import * as Crypto from 'expo-crypto';
import { getAccountService } from './service';
import { AccountMediaError } from './media-cache';
import { createMediaTransport } from './media-transport';
import { mediaSelectionPage, mediaSelectionScope, type MediaSelectionItem, type MediaSelectionPage } from './media-selection';
import { preparePrivateMedia, privatePreparedBytes, removePrivatePrepared, cleanupUnownedPrepared } from './media-preparation';
import { canAdvancePrivateMediaJob, runPrivateMediaUpload, validatePrivateMediaUploadJob, type PrivateMediaUploadJob } from './media-upload';
import { classifyHistoryFailure, createHistoryTransport, historyStatus, runHistoryControl, HistoryTransferError, type HistoryStatus } from './history-transfer';
import { clearHistoryControl, clearPrivateMediaJob, installationId, loadHistoryControl, loadPrivateMediaJob, saveHistoryControl, savePrivateMediaJob, privateMediaJobExists, privateMediaJobUris, loadReplica } from './history-store';
import { mediaUuid } from '../../../../supabase/functions/_shared/private-media-protocol';
import { nativePhotoAccess } from '@/photo-access/native-adapter';
import { createNativeReconstructionRepository } from '@/reconstruction/repository';
import { classifyAppDiagnosticError, recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import type { OwnerPreview } from '@/photo-access/types';
import { AccountSyncStepError, type AccountSyncActionOptions } from './sync-step-error';
import { accountReplayMedia } from './replay-media-plan';

type View={enabled:boolean;busy:boolean;mediaConsent:boolean;message:string;page:MediaSelectionPage|null;previews:readonly OwnerPreview[];selected:readonly string[];audioAvailable:boolean;audioSelected:boolean;done:number;total:number};
const enabled=process.env.EXPO_PUBLIC_TRAVEL_LIFE_PRIVATE_MEDIA_ENABLED==='true';
const initial=():View=>({enabled,busy:false,mediaConsent:false,message:enabled?'Choose which memories to keep privately in your account.':'Private media sync is not enabled in this build.',page:null,previews:[],selected:[],audioAvailable:false,audioSelected:false,done:0,total:0});
let snapshot=initial();let ownerScope:string|null=null;let epoch=0;
let customTrack:{revision:string;localUri:string}|null=null;
const selection=new Map<string,MediaSelectionItem>();const listeners=new Set<()=>void>();
const update=(change:Partial<View>)=>{snapshot={...snapshot,...change};listeners.forEach(listener=>listener());};
const config={url:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL,key:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY,session:(correlationId?:string)=>getAccountService().getVerifiedSession(correlationId)};
const messages:Record<string,string>={ACCOUNT_SESSION:'Sign in again to use private account media.',ACCOUNT_STORAGE:'Account access is blocked while secure storage is unavailable.',MEDIA_ACCESS:'Media access changed. Your prepared selection was kept for review.',MEDIA_CONSENT:'Choose private media consent before uploading.',MEDIA_STORAGE:'This phone could not finish saving private media. Resume the saved selection.',MEDIA_NETWORK:'Media acknowledgement is unavailable. Resume to reconcile the exact saved selection.',MEDIA_QUOTA:'This selection reached the current media size or storage limit.',MEDIA_VERIFY:'This media could not be verified. The previous account copy was kept.',MEDIA_SCHEMA:'Private media needs a compatible account version.',MEDIA_CONFLICT:'The saved media version changed. Your previous account copy was kept.',MEDIA_SCOPE:'The current history no longer includes this selection. Refresh its scope.',MEDIA_UNAVAILABLE:'The selected source or format is unavailable on this phone.',MEDIA_DECODE:'The selected media could not be decoded.',MEDIA_ENCODE:'The private copy could not be prepared.'};
function mapped(error:unknown){
 if(error instanceof AccountMediaError)return error;
 if(error instanceof AccountSyncStepError)return error;
 const reason=classifyHistoryFailure(error);
 const boundary=error instanceof HistoryTransferError?error.boundary??null:null;
 if(reason==='HISTORY_READ_TIMEOUT')return new AccountSyncStepError(reason,boundary);
 if(reason==='UNKNOWN'){const classified=classifyAppDiagnosticError(error);if(classified!=='UNKNOWN')return new AccountSyncStepError(classified,null);}
 if(reason==='HISTORY_REVIEW'||reason==='ACCESS')return new AccountSyncStepError(reason,boundary);
 return new AccountMediaError(reason==='ACCOUNT_SESSION'?'ACCOUNT_SESSION':reason==='HISTORY_FENCED'?'MEDIA_ACCESS':reason==='HISTORY_STALE'||reason==='HISTORY_INCOMPLETE'?'MEDIA_SCOPE':reason==='HISTORY_CONFLICT'?'MEDIA_CONFLICT':reason==='HISTORY_QUOTA'?'MEDIA_QUOTA':reason==='HISTORY_CONSENT'?'MEDIA_CONSENT':reason==='HISTORY_SCHEMA'?'MEDIA_SCHEMA':reason==='HISTORY_STORAGE'?'MEDIA_STORAGE':reason==='UNKNOWN'?'UNKNOWN':'MEDIA_NETWORK',boundary);
}
async function action(work:(context:{owner:string;current:()=>boolean;history:ReturnType<typeof createHistoryTransport>;media:ReturnType<typeof createMediaTransport>;correlationId:string;stage:(value:AppDiagnosticEvent['stage'])=>void;managed:(value?:boolean)=>void})=>Promise<void>,options?:AccountSyncActionOptions){
 if(snapshot.busy){if(options?.propagateErrors)throw new AccountSyncStepError('ALREADY_RUNNING','MEDIA_STAGE');return false;}if(!enabled){update({message:initial().message});if(options?.propagateErrors)throw new AccountSyncStepError('ACCOUNT_DISABLED','MEDIA_AUTH');return false;}
 const owner=getAccountService().getLocalOwner();if(!owner){update({message:messages.ACCOUNT_SESSION});if(options?.propagateErrors)throw new AccountSyncStepError('ACCOUNT_SESSION','MEDIA_AUTH');return false;}
 ownerScope=owner;const generation=epoch;const current=()=>generation===epoch&&getAccountService().getLocalOwner()===owner;
 const correlationId=options?.correlationId??`local_${Crypto.randomUUID().replaceAll('-','')}`;let stage:AppDiagnosticEvent['stage']='MEDIA_AUTH';let managed=false;
 const emit=(reasonCode:AppDiagnosticEvent['reasonCode'],durableOutcome:AppDiagnosticEvent['durableOutcome'])=>recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage,reasonCode,durableOutcome,retryable:['MEDIA_STORAGE','MEDIA_NETWORK','DATABASE_BUSY','NATIVE_HANDLE','HISTORY_READ_TIMEOUT'].includes(reasonCode),correlationId});
 const history=createHistoryTransport({...config,fence:{owner,current},correlationId});
 const media=createMediaTransport({...config,enabled,owner,current,invalidateSession:async()=>{if(current())await getAccountService().invalidateSession();}});
 update({busy:true,done:0,total:0});emit('START','unchanged');
 try{await work({owner,current,history,media,correlationId,stage:value=>{stage=value;emit('START','unchanged');},managed:(value=true)=>{managed=value;}});if(!managed)emit(current()?'COMPLETE':'MEDIA_ACCESS',current()?'complete':'skipped');if(!current()&&options?.propagateErrors)throw new AccountSyncStepError('MEDIA_ACCESS',stage,true);return current();}
 catch(error){if(error instanceof AccountSyncStepError&&error.diagnosticRecorded){if(options?.propagateErrors)throw error;return false;}const safe=mapped(error);if(safe.boundary)stage=safe.boundary;
  if(safe.reason==='ACCOUNT_SESSION'&&current()){try{await getAccountService().invalidateSession();}catch{stage='ACCOUNT_SECURE_DELETE';if(!managed)emit('ACCOUNT_STORAGE','blocked');if(options?.propagateErrors)throw new AccountSyncStepError('ACCOUNT_STORAGE',stage,true);return false;}}
  if(current())update({message:messages[safe.reason]??'Private media could not finish. Your saved selection was kept.'});
  if(!managed)emit(safe.reason,safe.reason==='MEDIA_ACCESS'||safe.reason==='ALREADY_RUNNING'?'skipped':['MEDIA_NETWORK','MEDIA_STORAGE','DATABASE_BUSY','NATIVE_HANDLE','HISTORY_READ_TIMEOUT','UNKNOWN'].includes(safe.reason)?'unknown':'blocked');
  if(options?.propagateErrors)throw new AccountSyncStepError(safe.reason,stage,true);return false;
 }finally{if(current())update({busy:false});}
}
async function status(context:{history:ReturnType<typeof createHistoryTransport>;current:()=>boolean}):Promise<HistoryStatus>{
 let result:HistoryStatus;
 try{result=historyStatus(await context.history({action:'status',input:{}}));}
 catch(error){if(classifyHistoryFailure(error)==='ACCOUNT_SESSION'&&context.current()){try{await getAccountService().invalidateSession();}catch{throw new AccountMediaError('ACCOUNT_STORAGE','ACCOUNT_SECURE_DELETE');}}throw mapped(error);}
 if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
 update({mediaConsent:result.mediaConsent});return result;
}
const recoverableServiceStages:readonly AppDiagnosticEvent['stage'][]=[
 'MEDIA_SERVICE_HTTP_RETRY','MEDIA_SERVICE_BOOT','MEDIA_SERVICE_WORKER_ERROR','MEDIA_SERVICE_WORKER_LIMIT','MEDIA_SERVICE_REQUEST','MEDIA_SERVICE_DEADLINE','MEDIA_SERVICE_RESPONSE_JSON',
];
async function runJob(job:PrivateMediaUploadJob,context:MediaContext,reconcile=false){
 const run=(job:PrivateMediaUploadJob)=>runPrivateMediaUpload(job,{current:context.current,permitted:async()=>{
  const live=await status(context);const source=live.sources.find(item=>item.sourceId===job.sourceId);
  return live.status==='active'&&live.historyConsent&&live.mediaConsent&&live.generation===job.accountGeneration&&source?.state==='active'&&source.generation===job.sourceGeneration;
 },save:value=>savePrivateMediaJob(value,context.current),clear:id=>clearPrivateMediaJob(context.owner,id,context.current),read:privatePreparedBytes,digest:async bytes=>Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,Uint8Array.from(bytes).buffer))).map(byte=>byte.toString(16).padStart(2,'0')).join(''),remove:removePrivatePrepared,send:context.media.send,upload:context.media.upload,correlationId:context.correlationId}).catch(error=>{
  if(error instanceof AccountSyncStepError)context.managed(false);
  throw error;
 });
 context.managed();
 try{await run(job);}
 catch(error){
  if(!reconcile||!(error instanceof AccountMediaError)||error.reason!=='MEDIA_NETWORK'||!error.boundary||!recoverableServiceStages.includes(error.boundary))throw error;
  context.managed(false);
  context.stage('MEDIA_RECONCILE');
  const checkOwner=()=>{if(!context.current())throw new AccountMediaError('MEDIA_ACCESS','MEDIA_RECONCILE');};
  checkOwner();
  let saved;
  try{
   saved=await loadPrivateMediaJob(context.owner);
   if(saved!==null)validatePrivateMediaUploadJob(saved);
  }catch(loadError){
   checkOwner();
   throw new AccountMediaError(loadError instanceof AccountMediaError?loadError.reason:'MEDIA_STORAGE','MEDIA_RECONCILE');
  }
  checkOwner();
  if(!saved||!canAdvancePrivateMediaJob(job,saved))throw new AccountMediaError('MEDIA_CONFLICT','MEDIA_RECONCILE');
  context.managed();
  await run(saved);
 }
}

