import {collectAccountIdentityKeys,prepareAccountHistory,mergePreparedAccountHistory,historyDomainSourceDigest,decodeHistoryRows,encodeHistoryRows,historyWireBytes,applyOwnerChanges} from './history-domain.js';
import {historyIdentityRequests,historyIdentityKey} from './history-identities.ts';

type Json=Record<string,unknown>;
type Rpc=(action:string,input:Json,boundary?:string)=>Promise<Json>;
const object=(value:unknown):value is Json=>!!value&&typeof value==='object'&&!Array.isArray(value);
function fail(code='HISTORY_SCHEMA'):never{throw Object.assign(new Error('Private history checkpoint unavailable.'),{code});}
const quota=67_108_864,chunkSize=16_384;
function frozenBase(plan:Json):Json{
 return {accountGeneration:plan.accountGeneration,expectedAccountRevision:plan.expectedAccountRevision,sourcePlan:plan.sourcePlan,ownerRevision:plan.ownerRevision??0,preferredReplaySourceId:plan.preferredReplaySourceId??null};
}
function mergeOptions(plan:Json):Json{
 return {...(object(plan.ownerChanges)?{accountOwnerChanges:plan.ownerChanges}:{}),...(typeof plan.preferredReplaySourceId==='string'?{preferredReplaySourceId:plan.preferredReplaySourceId}:{})};
}
function chunks(text:string):string[]{
 if(historyWireBytes(text)>quota)fail('HISTORY_QUOTA');
 const result:string[]=[];
 for(let start=0;start<text.length;){
  let end=Math.min(start+chunkSize,text.length);
  const last=text.charCodeAt(end-1),next=text.charCodeAt(end);
  if(end<text.length&&last>=0xd800&&last<=0xdbff&&next>=0xdc00&&next<=0xdfff)end--;
  result.push(text.slice(start,end));start=end;
 }
 if(!result.length||result.length>10000)fail('HISTORY_QUOTA');return result;
}
async function sourceRows(plan:Json,rpc:Rpc,enter:(stage:string)=>void){
 if(!Array.isArray(plan.sourcePlan)||plan.sourcePlan.length>100)fail();
 const sources:{sourceId:string;rows:ReturnType<typeof decodeHistoryRows>;retainedOwnerFacts?:boolean}[]=[];let bytes=0,pages=0;
 for(const source of plan.sourcePlan){
  if(!object(source)||typeof source.sourceId!=='string'||typeof source.snapshotId!=='string'||!Number.isInteger(source.pages)||Number(source.pages)<1||Number(source.pages)>10000)fail();
  if(source.retainedOwnerFacts!==undefined&&(typeof source.retainedOwnerFacts!=='boolean'||source.retainedOwnerFacts&&source.state!=='removed'))fail();
  pages+=Number(source.pages);if(pages>10000)fail('HISTORY_QUOTA');const rows:unknown[]=[];
  for(let page=0;page<Number(source.pages);page++){
   const data=await rpc('page',{accountGeneration:plan.accountGeneration,expectedAccountRevision:plan.expectedAccountRevision,sourcePlan:plan.sourcePlan,snapshotId:source.snapshotId,page},'HISTORY_PREPARE');
   if(!Array.isArray(data.records)||data.records.length>100)fail('HISTORY_NETWORK');
   bytes+=historyWireBytes(JSON.stringify(data.records));if(bytes>quota)fail('HISTORY_QUOTA');rows.push(...data.records);
  }
  enter('HISTORY_SCHEMA');sources.push({sourceId:source.sourceId,rows:decodeHistoryRows(rows),...(source.retainedOwnerFacts?{retainedOwnerFacts:true}:{})});
 }
 return sources;
}
async function prepare(operationId:string,plan:Json,rpc:Rpc,enter:(stage:string)=>void){
 const sources=await sourceRows(plan,rpc,enter);enter('HISTORY_PREPARE');
 const keys=collectAccountIdentityKeys(sources),allocated=new Map<string,string>();
 const base=frozenBase(plan);
 for(let index=0;index<keys.length;index+=100){
  const batch=keys.slice(index,index+100),requests=await historyIdentityRequests(batch);
  const lookup=new Map<string,(typeof requests)[number]>();
  for(const request of requests){const key=historyIdentityKey(request.wire);if(!lookup.has(key))lookup.set(key,request);}
  const response=await rpc('map-identities',{accountGeneration:base.accountGeneration,expectedAccountRevision:base.expectedAccountRevision,sourcePlan:base.sourcePlan,keys:requests.map(item=>item.wire)},'HISTORY_PREPARE');
  if(!Array.isArray(response.mappings)||response.mappings.length!==batch.length)fail('HISTORY_NETWORK');
  for(const mapping of response.mappings){
   if(!object(mapping)||typeof mapping.accountId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(mapping.accountId))fail('HISTORY_NETWORK');
   const matched=lookup.get(historyIdentityKey(mapping as unknown as Parameters<typeof historyIdentityKey>[0]));if(!matched)fail('HISTORY_NETWORK');
   allocated.set(JSON.stringify([matched.original.sourceId,matched.original.kind,matched.original.localId]),mapping.accountId);
  }
 }
 const prepared=prepareAccountHistory(sources,{mapIdentity:(sourceId:string,kind:string,localId:string)=>allocated.get(JSON.stringify([sourceId,kind,localId]))??fail()});
 const parts=chunks(JSON.stringify({prepared,options:mergeOptions(plan)})),checkpoint={operationId,domainDigest:historyDomainSourceDigest};
 await rpc('checkpoint-start',{...checkpoint,base,pages:parts.length},'HISTORY_CHECKPOINT_WRITE');
 for(let page=0;page<parts.length;page++)await rpc('checkpoint-page',{...checkpoint,page,records:[parts[page]]},'HISTORY_CHECKPOINT_WRITE');
 await rpc('checkpoint-seal',checkpoint,'HISTORY_CHECKPOINT_SEAL');
}
async function build(operationId:string,status:Json,rpc:Rpc,enter:(stage:string)=>void){
 if(!object(status.base)||!Number.isInteger(status.preparedPages)||Number(status.preparedPages)<1||Number(status.preparedPages)>10000)fail('HISTORY_NETWORK');
 const checkpoint={operationId,domainDigest:historyDomainSourceDigest},parts:string[]=[];let bytes=0;
 for(let page=0;page<Number(status.preparedPages);page+=8){
  const count=Math.min(8,Number(status.preparedPages)-page);
  const data=await rpc('checkpoint-read-batch',{...checkpoint,page,count},'HISTORY_CHECKPOINT_READ');
  if(!Array.isArray(data.records)||data.records.length!==count)fail();
  for(const part of data.records){
   if(typeof part!=='string'||!part.length||part.length>chunkSize)fail();
   bytes+=historyWireBytes(part);if(bytes>quota)fail('HISTORY_QUOTA');parts.push(part);
  }
 }
 let envelope:unknown;try{envelope=JSON.parse(parts.join(''));}catch{fail();}
 if(!object(envelope)||Object.keys(envelope).sort().join(',')!=='options,prepared'||!object(envelope.options))fail();
 if(Object.keys(envelope.options).some(key=>!['accountOwnerChanges','preferredReplaySourceId'].includes(key)))fail();
 if(envelope.options.preferredReplaySourceId!==undefined&&(typeof envelope.options.preferredReplaySourceId!=='string'||!envelope.options.preferredReplaySourceId))fail();
 if(envelope.options.accountOwnerChanges!==undefined){
  const changes=envelope.options.accountOwnerChanges;
  if(!object(changes)||Object.keys(changes).sort().join(',')!=='deleted,rows'||!Array.isArray(changes.rows)||!Array.isArray(changes.deleted))fail();
  if(changes.deleted.some(item=>!object(item)||Object.keys(item).sort().join(',')!=='key,kind'||typeof item.key!=='string'||!item.key||!['manual','home','replay'].includes(String(item.kind))))fail();
  try{applyOwnerChanges([],changes as unknown as Parameters<typeof applyOwnerChanges>[1]);}catch{fail();}
 }
 enter('HISTORY_REBUILD');
 const merged=await mergePreparedAccountHistory(envelope.prepared as Parameters<typeof mergePreparedAccountHistory>[0],{...envelope.options,verifiedDuplicates:[],profile:enter});
 if(merged.review.length){
  if(merged.review.some((item:Json)=>item.reason==='duplicate-metadata-conflict'))enter('HISTORY_REVIEW_DUPLICATE');
  else if(merged.review.some((item:Json)=>item.reason==='correction-needs-review'&&item.sourceId!==undefined))enter('HISTORY_REVIEW_RETAINED_SOURCE');
  else if(merged.review.some((item:Json)=>item.reason==='correction-needs-review'&&item.revisionId!==undefined))enter('HISTORY_REVIEW_CORRECTION_REMAP');
  else if(merged.review.some((item:Json)=>item.reason==='correction-needs-review'))enter('HISTORY_REVIEW_CORRECTION');
  else enter('HISTORY_REVIEW_REPLAY_GROUP');fail('HISTORY_REVIEW');
 }
 enter('HISTORY_METADATA');
 const base=status.base;
 let metadata:Json={metadataVersion:2,graphSummary:{journeys:merged.projection.graph.journeys.length,visits:merged.projection.graph.visits.length},replaySummary:{selected:!!merged.replay,pendingCount:merged.pendingReplay.length},sourceCopies:merged.sourceCopies,review:merged.review,privacy:merged.privacy,domainSourceDigest:historyDomainSourceDigest,ownerRevision:base.ownerRevision};
 if(historyWireBytes(JSON.stringify(metadata))>400000){metadata={...metadata,metadataVersion:3,sourceCopiesFromPlan:true};delete metadata.sourceCopies;}
 if(historyWireBytes(JSON.stringify(metadata))>400000)fail('HISTORY_QUOTA');
 const pages:unknown[][]=[[]];let size=2;
 for(const row of encodeHistoryRows(merged.rows)){
  const bytes=historyWireBytes(JSON.stringify(row))+1;if(bytes>400000)fail('HISTORY_QUOTA');
  if(pages.at(-1)!.length>=100||size+bytes>400000){pages.push([]);size=2;}pages.at(-1)!.push(row);size+=bytes;
 }
 const activation={accountGeneration:base.accountGeneration,expectedAccountRevision:base.expectedAccountRevision,sourcePlan:base.sourcePlan,operationId};
 enter('HISTORY_ACTIVATE');
 await rpc('activate',{...activation,phase:'start',pages:pages.length,metadata,engineVersion:'reconstruction-v1/trip-detector-v1.1'},'HISTORY_ACTIVATE_START');
 for(let page=0;page<pages.length;page++)await rpc('activate',{...activation,phase:'page',page,records:pages[page]},'HISTORY_ACTIVATE_PAGE');
 await rpc('checkpoint-ready',{...checkpoint,pages:pages.length},'HISTORY_CHECKPOINT_SEAL');
}

