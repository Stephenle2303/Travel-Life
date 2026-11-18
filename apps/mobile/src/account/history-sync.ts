import { createTransferJob, HistoryTransferError, sendTransferJob, type HistoryFailure, type HistoryStatus, type HistoryTransport, type TransferJob } from './history-transfer';
import type { HistoryRow } from './history-contract';
import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';

export type HistorySyncConfig={ownerId:string;accountGeneration:number;sourceId:string;sourceGeneration:number;enabled:boolean;lastDigest:string|null;attempts:number;nextAttemptAt:number;lastSuccessAt:number|null};
export type SyncTransferJob=TransferJob&{contentDigest?:string};
export class HistorySyncError extends HistoryTransferError{constructor(reason:HistoryFailure,readonly boundary:AppDiagnosticEvent['stage']){super(reason);}}
type Options={trigger:'foreground'|'background';now:()=>number;current:()=>boolean;stage:(stage:AppDiagnosticEvent['stage'])=>void;uuid:()=>string;claim:()=>Promise<boolean>;renew:()=>Promise<boolean>;release:()=>Promise<void>;cleanupFailed:()=>void;load:()=>Promise<SyncTransferJob|null>;checkpoint:(job:SyncTransferJob)=>Promise<void>;finish:(config:HistorySyncConfig,job:SyncTransferJob|null)=>Promise<void>;failed:(config:HistorySyncConfig)=>Promise<void>;status:()=>Promise<HistoryStatus>;permitted:()=>Promise<boolean>;exportRows:()=>Promise<readonly HistoryRow[]>;digest:(rows:readonly HistoryRow[])=>Promise<string>;transport:HistoryTransport;progress:(done:number,total:number)=>void};
/** One owner/source lease coordinates both OS and foreground resumptions. */
export async function runHistorySync(config:HistorySyncConfig,options:Options):Promise<'complete'|'unchanged'|'deferred'|'already-running'|'source-unavailable'>{
 let boundary:AppDiagnosticEvent['stage']='HISTORY_LEASE';
 const current=()=>{if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');};
 const step=async<T>(stage:AppDiagnosticEvent['stage'],work:()=>Promise<T>)=>{boundary=stage;options.stage(stage);current();const value=await work();current();return value;};
 if(!config.enabled)return 'deferred';
 if(options.trigger==='background'&&(config.attempts>=5||options.now()<config.nextAttemptAt))return 'deferred';
 if(!await step('HISTORY_LEASE',options.claim))return 'already-running';
 let originalFailure=false;
 const renew=async()=>{if(!await step('HISTORY_LEASE',options.renew))throw new HistoryTransferError('HISTORY_FENCED');};
 try{
  const live=await step('HISTORY_AUTH',options.status);const source=live.sources.find(item=>item.sourceId===config.sourceId);
  if(live.status!=='active'||live.generation!==config.accountGeneration)throw new HistoryTransferError('HISTORY_FENCED');
  if(!live.historyConsent)throw new HistoryTransferError('HISTORY_CONSENT');
  if(!source||source.state!=='active'||source.generation!==config.sourceGeneration)return 'source-unavailable';
  if(!await step('HISTORY_AUTH',options.permitted))return 'source-unavailable';
  let job=await step('HISTORY_STAGE',options.load);
  if(job&&(job.ownerId!==config.ownerId||job.generation!==config.accountGeneration||job.requests.some(request=>request.input.sourceId!==config.sourceId||request.input.sourceGeneration!==config.sourceGeneration)))throw new HistoryTransferError('HISTORY_FENCED');
  if(!job){
   const rows=await step('HISTORY_EXPORT',options.exportRows);const contentDigest=await step('HISTORY_EXPORT',()=>options.digest(rows));
   await renew();
   if(contentDigest===config.lastDigest){await step('HISTORY_STAGE',()=>options.finish({...config,attempts:0,nextAttemptAt:0},null));return 'unchanged';}
   if(!Number.isSafeInteger(source.sourceSnapshotRevision))throw new HistoryTransferError('HISTORY_SCHEMA');
   job={...createTransferJob({ownerId:config.ownerId,generation:config.accountGeneration,sourceId:config.sourceId,sourceGeneration:config.sourceGeneration,sourceSnapshotRevision:source.sourceSnapshotRevision,rows,uuid:options.uuid}),contentDigest};
  }
  const planned=job;
  await sendTransferJob(job,{current:options.current,transport:async request=>{
   await renew();if(!await step('HISTORY_AUTH',options.permitted))throw new HistoryTransferError('HISTORY_FENCED');
   const result=await step('HISTORY_ACK',()=>options.transport(request));await renew();return result;
  },checkpoint:async value=>{await renew();await step('HISTORY_STAGE',()=>options.checkpoint({...value,contentDigest:planned.contentDigest}));},progress:options.progress});
  await renew();
  await step('HISTORY_STAGE',()=>options.finish({...config,enabled:true,lastDigest:planned.contentDigest??null,attempts:0,nextAttemptAt:0,lastSuccessAt:options.now()},planned));
  return 'complete';
 }catch(error){
  originalFailure=true;
  if(options.current()&&error instanceof HistoryTransferError&&error.reason==='HISTORY_NETWORK'){
   const attempts=Math.min(5,config.attempts+1);
   try{await options.failed({...config,attempts,nextAttemptAt:options.now()+Math.min(3_600_000,60_000*2**(attempts-1))});}catch{options.cleanupFailed();}
  }
  throw error instanceof HistorySyncError?error:new HistorySyncError(error instanceof HistoryTransferError?error.reason:['HISTORY_LEASE','HISTORY_STAGE','HISTORY_EXPORT'].includes(String(boundary))?'HISTORY_STORAGE':'UNKNOWN',boundary);
 }finally{
  try{await options.release();}catch{if(originalFailure)options.cleanupFailed();else throw new HistorySyncError('HISTORY_STORAGE','HISTORY_LEASE');}
 }
}
