import { recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { AccountMediaError } from './media-cache';
import { privateMediaActivationReceipt } from './media-receipt';
import { AccountSyncStepError } from './sync-step-error';
import { mediaInteger, mediaKeys, mediaUuid, privateMediaManifest, privateMediaTarget, type PrivateMediaManifest, type PrivateMediaTarget } from '../../../../supabase/functions/_shared/private-media-protocol';

export type PrivateMediaUploadJob=Readonly<{owner:string;accountGeneration:number;sourceId:string;sourceGeneration:number;target:PrivateMediaTarget;expectedRevision:number;stageMutationId:string;activateMutationId:string;uri:string;manifest:PrivateMediaManifest;artifactId:string|null;active:boolean}>;
export function validatePrivateMediaUploadJob(value:unknown):asserts value is PrivateMediaUploadJob{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AccountMediaError('MEDIA_SCHEMA');
 const job=value as PrivateMediaUploadJob;
 if(!mediaKeys(job as unknown as Record<string,unknown>,['owner','accountGeneration','sourceId','sourceGeneration','target','expectedRevision','stageMutationId','activateMutationId','uri','manifest','artifactId','active'])||typeof job.owner!=='string'||!job.owner||job.owner.length>1024||!mediaInteger(job.accountGeneration,1)||!mediaInteger(job.sourceGeneration,1)||!mediaInteger(job.expectedRevision,0)||!mediaUuid(job.sourceId)||!mediaUuid(job.stageMutationId)||!mediaUuid(job.activateMutationId)||job.stageMutationId===job.activateMutationId||job.artifactId!==null&&!mediaUuid(job.artifactId)||!privateMediaTarget(job.target)||!privateMediaManifest(job.manifest)||typeof job.uri!=='string'||!job.uri||job.uri.length>4096||typeof job.active!=='boolean'||job.active&&!job.artifactId||(job.target.kind==='soundtrack')!==(job.manifest.kind==='audio'))throw new AccountMediaError('MEDIA_SCHEMA');
}
/** A reload/save may advance receipt state only for the same immutable upload. */
export function canAdvancePrivateMediaJob(previous:PrivateMediaUploadJob,next:PrivateMediaUploadJob):boolean{
 const immutable=(value:PrivateMediaUploadJob)=>[
  value.owner,value.accountGeneration,value.sourceId,value.sourceGeneration,value.target.kind,
  value.target.kind==='evidence'?value.target.id:value.target.revision,value.expectedRevision,
  value.stageMutationId,value.activateMutationId,value.uri,value.manifest.contractVersion,
  value.manifest.kind,value.manifest.mimeType,value.manifest.byteLength,value.manifest.sha256,
  value.manifest.width,value.manifest.height,value.manifest.durationMillis,
 ];
 const nextValues=immutable(next);
 return immutable(previous).every((value,index)=>value===nextValues[index])&&
  (previous.artifactId===null||previous.artifactId===next.artifactId)&&(!previous.active||next.active);
}
type Options={current:()=>boolean;permitted:()=>Promise<boolean>;save:(job:PrivateMediaUploadJob)=>Promise<void>;clear:(stageMutationId:string)=>Promise<void>;read:(uri:string)=>Promise<Uint8Array>;digest:(bytes:Uint8Array)=>Promise<string>;remove:(uri:string)=>Promise<void>;send:(request:Record<string,unknown>,correlationId:string)=>Promise<Record<string,unknown>>;upload:(artifactId:string,bytes:Uint8Array,correlationId:string)=>Promise<Record<string,unknown>>;correlationId:string};
/** One immutable derivative and two receipts survive all unknown acknowledgements. */
export async function runPrivateMediaUpload(input:PrivateMediaUploadJob,options:Options):Promise<void>{
 let stage:AppDiagnosticEvent['stage']='MEDIA_AUTH';
 const event=(reasonCode:AppDiagnosticEvent['reasonCode'],durableOutcome:AppDiagnosticEvent['durableOutcome'])=>recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage,reasonCode,durableOutcome,retryable:['MEDIA_STORAGE','MEDIA_NETWORK'].includes(reasonCode),correlationId:options.correlationId});
 const current=()=>{if(!options.current())throw new AccountMediaError('MEDIA_ACCESS',stage);};
 const step=async<T>(boundary:AppDiagnosticEvent['stage'],work:()=>Promise<T>):Promise<T>=>{stage=boundary;event('START','unchanged');current();const value=await work();current();return value;};
 const save=(job:PrivateMediaUploadJob)=>step('MEDIA_STAGE',async()=>{try{await options.save(job);}catch(error){if(error instanceof AccountMediaError)throw error;throw new AccountMediaError('MEDIA_STORAGE','MEDIA_STAGE');}});
 try{
  validatePrivateMediaUploadJob(input);
  let job={...input,manifest:{...input.manifest},target:{...input.target}};
  if(!await step('MEDIA_AUTH',options.permitted))throw new AccountMediaError('MEDIA_CONSENT','MEDIA_AUTH');
  await save(job);
  if(!job.active){
   if(!job.artifactId){
    const result=await step('MEDIA_STAGE',()=>options.send({action:'stage',mutationId:job.stageMutationId,accountGeneration:job.accountGeneration,sourceId:job.sourceId,sourceGeneration:job.sourceGeneration,target:job.target,expectedRevision:job.expectedRevision,manifest:job.manifest},options.correlationId));
    if(result.status!=='staged'||!mediaUuid(result.artifactId))throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_STAGE');
    job={...job,artifactId:result.artifactId};await save(job);
   }
   const artifactId=job.artifactId!;
   const response=await step('MEDIA_ACK',()=>options.send({action:'status',artifactId},options.correlationId));
   if(response.artifactId!==artifactId||(response.status!=='staged'&&response.status!=='verified'&&response.status!=='active'))throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_ACK');
   if(response.status==='staged'){
    const bytes=await step('MEDIA_VERIFY',async()=>{
     let bytes;try{bytes=await options.read(job.uri);}catch(error){
      if(error instanceof AccountMediaError&&(error.reason==='MEDIA_UNAVAILABLE'||error.reason==='MEDIA_SCHEMA'))throw error;
      throw new AccountMediaError('MEDIA_STORAGE','MEDIA_VERIFY');
     }
     if(bytes.length!==job.manifest.byteLength||await options.digest(bytes)!==job.manifest.sha256)throw new AccountMediaError('MEDIA_VERIFY');return bytes;
    });
    const uploaded=await step('MEDIA_UPLOAD',()=>options.upload(artifactId,bytes,options.correlationId));
    if(uploaded.artifactId!==artifactId||(uploaded.status!=='verified'&&uploaded.status!=='active'))throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_UPLOAD');
   }
   if(response.status!=='active'){
    const result=await step('MEDIA_ACTIVATE',()=>options.send({action:'activate',mutationId:job.activateMutationId,artifactId,expectedRevision:job.expectedRevision},options.correlationId));
    if(!privateMediaActivationReceipt(result,artifactId,job.expectedRevision))throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_ACTIVATE');
   }
   job={...job,active:true};await save(job);
  }
  await step('MEDIA_CLEANUP',async()=>{try{await options.remove(job.uri);await options.clear(job.stageMutationId);}catch(error){throw new AccountMediaError(error instanceof AccountMediaError?error.reason:'MEDIA_STORAGE','MEDIA_CLEANUP');}});
  event('COMPLETE','complete');
 }catch(error){
  if(error instanceof AccountSyncStepError)throw error;
  if(error instanceof AccountMediaError&&error.boundary)stage=error.boundary;
  const reason=error instanceof AccountMediaError?error.reason:['MEDIA_STAGE','MEDIA_CLEANUP','MEDIA_VERIFY'].includes(String(stage))?'MEDIA_STORAGE':'MEDIA_NETWORK';
  event(reason,reason==='MEDIA_ACCESS'||reason==='ALREADY_RUNNING'?'skipped':['MEDIA_STORAGE','MEDIA_NETWORK','UNKNOWN'].includes(reason)?'unknown':'blocked');
  throw new AccountMediaError(reason,stage);
 }
}
