import * as Crypto from 'expo-crypto';
import { ensureNativeImportSchema } from '@/import-record/repository';
import { runOwnedTransaction, serializeNativeTransactions } from '@/database/native-transaction';
import { assertHistoryRow, HistoryContractError, historyLayouts, portableReplayJson, type HistoryRow } from './history-contract';
import { classifyAppDiagnosticError, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { HistorySyncError } from './history-sync';
import { HistoryTransferError, type HistoryFailure } from './history-transfer';
import { reclaimReplicaFiles, reserveReplicaFile, retireReplicaFile } from './history-store';
import { assertReplicaOpen, trackReplicaConnection } from './replica-connections';

type DB = {
  closeAsync?():Promise<void>;
  execAsync(sql:string):Promise<void>;
  runAsync(sql:string,...params:(string|number|null)[]):Promise<unknown>;
  getAllAsync<T>(sql:string,...params:(string|number|null)[]):Promise<T[]>;
  getFirstAsync<T>(sql:string,...params:(string|number|null)[]):Promise<T|null>;
};
async function open(name:string,stage?:(value:AppDiagnosticEvent['stage'])=>void):Promise<DB> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite=require('expo-sqlite') as {openDatabaseAsync(name:string,options:{useNewConnection:boolean}):Promise<DB>};
  stage?.('HISTORY_EXPORT_OPEN');assertReplicaOpen(name);const db=serializeNativeTransactions(trackReplicaConnection(name,await sqlite.openDatabaseAsync(name,{useNewConnection:true})));
  stage?.('HISTORY_EXPORT_SCHEMA');
  try{await ensureNativeImportSchema(db);return db;}catch(error){try{await db.closeAsync?.();}catch{/* Preserve the schema failure. */}throw error;}
}
const exportKinds={evidence:'EVIDENCE',overlay:'OVERLAY','journey-correction':'JOURNEY_CORRECTION','memory-correction':'MEMORY_CORRECTION',privacy:'PRIVACY',home:'HOME',manual:'MANUAL',replay:'REPLAY'} as const;
function exportFailure(error:unknown,boundary:AppDiagnosticEvent['stage']):HistorySyncError{
 if(error instanceof HistorySyncError)return error;
 if(boundary==='HISTORY_EXPORT_REPLAY_VALIDATE')boundary=`HISTORY_EXPORT_REPLAY_${error instanceof HistoryContractError?error.replayCategory??'ROW':'ROW'}`;
 let reason:HistoryFailure;
 if(error instanceof HistoryTransferError)reason=error.reason;
 else if(error instanceof HistoryContractError||String(boundary).endsWith('_VALIDATE'))reason='HISTORY_SCHEMA';
 else{const classified=classifyAppDiagnosticError(error);reason=classified==='SCHEMA'?'HISTORY_SCHEMA':['DATABASE_BUSY','NATIVE_HANDLE','TRANSACTION','CONSTRAINT','ROW_LIMIT'].includes(classified)?classified as HistoryFailure:'HISTORY_STORAGE';}
 return new HistorySyncError(reason,boundary);
}
/** A single consistent semantic read. No network call holds this native writer turn. */
export async function exportLocalHistory(databaseName='travel-life-import-v1.db',options:{stage?:(value:AppDiagnosticEvent['stage'])=>void; purpose?:'replica-readback'}={}):Promise<HistoryRow[]> {
  let boundary:AppDiagnosticEvent['stage']='HISTORY_EXPORT_OPEN';let db:DB|undefined;let failed=false;
  const stage=(value:AppDiagnosticEvent['stage'])=>{boundary=value;options.stage?.(value);};
  let failedReadBoundary:AppDiagnosticEvent['stage']='HISTORY_EXPORT_BEGIN';
  try{db=await open(databaseName,stage);stage('HISTORY_EXPORT_BEGIN');return await runOwnedTransaction(db,{kind:'foreground',mode:'read',onRollback:outcome=>{
    if(outcome==='start'){failedReadBoundary=boundary;stage('HISTORY_EXPORT_ROLLBACK');}
    else if(outcome==='complete')boundary=failedReadBoundary;
  }},async db=>{
    stage('HISTORY_EXPORT_LIFECYCLE');
    const lifecycle=await db.getFirstAsync<{state:string}>('select state from private_record_lifecycle where record_id=1');
    if(lifecycle?.state!=='connected') throw new HistoryTransferError('HISTORY_FENCED');
    if (options.purpose !== 'replica-readback') {
      stage('HISTORY_EXPORT_CANDIDATE_COMPATIBILITY');
      const reviewed = await db.getFirstAsync<{ present: number }>('SELECT 1 AS present FROM recognizable_candidate_rejection LIMIT 1');
      const visual = await db.getFirstAsync<{ present: number }>("SELECT 1 AS present FROM visual_place_review WHERE decision = 'confirmed' LIMIT 1");
      const recovery = await db.getFirstAsync<{ rule_version: string }>("SELECT rule_version FROM reconstruction_run WHERE status = 'complete' ORDER BY run_id DESC LIMIT 1");
      if (reviewed?.present === 1 || visual?.present === 1 || recovery?.rule_version === 'atlas-recovery-local-v1') throw new HistoryTransferError('HISTORY_VERSION_UNSUPPORTED', true);
    }
    const result:HistoryRow[]=[];
    for(const [kind,layout] of Object.entries(historyLayouts)) {
      const label=exportKinds[kind as keyof typeof exportKinds];stage(`HISTORY_EXPORT_${label}_READ`);
      const rows=await db.getAllAsync<Record<string,string|number|null>>(`select ${Object.keys(layout.fields).join(',')} from ${layout.table} order by ${layout.key}`);
      stage(`HISTORY_EXPORT_${label}_VALIDATE`);
      for(const original of rows) {
        const value={...original};
        if (kind === 'home' && value.origin === 'manual-pin' && options.purpose !== 'replica-readback') {
          // The current transfer protocol cannot negotiate reader compatibility.
          throw new HistoryTransferError('HISTORY_VERSION_UNSUPPORTED', true);
        }
        if(kind==='replay' && typeof value.committed_overrides_json==='string') value.committed_overrides_json=portableReplayJson(value.committed_overrides_json);
        const row={kind,key:String(value[layout.key]),value}; assertHistoryRow(row); result.push(row);
      }
    }
    stage('HISTORY_EXPORT_COMMIT');return result;
  });}catch(error){failed=true;throw exportFailure(error,boundary);}finally{
    if(db){if(!failed)stage('HISTORY_EXPORT_CLOSE');try{await db.closeAsync?.();}catch(error){if(!failed)throw exportFailure(error,'HISTORY_EXPORT_CLOSE');}}
  }
}

/** Restore into a NEW replica; never mutate the primary checkout's local history DB. */
export async function stageAccountReplica(rows:readonly HistoryRow[],options:{owner?:string;current?:()=>boolean}={}):Promise<string> {
  const keys=new Set<string>();
  for(const row of rows) { assertHistoryRow(row); const key=JSON.stringify([row.kind,row.key]); if(keys.has(key)) throw new Error('History snapshot has conflicting records.'); keys.add(key); }
  const name=`travel-life-account-${Crypto.randomUUID()}.db`;
  await reclaimReplicaFiles();await reserveReplicaFile(name,options.owner??null,options.current??(()=>true));
  try{
  const db=await open(name);
  try{await runOwnedTransaction(db,{kind:'foreground'},async db=>{
    for(const row of rows) {
      const layout=historyLayouts[row.kind]; const fields=Object.keys(layout.fields);
      await db.runAsync(`insert into ${layout.table} (${fields.join(',')}) values (${fields.map(()=>'?').join(',')})`,...fields.map(key=>row.value[key]));
    }
    await db.runAsync("update private_record_lifecycle set state='connected' where record_id=1");
  });}finally{await db.closeAsync?.();}
  return name;
  }catch(error){await retireReplicaFile(name);throw error;}
}
