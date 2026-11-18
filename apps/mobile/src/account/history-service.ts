import * as Crypto from 'expo-crypto';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticEvent, type AppDiagnosticReasonCode } from '@/diagnostics/app-diagnostics';
import { createNativeReconstructionRepository } from '@/reconstruction/repository';
import { getAccountService } from './service';
import { classifyHistoryFailure, createHistoryTransport, createMergeTransport, currentHistoryStep, fetchHistorySnapshot, historyStatus, HistoryTransferError, publishCurrentHistoryStatus, runHistoryControl, runMergeJob, sourceReviewResponse, type HistoryStatus, type SourceReview } from './history-transfer';
import { exportLocalHistory, stageAccountReplica } from './history-native';
import { acceptCorrectionJob, resolveCorrectionJob, blockReplica, clearAccountJobs, clearHistoryControl, clearMergeOperation, clearReplica, clearReplicaIfMatching, loadCorrectionJob, loadHistoryControl, loadOwnerBaseline, loadReplica, loadReplicaDigest, mergeOperation, replicaScope, saveCorrectionJob, saveHistoryControl, saveReplica, retireReplicaFile } from './history-store';
import { syncOwnerCorrections } from './correction-sync';
import { historyRowsJson } from './correction-journal';
import { correctionConflictPage, correctionPreviewRefs, type CorrectionConflictPage } from './correction-conflict';
import { convergeAccountHistory } from './history-convergence';
import { accountSyncEnabled, runNativeHistorySync } from './history-sync-native';
import { HistorySyncError } from './history-sync';
import { recordContext } from './record-context';
import { AccountSyncStepError, type AccountSyncActionOptions } from './sync-step-error';
import { accountSessionPage, type AccountSessionPage } from './session-contract';
import { sourceImpact, sourceImpactScope, type SourceImpact } from './source-impact';
import { createNativeAccountMedia } from './media-native';
import type { OwnerPreview } from '@/photo-access/types';