type MediaContext=Parameters<Parameters<typeof action>[0]>[0];
async function uploadSelection(page:MediaSelectionPage,selected:readonly MediaSelectionItem[],audio:{revision:string;localUri:string}|null,context:MediaContext,manual=true,progress?:{done:number;total:number}){
  context.stage('MEDIA_STAGE');
  if(await loadPrivateMediaJob(context.owner))throw new AccountMediaError('MEDIA_CONFLICT');
  context.stage('MEDIA_CLEANUP');await cleanupUnownedPrepared(await privateMediaJobUris(),context.correlationId);
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  const total=progress?.total??selected.length+(audio?1:0);update({total,done:progress?.done??0,message:'Preparing your selected private copies…'});
  const permitted=async()=>{const live=await status(context);const source=live.sources.find(item=>item.sourceId===page.sourceId);return context.current()&&live.status==='active'&&live.historyConsent&&live.mediaConsent&&live.generation===page.accountGeneration&&live.activeAggregate===page.aggregateId&&source?.state==='active'&&source.generation===page.sourceGeneration&&source.sourceSnapshotRevision===page.sourceSnapshotRevision;};
  const entries=[...selected.map(item=>({source:{kind:item.kind,sourceRef:item.sourceRef},target:{kind:'evidence' as const,id:item.id},expectedRevision:item.expectedRevision})),...(audio&&page.soundtrack?[{source:{kind:'audio' as const,localUri:audio.localUri},target:{kind:'soundtrack' as const,revision:audio.revision},expectedRevision:page.soundtrack.expectedRevision}]:[])];
  for(const [index,item] of entries.entries()){
   if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
   const stageMutationId=Crypto.randomUUID(),activateMutationId=Crypto.randomUUID();
   context.managed();
   const prepared=await preparePrivateMedia({...item.source,current:context.current,consented:permitted,correlationId:context.correlationId});
   context.managed(false);
   const job:PrivateMediaUploadJob={owner:context.owner,accountGeneration:page.accountGeneration,sourceId:page.sourceId,sourceGeneration:page.sourceGeneration,target:item.target,expectedRevision:item.expectedRevision,stageMutationId,activateMutationId,...prepared,artifactId:null,active:false};
   try{context.stage('MEDIA_STAGE');await savePrivateMediaJob(job,context.current);}
   catch(error){
    if(!await privateMediaJobExists(context.owner,job.stageMutationId)){context.stage('MEDIA_CLEANUP');await removePrivatePrepared(prepared.uri);}
    throw error;
   }
   await runJob(job,context,!manual);context.managed(false);
   if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');if(manual&&item.target.kind==='evidence')selection.delete(item.target.id);
   update({done:(progress?.done??0)+index+1,...(manual?{selected:[...selection.keys()]}:{})});
  }
  update({...(manual?{audioSelected:false}:{}),message:'Your selected private copies were acknowledged. Other devices can request them while this phone is offline.'});

}

