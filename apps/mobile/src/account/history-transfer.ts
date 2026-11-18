import type { HistoryRow } from './history-contract';
import type { AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { assertHistoryRow, HistoryContractError } from './history-contract';
import { assertHistoryWireRow, decodeHistoryRows, encodeHistoryRows, HistoryWireError, historyWireBytes, HISTORY_TRANSFER_BYTES } from './history-wire';

export type HistoryFailure = 'ACCESS' | 'ACCOUNT_SESSION' | 'ACCOUNT_REAUTH' | 'HISTORY_SCHEMA' | 'HISTORY_VERSION_UNSUPPORTED' | 'HISTORY_FENCED' | 'HISTORY_CONSENT' | 'HISTORY_CONFLICT' | 'HISTORY_QUOTA' | 'HISTORY_STALE' | 'HISTORY_INCOMPLETE' | 'HISTORY_NETWORK' | 'HISTORY_READ_TIMEOUT' | 'HISTORY_STORAGE' | 'HISTORY_REVIEW' | 'UNKNOWN' | 'DATABASE_BUSY' | 'NATIVE_HANDLE' | 'TRANSACTION' | 'CONSTRAINT' | 'ROW_LIMIT';
export class HistoryTransferError extends Error {
  constructor(readonly reason: HistoryFailure, readonly definitive = false,readonly boundary?:AppDiagnosticEvent['stage']) { super('Private history transfer did not finish.'); this.name='HistoryTransferError'; }
}
export async function publishCurrentHistoryStatus<T>(load:()=>Promise<T>,current:()=>boolean,publish:(value:T)=>void):Promise<void> {
  const value=await load();
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  publish(value);
}
export async function currentHistoryStep<T>(current:()=>boolean,work:()=>Promise<T>):Promise<T> {
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  const value=await work();
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  return value;
}
export function classifyHistoryFailure(error:unknown):HistoryFailure|'UNKNOWN' {
  if(error instanceof HistoryTransferError)return error.reason;
  if(error instanceof HistoryContractError)return 'HISTORY_SCHEMA';
  return 'UNKNOWN';
}
export type HistoryRequest = { action:string; input:Record<string,unknown> };
export type HistoryResponse = Record<string,unknown>;
export type SourceCoverage={acceptedMetadata:number;observedStart:string|null;observedEnd:string|null;acknowledgedMedia:number;pendingMedia:number};
export type HistoryStatus = { generation:number;revision:number;historyConsent:boolean;mediaConsent:boolean;activeSnapshot:string|null;activeAggregate?:string|null;aggregateRevision?:number;pendingMerge?:boolean;ownerPending?:boolean;ownerRevision?:number;correctionConflicts?:number;sources:readonly {sourceId:string;generation:number;state:string;lastUpdatedAt:string|null;sourceSnapshotRevision?:number;coverage?:SourceCoverage}[];status:'active'|'deleted' };
const failures: readonly string[]=['ACCOUNT_SESSION','ACCOUNT_REAUTH','HISTORY_SCHEMA','HISTORY_FENCED','HISTORY_CONSENT','HISTORY_CONFLICT','HISTORY_QUOTA','HISTORY_STALE','HISTORY_INCOMPLETE','HISTORY_REVIEW'];
export type HistoryTransport = (request:HistoryRequest)=>Promise<HistoryResponse>;
/** Replays the exact durable mutation after unknown acknowledgement; no new UUID. */
export async function runHistoryControl(options:{current:()=>boolean;load:()=>Promise<HistoryRequest|null>;create:()=>HistoryRequest;save:(request:HistoryRequest)=>Promise<void>;send:HistoryTransport;refresh:()=>Promise<void>;clear:(id:string)=>Promise<void>;matches:(request:HistoryRequest)=>boolean}):Promise<HistoryResponse> {
  if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
  const pending=await options.load();
  if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
  if(pending&&!options.matches(pending))throw new HistoryTransferError('HISTORY_CONFLICT');
  const request=pending??options.create();
  await options.save(request);
  if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
  let result:HistoryResponse;
  try{result=await options.send(request);}
  catch(error){
    if(options.current()&&error instanceof HistoryTransferError&&error.definitive&&['HISTORY_CONFLICT','HISTORY_STALE','HISTORY_FENCED','HISTORY_CONSENT','HISTORY_SCHEMA','HISTORY_QUOTA','ACCOUNT_SESSION','ACCOUNT_REAUTH'].includes(error.reason))await options.clear(String(request.input.mutationId));
    throw error;
  }
  if(result.status!=='complete')throw new HistoryTransferError('HISTORY_NETWORK');
  if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
  await options.refresh();
  if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
  await options.clear(String(request.input.mutationId));
  return result;
}
export type SourceReview = {sourceId:string;revision:number;archived:boolean;page:number;pages:number;rows:readonly HistoryRow[]};
export function sourceReviewResponse(sourceId:string,page:number,response:HistoryResponse):SourceReview {
  if(response.status!=='complete'||response.page!==page||!Number.isSafeInteger(response.pages)||Number(response.pages)<1||Number(response.pages)>10000||page>=Number(response.pages)||!Number.isSafeInteger(response.sourceSnapshotRevision)||Number(response.sourceSnapshotRevision)<1||typeof response.archived!=='boolean'||!Array.isArray(response.records)||response.records.length>100)throw new HistoryTransferError('HISTORY_SCHEMA');
  for(const row of response.records){assertHistoryRow(row);if(row.kind==='evidence')throw new HistoryTransferError('HISTORY_SCHEMA');}
  return {sourceId,revision:Number(response.sourceSnapshotRevision),archived:response.archived,page,pages:Number(response.pages),rows:response.records};
}
export type HistoryRequestFence = {owner:string;current:()=>boolean};
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function createMergeTransport(config:{url?:string;key?:string;session:(correlationId?:string)=>Promise<{accessToken:string;ownerId?:string}|null>;fetcher?:typeof fetch;fence?:HistoryRequestFence;correlationId?:string}) {
  const sendRequest=async (operationId:string,legacy?:Record<string,unknown>):Promise<HistoryResponse>=>{
    if(!uuidPattern.test(operationId))throw new HistoryTransferError('HISTORY_SCHEMA');
    if(!config.url||!/^https:\/\/[^/]+$/.test(config.url)||!config.key)throw new HistoryTransferError('HISTORY_NETWORK');
    if(config.fence&&!config.fence.current())throw new HistoryTransferError('HISTORY_FENCED');
    const session=await config.session(config.correlationId);
    if(!session)throw new HistoryTransferError(config.fence?(config.fence.current()?'HISTORY_NETWORK':'HISTORY_FENCED'):'ACCOUNT_SESSION');
    if(config.fence&&(!config.fence.current()||session.ownerId!==config.fence.owner))throw new HistoryTransferError('HISTORY_FENCED');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120_000);
    try {
      const response=await (config.fetcher??fetch)(`${config.url}/functions/v1/travel-life-history-merge`,{method:'POST',signal:controller.signal,headers:{apikey:config.key,authorization:`Bearer ${session.accessToken}`,'content-type':'application/json',...(config.correlationId?{'x-travel-life-correlation':config.correlationId}:{})},body:JSON.stringify({operationId,...(legacy?{legacy}:{})})});
      const value:unknown=await response.json();
      if(config.fence&&!config.fence.current())throw new HistoryTransferError('HISTORY_FENCED');
      if(!value||typeof value!=='object'||Array.isArray(value))throw new HistoryTransferError('HISTORY_NETWORK');
      const result=value as HistoryResponse;
      if(typeof result.error==='string')throw new HistoryTransferError(failures.includes(result.error)?result.error as HistoryFailure:'HISTORY_NETWORK');
      if(!response.ok)throw new HistoryTransferError(response.status===401||response.status===403?'ACCOUNT_SESSION':'HISTORY_NETWORK');
      if(legacy){if(!['accepted','conflict'].includes(String(result.status))||!Number.isSafeInteger(result.ownerRevision)||Number(result.ownerRevision)<(result.status==='accepted'?1:0))throw new HistoryTransferError('HISTORY_NETWORK');}
      else if(result.status==='progress'){
        if(Object.keys(result).sort().join(',')!=='operationId,status'||result.operationId!==operationId)throw new HistoryTransferError('HISTORY_NETWORK');
      }else if(result.status!=='complete'||result.aggregateId!==operationId||!Number.isSafeInteger(result.aggregateRevision)||Number(result.aggregateRevision)<1||!Number.isSafeInteger(result.pages)||Number(result.pages)<1)throw new HistoryTransferError('HISTORY_NETWORK');
      return result;
    } catch(error){if(config.fence&&!config.fence.current())throw new HistoryTransferError('HISTORY_FENCED');if(error instanceof HistoryTransferError)throw error;throw new HistoryTransferError('HISTORY_NETWORK');}
    finally{clearTimeout(timer);}
  };
  const send=async(operationId:string,legacy?:Record<string,unknown>):Promise<HistoryResponse>=>{
    // Progress acknowledges a durable server phase, never the whole merge.
    // Bound a faulty/stalled server while retaining the same operation for retry.
    for(let request=0;request<16;request++){
      const result=await sendRequest(operationId,legacy);
      if(result.status!=='progress')return result;
    }
    throw new HistoryTransferError('HISTORY_NETWORK');
  };
  return Object.assign(async(operationId:string):Promise<void>=>{await send(operationId);},{legacy:(operationId:string,input:Record<string,unknown>)=>send(operationId,input)});
}
export async function runMergeJob(options:{current:()=>boolean;load:()=>Promise<string>;send:(id:string)=>Promise<void>;refresh:()=>Promise<void>;clear:(id:string)=>Promise<void>}):Promise<void> {
  for(let attempt=0;attempt<2;attempt++){
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    const id=await options.load();
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    try {await options.send(id);}
    catch(error){
      if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
      // Only an explicit stale rejection retires this operation. Unknown
      // acknowledgement must retry its exact ID, never allocate another one.
      if(error instanceof HistoryTransferError&&error.reason==='HISTORY_STALE'){
        await options.clear(id);
        if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
        if(attempt===0)continue;
      }
      throw error;
    }
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    await options.refresh();
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    await options.clear(id);
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    return;
  }
}
export function createHistoryTransport(config:{url?:string;key?:string;session:(correlationId?:string)=>Promise<{accessToken:string;ownerId?:string}|null>;fetcher?:typeof fetch;fence?:HistoryRequestFence;correlationId?:string}):HistoryTransport {
  return async request=>{
    const mediaMapping=request.action==='source-media';
    const boundary=(stage:AppDiagnosticEvent['stage'])=>mediaMapping?stage:undefined;
    const checkCurrent=(stage:AppDiagnosticEvent['stage'])=>{if(mediaMapping&&config.fence&&!config.fence.current())throw new HistoryTransferError('HISTORY_FENCED',false,stage);};
    checkCurrent('MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE');
    if(!config.url || !/^https:\/\/[^/]+$/.test(config.url) || !config.key) throw new HistoryTransferError('HISTORY_NETWORK',false,boundary('MEDIA_REPLAY_MAPPING_CONFIG'));
    let session:Awaited<ReturnType<typeof config.session>>;
    try{
      session=await config.session(config.correlationId);
      checkCurrent('MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE');
      // One transient verification failure may recover while the initiating
      // owner remains current. Always obtain a fresh verified session.
      if(mediaMapping&&!session&&config.fence?.current()){
        session=await config.session(config.correlationId);
        checkCurrent('MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE');
      }
    }
    catch(error){if(!mediaMapping)throw error;checkCurrent('MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE');if(error instanceof HistoryTransferError&&error.reason==='HISTORY_FENCED')throw error;throw new HistoryTransferError('HISTORY_NETWORK',false,'MEDIA_REPLAY_MAPPING_SESSION_READ');}
    if(!session)throw new HistoryTransferError(config.fence?(config.fence.current()?'HISTORY_NETWORK':'HISTORY_FENCED'):'ACCOUNT_SESSION',false,boundary('MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE'));
    if(config.fence&&(!config.fence.current()||session.ownerId!==config.fence.owner))throw new HistoryTransferError('HISTORY_FENCED',false,boundary('MEDIA_REPLAY_MAPPING_SESSION_UNAVAILABLE'));
    const finalizing=request.action==='activate';
    const aggregateRead=request.action==='pull'&&typeof request.input.aggregateId==='string';
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),finalizing||aggregateRead?65_000:30_000);
    let stage=boundary('MEDIA_REPLAY_MAPPING_REQUEST');
    try {
      const response=await (config.fetcher??fetch)(`${config.url}/rest/v1/rpc/${finalizing?'travel_life_history_finalize':aggregateRead?'travel_life_history_read':'travel_life_history'}`,{method:'POST',signal:controller.signal,headers:{apikey:config.key,authorization:`Bearer ${session.accessToken}`,'content-type':'application/json',...(config.correlationId?{'x-travel-life-correlation':config.correlationId}:{})},body:JSON.stringify(request)});
      checkCurrent('MEDIA_REPLAY_MAPPING_REQUEST');
      if(mediaMapping&&response.status===401)throw new HistoryTransferError('ACCOUNT_SESSION',false,'MEDIA_REPLAY_MAPPING_HTTP_AUTH');
      if(mediaMapping&&response.status===403)throw new HistoryTransferError('ACCESS',false,'MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN');
      const retryResponse=mediaMapping&&(response.status===429||response.status>=500);
      stage=boundary(retryResponse?'MEDIA_REPLAY_MAPPING_HTTP_RETRY':'MEDIA_REPLAY_MAPPING_RESPONSE_JSON');
      const value:unknown=await response.json();
      checkCurrent(stage??null);
      if(!value || typeof value!=='object' || Array.isArray(value)) throw new HistoryTransferError(retryResponse?'HISTORY_NETWORK':'HISTORY_SCHEMA',false,boundary(retryResponse?'MEDIA_REPLAY_MAPPING_HTTP_RETRY':'MEDIA_REPLAY_MAPPING_RESPONSE_SHAPE'));
      const result=value as HistoryResponse;
      if(mediaMapping&&(result.code==='57014'||result.error==='HISTORY_READ_TIMEOUT'))throw new HistoryTransferError('HISTORY_READ_TIMEOUT',false,'MEDIA_REPLAY_MAPPING_SQL_TIMEOUT');
      if(retryResponse)throw new HistoryTransferError('HISTORY_NETWORK',false,'MEDIA_REPLAY_MAPPING_HTTP_RETRY');
      if(request.action==='pull'&&typeof request.input.aggregateId==='string'&&(result.code==='57014'||result.error==='HISTORY_READ_TIMEOUT'))throw new HistoryTransferError('HISTORY_READ_TIMEOUT');
      if(typeof result.error==='string') throw new HistoryTransferError(failures.includes(result.error)?result.error as HistoryFailure:'HISTORY_SCHEMA',failures.includes(result.error),boundary('MEDIA_REPLAY_MAPPING_RESPONSE_ERROR'));
      if(!response.ok) throw new HistoryTransferError(response.status===401||response.status===403?'ACCOUNT_SESSION':'HISTORY_NETWORK',false,boundary(response.status===429||response.status>=500?'MEDIA_REPLAY_MAPPING_HTTP_RETRY':'MEDIA_REPLAY_MAPPING_HTTP_REJECT'));
      return result;
    } catch(error) {checkCurrent(stage??null);if(mediaMapping&&controller.signal.aborted)throw new HistoryTransferError('HISTORY_READ_TIMEOUT',false,'MEDIA_REPLAY_MAPPING_DEADLINE');if(error instanceof HistoryTransferError) throw error;throw new HistoryTransferError('HISTORY_NETWORK',false,stage); }
    finally {clearTimeout(timer);}
  };
}
export function historyStatus(value:HistoryResponse):HistoryStatus {
  if(value.pendingMerge!==undefined&&typeof value.pendingMerge!=='boolean')throw new HistoryTransferError('HISTORY_SCHEMA');
  if(value.ownerPending!==undefined&&typeof value.ownerPending!=='boolean')throw new HistoryTransferError('HISTORY_SCHEMA');
  for(const field of ['ownerRevision','correctionConflicts'])if(value[field]!==undefined&&(!Number.isSafeInteger(value[field])||Number(value[field])<0))throw new HistoryTransferError('HISTORY_SCHEMA');
  const positive=(input:unknown)=>Number.isSafeInteger(input)&&Number(input)>0;
  if(!positive(value.generation)||!Number.isSafeInteger(value.revision)||Number(value.revision)<0||typeof value.historyConsent!=='boolean'||typeof value.mediaConsent!=='boolean'||!['active','deleted'].includes(String(value.status))||value.activeSnapshot!==null&&!uuidPattern.test(String(value.activeSnapshot))||!Array.isArray(value.sources)) throw new HistoryTransferError('HISTORY_SCHEMA');
  const ids=new Set<string>();
  for(const item of value.sources) {
    if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.sourceId!=='string'||!uuidPattern.test(item.sourceId)||ids.has(item.sourceId)||!positive(item.generation)||!['active','paused','disconnected','removed'].includes(item.state)||item.lastUpdatedAt!==null&&typeof item.lastUpdatedAt!=='string'||item.sourceSnapshotRevision!==undefined&&(!Number.isSafeInteger(item.sourceSnapshotRevision)||item.sourceSnapshotRevision<0))throw new HistoryTransferError('HISTORY_SCHEMA');
    ids.add(item.sourceId);
    if(item.coverage!==undefined){const coverage=item.coverage;
      if(!coverage||typeof coverage!=='object'||Array.isArray(coverage)||Object.keys(coverage).length!==5||!['acceptedMetadata','acknowledgedMedia','pendingMedia'].every(key=>Number.isSafeInteger(coverage[key])&&coverage[key]>=0)||!['observedStart','observedEnd'].every(key=>coverage[key]===null||typeof coverage[key]==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(coverage[key])))throw new HistoryTransferError('HISTORY_SCHEMA');
    }
  }
  if(value.activeAggregate!==undefined&&value.activeAggregate!==null&&(!uuidPattern.test(String(value.activeAggregate))||!positive(value.aggregateRevision)||!positive(value.aggregatePages)||Number(value.aggregatePages)>10000))throw new HistoryTransferError('HISTORY_SCHEMA');
  if(value.aggregateRevision!==undefined&&(!Number.isSafeInteger(value.aggregateRevision)||Number(value.aggregateRevision)<0))throw new HistoryTransferError('HISTORY_SCHEMA');
  if(value.aggregatePages!==undefined&&value.aggregatePages!==null&&(!positive(value.aggregatePages)||Number(value.aggregatePages)>10000))throw new HistoryTransferError('HISTORY_SCHEMA');
  return value as HistoryStatus;
}
export type TransferJob = {ownerId:string;snapshotId:string;requests:HistoryRequest[];next:number;generation:number};
export function createTransferJob(input:{ownerId:string;generation:number;sourceId:string;sourceGeneration:number;sourceSnapshotRevision?:number;rows:readonly HistoryRow[];uuid:()=>string}):TransferJob {
  const pages:HistoryRow[][]=[]; let page:HistoryRow[]=[]; let bytes=0;
  let encoded:HistoryRow[];try{encoded=encodeHistoryRows(input.rows);}catch(error){if(error instanceof HistoryWireError)throw new HistoryTransferError(error.code);throw error;}
  for(const row of encoded) {
    // Worst-case UTF-8 bytes bound; leave envelope headroom under server cap.
    const size=historyWireBytes(JSON.stringify(row));
    if(size>450000) throw new HistoryTransferError('HISTORY_QUOTA');
    if(page.length && (page.length>=100||bytes+size>450000)) {pages.push(page);page=[];bytes=0;}
    page.push(row);bytes+=size;
  }
  if(page.length||!pages.length) pages.push(page);
  if(pages.length>10000)throw new HistoryTransferError('HISTORY_QUOTA');
  const snapshotId=input.uuid(); const common={generation:input.generation,sourceId:input.sourceId,sourceGeneration:input.sourceGeneration,snapshotId};
  const requests:HistoryRequest[]=[{action:'begin',input:{...common,mutationId:input.uuid(),pages:pages.length,schemaVersion:37,sourceSnapshotRevision:input.sourceSnapshotRevision??0}},...pages.map((records,index)=>({action:'page',input:{...common,mutationId:input.uuid(),page:index,records}})),{action:'activate',input:{...common,mutationId:input.uuid()}}];
  return {ownerId:input.ownerId,snapshotId,requests,next:0,generation:input.generation};
}
export async function sendTransferJob(job:TransferJob,options:{transport:HistoryTransport;checkpoint:(job:TransferJob)=>Promise<void>;current:()=>boolean;progress:(done:number,total:number)=>void}) {
  let current=job;
  // Caller persists the full stable plan before any request; checkpoints never change IDs.
  if(!options.current()) throw new HistoryTransferError('HISTORY_FENCED');
  await options.checkpoint(current);
  if(!options.current()) throw new HistoryTransferError('HISTORY_FENCED');
  let result:HistoryResponse={};
  if(current.next===current.requests.length) {
    if(!options.current()) throw new HistoryTransferError('HISTORY_FENCED');
    const response=await options.transport(current.requests[current.requests.length-1]);
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    return response;
  }
  while(current.next<current.requests.length) {
    if(!options.current()) throw new HistoryTransferError('HISTORY_FENCED');
    const request=current.requests[current.next];
    result=await options.transport(request);
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    const expected=request.action==='begin'?['staging']:request.action==='activate'?['initial','pending']:['complete'];
    if(!expected.includes(String(result.status))) throw new HistoryTransferError('HISTORY_SCHEMA');
    current={...current,next:current.next+1};
    await options.checkpoint(current);
    if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');
    options.progress(current.next,current.requests.length);
  }
  return result;
}

