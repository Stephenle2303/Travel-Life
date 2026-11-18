import { createDiagnosticCorrelationId,recordAppDiagnostic,classifyAppDiagnosticError } from '@/diagnostics/app-diagnostics';
import { createSimpleAccountSync } from './simple-sync';
import { getAccountService } from './service';
import { historyService } from './history-service';
import { privateMediaService } from './private-media-service';
import { recordContext } from './record-context';
import { AccountSyncStepError } from './sync-step-error';
import { classifyHistoryFailure } from './history-transfer';

type BusyService={getSnapshot:()=>{busy:boolean};subscribe:(listener:()=>void)=>()=>void};
async function idle(service:BusyService){
 const owner=getAccountService().getLocalOwner();
 if(!owner)throw new AccountSyncStepError('ACCOUNT_SESSION','ACCOUNT_SYNC_WAIT');
 if(!service.getSnapshot().busy)return;
 await new Promise<void>((resolve,reject)=>{
  let off=()=>{};let offOwner=()=>{};
  const check=()=>{if(getAccountService().getLocalOwner()!==owner){off();offOwner();reject(new AccountSyncStepError('ACCOUNT_SESSION','ACCOUNT_SYNC_WAIT'));}else if(!service.getSnapshot().busy){off();offOwner();resolve();}};
  off=service.subscribe(check);offOwner=getAccountService().subscribe(check);check();
 });
}
export const accountSyncService=createSimpleAccountSync({
 owner:()=>getAccountService().getLocalOwner(),correlation:createDiagnosticCorrelationId,emit:recordAppDiagnostic,
 wait:async()=>{await idle(historyService);await idle(privateMediaService);},
 consent:async correlationId=>{
  const options={correlationId,propagateErrors:true};
  await historyService.refresh(options);
  if(!historyService.getSnapshot().historyEnabled)await historyService.enable(options);
  await privateMediaService.refresh(options);
  if(!privateMediaService.getSnapshot().mediaConsent)await privateMediaService.consent(true,options);
 },
 history:async correlationId=>{
  await idle(historyService);const options={correlationId,propagateErrors:true};
  await historyService.catchUp('foreground',options);
  if(!historyService.getSnapshot().hasSnapshot)throw new AccountSyncStepError('HISTORY_INCOMPLETE','ACCOUNT_SYNC_HISTORY');
 },
 media:async(correlationId,progress)=>{
  await idle(privateMediaService);
  const off=privateMediaService.subscribe(()=>{const state=privateMediaService.getSnapshot();progress(state.done,state.total,state.message);});
  try{await privateMediaService.syncReplay({correlationId,propagateErrors:true});}finally{off();}
 },
 open:async correlationId=>{
  try{await recordContext.openAccount(correlationId);}
  catch(error){const reason=classifyHistoryFailure(error);throw new AccountSyncStepError(reason==='UNKNOWN'?classifyAppDiagnosticError(error):reason,'ACCOUNT_SYNC_OPEN',true);}
 },
});
let observedOwner:string|null=null;
export function observeAccountSyncOwner(){
 const check=()=>{const owner=getAccountService().getLocalOwner();if(owner!==observedOwner){observedOwner=owner;accountSyncService.lock();}};
 check();return getAccountService().subscribe(check);
}
