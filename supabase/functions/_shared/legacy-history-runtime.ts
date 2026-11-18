import { applyOwnerChanges, collectAccountIdentityKeys, historyRowsJson, translateLegacyOwnerChanges,decodeHistoryRows } from './history-domain.js';
import { historyIdentityRequests,historyIdentityKey } from './history-identities.ts';
type Json=Record<string,unknown>;
class LegacyFault extends Error { code:string;constructor(code:string){super('Private history migration unavailable.');this.code=code;} }
const fail=(code:string):never=>{throw new LegacyFault(code);};
const object=(value:unknown):value is Json=>!!value&&typeof value==='object'&&!Array.isArray(value);
const receipt=(value:Json):Json=>{
 if(!['accepted','conflict'].includes(String(value.status))||!Number.isSafeInteger(value.ownerRevision)||Number(value.ownerRevision)<(value.status==='accepted'?1:0))fail('HISTORY_NETWORK');
 return {status:value.status,ownerRevision:value.ownerRevision};
};
const digest=async(rows:Parameters<typeof historyRowsJson>[0])=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(historyRowsJson(rows))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');

export async function migrateLegacyHistory(input:Json,rpc:(action:string,payload:Json,boundary?:string)=>Promise<Json>,entering:(stage:string)=>void):Promise<Json>{
 const operationId=input.operationId;
 const plan=await rpc('legacy-plan',input,'HISTORY_AUTHORITY');
 if(['accepted','conflict'].includes(String(plan.status)))return receipt(plan);
 if(plan.status!=='planned'||!['initial','aggregate'].includes(String(plan.kind))||!object(input.legacy))fail('HISTORY_SCHEMA');
 const request=input.legacy as Json;
 if(plan.translated!==null&&plan.translated!==undefined)return receipt(await rpc('legacy-commit',{operationId},'HISTORY_CORRECTION'));
 let bytes=0,pages=0;
 const read=async(scope:string,count:unknown)=>{
  if(!Number.isSafeInteger(count)||Number(count)<1||Number(count)>10000)fail('HISTORY_SCHEMA');
  pages+=Number(count);if(pages>10000)fail('HISTORY_QUOTA');
  const rows:unknown[]=[];
  for(let page=0;page<Number(count);page++){
   const result=await rpc('legacy-page',{operationId,scope,page},'HISTORY_READ');
   if(!Array.isArray(result.records)||result.records.length>100)fail('HISTORY_SCHEMA');
   const records=result.records as unknown[];
   bytes+=new TextEncoder().encode(JSON.stringify(records)).length;if(bytes>67108864)fail('HISTORY_QUOTA');rows.push(...records);
  }
  return decodeHistoryRows(rows);
 };
 const baseline=await read('baseline',plan.baselinePages),canonicalRows=await read('canonical',plan.canonicalPages);
 entering('HISTORY_SCHEMA');
 if(await digest(baseline)!==request.baselineDigest)fail('HISTORY_REVIEW');
 const changes=request.changes as Parameters<typeof applyOwnerChanges>[1];
 let edited:ReturnType<typeof applyOwnerChanges>;
 try{edited=applyOwnerChanges(baseline,changes);}catch(error){
  if(object(error)&&['HISTORY_SCHEMA','HISTORY_REVIEW','HISTORY_FENCED','HISTORY_QUOTA'].includes(String(error.reason)))fail(String(error.reason));
  throw error;
 }
 if(await digest(edited)!==request.editedDigest)fail('HISTORY_SCHEMA');
 let translated=changes;
 if(plan.kind==='initial'){
  if(typeof plan.sourceId!=='string')fail('HISTORY_SCHEMA');
  const sourceId=String(plan.sourceId),allKeys=[...collectAccountIdentityKeys([{sourceId,rows:baseline}]),...collectAccountIdentityKeys([{sourceId,rows:edited}])];
  const keys=[...new Map(allKeys.map(key=>[JSON.stringify([key.sourceId,key.kind,key.localId]),key])).values()];
  const mappings=new Map<string,string>();
  for(let index=0;index<keys.length;index+=100){
   const batch=keys.slice(index,index+100),requests=await historyIdentityRequests(batch),result=await rpc('legacy-map',{operationId,keys:requests.map(request=>request.wire)},'HISTORY_SCHEMA');
   if(!Array.isArray(result.mappings)||result.mappings.length!==batch.length)fail('HISTORY_SCHEMA');
   for(const mapping of result.mappings as Json[]){
    if(!object(mapping)||typeof mapping.accountId!=='string')fail('HISTORY_SCHEMA');
    const matched=requests.find(request=>historyIdentityKey(request.wire)===historyIdentityKey(mapping as unknown as Parameters<typeof historyIdentityKey>[0]));if(!matched)fail('HISTORY_SCHEMA');
    mappings.set(JSON.stringify([matched!.original.sourceId,matched!.original.kind,matched!.original.localId]),String(mapping.accountId));
   }
  }
  entering('HISTORY_REBUILD');
  translated=await translateLegacyOwnerChanges({sourceId,baseline,changes,canonicalRows,mapIdentity:(source:string,kind:string,local:string)=>mappings.get(JSON.stringify([source,kind,local]))??fail('HISTORY_SCHEMA')});
 }
 await rpc('legacy-translate',{operationId,changes:translated},'HISTORY_STAGE');
 return receipt(await rpc('legacy-commit',{operationId},'HISTORY_CORRECTION'));
}
