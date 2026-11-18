import { safeHistoryCorrelation } from './history-diagnostics.ts';
import { createPrivateMediaDiagnostic, privateMediaReasons } from './private-media-diagnostics.ts';
import { mediaDigest, mediaInteger, mediaKeys, mediaObject, mediaUuid, privateMediaManifest, privateMediaTarget, PrivateMediaFault, type PrivateMediaManifest } from './private-media-protocol.ts';
import { verifyPrivateContainer } from './share-media.ts';

type Json=Record<string,unknown>;
type Backend={rpc(name:string,args:Json):PromiseLike<{data:unknown;error:unknown}>;storage:{from(bucket:string):{
  upload(path:string,bytes:Uint8Array,options:{contentType:string;upsert:boolean}):Promise<{error:unknown}>;
  download(path:string):Promise<{data:Blob|null;error:unknown}>;
  createSignedUrl(path:string,seconds:number):Promise<{data:{signedUrl:string}|null;error:unknown}>;
  remove(paths:string[]):Promise<{error:unknown}>;
}}};
export type PrivateMediaOptions={configured:boolean;backend:Backend;authenticate(token:string):Promise<{owner:string;session:string}|null>;decode(bytes:Uint8Array,manifest:PrivateMediaManifest,correlationId:string):Promise<boolean>;sink(event:Json):void};
async function bodyBytes(request:Request,max:number):Promise<Uint8Array>{
  const reader=request.body?.getReader();if(!reader)throw new PrivateMediaFault('MEDIA_SCHEMA');
  const chunks:Uint8Array[]=[];let count=0;
  try{
    while(true){const next=await reader.read();if(next.done)break;count+=next.value.length;if(count>max){await reader.cancel();throw new PrivateMediaFault('MEDIA_QUOTA');}chunks.push(next.value);}
    const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
  }catch(error){if(error instanceof PrivateMediaFault)throw error;throw new PrivateMediaFault('MEDIA_NETWORK');}
}
const storagePath=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(value);
export async function handlePrivateMedia(request:Request,options:PrivateMediaOptions):Promise<Response>{
  const correlationId=safeHistoryCorrelation(request.headers.get('x-travel-life-correlation'));
  const log=createPrivateMediaDiagnostic(options.sink);let stage='MEDIA_CONFIG';
  const event=(reasonCode:string,durableOutcome:string)=>log({reasonCode,durableOutcome,stage,correlationId});
  const entering=(next:string)=>{if(stage!==next){stage=next;event('START','unchanged');}};
  const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','x-travel-life-correlation':correlationId}});
  const current=()=>{if(request.signal.aborted)throw new PrivateMediaFault('MEDIA_CANCELLED');};
  event('START','unchanged');
  try{
    if(!options.configured)throw new PrivateMediaFault('MEDIA_UNAVAILABLE');
    entering('MEDIA_AUTH');
    if(!['POST','PUT'].includes(request.method)||request.headers.has('origin'))throw new PrivateMediaFault('MEDIA_SCHEMA');
    const authorization=request.headers.get('authorization');
    if(!authorization?.startsWith('Bearer ')||authorization.length>16384)throw new PrivateMediaFault('ACCOUNT_SESSION');
    const identity=await options.authenticate(authorization.slice(7));
    if(!identity||!mediaUuid(identity.owner)||!mediaUuid(identity.session))throw new PrivateMediaFault('ACCOUNT_SESSION');
    const rpc=async(action:string,input:Json,boundary:string):Promise<Json>=>{
      entering(boundary);current();let response;
      try{response=await options.backend.rpc('travel_life_private_media',{verified_owner:identity.owner,verified_session:identity.session,action,input});}catch{throw new PrivateMediaFault('MEDIA_NETWORK');}
      if(response.error)throw new PrivateMediaFault('UNKNOWN');
      if(!mediaObject(response.data))throw new PrivateMediaFault('MEDIA_NETWORK');
      if(response.data.error)throw new PrivateMediaFault(privateMediaReasons.has(String(response.data.error))?String(response.data.error):'UNKNOWN');
      return response.data;
    };
    const bucket=options.backend.storage.from('travel-life-private-media');
    if(request.method==='PUT'){
      entering('MEDIA_SCHEMA');const artifactId=request.headers.get('x-travel-life-artifact');
      if(!mediaUuid(artifactId)||request.headers.get('content-type')!=='application/octet-stream')throw new PrivateMediaFault('MEDIA_SCHEMA');
      const admitted=await rpc('upload-context',{artifactId},'MEDIA_ELIGIBILITY');
      if(admitted.status==='active'||admitted.status==='verified'){event('COMPLETE','complete');return json({status:admitted.status,artifactId});}
      const manifest=privateMediaManifest(admitted.manifest);
      if(!manifest||!storagePath(admitted.storagePath)||!mediaUuid(admitted.uploadLease))throw new PrivateMediaFault('MEDIA_SCHEMA');
      entering('MEDIA_SCHEMA');const bytes=await bodyBytes(request,manifest.byteLength);
      entering('MEDIA_VERIFY');
      if(bytes.length!==manifest.byteLength||await mediaDigest(bytes)!==manifest.sha256||!verifyPrivateContainer(bytes,manifest))throw new PrivateMediaFault('MEDIA_VERIFY');
      entering('MEDIA_DECODE');current();
      if(!await options.decode(bytes,manifest,correlationId))throw new PrivateMediaFault('MEDIA_DECODE');
      current();entering('MEDIA_UPLOAD');
      let uploaded;
      try{uploaded=await bucket.upload(admitted.storagePath,bytes,{contentType:manifest.mimeType,upsert:false});}catch{throw new PrivateMediaFault('MEDIA_STORAGE');}
      if(uploaded.error){
        // A prior upload may have committed before acknowledgement was lost.
        // Never overwrite it or infer that an error rolled back its bytes.
        let previous;try{previous=await bucket.download(admitted.storagePath);}catch{throw new PrivateMediaFault('MEDIA_STORAGE');}
        if(previous.error||!previous.data||previous.data.size!==manifest.byteLength)throw new PrivateMediaFault('MEDIA_STORAGE');
        const oldBytes=new Uint8Array(await previous.data.arrayBuffer());if(await mediaDigest(oldBytes)!==manifest.sha256)throw new PrivateMediaFault('MEDIA_CONFLICT');
      }
      let result;
      try{result=await rpc('verify',{artifactId,sha256:manifest.sha256,byteLength:bytes.length,uploadLease:admitted.uploadLease},'MEDIA_ACK');}
      catch(error){
        // Compensate only a proven authorization fence. Unknown verification may
        // already have committed; retain its bytes for receipt reconciliation.
        if(error instanceof PrivateMediaFault&&['HISTORY_FENCED','MEDIA_SCOPE','MEDIA_CONSENT'].includes(error.reason)){
          entering('MEDIA_CLEANUP');let removed;
          try{removed=await bucket.remove([admitted.storagePath]);}catch{throw new PrivateMediaFault('MEDIA_STORAGE');}
          if(removed.error)throw new PrivateMediaFault('MEDIA_STORAGE');
          entering('MEDIA_ACK');
        }
        throw error;
      }
      if(result.status!=='verified'&&result.status!=='active')throw new PrivateMediaFault('MEDIA_NETWORK');
      event('COMPLETE','complete');return json({status:result.status,artifactId});
    }
    entering('MEDIA_SCHEMA');let input:unknown;
    try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bodyBytes(request,8192)));}catch(error){if(error instanceof PrivateMediaFault)throw error;throw new PrivateMediaFault('MEDIA_SCHEMA');}
    if(!mediaObject(input)||typeof input.action!=='string')throw new PrivateMediaFault('MEDIA_SCHEMA');
    const action=input.action;
    if(action==='stage'){
      if(!mediaKeys(input,['action','mutationId','accountGeneration','sourceId','sourceGeneration','target','expectedRevision','manifest'])||!mediaUuid(input.mutationId)||!mediaUuid(input.sourceId)||!privateMediaTarget(input.target)||!mediaInteger(input.accountGeneration,1)||!mediaInteger(input.sourceGeneration,1)||!mediaInteger(input.expectedRevision,0)||!privateMediaManifest(input.manifest)||((input.manifest as PrivateMediaManifest).kind==='audio')!==((input.target as {kind:string}).kind==='soundtrack'))throw new PrivateMediaFault('MEDIA_SCHEMA');
    }else if(action==='activate'){
      if(!mediaKeys(input,['action','mutationId','artifactId','expectedRevision'])||!mediaUuid(input.mutationId)||!mediaUuid(input.artifactId)||!mediaInteger(input.expectedRevision,0))throw new PrivateMediaFault('MEDIA_SCHEMA');
    }else if(action==='status'){
      if(!mediaKeys(input,['action','artifactId'])||!mediaUuid(input.artifactId))throw new PrivateMediaFault('MEDIA_SCHEMA');
    }else if(action==='abandon'){
      if(!mediaKeys(input,['action','stageMutationId'])||!mediaUuid(input.stageMutationId))throw new PrivateMediaFault('MEDIA_SCHEMA');
    }else if(action==='download'){
      if(!mediaKeys(input,['action','target'])||!privateMediaTarget(input.target))throw new PrivateMediaFault('MEDIA_SCHEMA');
    }else throw new PrivateMediaFault('MEDIA_SCHEMA');
    const payload={...input};delete payload.action;
    const result=await rpc(action,payload,action==='stage'?'MEDIA_STAGE':action==='activate'?'MEDIA_ACTIVATE':action==='download'?'MEDIA_FETCH':action==='abandon'?'MEDIA_CLEANUP':'MEDIA_ACK');
    if(action==='abandon'){
      if(!['abandoned','active'].includes(String(result.status))||result.artifactId!==null&&!mediaUuid(result.artifactId))throw new PrivateMediaFault('MEDIA_NETWORK');
      event('COMPLETE','complete');return json({status:result.status,artifactId:result.artifactId});
    }
    if(action==='download'){
      const manifest=privateMediaManifest(result.manifest);
      if(!mediaUuid(result.artifactId)||!mediaInteger(result.revision,1)||!storagePath(result.storagePath)||!manifest)throw new PrivateMediaFault('MEDIA_SCHEMA');
      current();let signed;
      try{signed=await bucket.createSignedUrl(result.storagePath,300);}catch{throw new PrivateMediaFault('MEDIA_STORAGE');}
      if(signed.error||!signed.data||!/^https:\/\//.test(signed.data.signedUrl))throw new PrivateMediaFault('MEDIA_STORAGE');
      event('COMPLETE','complete');return json({status:'complete',artifactId:result.artifactId,revision:result.revision,manifest,url:signed.data.signedUrl,expiresInSeconds:300});
    }
    if(!mediaUuid(result.artifactId)||!['staged','verified','active','complete'].includes(String(result.status)))throw new PrivateMediaFault('MEDIA_NETWORK');
    event('COMPLETE','complete');return json({status:result.status,artifactId:result.artifactId,...(mediaInteger(result.revision,1)?{revision:result.revision}:{})});
  }catch(error){
    if(error instanceof PrivateMediaFault&&error.boundary)stage=error.boundary;
    const reason=error instanceof PrivateMediaFault&&privateMediaReasons.has(error.reason)?error.reason:'UNKNOWN';
    const outcome=['MEDIA_CANCELLED','HISTORY_FENCED','MEDIA_BUSY'].includes(reason)?'skipped':['MEDIA_NETWORK','MEDIA_STORAGE','UNKNOWN'].includes(reason)?'unknown':'blocked';
    event(reason,outcome);return json({status:outcome,error:reason},reason==='ACCOUNT_SESSION'?401:['MEDIA_NETWORK','MEDIA_STORAGE','UNKNOWN','MEDIA_UNAVAILABLE'].includes(reason)?503:409);
  }
}
