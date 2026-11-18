import { safeHistoryCorrelation } from './history-diagnostics.ts';
import { createPrivateMediaDiagnostic } from './private-media-diagnostics.ts';
import { mediaKeys,mediaObject,mediaUuid } from './private-media-protocol.ts';
import { emptyCleanupRequest } from './cleanup-request.ts';
type Backend={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>;storage:{from(bucket:string):{remove(paths:string[]):Promise<{error:unknown}>}}};
export async function handlePrivateMediaCleanup(request:Request,options:{configured?:boolean;secret:string;backend:Backend;sink(event:Record<string,unknown>):void}):Promise<Response>{
 const correlationId=safeHistoryCorrelation(null);const log=createPrivateMediaDiagnostic(options.sink);let stage='MEDIA_AUTH';let reason='UNKNOWN';
 const event=(reasonCode:string,durableOutcome:string)=>log({correlationId,stage,reasonCode,durableOutcome});
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 event('START','unchanged');
 try{
  if(options.configured===false){stage='MEDIA_CONFIG';event('MEDIA_UNAVAILABLE','blocked');return reply({status:'unavailable'},503);}
  if(request.method!=='POST'||request.headers.has('origin')||options.secret.length<43||request.headers.get('x-private-media-cleanup')!==options.secret){event('ACCOUNT_SESSION','blocked');return reply({status:'blocked'},403);}
  if(!await emptyCleanupRequest(request)){event('MEDIA_SCHEMA','blocked');return reply({status:'blocked'},400);}
  const rpc=async(action:string,input:Record<string,unknown>)=>{let response;try{response=await options.backend.rpc('travel_life_private_media_cleanup',{action,input});}catch{reason='MEDIA_NETWORK';throw 0;}if(response.error||!mediaObject(response.data)||response.data.error){reason='MEDIA_NETWORK';throw 0;}return response.data;};
  stage='MEDIA_CLEANUP';event('START','unchanged');
  const leased=await rpc('lease',{limit:10});
  if(!Array.isArray(leased.items)||leased.items.length>10){reason='MEDIA_SCHEMA';throw 0;}
  for(const item of leased.items){
   if(!mediaObject(item)||!mediaKeys(item,['storagePath','leaseId'])||!mediaUuid(item.leaseId)||typeof item.storagePath!=='string'||!(/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/).test(item.storagePath)){reason='MEDIA_SCHEMA';throw 0;}
   let removed;try{removed=await options.backend.storage.from('travel-life-private-media').remove([item.storagePath]);}catch{reason='MEDIA_STORAGE';throw 0;}
   if(removed.error){reason='MEDIA_STORAGE';throw 0;}
   // An absent object is only one acknowledgement. SQL retains its path tombstone
   // and reservation for repeated deletion while late upload completion is possible.
   await rpc('ack',{storagePath:item.storagePath,leaseId:item.leaseId});
  }
  event('COMPLETE','complete');return reply({status:'complete',processed:leased.items.length});
 }catch{event(reason,reason==='MEDIA_SCHEMA'?'blocked':'unknown');return reply({status:'unavailable'},503);}
}
