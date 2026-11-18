import { AccountMediaError } from './media-cache';
import { privateMediaActivationReceipt } from './media-receipt';
import { mediaInteger, mediaKeys, mediaObject, mediaUuid, privateMediaManifest, privateMediaTarget, type PrivateMediaTarget } from '../../../../supabase/functions/_shared/private-media-protocol';

type Options={enabled:boolean;url?:string;key?:string;owner:string;current:()=>boolean;session:(correlationId?:string)=>Promise<{ownerId:string;accessToken:string}|null>;invalidateSession?:()=>Promise<void>;fetcher?:typeof fetch};
/** Only current owner authorization issues URL capabilities. No bearer accompanies object fetches. */
export function createMediaTransport(options:Options){
 const check=(boundary?:ConstructorParameters<typeof AccountMediaError>[1])=>{if(!options.current())throw new AccountMediaError('MEDIA_ACCESS',boundary);};
 const validUrl=(value:unknown):value is string=>{
  if(typeof value!=='string'||!options.url)return false;
  try{const url=new URL(value);return url.protocol==='https:'&&url.origin===new URL(options.url).origin&&!url.username&&!url.password&&url.pathname.startsWith('/storage/v1/object/sign/');}catch{return false;}
 };
 const run=async<T>(work:(signal:AbortSignal)=>Promise<T>)=>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30_000);
  try{check();const value=await work(controller.signal);check();return value;}
  catch(error){if(error instanceof AccountMediaError)throw error;check();throw new AccountMediaError('MEDIA_NETWORK');}
  finally{clearTimeout(timer);}
 };
 const request=async(input:Record<string,unknown>|Uint8Array,correlationId:string,signal:AbortSignal,artifactId?:string)=>{
  if(!options.enabled||!options.url||!/^https:\/\/[^/]+$/.test(options.url)||!options.key)throw new AccountMediaError('MEDIA_ACCESS','MEDIA_SERVICE_AUTH');
  // A timer spent verifying the session must not trigger an upload reconciliation.
  const checkSession=()=>{
   check('MEDIA_SERVICE_SESSION');
   if(signal.aborted)throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_SESSION_DEADLINE');
  };
  let session;
  try{session=await options.session(correlationId);}catch{checkSession();throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_SESSION');}
  checkSession();
  if(!session||session.ownerId!==options.owner)throw new AccountMediaError('MEDIA_ACCESS','MEDIA_SERVICE_SESSION');
  const checkRequest=(boundary:'MEDIA_SERVICE_REQUEST'|'MEDIA_SERVICE_RESPONSE_JSON')=>{
   check(boundary);
   if(signal.aborted)throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_DEADLINE');
  };
  let response;
  try{
   response=await (options.fetcher??fetch)(`${options.url}/functions/v1/travel-life-private-media`,{method:artifactId?'PUT':'POST',signal,headers:{apikey:options.key,authorization:`Bearer ${session.accessToken}`,'content-type':artifactId?'application/octet-stream':'application/json','x-travel-life-correlation':correlationId,...(artifactId?{'x-travel-life-artifact':artifactId}:{})},body:input instanceof Uint8Array?Uint8Array.from(input).buffer:JSON.stringify(input)});
  }catch{checkRequest('MEDIA_SERVICE_REQUEST');throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_REQUEST');}
  checkRequest('MEDIA_SERVICE_REQUEST');
  const authFailure=response.status===401||response.status===403;
  const retryableHttp=response.status===429||(response.status>=500&&response.status<=599);
  let value:unknown;
  try{value=await response.json();}
  catch{
   checkRequest('MEDIA_SERVICE_RESPONSE_JSON');
   if(authFailure)throw new AccountMediaError('MEDIA_ACCESS','MEDIA_SERVICE_AUTH');
   if(retryableHttp)throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_HTTP_RETRY');
   throw new AccountMediaError('MEDIA_NETWORK',response.ok?'MEDIA_SERVICE_RESPONSE_JSON':'MEDIA_SERVICE_HTTP_REJECT');
  }
  checkRequest('MEDIA_SERVICE_RESPONSE_JSON');
  if(!response.ok){
   if(mediaObject(value)&&value.error==='ACCOUNT_SESSION'){
    check('MEDIA_SERVICE_AUTH');try{await options.invalidateSession?.();}catch{check('MEDIA_SERVICE_AUTH');throw new AccountMediaError('ACCOUNT_STORAGE','ACCOUNT_SECURE_DELETE');}
    throw new AccountMediaError('ACCOUNT_SESSION','MEDIA_SERVICE_AUTH');
   }
   if(mediaObject(value)){
    if(Object.hasOwn(value,'error')&&typeof value.error!=='string')throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_SERVICE_SCHEMA');
    if(typeof value.error==='string'&&['MEDIA_SCHEMA','MEDIA_CONFLICT','MEDIA_CONSENT','MEDIA_SCOPE','MEDIA_QUOTA','MEDIA_UNAVAILABLE','MEDIA_DECODE','MEDIA_VERIFY','MEDIA_STORAGE','UNKNOWN'].includes(value.error))throw new AccountMediaError(value.error as ConstructorParameters<typeof AccountMediaError>[0]);
    if(value.error==='HISTORY_FENCED')throw new AccountMediaError('MEDIA_ACCESS');
    if(value.error==='MEDIA_BUSY')throw new AccountMediaError('ALREADY_RUNNING','MEDIA_SERVICE_UPLOAD_LEASE');
    if(retryableHttp){
     if(value.code==='BOOT_ERROR')throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_BOOT');
     if(value.code==='WORKER_ERROR')throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_WORKER_ERROR');
     if(value.code==='WORKER_LIMIT')throw new AccountMediaError('MEDIA_NETWORK','MEDIA_SERVICE_WORKER_LIMIT');
    }
   }
   if(authFailure)throw new AccountMediaError('MEDIA_ACCESS','MEDIA_SERVICE_AUTH');
   throw new AccountMediaError('MEDIA_NETWORK',retryableHttp?'MEDIA_SERVICE_HTTP_RETRY':'MEDIA_SERVICE_HTTP_REJECT');
  }
  if(!mediaObject(value))throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_SERVICE_SCHEMA');
  return value;
 };
 return {
  authorize:async(target:PrivateMediaTarget,correlationId:string)=>run(async signal=>{
   if(!privateMediaTarget(target))throw new AccountMediaError('MEDIA_VERIFY');
   const value=await request({action:'download',target},correlationId,signal);
   const manifest=mediaObject(value)?privateMediaManifest(value.manifest):null;
   if(!mediaObject(value)||value.status!=='complete'||!mediaUuid(value.artifactId)||!Number.isSafeInteger(value.revision)||Number(value.revision)<1||!manifest||!validUrl(value.url)||!Number.isInteger(value.expiresInSeconds)||Number(value.expiresInSeconds)<1||Number(value.expiresInSeconds)>300||(target.kind==='soundtrack')!==(manifest.kind==='audio'))throw new AccountMediaError('MEDIA_VERIFY');
   return {artifactId:value.artifactId,revision:Number(value.revision),manifest,url:value.url};
  }),
  send:async(input:Record<string,unknown>,correlationId:string)=>run(async signal=>{
   const action=input.action;
   if(action==='stage'){
    if(!mediaKeys(input,['action','mutationId','accountGeneration','sourceId','sourceGeneration','target','expectedRevision','manifest'])||!mediaUuid(input.mutationId)||!mediaUuid(input.sourceId)||!mediaInteger(input.accountGeneration,1)||!mediaInteger(input.sourceGeneration,1)||!mediaInteger(input.expectedRevision,0)||!privateMediaTarget(input.target)||!privateMediaManifest(input.manifest))throw new AccountMediaError('MEDIA_SCHEMA');
   }else if(action==='activate'){
    if(!mediaKeys(input,['action','mutationId','artifactId','expectedRevision'])||!mediaUuid(input.mutationId)||!mediaUuid(input.artifactId)||!mediaInteger(input.expectedRevision,0))throw new AccountMediaError('MEDIA_SCHEMA');
   }else if(action==='status'){
    if(!mediaKeys(input,['action','artifactId'])||!mediaUuid(input.artifactId))throw new AccountMediaError('MEDIA_SCHEMA');
   }else if(action==='abandon'){
    if(!mediaKeys(input,['action','stageMutationId'])||!mediaUuid(input.stageMutationId))throw new AccountMediaError('MEDIA_SCHEMA');
   }else throw new AccountMediaError('MEDIA_SCHEMA');
   const value=await request(input,correlationId,signal);
   if(action==='activate'&&!privateMediaActivationReceipt(value,String(input.artifactId),Number(input.expectedRevision)))throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_ACTIVATE');
   return value;
  }),
  upload:async(artifactId:string,bytes:Uint8Array,correlationId:string)=>run(async signal=>{
   if(!mediaUuid(artifactId)||bytes.length<1||bytes.length>100*1024*1024)throw new AccountMediaError('MEDIA_SCHEMA');
   return request(bytes,correlationId,signal,artifactId);
  }),
  download:async(url:string,maxBytes:number)=>run(async signal=>{
   if(!validUrl(url)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>100*1024*1024)throw new AccountMediaError('MEDIA_VERIFY');
   const response=await (options.fetcher??fetch)(url,{signal,redirect:'error'});check();
   if(!response.ok)throw new AccountMediaError('MEDIA_NETWORK');
   const claimed=response.headers.get('content-length');
   if(claimed!==null&&(!/^\d+$/.test(claimed)||Number(claimed)>maxBytes))throw new AccountMediaError('MEDIA_VERIFY');
   // Native fetch currently buffers; stream where supported and enforce the same
   // admission bound on each chunk. Native resource envelope remains a device gate.
   const reader=response.body?.getReader?.();
   if(reader){
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const chunk=await reader.read();check();if(chunk.done)break;size+=chunk.value.length;if(size>maxBytes)throw new AccountMediaError('MEDIA_VERIFY');chunks.push(chunk.value);}}
    finally{await reader.cancel();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
   }
   const bytes=new Uint8Array(await response.arrayBuffer());check();if(bytes.length>maxBytes)throw new AccountMediaError('MEDIA_VERIFY');return bytes;
  }),
 };
}
