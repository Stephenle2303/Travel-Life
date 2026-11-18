import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import {recordAppDiagnostic,type AppDiagnosticEvent} from '@/diagnostics/app-diagnostics';
import {getAccountService} from './service';
import {AccountStorageError} from './storage';
import {createHistoryTransport,historyStatus,HistoryTransferError,classifyHistoryFailure} from './history-transfer';
import {runAccountDeletion,type DeletionTicket,type DeletionStatus} from './deletion';
import {recordContext} from './record-context';
import {clearAccountJobs,clearReplica} from './history-store';

export const accountControlsEnabled=process.env.EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_CONTROLS_ENABLED==='true';
const key='travel-life-deletion-receipt-v1';
let snapshot={busy:false,message:'',pending:false};const listeners=new Set<()=>void>();
const update=(value:Partial<typeof snapshot>)=>{snapshot={...snapshot,...value};listeners.forEach(listener=>listener());};
const config={url:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL,key:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY};
async function load():Promise<DeletionTicket|null>{
 try{
  const raw=await SecureStore.getItemAsync(key);if(!raw)return null;
  const value=JSON.parse(raw) as DeletionTicket;
  if(!value||Object.keys(value).length!==4||typeof value.owner!=='string'||!Number.isSafeInteger(value.generation)||value.generation<1||!(/^[a-f0-9-]{36}$/).test(value.mutationId)||!(/^[a-f0-9]{64}$/).test(value.ticket))throw new AccountStorageError('ACCOUNT_SECURE_READ');
  return value;
 }catch{throw new AccountStorageError('ACCOUNT_SECURE_READ');}
}
async function receipt(ticket:DeletionTicket):Promise<DeletionStatus>{
 if(!config.url||!/^https:\/\/[^/]+$/.test(config.url)||!config.key)throw new HistoryTransferError('HISTORY_NETWORK');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(`${config.url}/rest/v1/rpc/travel_life_deletion_status`,{method:'POST',signal:controller.signal,headers:{apikey:config.key,'content-type':'application/json'},body:JSON.stringify({ticket:ticket.ticket})});
  const value:unknown=await response.json();
  if(!response.ok||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!['pending','completed','unavailable'].includes(String((value as {status?:unknown}).status)))throw new HistoryTransferError('HISTORY_NETWORK');
  return (value as {status:DeletionStatus}).status;
 }catch{throw new HistoryTransferError('HISTORY_NETWORK');}finally{clearTimeout(timer);}
}
async function action(work:(stage:(value:AppDiagnosticEvent['stage'])=>void)=>Promise<DeletionStatus>){
 if(snapshot.busy||!accountControlsEnabled||Platform.OS==='web')return;
 const correlationId=`local_${Crypto.randomUUID().replaceAll('-','')}`;let stage:AppDiagnosticEvent['stage']='HISTORY_AUTH';
 const emit=(reasonCode:AppDiagnosticEvent['reasonCode'],durableOutcome:AppDiagnosticEvent['durableOutcome'])=>recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage,reasonCode,durableOutcome,retryable:['HISTORY_NETWORK','ACCOUNT_STORAGE'].includes(reasonCode),correlationId});
 update({busy:true});emit('START','unchanged');
 try{const status=await work(value=>{stage=value;emit('START','unchanged');});update({pending:status==='pending',message:status==='completed'?'Your account identity and active account data have been deleted. Offline device copies and provider backups follow their separate retention policy.':status==='pending'?'Account access is blocked. Deletion is pending while stored objects and account credentials are purged.':'No deletion acknowledgement is available yet. Retry the saved request.'});emit(status==='completed'?'COMPLETE':'PAUSED',status==='completed'?'complete':'paused');}
 catch(error){const reason=error instanceof AccountStorageError?'ACCOUNT_STORAGE':classifyHistoryFailure(error);if(error instanceof AccountStorageError)stage=error.stage??'ACCOUNT_SECURE_READ';update({message:reason==='ACCOUNT_REAUTH'?'Sign out and verify a new email code before deleting this account.':reason==='ACCOUNT_STORAGE'?'This phone could not save or read the protected deletion receipt. Retry before leaving this account.':'Deletion acknowledgement is unavailable. Keep the saved receipt and retry.'});emit(reason,reason==='HISTORY_NETWORK'||reason==='UNKNOWN'?'unknown':'blocked');}
 finally{update({busy:false});}
}
async function acceptDeletion(ticket:DeletionTicket,stage:(value:AppDiagnosticEvent['stage'])=>void){
 const account=getAccountService();const matching=account.getLocalOwner()===ticket.owner;let switched=false;
 const unsubscribe=account.subscribe(()=>{const owner=account.getLocalOwner();if(owner!==null&&owner!==ticket.owner)switched=true;});
 try{
  if(matching){recordContext.local('HISTORY_CONTEXT_DELETED');stage('ACCOUNT_SECURE_DELETE');await account.invalidateSession();}
  stage('HISTORY_DELETE_CLEANUP');await clearReplica(ticket.owner);await clearAccountJobs(ticket.owner);
  if(matching&&!switched&&account.getLocalOwner()===null){stage('ACCOUNT_SECURE_DELETE');await account.signOut();if(account.getSnapshot().reason==='ACCOUNT_STORAGE')throw new AccountStorageError('ACCOUNT_SECURE_DELETE');}
 }finally{unsubscribe();}
}
export const accountDeletionService={
 getSnapshot:()=>snapshot,subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
 check:()=>action(async stage=>{stage('HISTORY_DELETE_STATUS');const ticket=await load();const result=ticket?await receipt(ticket):'unavailable';if(ticket&&result!=='unavailable')await acceptDeletion(ticket,stage);if(result==='completed'){stage('ACCOUNT_SECURE_DELETE');try{await SecureStore.deleteItemAsync(key);}catch{throw new AccountStorageError('ACCOUNT_SECURE_DELETE');}}return result;}),
 remove:()=>action(async stage=>{
  const account=getAccountService();const owner=account.getLocalOwner();if(!owner)throw new HistoryTransferError('ACCOUNT_SESSION');
  const current=()=>account.getLocalOwner()===owner;
  stage('HISTORY_STAGE');const saved=await load();if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  if(saved){
   if(saved.owner!==owner)throw new HistoryTransferError('HISTORY_CONFLICT');
   stage('HISTORY_DELETE_STATUS');const acknowledged=await receipt(saved);if(!current())throw new HistoryTransferError('HISTORY_FENCED');
   if(acknowledged!=='unavailable'){await acceptDeletion(saved,stage);return acknowledged;}
  }
  const transport=createHistoryTransport({...config,session:()=>account.getVerifiedSession(),fence:{owner,current}});
  const live=historyStatus(await transport({action:'status',input:{}}));
  let valid=true;const unsubscribe=account.subscribe(()=>{if(account.getLocalOwner()!==owner)valid=false;});
  let planned=saved;
  try{return await runAccountDeletion({current:()=>valid&&current(),load:async()=>saved,create:()=>{planned={owner,generation:live.generation,mutationId:Crypto.randomUUID(),ticket:Array.from(Crypto.getRandomBytes(32)).map(byte=>byte.toString(16).padStart(2,'0')).join('')};return planned;},save:async ticket=>{stage('HISTORY_STAGE');await SecureStore.setItemAsync(key,JSON.stringify(ticket),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},send:async ticket=>{stage('HISTORY_DELETE');const result=await transport({action:'delete-account',input:{mutationId:ticket.mutationId,generation:ticket.generation,ticket:ticket.ticket}});if(result.status!=='pending'&&result.status!=='completed')throw new HistoryTransferError('HISTORY_NETWORK');return result.status;},status:ticket=>{stage('HISTORY_DELETE_STATUS');return receipt(ticket);},accepted:async()=>{if(!planned)throw new HistoryTransferError('HISTORY_SCHEMA');await acceptDeletion(planned,stage);}});
  }finally{unsubscribe();}
 }),
};
