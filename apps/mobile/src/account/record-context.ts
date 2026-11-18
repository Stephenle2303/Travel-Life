import { createNativeImportRepository } from '@/import-record/repository';
import { createNativeReconstructionRepository } from '@/reconstruction/repository';
import { createNativeAccountMedia } from './media-native';
import { getAccountService } from './service';
import { loadAtlasAccountPreference, loadReplica, replicaBlocked, saveAtlasAccountPreference } from './history-store';
import { HistoryTransferError } from './history-transfer';
import { selectReplicaConnection } from './replica-connections';
import {classifyAppDiagnosticError,createDiagnosticCorrelationId,recordAppDiagnostic,type AppDiagnosticEvent} from '@/diagnostics/app-diagnostics';

let revision=0;
let intent=0;
let selection:{owner:string;databaseName:string;correlationId:string}|null=null;
let suspended:{owner:string;request:number}|null=null;
const listeners=new Set<()=>void>();
let bindingSnapshot:{revision:number;repositories:ReturnType<typeof build>|null;account:boolean;correlationId:string}={revision,repositories:null,account:false,correlationId:createDiagnosticCorrelationId()};
const changed=()=>{revision++;bindingSnapshot={revision,repositories,account:selection!==null,correlationId:selection?.correlationId??createDiagnosticCorrelationId()};listeners.forEach(listener=>listener());};
let media:ReturnType<typeof createNativeAccountMedia>|null=null;
let repositories:ReturnType<typeof build>|null=null;
type LocalContextStage = 'HISTORY_CONTEXT_USER_LOCAL' | 'HISTORY_CONTEXT_OWNER_CHANGE' | 'HISTORY_CONTEXT_AUTH_LOST' | 'HISTORY_CONTEXT_SCOPE_CHANGED' | 'HISTORY_CONTEXT_AUTHORITY_LOST' | 'HISTORY_CONTEXT_UPLOADS_STOPPED' | 'HISTORY_CONTEXT_DELETED';
function contextTransition(stage:LocalContextStage|'HISTORY_CONTEXT_SUSPEND',correlationId=createDiagnosticCorrelationId()){
 recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage,reasonCode:'SKIPPED',retryable:false,durableOutcome:'skipped',correlationId});
}
const mutationsInFlight=new Map<string,{version:number;pending:number}>();
function build(name:string,adapter:ReturnType<typeof createNativeAccountMedia>['adapter'],current:()=>boolean){
 const reconstruction=createNativeReconstructionRepository({databaseName:name});
 const mutations=new Set(['saveJourneyCorrection','saveJourneyMemoryCorrection','saveJourneyPrivacy','restoreJourneyPrivacy','createManualJourney','saveConfiguredHomeAreaFromJourney','renameConfiguredHomeArea','removeConfiguredHomeArea','saveReplayDraft']);
 const reconstructionRepository=new Proxy(reconstruction,{get(target,key,receiver){
  const value=Reflect.get(target,key,receiver);if(typeof key!=='string'||!mutations.has(key)||typeof value!=='function')return value;
  return async(...args:unknown[])=>{
   if(!current())throw new HistoryTransferError('HISTORY_FENCED');
   const state=mutationsInFlight.get(name)??{version:0,pending:0};state.version++;state.pending++;mutationsInFlight.set(name,state);
   try{return await value.apply(target,args);}
   finally{state.pending--;state.version++;}
  };
 }});
 return {repository:createNativeImportRepository({databaseName:name}),reconstructionRepository,adapter};
}
export const recordContext={
  getSnapshot:()=>bindingSnapshot,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  isAccount:()=>selection!==null,
  getRepositories:()=>repositories,
  selectionIntent:(owner:string)=>selection?.owner===owner?intent:suspended?.owner===owner?suspended.request:null,
  suspend(owner:string){
    if(selection?.owner!==owner)return;
    contextTransition('HISTORY_CONTEXT_SUSPEND');
    suspended={owner,request:intent};selection=null;repositories=null;media?.dispose();media=null;selectReplicaConnection(null);changed();
  },
  mutationStamp:(name:string)=>({...mutationsInFlight.get(name)??{version:0,pending:0}}),
  mutationUnchanged:(name:string,stamp:{version:number;pending:number})=>{const now=mutationsInFlight.get(name)??{version:0,pending:0};return stamp.pending===0&&now.pending===0&&stamp.version===now.version;},
  async restoreSelection(){
    const request=intent;
    if(selection||suspended)return;
    const correlationId=createDiagnosticCorrelationId();
    let owner:string|null;
    try{owner=await loadAtlasAccountPreference();}
    catch{
      recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage:'HISTORY_OPEN_PREFERENCE',reasonCode:'HISTORY_STORAGE',retryable:true,durableOutcome:'failed',correlationId});
      return;
    }
    if(!owner||request!==intent)return;
    const account=getAccountService();
    try{if(!account.getLocalOwner())await account.restore();}
    catch{
      recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage:'HISTORY_OPEN_AUTH',reasonCode:'ACCOUNT_SESSION',retryable:true,durableOutcome:'blocked',correlationId});
      return;
    }
    if(request!==intent||account.getLocalOwner()!==owner)return;
    try{await this.openAccount(correlationId);}catch{/* The existing open stages record the failure. */}
  },
  async rebind(owner:string,request:number|null){
    const intended=()=>selection?.owner===owner||suspended?.owner===owner&&suspended.request===request;
    if(request===null||request!==intent||!intended()||getAccountService().getLocalOwner()!==owner)return false;
    const replica=await loadReplica(owner);const blocked=await replicaBlocked(owner);
    if(!replica||blocked||request!==intent||!intended()||getAccountService().getLocalOwner()!==owner)return false;
    const next=++intent;const current=()=>next===intent&&selection?.owner===owner&&getAccountService().getLocalOwner()===owner;
    media?.dispose();media=createNativeAccountMedia(owner,replica.snapshot_id,current);
    repositories=build(replica.database_name,media.adapter,current);selection={owner,databaseName:replica.database_name,correlationId:createDiagnosticCorrelationId()};suspended=null;selectReplicaConnection(replica.database_name);changed();return true;
  },
  async openAccount(actionCorrelationId?:string){
    const request=++intent;
    suspended=null;
    const correlationId=actionCorrelationId??createDiagnosticCorrelationId();let stage:AppDiagnosticEvent['stage']='HISTORY_OPEN_AUTH';
    const emit=(reasonCode:AppDiagnosticEvent['reasonCode'],durableOutcome:AppDiagnosticEvent['durableOutcome'])=>recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage,reasonCode,retryable:reasonCode==='DATABASE_BUSY'||reasonCode==='HISTORY_STORAGE',durableOutcome,correlationId});
    const enter=(next:AppDiagnosticEvent['stage'])=>{stage=next;emit('START','unchanged');};
    emit('START','unchanged');
    try{
      const owner=getAccountService().getLocalOwner();if(!owner)throw new HistoryTransferError('ACCOUNT_SESSION');
      enter('HISTORY_OPEN_REPLICA');const replica=await loadReplica(owner);
      if(!replica)throw new HistoryTransferError('HISTORY_INCOMPLETE');
      enter('HISTORY_OPEN_SCOPE');if(await replicaBlocked(owner))throw new HistoryTransferError('HISTORY_STALE');
      const authorized=()=>request===intent&&getAccountService().getLocalOwner()===owner;
      if(!authorized())throw new HistoryTransferError('HISTORY_FENCED');
      enter('HISTORY_OPEN_PREFERENCE');
      try{await saveAtlasAccountPreference(owner,authorized);}catch{throw new HistoryTransferError('HISTORY_STORAGE');}
      if(!authorized())throw new HistoryTransferError('HISTORY_FENCED');
      enter('HISTORY_OPEN_BIND');media?.dispose();
      const current=()=>request===intent&&selection?.owner===owner&&getAccountService().getLocalOwner()===owner;
      media=createNativeAccountMedia(owner,replica.snapshot_id,current);
      repositories=build(replica.database_name,media.adapter,current);selection={owner,databaseName:replica.database_name,correlationId};selectReplicaConnection(replica.database_name);changed();
      emit('COMPLETE','complete');
    }catch(error){
      const reason=error instanceof HistoryTransferError?error.reason:classifyAppDiagnosticError(error);
      emit(reason,reason==='HISTORY_FENCED'||reason==='HISTORY_STALE'?'skipped':reason==='ACCOUNT_SESSION'?'blocked':'failed');throw error;
    }
  },
  local(stage:LocalContextStage='HISTORY_CONTEXT_USER_LOCAL',correlationId=createDiagnosticCorrelationId()){
    if(selection||suspended)contextTransition(stage,correlationId);
    ++intent;
    selection=null;suspended=null;repositories=null;media?.dispose();media=null;selectReplicaConnection(null);changed();
    if(stage==='HISTORY_CONTEXT_USER_LOCAL')void saveAtlasAccountPreference(null,()=>true).catch(()=>{
      recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage:'HISTORY_OPEN_PREFERENCE',reasonCode:'HISTORY_STORAGE',retryable:true,durableOutcome:'failed',correlationId});
    });
  },
  checkOwner(){const owner=selection?.owner??suspended?.owner;if(owner&&getAccountService().getLocalOwner()!==owner)this.local('HISTORY_CONTEXT_OWNER_CHANGE');},
};