type View=Readonly<{busy:boolean;restorePhase?:string;historyEnabled:boolean;hasSnapshot:boolean;message:string;done:number;total:number;revision:number;sourceCount:number;sources:HistoryStatus['sources'];review:SourceReview|null;sessions:AccountSessionPage|null;impact:SourceImpact|null;impactPreviews:readonly OwnerPreview[];conflict:CorrectionConflictPage|null;conflictCount:number;conflictPreviews:{accepted:readonly (readonly OwnerPreview[])[];proposed:readonly (readonly OwnerPreview[])[]}}>;
let snapshot:View={busy:false,historyEnabled:false,hasSnapshot:false,message:'Choose whether your private history is stored in your account.',done:0,total:0,revision:0,sourceCount:0,sources:[],review:null,sessions:null,impact:null,impactPreviews:[],conflict:null,conflictCount:0,conflictPreviews:{accepted:[],proposed:[]}};
let conflictMedia:ReturnType<typeof createNativeAccountMedia>|null=null;
let impactMedia:ReturnType<typeof createNativeAccountMedia>|null=null;
let status:HistoryStatus|null=null;let epoch=0;
const listeners=new Set<()=>void>();
const account=getAccountService;
export const accountControlsEnabled=process.env.EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_CONTROLS_ENABLED==='true';
const transportConfig={url:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL,key:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY,session:(correlationId?:string)=>account().getVerifiedSession(correlationId)};
type BoundTransport=ReturnType<typeof createHistoryTransport>;
type BoundMergeTransport=ReturnType<typeof createMergeTransport>;
const update=(value:Partial<View>)=>{snapshot={...snapshot,...value};listeners.forEach(listener=>listener());};
const copy:Record<string,string>={DATABASE_BUSY:'This phone is updating local history. Your saved sync checkpoint is kept. Try again after it finishes.',ACCOUNT_SESSION:'Sign in again before using account history.',ACCOUNT_REAUTH:'Sign out and verify a new email code before deleting account history.',HISTORY_REVIEW:'Some reviewed facts need attention before histories can be combined. Your saved history was kept.',HISTORY_CONSENT:'Choose history sync before transferring.',HISTORY_FENCED:'Account or source access changed. Refresh its status.',HISTORY_CONFLICT:'This transfer conflicts with an existing version. Your local record is kept.',HISTORY_VERSION_UNSUPPORTED:'Account sync for map-selected Home bases is not available yet. You can keep using Local history.',HISTORY_SCHEMA:'This history needs a compatible transfer version. Your local record is kept.',HISTORY_QUOTA:'Your account transfer reached its current storage limit.',HISTORY_STALE:'This saved version is no longer active. Refresh account status.',HISTORY_INCOMPLETE:'This transfer has unacknowledged pages. Resume the transfer.',HISTORY_READ_TIMEOUT:'Your saved history is taking longer to load. Try Sync again.',HISTORY_NETWORK:'Transfer acknowledgement is unavailable. Resume to reconcile the saved operation.',HISTORY_STORAGE:'This phone could not save the transfer checkpoint. Your local record is kept.'};
function reason(error:unknown):AppDiagnosticReasonCode{const typed=classifyHistoryFailure(error);return typed==='UNKNOWN'?classifyAppDiagnosticError(error):typed;}
async function action(stage:AppDiagnosticEvent['stage'],work:(owner:string,current:()=>boolean,setStage:(stage:AppDiagnosticEvent['stage'])=>void,transport:BoundTransport,mergeTransport:BoundMergeTransport,correlationId:string)=>Promise<void|'skipped'|'already-running'>,options?:AccountSyncActionOptions):Promise<boolean> {
  if(snapshot.busy){if(options?.propagateErrors)throw new AccountSyncStepError('ALREADY_RUNNING',stage);return false;}
  const owner=account().getLocalOwner();if(!owner){update({message:copy.ACCOUNT_SESSION});if(options?.propagateErrors)throw new AccountSyncStepError('ACCOUNT_SESSION','HISTORY_AUTH');return false;}
  const generation=epoch;const current=()=>generation===epoch&&account().getLocalOwner()===owner;
  const correlationId=options?.correlationId??createDiagnosticCorrelationId();
  const fence={owner,current};const transport=createHistoryTransport({...transportConfig,fence,correlationId});const mergeTransport=createMergeTransport({...transportConfig,fence,correlationId});
  update({busy:true,done:0,total:0});
  const emit=(code:AppDiagnosticReasonCode,outcome:AppDiagnosticEvent['durableOutcome'])=>recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage,reasonCode:code,retryable:code==='HISTORY_NETWORK'||code==='HISTORY_READ_TIMEOUT'||code==='HISTORY_STORAGE'||code==='DATABASE_BUSY',durableOutcome:outcome,correlationId});
  emit('START','unchanged');
  try{const outcome=await work(owner,current,value=>{if(stage!==value){stage=value;emit('START','unchanged');}},transport,mergeTransport,correlationId);const complete=current()&&outcome!=='skipped'&&outcome!=='already-running';emit(complete?'COMPLETE':outcome==='already-running'?'ALREADY_RUNNING':'SKIPPED',complete?'complete':'skipped');if(!complete&&options?.propagateErrors)throw new AccountSyncStepError(outcome==='already-running'?'ALREADY_RUNNING':'HISTORY_FENCED',stage,true);return complete;}
  catch(error){
    if(error instanceof AccountSyncStepError)throw error;
    if(error instanceof HistorySyncError)stage=error.boundary;
    let code=reason(error);
    if(code==='ACCOUNT_SESSION'&&current()){
      recordContext.local('HISTORY_CONTEXT_AUTH_LOST',correlationId);historyService.lock();stage='HISTORY_AUTH';
      try{await account().invalidateSession();}
      catch{code='ACCOUNT_STORAGE';stage='ACCOUNT_SECURE_DELETE';}
    }
    const candidateCompatibility=code==='HISTORY_VERSION_UNSUPPORTED'&&stage==='HISTORY_EXPORT_CANDIDATE_COMPATIBILITY';
    if(current())update({message:candidateCompatibility
      ? 'Account sync for Possible trips decisions is not available yet. You can keep using Local history.'
      : copy[code]??'Private history could not be completed. Try again.'});
    emit(code,code==='ACCOUNT_SESSION'||code==='ACCOUNT_STORAGE'||candidateCompatibility?'blocked':code==='HISTORY_NETWORK'||code==='HISTORY_READ_TIMEOUT'?'unknown':code==='HISTORY_STALE'||code==='HISTORY_FENCED'?'skipped':'failed');
    if(options?.propagateErrors)throw new AccountSyncStepError(code,stage,true);
    return false;
  }
  finally{if(current())update(snapshot.restorePhase
    ? {busy:false,restorePhase:undefined,done:0,total:0}
    : {busy:false});}
}
async function refresh(current:()=>boolean,transport:BoundTransport) {
  const result=historyStatus(await transport({action:'status',input:{}}));
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  const owner=account().getLocalOwner();
  const savedScope=owner?await replicaScope(owner):null;
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  if(result.ownerPending&&savedScope!==null){if(owner){recordContext.suspend(owner);await blockReplica(owner,current);}if(!current())throw new HistoryTransferError('HISTORY_FENCED');}
  if(result.status==='deleted'||savedScope!==null&&(savedScope!==scopeSignature(result)||result.pendingMerge===true&&!result.ownerPending&&!result.activeAggregate&&!result.activeSnapshot)) {
    recordContext.local(result.status==='deleted'?'HISTORY_CONTEXT_DELETED':savedScope!==scopeSignature(result)?'HISTORY_CONTEXT_SCOPE_CHANGED':'HISTORY_CONTEXT_AUTHORITY_LOST');
    if(owner){await clearReplica(owner);if(result.status==='deleted')await clearAccountJobs(owner);}
    if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  }
  await publishCurrentHistoryStatus(async()=>result,current,value=>{
    status=value;
    update({historyEnabled:value.historyConsent,hasSnapshot:!!(value.activeAggregate??value.activeSnapshot),revision:value.aggregateRevision??value.revision,sourceCount:value.sources.length,sources:value.sources,conflictCount:value.correctionConflicts??0,message:value.status==='deleted'?'Your account history was removed.':value.activeAggregate?'Your combined account history is available.':value.activeSnapshot?'A saved history version is available.':value.historyConsent?'History sync is enabled. Choose this device to transfer.':'Choose whether your private history is stored in your account.'});
  });
}
function scopeSignature(value:HistoryStatus):string {
  return JSON.stringify([value.generation,...value.sources.filter(source=>source.state==='removed').map(source=>[source.sourceId,source.generation]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}
async function replacementGuard(owner:string,current:()=>boolean,setStage:(stage:AppDiagnosticEvent['stage'])=>void,explicit:boolean){
 setStage('HISTORY_READ');
 const prior=await currentHistoryStep(current,()=>loadReplica(owner));
 const job=await currentHistoryStep(current,()=>loadCorrectionJob(owner));
 if(job&&((!job.resolved&&job.acceptedRevision===undefined)||explicit))throw new HistoryTransferError('HISTORY_REVIEW');
 if(!prior)return async()=>{if(await loadReplica(owner))throw new HistoryTransferError('HISTORY_REVIEW');};
 const baseline=(job?.resolved||job?.acceptedRevision!==undefined)?await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(job.currentRows)):await loadReplicaDigest(owner);
 if(!baseline)throw new HistoryTransferError('HISTORY_REVIEW');
 const stamp=recordContext.mutationStamp(prior.database_name);
 const verify=async()=>{
  const pointer=await currentHistoryStep(current,()=>loadReplica(owner));const pending=await currentHistoryStep(current,()=>loadCorrectionJob(owner));
  if(pointer?.database_name!==prior.database_name||JSON.stringify(pending)!==JSON.stringify(job)||!recordContext.mutationUnchanged(prior.database_name,stamp))throw new HistoryTransferError('HISTORY_REVIEW');
  const digest=await currentHistoryStep(current,async()=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(await exportLocalHistory(prior.database_name,{purpose:'replica-readback'}))));
  if(digest!==baseline||!recordContext.mutationUnchanged(prior.database_name,stamp))throw new HistoryTransferError('HISTORY_REVIEW');
 };
 await verify();return {verify,stable:()=>recordContext.mutationUnchanged(prior.database_name,stamp)};
}
async function restoreCurrent(owner:string,current:()=>boolean,setStage:(stage:AppDiagnosticEvent['stage'])=>void,transport:BoundTransport,explicit=false,correlationId=createDiagnosticCorrelationId()){
 const guard=await replacementGuard(owner,current,setStage,explicit);
 const verify=typeof guard==='function'?guard:guard.verify;
 const selectionIntent=recordContext.selectionIntent(owner);
 await refresh(current,transport);const aggregate=!!status?.activeAggregate;const id=status?.activeAggregate??status?.activeSnapshot;if(!id)throw new HistoryTransferError('HISTORY_STALE');
 setStage('HISTORY_PULL');const rows=await currentHistoryStep(current,()=>fetchHistorySnapshot(id,transport,current,aggregate,explicit?(done,total)=>{if(current())update({done,total});}:undefined));
 setStage('HISTORY_REPLICA_STAGE');const name=await currentHistoryStep(current,()=>stageAccountReplica(rows,{owner,current}));
 try{
 const repository=createNativeReconstructionRepository({databaseName:name});
 setStage('HISTORY_REBUILD');await currentHistoryStep(current,()=>repository.rebuild());
 setStage('HISTORY_READ');await currentHistoryStep(current,()=>repository.loadDurableReveal());
 const baselineRows=await currentHistoryStep(current,()=>exportLocalHistory(name,{purpose:'replica-readback'}));
 const digest=baselineRows?await currentHistoryStep(current,()=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(baselineRows))):undefined;
 setStage('HISTORY_AUTHORITY');await refresh(current,transport);if((status?.activeAggregate??status?.activeSnapshot)!==id||!current())throw new HistoryTransferError('HISTORY_STALE');
 if(!status)throw new HistoryTransferError('HISTORY_STALE');
 setStage('HISTORY_READ');await verify();
 const pointerCurrent=()=>{if(typeof guard!=='function'&&!guard.stable())throw new HistoryTransferError('HISTORY_REVIEW');return current();};
 setStage('HISTORY_POINTER');await saveReplica(owner,name,id,scopeSignature(status),pointerCurrent,digest,baselineRows?{rows:baselineRows,revision:status.ownerRevision??0,canonical:aggregate}:undefined);
 if(!current()){await clearReplicaIfMatching(owner,name);throw new HistoryTransferError('HISTORY_FENCED');}
 await recordContext.rebind(owner,selectionIntent);
 }finally{
  try{await retireReplicaFile(name);}catch{recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage:'HISTORY_REPLICA_STAGE',reasonCode:'HISTORY_STORAGE',retryable:true,durableOutcome:'unknown',correlationId});}
 }
}
export const historyService={
  getSnapshot:()=>snapshot,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  lock(){epoch++;status=null;impactMedia?.dispose();impactMedia=null;conflictMedia?.dispose();conflictMedia=null;update({busy:false,restorePhase:undefined,historyEnabled:false,hasSnapshot:false,done:0,total:0,revision:0,sourceCount:0,sources:[],review:null,sessions:null,impact:null,impactPreviews:[],conflict:null,conflictCount:0,conflictPreviews:{accepted:[],proposed:[]},message:'Sign in to use your account history.'});},
  refresh:(options?:AccountSyncActionOptions)=>action('HISTORY_AUTH',async(_owner,current,_stage,transport)=>{await refresh(current,transport);},options),
  enable:(options?:AccountSyncActionOptions)=>action('HISTORY_CONSENT',async(_owner,current,_stage,transport)=>{
    await refresh(current,transport);if(!status||status.status!=='active')throw new HistoryTransferError('HISTORY_FENCED');
    const live=status;
    if(!accountControlsEnabled){await transport({action:'consent',input:{mutationId:Crypto.randomUUID(),generation:live.generation,history:true,media:false}});await refresh(current,transport);return;}
    await runHistoryControl({current,load:()=>loadHistoryControl(_owner),create:()=>({action:'consent',input:{mutationId:Crypto.randomUUID(),generation:live.generation,expectedRevision:live.revision,history:true,media:false}}),matches:request=>request.action==='consent'&&request.input.history===true&&request.input.media===false,save:request=>saveHistoryControl(_owner,request),send:transport,refresh:()=>refresh(current,transport),clear:id=>clearHistoryControl(_owner,id)});
  },options),
  withdraw:()=>action('HISTORY_CONSENT',async(owner,current,setStage,transport)=>{
    if(!accountControlsEnabled)return 'skipped';
    await refresh(current,transport);if(!status)throw new HistoryTransferError('HISTORY_STALE');const live=status;
    await runHistoryControl({current,load:()=>loadHistoryControl(owner),create:()=>({action:'consent',input:{mutationId:Crypto.randomUUID(),generation:live.generation,expectedRevision:live.revision,history:false,media:false}}),matches:request=>request.action==='consent'&&request.input.history===false&&request.input.media===false,save:request=>{setStage('HISTORY_STAGE');return saveHistoryControl(owner,request);},send:request=>{setStage('HISTORY_CONSENT');return transport(request);},refresh:()=>refresh(current,transport),clear:id=>clearHistoryControl(owner,id)});
    recordContext.local('HISTORY_CONTEXT_UPLOADS_STOPPED');update({message:'New history uploads stopped. Retained history remains in your account. Private media access is withdrawn and its stored copies await cleanup.'});
  }),
  sessions:(page=0)=>action('HISTORY_SESSION_LIST',async(_owner,current,setStage,transport)=>{
    if(!accountControlsEnabled)return 'skipped';
    const value=await transport({action:'sessions',input:{page}});setStage('HISTORY_SCHEMA');
    const result=accountSessionPage(value,page);if(!current())throw new HistoryTransferError('HISTORY_FENCED');update({sessions:result});
  }),
  closeSessions:()=>update({sessions:null}),
  revokeSession:(sessionId:string)=>action('HISTORY_SESSION_REVOKE',async(owner,current,setStage,transport)=>{
    if(!accountControlsEnabled)return 'skipped';
    const selected=snapshot.sessions?.sessions.find(item=>item.sessionId===sessionId);if(!selected||selected.current)throw new HistoryTransferError('HISTORY_SCHEMA');
    await refresh(current,transport);if(!status)throw new HistoryTransferError('HISTORY_STALE');const generation=status.generation;
    await runHistoryControl({current,load:()=>loadHistoryControl(owner),create:()=>({action:'revoke-session',input:{mutationId:Crypto.randomUUID(),generation,sessionId}}),matches:request=>request.action==='revoke-session'&&request.input.sessionId===sessionId,save:request=>{setStage('HISTORY_STAGE');return saveHistoryControl(owner,request);},send:request=>{setStage('HISTORY_SESSION_REVOKE');return transport(request);},refresh:async()=>{const result=accountSessionPage(await transport({action:'sessions',input:{page:0}}),0);if(!current())throw new HistoryTransferError('HISTORY_FENCED');update({sessions:result});},clear:id=>clearHistoryControl(owner,id)});
    update({message:'That session can no longer access your account or refresh. An offline phone cannot be remotely wiped immediately.'});
  }),
  transfer:()=>action('HISTORY_EXPORT',async(owner,current,setStage,transport)=>{
    const outcome=await runNativeHistorySync({owner,current,trigger:'attach',transport,stage:setStage,progress:(done,total)=>{if(current())update({done,total});}});
    if(outcome==='already-running')return 'already-running';
    await refresh(current,transport);
    update({message:outcome==='unchanged'?'This device history matches its acknowledged version.':status?.activeAggregate?'This device contribution is saved. Restore the combined account history when ready.':'This device contribution is saved. Later sources wait for history merging; unsynchronized media stays at its source.'});
  }),
  catchUp:(trigger:'foreground'|'background'='foreground',options?:AccountSyncActionOptions)=>action('HISTORY_STAGE',async(owner,current,setStage,transport,mergeTransport,correlationId)=>{
    if(!accountSyncEnabled||trigger==='background')return 'skipped';
    let correctionsChanged=false;
    if(process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED==='true'){
      const live=historyStatus(await transport({action:'status',input:{}}));if(!current())throw new HistoryTransferError('HISTORY_FENCED');
      correctionsChanged=await syncOwnerCorrections({owner,generation:live.generation,current,uuid:()=>Crypto.randomUUID(),stage:setStage,load:()=>loadCorrectionJob(owner),baseline:()=>loadOwnerBaseline(owner),rows:async()=>{const replica=await currentHistoryStep(current,()=>loadReplica(owner));if(!replica)throw new HistoryTransferError('HISTORY_STALE');return exportLocalHistory(replica.database_name);},save:job=>saveCorrectionJob(job,current),accepted:async(job,revision)=>acceptCorrectionJob(job,revision,await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(job.currentRows)),current),send:transport,digest:rows=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,historyRowsJson(rows)),migrate:async job=>{if(!job.legacy)throw new HistoryTransferError('HISTORY_SCHEMA');setStage('HISTORY_REBUILD');try{await mergeTransport(job.legacy.buildId);}catch(error){throw new HistorySyncError(error instanceof HistoryTransferError?error.reason:'HISTORY_NETWORK','HISTORY_REBUILD');}if(!current())throw new HistoryTransferError('HISTORY_FENCED');setStage('HISTORY_CORRECTION');return mergeTransport.legacy(job.mutationId,{generation:job.generation,baseSnapshot:job.baseAggregate,expectedOwnerRevision:job.expectedOwnerRevision,baselineDigest:job.legacy.baselineDigest,editedDigest:job.legacy.editedDigest,changes:job.changes});}});
      correctionsChanged=correctionsChanged||!!live.activeSnapshot&&!live.activeAggregate;
    }
    const outcome=await runNativeHistorySync({owner,current,trigger,transport,stage:setStage,progress:(done,total)=>{if(current())update({done,total});},correlationId});
    if(outcome==='already-running')return 'already-running';
    await refresh(current,transport);
    await convergeAccountHistory({enabled:process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED==='true',current,contributionChanged:outcome==='complete'||correctionsChanged,refresh:async()=>{setStage('HISTORY_AUTHORITY');await refresh(current,transport);if(!status)throw new HistoryTransferError('HISTORY_STALE');return status;},merge:()=>runMergeJob({current,load:()=>mergeOperation(owner,()=>Crypto.randomUUID()),send:id=>{setStage('HISTORY_ACK');return mergeTransport(id);},refresh:()=>refresh(current,transport),clear:id=>clearMergeOperation(owner,id)}),replica:()=>loadReplica(owner),dirty:async()=>{
      setStage('HISTORY_READ');const replica=await currentHistoryStep(current,()=>loadReplica(owner));const pending=await currentHistoryStep(current,()=>loadCorrectionJob(owner));const baseline=(pending?.resolved||pending?.acceptedRevision!==undefined)?await currentHistoryStep(current,()=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(pending.currentRows))):await currentHistoryStep(current,()=>loadReplicaDigest(owner));if(!replica||!baseline)return true;
      const digest=await currentHistoryStep(current,async()=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(await exportLocalHistory(replica.database_name,{purpose:'replica-readback'}))));return digest!==baseline;
    },restore:()=>restoreCurrent(owner,current,setStage,transport,false,correlationId)});
    if(outcome==='complete')update({message:'This device contribution is acknowledged. Account history may still need combining before restoring.'});
  },options),
  // This entry point remains unexposed until the worker's rollout gates are met.
  merge:()=>action('HISTORY_STAGE',async(owner,current,setStage,transport,mergeTransport)=>{
    await refresh(current,transport);if(!status?.historyConsent)throw new HistoryTransferError('HISTORY_CONSENT');
    await runMergeJob({current,load:()=>mergeOperation(owner,()=>Crypto.randomUUID()),send:id=>{setStage('HISTORY_ACK');return mergeTransport(id);},refresh:()=>refresh(current,transport),clear:id=>clearMergeOperation(owner,id)});
    update({message:'Your combined account history is ready to restore.'});
  }),
  restore:(options?:AccountSyncActionOptions)=>action('HISTORY_AUTH',async(owner,current,diagnosticStage,transport,mergeTransport,correlationId)=>{
    update({restorePhase:'Preparing restore…'});
    const setStage=(stage:AppDiagnosticEvent['stage'])=>{
      diagnosticStage(stage);
      if(!current())return;
      if(stage==='HISTORY_PULL')update({restorePhase:'Downloading saved history…'});
      else if(stage==='HISTORY_REPLICA_STAGE'||stage==='HISTORY_REBUILD')update({restorePhase:'Preparing history on this phone…',done:0,total:0});
      else if(stage==='HISTORY_AUTHORITY'||stage==='HISTORY_POINTER')update({restorePhase:'Finishing restore…'});
    };
    if(process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED==='true'&&process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_CONVERGENCE_ENABLED==='true'){
      await refresh(current,transport);
      if(status?.activeSnapshot&&!status.activeAggregate)await runMergeJob({current,load:()=>mergeOperation(owner,()=>Crypto.randomUUID()),send:id=>{setStage('HISTORY_ACK');return mergeTransport(id);},refresh:()=>refresh(current,transport),clear:id=>clearMergeOperation(owner,id)});
    }
    await restoreCurrent(owner,current,setStage,transport,true,correlationId);
    if(current())update({message:'Your saved history is restored into a separate account record. Media availability is shown separately.'});
  },options),
  sourceControl:(sourceId:string,mode:'paused'|'disconnected'|'removed'|'active')=>action('HISTORY_DELETE',async(owner,current,setStage,transport)=>{
    const impact=mode==='removed'?snapshot.impact:null;
    if(mode==='removed'&&(!impact||impact.sourceId!==sourceId||process.env.EXPO_PUBLIC_TRAVEL_LIFE_SOURCE_REMOVAL_ENABLED!=='true'))throw new HistoryTransferError('HISTORY_STALE');
    await refresh(current,transport);const source=status?.sources.find(item=>item.sourceId===sourceId);
    if(!status||!source)throw new HistoryTransferError('HISTORY_STALE');
    const generation=status.generation;
    if(impact&&(impact.sourceGeneration!==source.generation||impact.sourceSnapshotRevision!==source.sourceSnapshotRevision||impact.accountGeneration!==generation||impact.accountRevision!==status.revision))throw new HistoryTransferError('HISTORY_CONFLICT');
    await runHistoryControl({current,load:()=>loadHistoryControl(owner),create:()=>({action:'source-control',input:{mutationId:Crypto.randomUUID(),generation,sourceId,sourceGeneration:source.generation,mode,...(impact?{expectedSourceRevision:impact.sourceSnapshotRevision,expectedAccountRevision:impact.accountRevision}:{})}}),matches:request=>request.action==='source-control'&&request.input.sourceId===sourceId&&request.input.mode===mode,save:request=>{setStage('HISTORY_STAGE');return saveHistoryControl(owner,request);},send:request=>{setStage('HISTORY_DELETE');return transport(request);},refresh:()=>refresh(current,transport),clear:id=>clearHistoryControl(owner,id)});
    if(current()&&mode==='removed'){impactMedia?.dispose();impactMedia=null;update({impact:null,impactPreviews:[]});}
    if(current())update({review:null,message:mode==='removed'?'Source contributions were removed. Independent owner facts were retained; source-linked proposals may need review.':mode==='active'?'Source reads can resume. Retained history was kept.':'Source reads stopped. Retained history and previously acknowledged private copies remain under your current account consent.'});
  }),
  previewSourceRemoval:(sourceId:string,page=0)=>action('HISTORY_ACK',async(owner,current,setStage,transport)=>{
    const prior=snapshot.impact;
    const result=sourceImpact(await transport({action:'source-impact',input:{sourceId,page,...(page>0&&prior?{expectedSourceRevision:prior.sourceSnapshotRevision}:{})}}));
    setStage('HISTORY_SCHEMA');if(!current())throw new HistoryTransferError('HISTORY_FENCED');
    if(result.sourceId!==sourceId||result.page!==page||page>0&&(!prior||sourceImpactScope(prior)!==sourceImpactScope(result)))throw new HistoryTransferError('HISTORY_STALE');
    impactMedia?.dispose();impactMedia=null;
    const refs=result.records.map(row=>{const mapped=result.media.find(item=>item.localKey===row.key&&row.kind==='evidence');return mapped?`account:${mapped.evidenceId}`:null;});
    let previews:readonly OwnerPreview[]=refs.map(()=>({uri:null,kind:'photo',availability:'unavailable'}));
    if(result.aggregateId&&result.media.length){impactMedia=createNativeAccountMedia(owner,result.aggregateId,current);previews=await impactMedia.adapter.resolveOwnerPreviews!(refs,refs.length);}
    if(!current())throw new HistoryTransferError('HISTORY_FENCED');update({impact:result,impactPreviews:previews});
  }),
  closeSourceRemoval:()=>{impactMedia?.dispose();impactMedia=null;update({impact:null,impactPreviews:[]});},
  reviewCorrections:(page=0)=>action('HISTORY_ACK',async(owner,current,setStage,transport)=>{
    if(process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED!=='true')return 'skipped';
    const response=await transport({action:'correction-conflicts',input:{page}});setStage('HISTORY_SCHEMA');const conflict=correctionConflictPage(response);
    if(!current())throw new HistoryTransferError('HISTORY_FENCED');if(conflict.page!==page)throw new HistoryTransferError('HISTORY_SCHEMA');
    conflictMedia?.dispose();conflictMedia=null;
    const previews:{accepted:OwnerPreview[][];proposed:OwnerPreview[][]}={accepted:[],proposed:[]};
    if(conflict.aggregateId)conflictMedia=createNativeAccountMedia(owner,conflict.aggregateId,current);
    for(const side of ['accepted','proposed'] as const)for(const row of conflict.proposal?.[side].rows??[]){
      const refs=correctionPreviewRefs(row);const resolved=refs.length&&conflictMedia?await conflictMedia.adapter.resolveOwnerPreviews!(refs,refs.length):[];
      if(!current())throw new HistoryTransferError('HISTORY_FENCED');previews[side].push(resolved);
    }
    update({conflict,conflictPreviews:previews});
  }),
  closeCorrections:()=>{conflictMedia?.dispose();conflictMedia=null;update({conflict:null,conflictPreviews:{accepted:[],proposed:[]}});},
  resolveCorrection:(choice:'accepted'|'proposed')=>action('HISTORY_CORRECTION',async(owner,current,setStage,transport)=>{
    const conflict=snapshot.conflict;if(!conflict?.proposal||process.env.EXPO_PUBLIC_TRAVEL_LIFE_CORRECTIONS_ENABLED!=='true')throw new HistoryTransferError('HISTORY_STALE');
    let revision=conflict.ownerRevision;
    await runHistoryControl({current,load:()=>loadHistoryControl(owner),create:()=>({action:'correction-resolve',input:{mutationId:Crypto.randomUUID(),generation:conflict.accountGeneration,expectedOwnerRevision:conflict.ownerRevision,proposalId:conflict.proposal!.mutationId,choice}}),matches:request=>request.action==='correction-resolve'&&request.input.proposalId===conflict.proposal!.mutationId&&request.input.choice===choice,save:request=>{setStage('HISTORY_STAGE');return saveHistoryControl(owner,request);},send:async request=>{setStage('HISTORY_CORRECTION');const result=await transport(request);if(result.status!=='accepted'||!Number.isSafeInteger(result.ownerRevision))throw new HistoryTransferError('HISTORY_NETWORK');revision=Number(result.ownerRevision);return {...result,status:'complete'};},refresh:async()=>{
      setStage('HISTORY_STAGE');const job=await currentHistoryStep(current,()=>loadCorrectionJob(owner));
      if(job?.mutationId===conflict.proposal!.mutationId)await resolveCorrectionJob(job,revision,choice,current);
      await refresh(current,transport);
    },clear:id=>clearHistoryControl(owner,id)});
    update({conflict:null,message:'Your versioned resolution is saved. Sync account history to rebuild and pull the selected result.'});
  }),
  reviewSource:(sourceId:string,page=0,archived=false)=>action('HISTORY_ACK',async(_owner,current,setStage,transport)=>{
    const response=await transport({action:'source-review',input:{sourceId,page,archived}});setStage('HISTORY_SCHEMA');
    const result=sourceReviewResponse(sourceId,page,response);
    if(!current())throw new HistoryTransferError('HISTORY_FENCED');
    if(page>0&&(snapshot.review?.sourceId!==sourceId||snapshot.review.revision!==result.revision||snapshot.review.archived!==result.archived))throw new HistoryTransferError('HISTORY_STALE');
    update({review:result});
  }),
  closeSourceReview:()=>update({review:null}),
  resumeSourceAction:()=>action('HISTORY_STAGE',async(owner,current,setStage,transport)=>{
    const pending=await loadHistoryControl(owner);if(!pending){if(current())update({message:'No source action is waiting for acknowledgement.'});return;}
    await runHistoryControl({current,load:async()=>pending,create:()=>pending,matches:()=>true,save:request=>saveHistoryControl(owner,request),send:request=>{setStage('HISTORY_DELETE');return transport(request);},refresh:()=>refresh(current,transport),clear:id=>clearHistoryControl(owner,id)});
    if(current())update({review:null,message:'The saved source action is acknowledged.'});
  }),
  archiveSourceProposals:()=>action('HISTORY_DELETE',async(owner,current,setStage,transport)=>{
    const review=snapshot.review;if(!review||review.archived)throw new HistoryTransferError('HISTORY_STALE');
    await refresh(current,transport);const source=status?.sources.find(item=>item.sourceId===review.sourceId);
    if(!status||!source||source.state!=='removed')throw new HistoryTransferError('HISTORY_STALE');
    const generation=status.generation;
    await runHistoryControl({current,load:()=>loadHistoryControl(owner),create:()=>({action:'resolve-conflict',input:{mutationId:Crypto.randomUUID(),generation,sourceId:review.sourceId,sourceGeneration:source.generation,expectedSourceRevision:review.revision,mode:'archive-source-proposals'}}),matches:request=>request.action==='resolve-conflict'&&request.input.sourceId===review.sourceId,save:request=>{setStage('HISTORY_STAGE');return saveHistoryControl(owner,request);},send:request=>{setStage('HISTORY_DELETE');return transport(request);},refresh:()=>refresh(current,transport),clear:id=>clearHistoryControl(owner,id)});
    if(current())update({review:null,message:'Source-linked proposals are archived for review. Independent trips, home areas and their privacy choices remain available for rebuilding.'});
  }),
};
