import { collectAccountIdentityKeys, mergeAccountHistory, historyDomainSourceDigest,decodeHistoryRows,encodeHistoryRows,historyWireBytes } from './history-domain.js';
import { historyIdentityRequests,historyIdentityKey } from './history-identities.ts';
import { createHistoryDiagnostic, safeHistoryCorrelation } from './history-diagnostics.ts';
import { migrateLegacyHistory } from './legacy-history-runtime.ts';
import { resumeHistoryMerge } from './history-resumable.ts';

type JsonObject = Record<string, unknown>;
type WorkerIdentity = { owner: string; session: string };
type Backend = { rpc(name: string, args: JsonObject): PromiseLike<{ data: unknown; error: unknown }> };
type Options = {
  resumable?: boolean;
  configured?: boolean;
  backend: Backend;
  authenticate(token: string): Promise<WorkerIdentity | null>;
  sink(event: JsonObject): void;
  domain?: { collectAccountIdentityKeys: typeof collectAccountIdentityKeys; mergeAccountHistory: typeof mergeAccountHistory };
};
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const reasons = new Set(['ACCOUNT_SESSION','HISTORY_FENCED','HISTORY_CONSENT','HISTORY_SCHEMA','HISTORY_REVIEW','HISTORY_STALE','HISTORY_INCOMPLETE','HISTORY_CONFLICT','HISTORY_QUOTA','HISTORY_NETWORK']);
class WorkerFault extends Error { reason: string; constructor(reason: string) { super('Private history operation unavailable.'); this.reason=reason; } }
async function boundedInput(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new WorkerFault('HISTORY_SCHEMA');
  const chunks: Uint8Array[]=[]; let count=0;
  try {
    while (true) { const next=await reader.read(); if(next.done) break; count+=next.value.length; if(count>460000) { await reader.cancel(); throw new WorkerFault('HISTORY_SCHEMA'); } chunks.push(next.value); }
    const bytes=new Uint8Array(count); let offset=0; for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch(error) { if(error instanceof WorkerFault) throw error; throw new WorkerFault('HISTORY_SCHEMA'); }
}
export async function handleHistoryMerge(request: Request, options: Options): Promise<Response> {
  const correlationId=safeHistoryCorrelation(request.headers.get('x-travel-life-correlation'));
  const log=createHistoryDiagnostic(options.sink); let stage='HISTORY_AUTH'; let loggedStage=stage;
  const event=(reasonCode:string,durableOutcome:string)=>log({stage,reasonCode,durableOutcome,correlationId});
  const entering=(next:string)=>{ stage=next; if(loggedStage!==next) { loggedStage=next;event('START','unchanged'); } };
  const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','x-travel-life-correlation':correlationId}});
  event('START','unchanged');
  try {
    if(options.configured===false) { entering('HISTORY_CONFIG');throw new WorkerFault('HISTORY_UNAVAILABLE'); }
    if(request.method!=='POST' || request.headers.has('origin')) throw new WorkerFault('HISTORY_SCHEMA');
    const authorization=request.headers.get('authorization');
    if(!authorization?.startsWith('Bearer ') || authorization.length>16384) throw new WorkerFault('ACCOUNT_SESSION');
    const identity=await options.authenticate(authorization.slice(7));
    if(!identity || !uuid(identity.owner) || !uuid(identity.session)) throw new WorkerFault('ACCOUNT_SESSION');
    entering('HISTORY_SCHEMA');
    const input=await boundedInput(request);
    if(!object(input) || Object.keys(input).some(key=>!['operationId','legacy'].includes(key)) || !uuid(input.operationId)||input.legacy!==undefined&&!object(input.legacy)) throw new WorkerFault('HISTORY_SCHEMA');
    const rpc=async(action:string,payload:JsonObject,boundary='HISTORY_ACK'):Promise<JsonObject>=>{
      entering(boundary);
      if(request.signal.aborted) throw new WorkerFault('HISTORY_CANCELLED');
      let response;
      const checkpoint=action.startsWith('checkpoint-');
      try { response=await options.backend.rpc(checkpoint?'travel_life_history_checkpoint':action==='activate'&&payload.phase==='commit'?'travel_life_history_finalize_worker':'travel_life_history_worker',{verified_owner:identity.owner,verified_session:identity.session,action:checkpoint?action.slice('checkpoint-'.length):action,input:payload}); }
      catch { throw new WorkerFault('HISTORY_NETWORK'); }
      if(response.error) throw new WorkerFault('UNKNOWN');
      if(!object(response.data)) throw new WorkerFault('HISTORY_NETWORK');
      if(response.data.error) {
        const reason=reasons.has(String(response.data.error))?String(response.data.error):'UNKNOWN';
        if(reason==='ACCOUNT_SESSION') stage='HISTORY_AUTH';
        if(reason==='HISTORY_SCHEMA'&&!boundary.startsWith('HISTORY_ACTIVATE_')&&!boundary.startsWith('HISTORY_CHECKPOINT_')) stage='HISTORY_SCHEMA';
        throw new WorkerFault(reason);
      }
      return response.data;
    };
    if(input.legacy!==undefined){const result=await migrateLegacyHistory(input,rpc,entering);event(result.status==='conflict'?'HISTORY_CONFLICT':'COMPLETE',result.status==='conflict'?'blocked':'complete');return json(result);}
    if(options.resumable){
      const result=await resumeHistoryMerge(input.operationId,rpc,entering);
      if(result.status==='complete'&&(!uuid(result.aggregateId)||result.aggregateId!==input.operationId||!Number.isSafeInteger(result.aggregateRevision)||Number(result.aggregateRevision)<1||!Number.isSafeInteger(result.pages)||Number(result.pages)<1))throw new WorkerFault('HISTORY_NETWORK');
      event(result.status==='complete'?'COMPLETE':'CHECKPOINTED',result.status==='complete'?'complete':'unchanged');return json(result);
    }
    const plan=await rpc('plan',{operationId:input.operationId});
    if(plan.status==='complete') {
      if(!uuid(plan.aggregateId) || !Number.isSafeInteger(plan.aggregateRevision) || !Number.isSafeInteger(plan.pages)) throw new WorkerFault('HISTORY_NETWORK');
      event('COMPLETE','complete'); return json({status:'complete',aggregateId:plan.aggregateId,aggregateRevision:plan.aggregateRevision,pages:plan.pages});
    }
    if(!Number.isSafeInteger(plan.accountGeneration) || !Number.isSafeInteger(plan.expectedAccountRevision) || !Array.isArray(plan.sourcePlan) || plan.sourcePlan.length>100) throw new WorkerFault('HISTORY_NETWORK');
    const base={accountGeneration:plan.accountGeneration,expectedAccountRevision:plan.expectedAccountRevision,sourcePlan:plan.sourcePlan};
    const sources: {sourceId:string;rows:ReturnType<typeof decodeHistoryRows>;retainedOwnerFacts?:boolean}[]=[]; let totalBytes=0; let totalPages=0;
    for(const source of plan.sourcePlan) {
      if(!object(source) || !uuid(source.sourceId) || !uuid(source.snapshotId) || !Number.isInteger(source.pages) || Number(source.pages)<1 || Number(source.pages)>10000) throw new WorkerFault('HISTORY_NETWORK');
      if(source.retainedOwnerFacts!==undefined && (typeof source.retainedOwnerFacts!=='boolean' || source.retainedOwnerFacts && source.state!=='removed')) throw new WorkerFault('HISTORY_SCHEMA');
      totalPages+=Number(source.pages); if(totalPages>10000) throw new WorkerFault('HISTORY_QUOTA');
      const rows:unknown[]=[];
      for(let page=0;page<Number(source.pages);page++) {
        const data=await rpc('page',{...base,snapshotId:source.snapshotId,page});
        if(!Array.isArray(data.records) || data.records.length>100) throw new WorkerFault('HISTORY_NETWORK');
        totalBytes+=historyWireBytes(JSON.stringify(data.records));
        if(totalBytes>67108864) throw new WorkerFault('HISTORY_QUOTA');
        rows.push(...data.records);
      }
      entering('HISTORY_SCHEMA');sources.push({sourceId:source.sourceId,rows:decodeHistoryRows(rows),...(source.retainedOwnerFacts?{retainedOwnerFacts:true}:{})});
    }
    entering('HISTORY_REBUILD');
    const domain=options.domain??{collectAccountIdentityKeys,mergeAccountHistory};
    const keys=domain.collectAccountIdentityKeys(sources);
    const allocated=new Map<string,string>();
    for(let index=0;index<keys.length;index+=100) {
      const batch=keys.slice(index,index+100);
      const requests=await historyIdentityRequests(batch);
      const response=await rpc('map-identities',{...base,keys:requests.map(request=>request.wire)});
      if(!Array.isArray(response.mappings) || response.mappings.length!==batch.length) throw new WorkerFault('HISTORY_NETWORK');
      for(const mapping of response.mappings) {
        if(!object(mapping)||!uuid(mapping.accountId))throw new WorkerFault('HISTORY_NETWORK');
        const matched=requests.find(request=>historyIdentityKey(request.wire)===historyIdentityKey(mapping as unknown as Parameters<typeof historyIdentityKey>[0]));if(!matched)throw new WorkerFault('HISTORY_NETWORK');
        allocated.set(JSON.stringify([matched.original.sourceId,matched.original.kind,matched.original.localId]),mapping.accountId);
      }
    }
    entering('HISTORY_REBUILD');
    const merged=await domain.mergeAccountHistory(sources,{
      profile:entering,
      mapIdentity:(sourceId:string,kind:string,localId:string)=>{const value=allocated.get(JSON.stringify([sourceId,kind,localId]));if(!value) throw new WorkerFault('HISTORY_SCHEMA');return value;},
      verifiedDuplicates:[],
      ...(object(plan.ownerChanges)?{accountOwnerChanges:plan.ownerChanges as unknown as NonNullable<Parameters<typeof mergeAccountHistory>[1]['accountOwnerChanges']>}:{}),
      ...(typeof plan.preferredReplaySourceId==='string'?{preferredReplaySourceId:plan.preferredReplaySourceId}:{}),
    });
    if(merged.review.length) {
      if(merged.review.some(item=>item.reason==='duplicate-metadata-conflict')) entering('HISTORY_REVIEW_DUPLICATE');
      else if(merged.review.some(item=>item.reason==='correction-needs-review'&&item.sourceId!==undefined)) entering('HISTORY_REVIEW_RETAINED_SOURCE');
      else if(merged.review.some(item=>item.reason==='correction-needs-review'&&item.revisionId!==undefined)) entering('HISTORY_REVIEW_CORRECTION_REMAP');
      else if(merged.review.some(item=>item.reason==='correction-needs-review')) entering('HISTORY_REVIEW_CORRECTION');
      else if(stage!=='HISTORY_REPLAY_GROUP_ABSENT'&&stage!=='HISTORY_REPLAY_GROUP_TARGET') entering('HISTORY_REVIEW_REPLAY_GROUP');
      throw new WorkerFault('HISTORY_REVIEW');
    }
    // Metadata stays private and immutable alongside the semantic pages. It is never logged.
    entering('HISTORY_METADATA');
    let metadata:Record<string,unknown>={metadataVersion:2,graphSummary:{journeys:merged.projection.graph.journeys.length,visits:merged.projection.graph.visits.length},replaySummary:{selected:!!merged.replay,pendingCount:merged.pendingReplay.length},sourceCopies:merged.sourceCopies,review:merged.review,privacy:merged.privacy,domainSourceDigest:historyDomainSourceDigest,ownerRevision:Number.isSafeInteger(plan.ownerRevision)?plan.ownerRevision:0};
    if(historyWireBytes(JSON.stringify(metadata))>400000) {
      metadata={...metadata,metadataVersion:3,sourceCopiesFromPlan:true};
      delete metadata.sourceCopies;
    }
    if(historyWireBytes(JSON.stringify(metadata))>400000) throw new WorkerFault('HISTORY_QUOTA');
    const pages:unknown[][]=[[]]; let bytes=2;
    for(const row of encodeHistoryRows(merged.rows)) {
      const size=historyWireBytes(JSON.stringify(row))+1;
      if(size>400000) throw new WorkerFault('HISTORY_QUOTA');
      if(pages.at(-1)!.length>=100 || bytes+size>400000) { pages.push([]);bytes=2; }
      pages.at(-1)!.push(row);bytes+=size;
    }
    const activation={...base,operationId:input.operationId};
    entering('HISTORY_ACTIVATE');
    await rpc('activate',{...activation,phase:'start',pages:pages.length,metadata,engineVersion:'reconstruction-v1/trip-detector-v1.1'},'HISTORY_ACTIVATE_START');
    for(let page=0;page<pages.length;page++) await rpc('activate',{...activation,phase:'page',page,records:pages[page]},'HISTORY_ACTIVATE_PAGE');
    const result=await rpc('activate',{...activation,phase:'commit'},'HISTORY_ACTIVATE_COMMIT');
    if(result.status!=='complete' || !uuid(result.aggregateId) || !Number.isSafeInteger(result.aggregateRevision)) throw new WorkerFault('HISTORY_NETWORK');
    event('COMPLETE','complete');return json({status:'complete',aggregateId:result.aggregateId,aggregateRevision:result.aggregateRevision,pages:pages.length});
  } catch(error) {
    // Domain errors carry closed codes only; no exception message/stack crosses this boundary.
    const domainCode=object(error)?error.code:undefined;
    const reason=error instanceof WorkerFault?error.reason:reasons.has(String(domainCode))?String(domainCode):'UNKNOWN';
    const outcome=reason==='HISTORY_STALE'||reason==='HISTORY_CANCELLED'?'skipped':reason==='HISTORY_NETWORK'||reason==='UNKNOWN'?'unknown':'blocked';
    event(reason,outcome);
    return json({status:outcome,error:reason},reason==='ACCOUNT_SESSION'?401:reason==='HISTORY_NETWORK'||reason==='UNKNOWN'?503:409);
  }
}