export async function fetchHistorySnapshot(snapshotId:string,transport:HistoryTransport,current:()=>boolean,aggregate=false,onProgress?:(done:number,total:number)=>void):Promise<HistoryRow[]> {
  const rows:HistoryRow[]=[]; let pages=1;let totalBytes=0;
  for(let page=0;page<pages;page++) {
    if(!current()) throw new HistoryTransferError('HISTORY_FENCED');
    const response=await transport({action:'pull',input:{...(aggregate?{aggregateId:snapshotId}:{snapshotId}),page}});
    if(!current())throw new HistoryTransferError('HISTORY_FENCED');
    if((aggregate?response.aggregateId:response.snapshotId)!==snapshotId||response.page!==page||!Number.isInteger(response.pages)||Number(response.pages)<1||Number(response.pages)>10000||response.schemaVersion!==37||!Array.isArray(response.records)||response.records.length>100) throw new HistoryTransferError('HISTORY_SCHEMA');
    if(page>0&&response.pages!==pages) throw new HistoryTransferError('HISTORY_STALE');
    pages=Number(response.pages);
    for(const row of response.records) {assertHistoryWireRow(row);totalBytes+=historyWireBytes(JSON.stringify(row))+1;if(totalBytes>HISTORY_TRANSFER_BYTES)throw new HistoryTransferError('HISTORY_QUOTA');rows.push(row);}
    onProgress?.(page+1,pages);
  }
  try{return decodeHistoryRows(rows);}catch(error){if(error instanceof HistoryWireError)throw new HistoryTransferError(error.code);throw error;}
}
