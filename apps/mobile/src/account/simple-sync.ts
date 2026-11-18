import { classifyAppDiagnosticError, type AppDiagnosticEvent, type AppDiagnosticReasonCode } from '@/diagnostics/app-diagnostics';
import { AccountSyncStepError } from './sync-step-error';

type Phase='idle'|'waiting'|'consent'|'history'|'media'|'opening'|'ready'|'error';
export type SimpleSyncView=Readonly<{phase:Phase;busy:boolean;message:string;done:number;total:number}>;
type Dependencies={owner:()=>string|null;correlation:()=>string;emit:(event:AppDiagnosticEvent)=>void;wait:()=>Promise<void>;consent:(correlation:string)=>Promise<void>;history:(correlation:string)=>Promise<void>;media:(correlation:string,progress:(done:number,total:number,message:string)=>void)=>Promise<void>;open:(correlation:string)=>Promise<void>};
const initial=():SimpleSyncView=>({phase:'idle',busy:false,message:'',done:0,total:0});
function recovery(reason:AppDiagnosticReasonCode){
 if(reason==='ACCOUNT_DISABLED')return 'Account sync is unavailable in this build.';
 if(reason==='ACCOUNT_SESSION'||reason==='ACCOUNT_STORAGE')return 'Sign in again to sync your account.';
 if(reason==='MEDIA_UNAVAILABLE')return 'Sync from the phone that has your Replay memories. Your saved choices are kept.';
 if(reason==='MEDIA_CONFLICT'||reason==='HISTORY_REVIEW')return 'A saved change needs attention. Open Details to review it.';
 if(reason==='MEDIA_QUOTA'||reason==='HISTORY_QUOTA')return 'Account storage is full. Your saved history is kept.';
 if(reason==='ALREADY_RUNNING')return 'Sync is already running. Try again shortly.';
 if(reason==='MEDIA_CONSENT'||reason==='HISTORY_CONSENT')return 'Choose Sync to account to allow private history and Replay storage.';
 return 'Sync paused. Your saved progress is kept. Tap Try sync again.';
}
export function createSimpleAccountSync(deps:Dependencies){
 let state=initial();let epoch=0;const listeners=new Set<()=>void>();
 const update=(value:Partial<SimpleSyncView>)=>{state={...state,...value};listeners.forEach(listener=>listener());};
 return {
  getSnapshot:()=>state,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  lock(){epoch++;state=initial();listeners.forEach(listener=>listener());},
  consumeReady(){if(state.phase!=='ready')return false;update({phase:'idle'});return true;},
  async sync(allowPrivateReplay=false){
   if(state.busy){deps.emit({operation:'HISTORY_TRANSFER',stage:'ACCOUNT_SYNC_WAIT',reasonCode:'ALREADY_RUNNING',retryable:false,durableOutcome:'skipped',correlationId:deps.correlation()});return false;}
   const owner=deps.owner(),generation=++epoch,correlationId=deps.correlation();
   let stage:AppDiagnosticEvent['stage']='ACCOUNT_SYNC_CONSENT';
   const current=()=>generation===epoch&&deps.owner()===owner&&owner!==null;
   const emit=(reasonCode:AppDiagnosticReasonCode,durableOutcome:AppDiagnosticEvent['durableOutcome'])=>deps.emit({operation:'HISTORY_TRANSFER',stage,reasonCode,durableOutcome,retryable:['HISTORY_NETWORK','HISTORY_READ_TIMEOUT','MEDIA_NETWORK','MEDIA_STORAGE','DATABASE_BUSY','UNKNOWN','ALREADY_RUNNING'].includes(reasonCode),correlationId});
   const enter=(phase:Phase,next:AppDiagnosticEvent['stage'],message:string)=>{stage=next;update({phase,busy:true,message,done:0,total:0});emit('START','unchanged');};
   const check=()=>{if(!current())throw new AccountSyncStepError('ACCOUNT_SESSION',stage);};
   try{
    if(!owner)throw new AccountSyncStepError('ACCOUNT_SESSION',stage);
    if(!allowPrivateReplay)throw new AccountSyncStepError('MEDIA_CONSENT',stage);
    enter('waiting','ACCOUNT_SYNC_WAIT','Preparing account sync…');await deps.wait();check();
    enter('consent','ACCOUNT_SYNC_CONSENT','Preparing private storage…');await deps.consent(correlationId);check();
    enter('history','ACCOUNT_SYNC_HISTORY','Syncing your history…');await deps.history(correlationId);check();
    enter('media','ACCOUNT_SYNC_MEDIA','Syncing your Replay memories…');
    await deps.media(correlationId,(done,total,message)=>{if(current())update({done,total,message});});check();
    enter('opening','ACCOUNT_SYNC_OPEN','Opening your account history…');await deps.open(correlationId);check();
    emit('COMPLETE','complete');update({phase:'ready',busy:false,message:'Your account is up to date.',done:0,total:0});return true;
   }catch(error){
    const typed=error instanceof AccountSyncStepError?error:null;const reason=typed?.reason??classifyAppDiagnosticError(error);
    if(typed?.boundary)stage=typed.boundary;
    if(!typed?.diagnosticRecorded)emit(reason,reason==='ACCOUNT_SESSION'||reason==='MEDIA_CONSENT'?'blocked':reason==='HISTORY_FENCED'||reason==='MEDIA_ACCESS'?'skipped':'unknown');
    if(generation===epoch)update({phase:'error',busy:false,message:recovery(reason),done:0,total:0});return false;
   }
  },
 };
}
