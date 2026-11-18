import type { HistoryRow } from './history-contract';
import { ownerChanges, type OwnerChanges } from './correction-journal';
import { HistoryTransferError, type HistoryRequest, type HistoryTransport } from './history-transfer';
import { HistoryContractError } from './history-contract';
import { HistorySyncError } from './history-sync';
import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
export type CorrectionJob={owner:string;mutationId:string;generation:number;baseAggregate:string;expectedOwnerRevision:number;changes:OwnerChanges;currentRows:readonly HistoryRow[];conflict:boolean;resolved?:'accepted'|'proposed';resolutionRevision?:number;legacy?:{buildId:string;baselineDigest:string;editedDigest:string};acceptedRevision?:number};
type Options={owner:string;generation:number;current:()=>boolean;uuid:()=>string;stage:(value:AppDiagnosticEvent['stage'])=>void;load:()=>Promise<CorrectionJob|null>;baseline:()=>Promise<{snapshotId:string;revision:number;rows:readonly HistoryRow[];canonical?:boolean}|null>;rows:()=>Promise<readonly HistoryRow[]>;save:(job:CorrectionJob)=>Promise<void>;accepted:(job:CorrectionJob,revision:number)=>Promise<void>;send:HistoryTransport;digest?:(rows:readonly HistoryRow[])=>Promise<string>;migrate?:(job:CorrectionJob)=>Promise<Record<string,unknown>>};
export async function syncOwnerCorrections(options:Options):Promise<boolean>{
 let boundary:AppDiagnosticEvent['stage']='HISTORY_STAGE';
 const stage=(value:AppDiagnosticEvent['stage'])=>{boundary=value;options.stage(value);};
 try{
 const check=()=>{if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');};
 stage('HISTORY_STAGE');check();let job=await options.load();check();
 if(job&&(job.owner!==options.owner||job.generation!==options.generation))throw new HistoryTransferError('HISTORY_FENCED');
 // Resolution is not a local replica acknowledgement. Keep its immutable rows
 // until an authoritative pull, and never propose the rejected branch again.
 if(job?.resolved||job?.acceptedRevision!==undefined)return true;
 if(job?.conflict)throw new HistoryTransferError('HISTORY_CONFLICT');
 if(!job){
  stage('HISTORY_READ');const baseline=await options.baseline();check();if(!baseline)return false;
  const rows=await options.rows();check();const changes=ownerChanges(baseline.rows,rows);if(!changes.rows.length&&!changes.deleted.length)return false;
  if(baseline.canonical===false&&(!options.migrate||!options.digest))throw new HistoryTransferError('HISTORY_REVIEW');
  job={owner:options.owner,mutationId:options.uuid(),generation:options.generation,baseAggregate:baseline.snapshotId,expectedOwnerRevision:baseline.revision,changes,currentRows:rows,conflict:false};
  if(baseline.canonical===false){job.legacy={buildId:options.uuid(),baselineDigest:await options.digest!(baseline.rows),editedDigest:await options.digest!(rows)};check();}
 }
 if(job.owner!==options.owner||job.generation!==options.generation)throw new HistoryTransferError('HISTORY_FENCED');
 stage('HISTORY_STAGE');await options.save(job);check();
 stage('HISTORY_CORRECTION');
 const request:HistoryRequest={action:'correction-propose',input:{mutationId:job.mutationId,generation:job.generation,baseAggregate:job.baseAggregate,expectedOwnerRevision:job.expectedOwnerRevision,changes:job.changes}};
 const result=job.legacy?await (options.migrate?options.migrate(job):Promise.reject(new HistoryTransferError('HISTORY_REVIEW'))):await options.send(request);check();
 if(!['accepted','conflict'].includes(String(result.status))||!Number.isSafeInteger(result.ownerRevision)||Number(result.ownerRevision)<0)throw new HistoryTransferError('HISTORY_NETWORK');
 stage('HISTORY_STAGE');
 if(result.status==='conflict'){await options.save({...job,conflict:true});check();throw new HistoryTransferError('HISTORY_CONFLICT');}
 await options.accepted(job,Number(result.ownerRevision));check();return true;
 }catch(error){
  if(error instanceof HistorySyncError)throw error;
  throw new HistorySyncError(error instanceof HistoryTransferError?error.reason:error instanceof HistoryContractError?'HISTORY_SCHEMA':String(boundary)==='HISTORY_CORRECTION'?'HISTORY_NETWORK':'HISTORY_STORAGE',boundary);
 }
}
