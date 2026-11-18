import {createHistoryDiagnostic,safeHistoryCorrelation} from './history-diagnostics.ts';
import {mediaKeys,mediaObject,mediaUuid} from './private-media-protocol.ts';
import {emptyCleanupRequest} from './cleanup-request.ts';

type Json=Record<string,unknown>;
type Options={configured?:boolean;secret:string;sink:(event:Json)=>void;rpc:(action:string,input:Json)=>Promise<Json>;user:(owner:string)=>Promise<boolean>;removeUser:(owner:string)=>Promise<void>};
/** Only scheduler capability can drive the already owner-authorized deletion queue. */
export async function handleAccountDeletionCleanup(request:Request,options:Options):Promise<Response>{
 const correlationId=safeHistoryCorrelation(null);const diagnostic=createHistoryDiagnostic(options.sink);let stage='HISTORY_AUTH';
 const emit=(reasonCode:string,durableOutcome:string)=>diagnostic({stage,reasonCode,durableOutcome,correlationId});
 const enter=(value:string)=>{stage=value;emit('START','unchanged');};
 const reply=(status:string,code=200)=>new Response(JSON.stringify({status}),{status:code,headers:{'content-type':'application/json','cache-control':'no-store'}});
 emit('START','unchanged');
 try{
  if(options.configured===false){emit('HISTORY_UNAVAILABLE','blocked');return reply('unavailable',503);}
  if(request.method!=='POST'||request.headers.has('origin')||options.secret.length<43||request.headers.get('x-account-cleanup')!==options.secret){emit('ACCOUNT_SESSION','blocked');return reply('blocked',403);}
  if(!await emptyCleanupRequest(request)){emit('HISTORY_SCHEMA','blocked');return reply('blocked',400);}
  enter('HISTORY_DELETE_LEASE');const batch=await options.rpc('lease',{});
  if(batch.status!=='complete'||!Array.isArray(batch.items)||batch.items.length>10)throw new Error('unavailable');
  for(const item of batch.items){
   if(!mediaObject(item)||!mediaKeys(item,['owner','leaseId'])||!mediaUuid(item.owner)||!mediaUuid(item.leaseId))throw new Error('unavailable');
   enter('HISTORY_DELETE_CLEANUP');const result=await options.rpc('purge',item);
   if(result.status==='pending')continue;
   if(result.status!=='metadata-purged')throw new Error('unavailable');
   enter('HISTORY_DELETE_AUTH');if(await options.user(item.owner))await options.removeUser(item.owner);
   // A lost delete response is recovered by querying the exact owner on retry.
   enter('HISTORY_DELETE_ACK');const complete=await options.rpc('complete',item);
   if(complete.status!=='completed')throw new Error('unavailable');
  }
  emit('COMPLETE','complete');return reply('complete');
 }catch{emit('UNKNOWN','unknown');return reply('unavailable',503);}
}