/** Consent covers the committed account Replay, never the whole gallery. */
async function syncReplayMedia(context:MediaContext){
 context.stage('MEDIA_REPLAY_SCOPE');
 const live=await status(context);if(!live.historyConsent||!live.mediaConsent)throw new AccountMediaError('MEDIA_CONSENT');
 context.stage('MEDIA_REPLAY_REPLICA');
 const replica=await loadReplica(context.owner);if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
 if(!replica||replica.snapshot_id!==(live.activeAggregate??live.activeSnapshot))throw new AccountMediaError('MEDIA_SCOPE');
 context.stage('MEDIA_REPLAY_MANIFEST');
 const input=await createNativeReconstructionRepository({databaseName:replica.database_name}).loadReplayManifestInput();
 context.stage('MEDIA_REPLAY_SCOPE');
 const plan=accountReplayMedia(input);if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
 if(!plan.evidenceIds.length&&!plan.soundtrackRevision){update({done:0,total:0,message:'Your account history is saved.'});return;}
 const wanted=new Set(plan.evidenceIds);const located=new Set<string>();const seen=new Set<string>();
 const pages:MediaSelectionPage[]=[];const installation=await installationId(()=>Crypto.randomUUID());
 if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
 context.stage('MEDIA_REPLAY_MAPPING');update({done:0,total:0,message:'Checking the memories already used in your Replay…'});
 for(let page=0;page===0||page<pages[0].pages;page++){
  const value=await context.history({action:'source-media',input:{installationId:installation,page}});
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  let next:MediaSelectionPage;
  try{next=mediaSelectionPage(value);}catch{throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_REPLAY_MAPPING_RESPONSE_SHAPE');}
  if(next.accountGeneration!==live.generation||next.aggregateId!==replica.snapshot_id)throw new AccountMediaError('MEDIA_SCOPE');
  if(next.page!==page||pages[0]&&(mediaSelectionScope(pages[0])!==mediaSelectionScope(next)||next.pages!==pages[0].pages||next.total!==pages[0].total))throw new AccountMediaError('MEDIA_SCOPE');
  for(const item of next.items){if(seen.has(item.id))throw new AccountMediaError('MEDIA_SCHEMA');seen.add(item.id);if(wanted.has(item.id))located.add(item.id);}
  pages.push(next);
 }
 context.stage('MEDIA_AUTH');
 for(const id of wanted)if(!located.has(id))await context.media.authorize({kind:'evidence',id},context.correlationId);
 let audio:{revision:string;localUri:string}|null=null;let audioPage:MediaSelectionPage|undefined;
 if(plan.soundtrackRevision){
  audioPage=pages.find(page=>page.soundtrack?.revision===plan.soundtrackRevision);
  if(audioPage&&audioPage.soundtrack!.expectedRevision===0){
   context.stage('MEDIA_REPLAY_SOUNDTRACK');
   const local=await createNativeReconstructionRepository({databaseName:'travel-life-import-v1.db'}).loadReplayManifestInput();
   if(local.soundtrack?.kind==='custom'&&local.soundtrack.revision===plan.soundtrackRevision&&local.soundtrack.localUri)audio=local.soundtrack;
   else throw new AccountMediaError('MEDIA_UNAVAILABLE');
  }else if(!audioPage)await context.media.authorize({kind:'soundtrack',revision:plan.soundtrackRevision},context.correlationId);
 }
 if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
 context.stage('MEDIA_STAGE');
 const pending=await loadPrivateMediaJob(context.owner);const resumed=new Set<string>();let done=0;
 if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
 const key=(target:PrivateMediaUploadJob['target'])=>target.kind==='evidence'?target.id:`audio:${target.revision}`;
 const missing=pages.reduce((count,page)=>count+page.items.filter(item=>wanted.has(item.id)&&item.expectedRevision===0).length,0)+(audio?1:0);
 const pendingMissing=pending&&(pending.target.kind==='evidence'?pages.some(page=>page.items.some(item=>item.id===(pending.target.kind==='evidence'?pending.target.id:'')&&item.expectedRevision===0)):audio?.revision===pending.target.revision);
 const total=missing+(pending&&!pendingMissing?1:0);
 update({total,done:0,message:'Saving your Replay memories privately…'});
 if(pending){
  const page=pages.find(page=>page.sourceId===pending.sourceId&&page.sourceGeneration===pending.sourceGeneration&&page.accountGeneration===pending.accountGeneration&&(pending.target.kind==='evidence'?page.items.some(item=>item.id===(pending.target.kind==='evidence'?pending.target.id:'')):page.soundtrack?.revision===pending.target.revision));
  const selected=pending.target.kind==='evidence'?wanted.has(pending.target.id)&&page?.items.some(item=>item.id===(pending.target.kind==='evidence'?pending.target.id:'')):pending.target.revision===plan.soundtrackRevision&&page?.soundtrack?.revision===pending.target.revision;
  if(!selected)throw new AccountMediaError('MEDIA_CONFLICT');
  await runJob(pending,context,true);context.managed(false);
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  resumed.add(key(pending.target));done++;update({done});
 }
 for(const page of pages){
  const items=page.items.filter(item=>wanted.has(item.id)&&item.expectedRevision===0&&!resumed.has(item.id));
  const track=page===audioPage&&audio&&!resumed.has(`audio:${audio.revision}`)?audio:null;
  if(!items.length&&!track)continue;
  await uploadSelection(page,items,track,context,false,{done,total});done+=items.length+(track?1:0);
 }
 context.stage('MEDIA_AUTH');const final=await status(context);
 if(!final.historyConsent||!final.mediaConsent)throw new AccountMediaError('MEDIA_CONSENT');
 if(final.generation!==live.generation||(final.activeAggregate??final.activeSnapshot)!==replica.snapshot_id)throw new AccountMediaError('MEDIA_SCOPE');
 if(pages.some(page=>!final.sources.some(source=>source.sourceId===page.sourceId&&source.state==='active'&&source.generation===page.sourceGeneration&&source.sourceSnapshotRevision===page.sourceSnapshotRevision)))throw new AccountMediaError('MEDIA_SCOPE');
 if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
 update({done,total,message:'Your Replay memories are saved in your account.'});
}

export const privateMediaService={
 getSnapshot:()=>snapshot,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 lock(){epoch++;ownerScope=null;selection.clear();customTrack=null;snapshot=initial();listeners.forEach(listener=>listener());},
 checkOwner(){if(ownerScope&&getAccountService().getLocalOwner()!==ownerScope)this.lock();},
 refresh:(options?:AccountSyncActionOptions)=>action(async context=>{await status(context);},options),
 syncReplay:(options?:AccountSyncActionOptions)=>action(syncReplayMedia,options),
 consent:(mediaEnabled:boolean,options?:AccountSyncActionOptions)=>action(async context=>{
  const live=await status(context);if(!live.historyConsent)throw new AccountMediaError('MEDIA_CONSENT');
  await runHistoryControl({current:context.current,load:()=>loadHistoryControl(context.owner),create:()=>({action:'consent',input:{mutationId:Crypto.randomUUID(),generation:live.generation,expectedRevision:live.revision,history:true,media:mediaEnabled}}),matches:request=>request.action==='consent'&&request.input.media===mediaEnabled,save:request=>{context.stage('MEDIA_STAGE');return saveHistoryControl(context.owner,request);},send:request=>{context.stage('MEDIA_ACK');return context.history(request);},refresh:async()=>{await status(context);},clear:id=>clearHistoryControl(context.owner,id)});
  if(context.current())update({message:mediaEnabled?'Only memories and audio you explicitly select will be uploaded.':'Private media access is withdrawn. Previously issued links can remain usable for up to five minutes; offline copied bytes cannot be remotely wiped.',page:null,previews:[],selected:[],audioSelected:false});
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  selection.clear();customTrack=null;
 },options),
 choose:(page=0)=>action(async context=>{
  context.stage('MEDIA_STAGE');
  const installation=await installationId(()=>Crypto.randomUUID());if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  context.stage('MEDIA_FETCH');const value=await context.history({action:'source-media',input:{installationId:installation,page}});context.stage('MEDIA_VERIFY');const result=mediaSelectionPage(value);
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  if(snapshot.page&&mediaSelectionScope(snapshot.page)!==mediaSelectionScope(result)){selection.clear();customTrack=null;update({selected:[],audioSelected:false});}
  context.stage('MEDIA_AUTH');const permission=await nativePhotoAccess.inspect();if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  if(!permission||!['full','limited'].includes(permission.scope))throw new AccountMediaError('MEDIA_ACCESS');
  context.stage('MEDIA_FETCH');const previews=await nativePhotoAccess.resolveOwnerPreviews!(result.items.map(item=>item.sourceRef),result.items.length);
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  if(result.soundtrack){const local=await createNativeReconstructionRepository({databaseName:'travel-life-import-v1.db'}).loadReplayManifestInput();if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');customTrack=local.soundtrack?.kind==='custom'&&local.soundtrack.revision===result.soundtrack.revision?local.soundtrack:null;}
  else customTrack=null;
  update({page:result,previews,audioAvailable:customTrack!==null,message:'Select recognizable memories to upload private viewing copies. Originals remain on this phone.'});
 }),
 toggle:(id:string)=>{if(snapshot.busy)return;const index=snapshot.page?.items.findIndex(item=>item.id===id)??-1;const item=snapshot.page?.items[index];if(!item||snapshot.previews[index]?.availability!=='available')return;if(selection.has(id))selection.delete(id);else if(selection.size<100)selection.set(id,item);update({selected:[...selection.keys()]});},
 toggleAudio:()=>{if(!snapshot.busy&&snapshot.audioAvailable)update({audioSelected:!snapshot.audioSelected});},
 upload:()=>action(async context=>{
  const page=snapshot.page;const selected=[...selection.values()];const audio=snapshot.audioSelected?customTrack:null;
  if(!page||!selected.length&&!audio)throw new AccountMediaError('MEDIA_SCOPE');
  await uploadSelection(page,selected,audio,context);
 }),
 resume:()=>action(async context=>{context.stage('MEDIA_STAGE');const job=await loadPrivateMediaJob(context.owner);if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');if(!job){update({message:'No prepared media upload is waiting.'});return;}await runJob(job,context);if(context.current())update({message:'The saved private copy is acknowledged. Resume again if another copy is waiting.'});}),
 abandon:()=>action(async context=>{
  context.stage('MEDIA_STAGE');const job=await loadPrivateMediaJob(context.owner);if(!job)return;
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  context.stage('MEDIA_CLEANUP');const result=await context.media.send({action:'abandon',stageMutationId:job.stageMutationId},context.correlationId);
  if((result.status!=='abandoned'&&result.status!=='active')||result.artifactId!==null&&!mediaUuid(result.artifactId)||job.artifactId!==null&&result.artifactId!==job.artifactId)throw new AccountMediaError('MEDIA_SCHEMA','MEDIA_CLEANUP');
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  await removePrivatePrepared(job.uri);await clearPrivateMediaJob(context.owner,job.stageMutationId,context.current);
  if(!context.current())throw new AccountMediaError('MEDIA_ACCESS');
  selection.clear();customTrack=null;update({page:null,selected:[],previews:[],audioSelected:false,message:result.status==='active'?'The acknowledged account copy was kept. Choose memories again for a new selection.':'The prepared upload was abandoned. Choose memories again to prepare its current version.'});
 }),
};