class CompletedCheckpoint extends Error{
 readonly receipt:Json;
 constructor(receipt:Json){super('Private history already completed.');this.receipt=receipt;}
}
/** The client supplies only the operation. All phases/content come from private receipts. */
export async function resumeHistoryMerge(operationId:string,rpc:Rpc,enter:(stage:string)=>void):Promise<Json>{
 const guardedRpc:Rpc=async(action,input,boundary)=>{
  const result=await rpc(action,input,boundary);
  // A concurrent continuation may finish between status and any checkpoint RPC.
  if(action.startsWith('checkpoint-')&&action!=='checkpoint-status'&&result.status==='complete')throw new CompletedCheckpoint(result);
  return result;
 };
 try{return await advanceHistoryMerge(operationId,guardedRpc,enter);}
 catch(error){if(error instanceof CompletedCheckpoint)return error.receipt;throw error;}
}
async function advanceHistoryMerge(operationId:string,rpc:Rpc,enter:(stage:string)=>void):Promise<Json>{
 const status=await rpc('checkpoint-status',{operationId,domainDigest:historyDomainSourceDigest},'HISTORY_CHECKPOINT_READ');
 if(status.status==='complete')return status;
 if(status.status==='prepare'){
  const plan=await rpc('plan',{operationId},'HISTORY_PREPARE');
  if(plan.status==='complete')return plan;
  await prepare(operationId,plan,rpc,enter);
 }else if(status.status==='build')await build(operationId,status,rpc,enter);
 else if(status.status==='finalize'){
  if(!object(status.base)||!Number.isInteger(status.outputPages)||Number(status.outputPages)<1)fail('HISTORY_NETWORK');
  const base=status.base;
  const result=await rpc('activate',{accountGeneration:base.accountGeneration,expectedAccountRevision:base.expectedAccountRevision,sourcePlan:base.sourcePlan,operationId,phase:'commit'},'HISTORY_ACTIVATE_COMMIT');
  if(result.status!=='complete'||result.aggregateId!==operationId||!Number.isSafeInteger(result.aggregateRevision)||Number(result.aggregateRevision)<1)fail('HISTORY_NETWORK');
  // Reconcile the durable receipt and retire the now-unneeded private prepared pages.
  const receipt=await rpc('checkpoint-status',{operationId,domainDigest:historyDomainSourceDigest},'HISTORY_CHECKPOINT_READ');
  if(receipt.status!=='complete'||receipt.aggregateId!==operationId||receipt.aggregateRevision!==result.aggregateRevision||receipt.pages!==status.outputPages)fail('HISTORY_NETWORK');
  return {status:'complete',aggregateId:operationId,aggregateRevision:result.aggregateRevision,pages:status.outputPages};
 }else fail('HISTORY_NETWORK');
 return {status:'progress',operationId};
}
