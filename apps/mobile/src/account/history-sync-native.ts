import * as Crypto from 'expo-crypto';
import { nativePhotoAccess } from '@/photo-access/native-adapter';
import { createNativeImportRepository } from '@/import-record/repository';
import { recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { exportLocalHistory } from './history-native';
import { checkpointHistorySync, claimHistorySync, finishHistorySync, installationId, loadHistorySyncConfig, loadTransferJob, reconcileHistorySource, releaseHistorySync, renewHistorySync, type HistorySyncLease } from './history-store';
import { runHistorySync } from './history-sync';
import { historyStatus, HistoryTransferError, type HistoryTransport } from './history-transfer';

export const accountSyncEnabled=process.env.EXPO_PUBLIC_TRAVEL_LIFE_HISTORY_SYNC_ENABLED==='true';
export async function runNativeHistorySync(options:{owner:string;current:()=>boolean;trigger:'attach'|'foreground'|'background';transport:HistoryTransport;stage:(stage:AppDiagnosticEvent['stage'])=>void;progress:(done:number,total:number)=>void;correlationId?:string}){
 const check=()=>{if(!options.current())throw new HistoryTransferError('HISTORY_FENCED');};
 options.stage('HISTORY_STAGE');let config=await loadHistorySyncConfig(options.owner);check();
 const attach=options.trigger==='attach'||(!config?.enabled&&options.trigger==='foreground');
 if(!config&&!attach)return 'deferred' as const;
 if(config){
  options.stage('HISTORY_AUTH');const live=historyStatus(await options.transport({action:'status',input:{}}));check();
  if(live.status!=='active'||live.generation!==config.accountGeneration)throw new HistoryTransferError('HISTORY_FENCED');
  if(!live.historyConsent)throw new HistoryTransferError('HISTORY_CONSENT');
  const source=live.sources.find(item=>item.sourceId===config!.sourceId);
  if(source?.state==='active'&&source.generation!==config.sourceGeneration){
   const installation=await installationId(()=>Crypto.randomUUID());check();
   const ack=await options.transport({action:'register-source',input:{mutationId:Crypto.randomUUID(),generation:live.generation,installationId:installation,sourceId:config.sourceId}});check();
   if(ack.sourceId!==source.sourceId||ack.sourceGeneration!==source.generation)throw new HistoryTransferError('HISTORY_FENCED');
   options.stage('HISTORY_STAGE');config=await reconcileHistorySource(config,{sourceId:source.sourceId,sourceGeneration:source.generation,accountGeneration:live.generation},options.current);check();
  }
 }
 if(attach){
  options.stage('HISTORY_AUTH');const live=historyStatus(await options.transport({action:'status',input:{}}));check();
  if(!live.historyConsent)throw new HistoryTransferError('HISTORY_CONSENT');
  options.stage('HISTORY_STAGE');const installation=await installationId(()=>Crypto.randomUUID());check();
  const source=await options.transport({action:'register-source',input:{mutationId:Crypto.randomUUID(),generation:live.generation,installationId:installation,sourceId:Crypto.randomUUID()}});check();
  if(typeof source.sourceId!=='string'||!Number.isSafeInteger(source.sourceGeneration))throw new HistoryTransferError('HISTORY_SCHEMA');
  if(config&&(config.accountGeneration!==live.generation||config.sourceId!==source.sourceId||config.sourceGeneration!==source.sourceGeneration))throw new HistoryTransferError('HISTORY_FENCED');
  config={...(config??{lastDigest:null,attempts:0,nextAttemptAt:0,lastSuccessAt:null}),ownerId:options.owner,accountGeneration:live.generation,sourceId:source.sourceId,sourceGeneration:Number(source.sourceGeneration),enabled:true};
 }
 if(!config)throw new HistoryTransferError('HISTORY_SCHEMA');
 const lease:HistorySyncLease={config,leaseId:Crypto.randomUUID(),now:()=>Date.now(),current:options.current};
 const correlationId=options.correlationId??`local_${Crypto.randomUUID().replaceAll('-','')}`;
 const cleanupFailed=()=>recordAppDiagnostic({operation:'HISTORY_TRANSFER',stage:'HISTORY_LEASE',reasonCode:'HISTORY_STORAGE',retryable:true,durableOutcome:'unknown',correlationId});
 const outcome=await runHistorySync(config,{trigger:options.trigger==='background'?'background':'foreground',now:lease.now,current:options.current,stage:options.stage,uuid:()=>Crypto.randomUUID(),claim:()=>claimHistorySync(lease),renew:()=>renewHistorySync(lease),release:()=>releaseHistorySync(lease),cleanupFailed,load:()=>loadTransferJob(options.owner),checkpoint:job=>checkpointHistorySync(lease,job),finish:(updated,job)=>finishHistorySync(lease,updated,job),failed:updated=>finishHistorySync(lease,updated,null),status:async()=>historyStatus(await options.transport({action:'status',input:{}})),permitted:async()=>{
  const access=await nativePhotoAccess.inspect();check();if(!access||!['full','limited'].includes(access.scope))return false;
  const lifecycle=await createNativeImportRepository().getPrivateRecordLifecycle();check();return lifecycle.state==='connected';
 },exportRows:()=>exportLocalHistory(undefined,{stage:options.stage}),digest:rows=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(rows)),transport:options.transport,progress:options.progress});
 return outcome;
}

/** The OS task maintains the local Atlas. Account uploads require an explicit action. */
export async function runBackgroundAccountSync():Promise<boolean>{
 return true;
}
