import { runOwnedTransaction, serializeNativeTransactions } from '@/database/native-transaction';
import { HistoryTransferError, type HistoryRequest, type TransferJob } from './history-transfer';
import { AccountMediaError } from './media-cache';
import { canAdvancePrivateMediaJob, validatePrivateMediaUploadJob, type PrivateMediaUploadJob } from './media-upload';
import type { HistorySyncConfig, SyncTransferJob } from './history-sync';
import { assertHistoryRow, type HistoryRow } from './history-contract';
import type { CorrectionJob } from './correction-sync';
import { accountReplicaName, closeReplicaConnections } from './replica-connections';

type DB={execAsync(sql:string):Promise<void>;runAsync(sql:string,...params:(string|number|null)[]):Promise<unknown>;getFirstAsync<T>(sql:string,...params:(string|number|null)[]):Promise<T|null>};
let connection:Promise<DB>|null=null;
async function open():Promise<DB> {
  connection??=(async()=>{
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite=require('expo-sqlite') as {openDatabaseAsync(name:string,options:{useNewConnection:boolean}):Promise<DB>};
    const db=serializeNativeTransactions(await sqlite.openDatabaseAsync('travel-life-account-control-v1.db',{useNewConnection:true}));
    await db.execAsync(`create table if not exists installation(id integer primary key check(id=1),installation_id text not null);
      create table if not exists transfer_job(owner_id text primary key,job_json text not null);
      create table if not exists merge_job(owner_id text primary key,operation_id text not null);
      create table if not exists history_control_job(owner_id text primary key,request_json text not null);
      create table if not exists private_media_job(owner_id text not null,mutation_id text not null,job_json text not null,primary key(owner_id,mutation_id));
      create table if not exists history_sync_config(owner_id text primary key,config_json text not null);
      create table if not exists history_sync_lease(owner_id text not null,source_id text not null,account_generation integer not null,source_generation integer not null,lease_id text not null,expires_at integer not null,primary key(owner_id,source_id));
      create table if not exists account_replica(owner_id text primary key,database_name text not null,snapshot_id text not null);
      create table if not exists account_replica_scope(owner_id text primary key,signature text not null);`);
    await db.execAsync('create table if not exists account_replica_digest(owner_id text primary key,digest text not null)');
    await db.execAsync('create table if not exists account_owner_base(owner_id text primary key,snapshot_id text not null,revision integer not null,rows_json text not null);create table if not exists account_correction_job(owner_id text primary key,job_json text not null)');
    await db.execAsync('create table if not exists account_owner_base_kind(owner_id text primary key,canonical integer not null)');
    await db.execAsync('create table if not exists account_replica_block(owner_id text primary key)');
    await db.execAsync('create table if not exists account_atlas_preference(id integer primary key check(id=1),owner_id text not null)');
    await db.execAsync("create table if not exists account_replica_file(database_name text primary key,owner_id text,state text not null check(state in ('staged','active','retired')),created_at integer not null)");
    return db;
  })().catch(error=>{connection=null;throw error;});
  return connection;
}
export async function loadAtlasAccountPreference():Promise<string|null> {
  const db=await open();
  const row=await db.getFirstAsync<{owner_id:string}>('select owner_id from account_atlas_preference where id=1');
  return row?.owner_id??null;
}
export async function saveAtlasAccountPreference(owner:string|null,current:()=>boolean):Promise<void> {
  const db=await open();
  await runOwnedTransaction(db,{kind:'foreground'},async db=>{
    if(!current())return;
    if(owner===null)await db.runAsync('delete from account_atlas_preference where id=1');
    else await db.runAsync('insert into account_atlas_preference(id,owner_id) values(1,?) on conflict(id) do update set owner_id=excluded.owner_id',owner);
  });
}
export async function installationId(uuid:()=>string):Promise<string> {
  const db=await open();
  return runOwnedTransaction(db,{kind:'foreground'},async db=>{
    const row=await db.getFirstAsync<{installation_id:string}>('select installation_id from installation where id=1');
    if(row)return row.installation_id;
    const id=uuid();await db.runAsync('insert into installation(id,installation_id) values(1,?)',id);return id;
  });
}
export async function loadTransferJob(owner:string):Promise<TransferJob|null> {
  const db=await open();const row=await db.getFirstAsync<{job_json:string}>('select job_json from transfer_job where owner_id=?',owner);
  if(!row)return null;const job=JSON.parse(row.job_json) as TransferJob;
  if(job.ownerId!==owner||!Array.isArray(job.requests)||!Number.isSafeInteger(job.next)||job.next<0||job.next>job.requests.length)throw new Error('Account transfer checkpoint is unavailable.');
  return job;
}
export async function saveTransferJob(job:TransferJob):Promise<void> {
  const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{await db.runAsync('insert into transfer_job(owner_id,job_json) values(?,?) on conflict(owner_id) do update set job_json=excluded.job_json',job.ownerId,JSON.stringify(job));});
}
export async function clearTransferJob(owner:string):Promise<void> {
  const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{await db.runAsync('delete from transfer_job where owner_id=?',owner);});
}
export async function mergeOperation(owner:string,uuid:()=>string):Promise<string> {
  const db=await open();return runOwnedTransaction(db,{kind:'foreground'},async db=>{
    const row=await db.getFirstAsync<{operation_id:string}>('select operation_id from merge_job where owner_id=?',owner);
    if(row)return row.operation_id;
    const id=uuid();await db.runAsync('insert into merge_job(owner_id,operation_id) values(?,?)',owner,id);return id;
  });
}
export async function clearMergeOperation(owner:string,id:string):Promise<void> {
  const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{await db.runAsync('delete from merge_job where owner_id=? and operation_id=?',owner,id);});
}
export async function loadHistoryControl(owner:string):Promise<HistoryRequest|null> {
  try {
    const db=await open();const row=await db.getFirstAsync<{request_json:string}>('select request_json from history_control_job where owner_id=?',owner);
    if(!row)return null;
    const request=JSON.parse(row.request_json) as HistoryRequest;
    if(!request||!['source-control','resolve-conflict','consent','revoke-session','correction-resolve'].includes(request.action)||!request.input||typeof request.input.mutationId!=='string')throw new HistoryTransferError('HISTORY_SCHEMA');
    return request;
  } catch(error){if(error instanceof HistoryTransferError)throw error;throw new HistoryTransferError('HISTORY_STORAGE');}
}
export async function saveHistoryControl(owner:string,request:HistoryRequest):Promise<void> {
  try {const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{await db.runAsync('insert into history_control_job(owner_id,request_json) values(?,?) on conflict(owner_id) do update set request_json=excluded.request_json',owner,JSON.stringify(request));});}
  catch {throw new HistoryTransferError('HISTORY_STORAGE');}
}
export async function clearHistoryControl(owner:string,mutationId:string):Promise<void> {
  try {const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
    const row=await db.getFirstAsync<{request_json:string}>('select request_json from history_control_job where owner_id=?',owner);
    if(row&&(JSON.parse(row.request_json) as HistoryRequest).input.mutationId===mutationId)await db.runAsync('delete from history_control_job where owner_id=?',owner);
  });}catch {throw new HistoryTransferError('HISTORY_STORAGE');}
}
export async function saveReplica(owner:string,databaseName:string,snapshotId:string,signature:string,current:()=>boolean,digest?:string,baseline?:{rows:readonly HistoryRow[];revision:number;canonical?:boolean}):Promise<void> {
  if(!/^travel-life-account-[a-f0-9-]{36}\.db$/.test(databaseName))throw new Error('Account replica is unavailable.');
  try {
    const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
      if(!current())throw new HistoryTransferError('HISTORY_FENCED');
      const previous=await db.getFirstAsync<{database_name:string}>('select database_name from account_replica where owner_id=?',owner);
      await db.runAsync('insert into account_replica(owner_id,database_name,snapshot_id) values(?,?,?) on conflict(owner_id) do update set database_name=excluded.database_name,snapshot_id=excluded.snapshot_id',owner,databaseName,snapshotId);
      await db.runAsync('insert into account_replica_scope(owner_id,signature) values(?,?) on conflict(owner_id) do update set signature=excluded.signature',owner,signature);
      if(digest)await db.runAsync('insert into account_replica_digest(owner_id,digest) values(?,?) on conflict(owner_id) do update set digest=excluded.digest',owner,digest);
      else await db.runAsync('delete from account_replica_digest where owner_id=?',owner);
      if(baseline)await db.runAsync('insert into account_owner_base(owner_id,snapshot_id,revision,rows_json) values(?,?,?,?) on conflict(owner_id) do update set snapshot_id=excluded.snapshot_id,revision=excluded.revision,rows_json=excluded.rows_json',owner,snapshotId,baseline.revision,JSON.stringify(baseline.rows));
      if(baseline)await db.runAsync('insert into account_owner_base_kind(owner_id,canonical) values(?,?) on conflict(owner_id) do update set canonical=excluded.canonical',owner,baseline.canonical===true?1:0);
      if(baseline){
        const pending=await db.getFirstAsync<{job_json:string}>('select job_json from account_correction_job where owner_id=?',owner);
        if(pending){const job:unknown=JSON.parse(pending.job_json);validCorrectionJob(job,owner);
          const acceptedRevision=job.acceptedRevision??job.resolutionRevision;
          if(job.legacy&&acceptedRevision!==undefined&&(baseline.canonical!==true||baseline.revision<acceptedRevision||snapshotId===job.baseAggregate))throw new HistoryTransferError('HISTORY_STALE');
          if(baseline.canonical===true&&(job.resolved||job.acceptedRevision!==undefined)&&acceptedRevision!==undefined&&baseline.revision>=acceptedRevision&&snapshotId!==job.baseAggregate)await db.runAsync("delete from account_correction_job where owner_id=? and json_extract(job_json,'$.mutationId')=?",owner,job.mutationId);
        }
      }
      await db.runAsync('delete from account_replica_block where owner_id=?',owner);
      await db.runAsync("update account_replica_file set state='active',owner_id=? where database_name=?",owner,databaseName);
      if(previous&&previous.database_name!==databaseName)await db.runAsync("update account_replica_file set state='retired' where database_name=?",previous.database_name);
      if(!current())throw new HistoryTransferError('HISTORY_FENCED');
    });
  } catch(error){if(error instanceof HistoryTransferError)throw error;throw new HistoryTransferError('HISTORY_STORAGE');}
}
export async function reserveReplicaFile(name:string,owner:string|null,current:()=>boolean):Promise<void>{
 if(!accountReplicaName(name))throw new HistoryTransferError('HISTORY_SCHEMA');
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  const count=await db.getFirstAsync<{n:number}>('select count(*) as n from account_replica_file');if((count?.n??0)>=8)throw new HistoryTransferError('HISTORY_QUOTA');
  await db.runAsync("insert into account_replica_file(database_name,owner_id,state,created_at) values(?,?,'staged',?)",name,owner,Date.now());if(!current())throw new HistoryTransferError('HISTORY_FENCED');
 });}catch(error){return syncFailure(error);}
}
export async function retireReplicaFile(name:string):Promise<void>{
 if(!accountReplicaName(name))throw new HistoryTransferError('HISTORY_SCHEMA');
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{await db.runAsync("update account_replica_file set state='retired' where database_name=? and not exists(select 1 from account_replica where database_name=?)",name,name);});}catch(error){return syncFailure(error);}
}
export async function reclaimReplicaFiles():Promise<void>{
 try{const db=await open();for(let index=0;index<8;index++){
  const reclaimed=await runOwnedTransaction(db,{kind:'privacy'},async db=>{
   const candidate=await db.getFirstAsync<{database_name:string}>("select f.database_name from account_replica_file f where (f.state='retired' or f.state='staged' and f.created_at<?) and not exists(select 1 from account_replica r where r.database_name=f.database_name) order by f.created_at limit 1",Date.now()-24*60*60*1000);
   if(!candidate)return false;if(!accountReplicaName(candidate.database_name))throw new HistoryTransferError('HISTORY_SCHEMA');
   if(!await closeReplicaConnections(candidate.database_name))return false;
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const sqlite=require('expo-sqlite') as {defaultDatabaseDirectory:string;deleteDatabaseAsync(name:string):Promise<void>};
   // A crash can leave a reservation before SQLite created the file. Native
   // delete rejects absent files, so reconcile existence after closing handles.
   // eslint-disable-next-line @typescript-eslint/no-require-imports
   const {File}=require('expo-file-system') as {File:new(directory:string,name:string)=>{exists:boolean}};
   if(new File(sqlite.defaultDatabaseDirectory,candidate.database_name).exists)await sqlite.deleteDatabaseAsync(candidate.database_name);
   await db.runAsync('delete from account_replica_file where database_name=?',candidate.database_name);return true;
  });if(!reclaimed)break;
 }}catch(error){return syncFailure(error);}
}
export async function replicaScope(owner:string):Promise<string|null> {
  const db=await open();
  return (await db.getFirstAsync<{signature:string}>('select signature from account_replica_scope where owner_id=?',owner))?.signature??null;
}
export async function loadReplica(owner:string):Promise<{database_name:string;snapshot_id:string}|null> {
  const db=await open();return db.getFirstAsync('select r.database_name,r.snapshot_id from account_replica r inner join account_replica_scope s on s.owner_id=r.owner_id where r.owner_id=?',owner);
}
export async function loadReplicaDigest(owner:string):Promise<string|null>{const db=await open();return (await db.getFirstAsync<{digest:string}>('select digest from account_replica_digest where owner_id=?',owner))?.digest??null;}
export async function blockReplica(owner:string,current:()=>boolean):Promise<void>{const db=await open();await runOwnedTransaction(db,{kind:'privacy'},async db=>{if(!current())throw new HistoryTransferError('HISTORY_FENCED');await db.runAsync('insert into account_replica_block(owner_id) values(?) on conflict do nothing',owner);if(!current())throw new HistoryTransferError('HISTORY_FENCED');});}
export async function replicaBlocked(owner:string):Promise<boolean>{const db=await open();return !!await db.getFirstAsync('select owner_id from account_replica_block where owner_id=?',owner);}
export async function clearReplica(owner:string):Promise<void> {
  const db=await open();await runOwnedTransaction(db,{kind:'privacy'},async db=>{await db.runAsync('delete from account_replica where owner_id=?',owner);await db.runAsync('delete from account_replica_scope where owner_id=?',owner);await db.runAsync('delete from account_replica_digest where owner_id=?',owner);await db.runAsync('delete from account_owner_base where owner_id=?',owner);});
}
export async function clearReplicaIfMatching(owner:string,databaseName:string):Promise<void> {
  const db=await open();await runOwnedTransaction(db,{kind:'privacy'},async db=>{
    const row=await db.getFirstAsync<{database_name:string}>('select database_name from account_replica where owner_id=?',owner);
    if(row?.database_name!==databaseName)return;
    await db.runAsync('delete from account_replica where owner_id=? and database_name=?',owner,databaseName);
    await db.runAsync('delete from account_replica_scope where owner_id=?',owner);
    await db.runAsync('delete from account_replica_digest where owner_id=?',owner);
  });
}
export async function clearAccountJobs(owner:string):Promise<void> {
  const db=await open();await runOwnedTransaction(db,{kind:'privacy'},async db=>{await db.runAsync('delete from transfer_job where owner_id=?',owner);await db.runAsync('delete from merge_job where owner_id=?',owner);await db.runAsync('delete from history_control_job where owner_id=?',owner);await db.runAsync('delete from private_media_job where owner_id=?',owner);await db.runAsync('delete from history_sync_config where owner_id=?',owner);await db.runAsync('delete from history_sync_lease where owner_id=?',owner);await db.runAsync('delete from account_correction_job where owner_id=?',owner);});
  // Account deletion fences the pointer before this owner-only cleanup.
  await runOwnedTransaction(db,{kind:'privacy'},async db=>{
    await db.runAsync('delete from account_atlas_preference where owner_id=?',owner);
    await db.runAsync("update account_replica_file set state='retired' where owner_id=? and not exists(select 1 from account_replica r where r.database_name=account_replica_file.database_name)",owner);
  });
  await reclaimReplicaFiles();
}

export async function savePrivateMediaJob(job:PrivateMediaUploadJob,current:()=>boolean):Promise<void>{
 validatePrivateMediaUploadJob(job);
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!current())throw new AccountMediaError('MEDIA_ACCESS');
  const previous=await db.getFirstAsync<{job_json:string}>('select job_json from private_media_job where owner_id=? and mutation_id=?',job.owner,job.stageMutationId);
  if(previous){
   const old:unknown=JSON.parse(previous.job_json);validatePrivateMediaUploadJob(old);
   if(!canAdvancePrivateMediaJob(old,job))throw new AccountMediaError('MEDIA_CONFLICT');
  }else{
   const count=await db.getFirstAsync<{n:number}>('select count(*) as n from private_media_job where owner_id=?',job.owner);
   if((count?.n??0)>=100)throw new AccountMediaError('MEDIA_QUOTA');
  }
  await db.runAsync('insert into private_media_job(owner_id,mutation_id,job_json) values(?,?,?) on conflict(owner_id,mutation_id) do update set job_json=excluded.job_json',job.owner,job.stageMutationId,JSON.stringify(job));
  if(!current())throw new AccountMediaError('MEDIA_ACCESS');
 });}catch(error){if(error instanceof AccountMediaError)throw error;throw new AccountMediaError('MEDIA_STORAGE','MEDIA_STAGE');}
}
export async function loadPrivateMediaJob(owner:string):Promise<PrivateMediaUploadJob|null>{
 try{const db=await open();const row=await db.getFirstAsync<{job_json:string}>('select job_json from private_media_job where owner_id=? order by rowid limit 1',owner);if(!row)return null;
  const job:unknown=JSON.parse(row.job_json);validatePrivateMediaUploadJob(job);if(job.owner!==owner)throw new AccountMediaError('MEDIA_SCHEMA');return job;
 }catch(error){if(error instanceof AccountMediaError)throw error;throw new AccountMediaError('MEDIA_STORAGE','MEDIA_STAGE');}
}
export async function clearPrivateMediaJob(owner:string,mutationId:string,current:()=>boolean):Promise<void>{
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!current())throw new AccountMediaError('MEDIA_ACCESS');await db.runAsync('delete from private_media_job where owner_id=? and mutation_id=?',owner,mutationId);if(!current())throw new AccountMediaError('MEDIA_ACCESS');
 });}catch(error){if(error instanceof AccountMediaError)throw error;throw new AccountMediaError('MEDIA_STORAGE','MEDIA_CLEANUP');}
}
export async function privateMediaJobExists(owner:string,id:string):Promise<boolean>{
 try{const db=await open();return !!await db.getFirstAsync('select mutation_id from private_media_job where owner_id=? and mutation_id=?',owner,id);}catch{throw new AccountMediaError('MEDIA_STORAGE','MEDIA_STAGE');}
}
export async function privateMediaJobUris():Promise<Set<string>>{
 try{const db=await open();const rows=await db.getFirstAsync<{jobs:string}>('select coalesce(json_group_array(job_json),\'[]\') as jobs from private_media_job');return new Set((JSON.parse(rows?.jobs??'[]') as string[]).map(value=>{const job:unknown=JSON.parse(value);validatePrivateMediaUploadJob(job);return job.uri;}));}catch{throw new AccountMediaError('MEDIA_STORAGE','MEDIA_CLEANUP');}
}

export type HistorySyncLease={config:HistorySyncConfig;leaseId:string;now:()=>number;current:()=>boolean};
function validSyncConfig(value:unknown):asserts value is HistorySyncConfig{
 const cfg=value as HistorySyncConfig;
 if(!cfg||typeof cfg!=='object'||typeof cfg.ownerId!=='string'||!cfg.ownerId||!Number.isSafeInteger(cfg.accountGeneration)||cfg.accountGeneration<1||typeof cfg.sourceId!=='string'||!Number.isSafeInteger(cfg.sourceGeneration)||cfg.sourceGeneration<1||typeof cfg.enabled!=='boolean'||cfg.lastDigest!==null&&(typeof cfg.lastDigest!=='string'||!/^[a-f0-9]{64}$/.test(cfg.lastDigest))||!Number.isSafeInteger(cfg.attempts)||cfg.attempts<0||cfg.attempts>5||!Number.isSafeInteger(cfg.nextAttemptAt)||cfg.nextAttemptAt<0||cfg.lastSuccessAt!==null&&(!Number.isSafeInteger(cfg.lastSuccessAt)||cfg.lastSuccessAt<0))throw new HistoryTransferError('HISTORY_SCHEMA');
}
const syncFailure=(error:unknown):never=>{if(error instanceof HistoryTransferError)throw error;throw new HistoryTransferError('HISTORY_STORAGE');};
export async function loadHistorySyncConfig(owner:string):Promise<HistorySyncConfig|null>{
 try{const db=await open();const row=await db.getFirstAsync<{config_json:string}>('select config_json from history_sync_config where owner_id=?',owner);if(!row)return null;const config:unknown=JSON.parse(row.config_json);validSyncConfig(config);if(config.ownerId!==owner)throw new HistoryTransferError('HISTORY_SCHEMA');return config;}catch(error){return syncFailure(error);}
}
/** Only a live register-source acknowledgement for this installation may advance enrollment. */
export async function reconcileHistorySource(previous:HistorySyncConfig,ack:{sourceId:string;sourceGeneration:number;accountGeneration:number},current:()=>boolean):Promise<HistorySyncConfig>{
 if(ack.accountGeneration!==previous.accountGeneration||ack.sourceId!==previous.sourceId||!Number.isSafeInteger(ack.sourceGeneration)||ack.sourceGeneration<=previous.sourceGeneration)throw new HistoryTransferError('HISTORY_FENCED');
 try{const db=await open();return await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  const saved=await db.getFirstAsync<{config_json:string}>('select config_json from history_sync_config where owner_id=?',previous.ownerId);
  if(!saved||JSON.stringify(JSON.parse(saved.config_json))!==JSON.stringify(previous))throw new HistoryTransferError('HISTORY_FENCED');
  const pending=await db.getFirstAsync<{job_json:string}>('select job_json from transfer_job where owner_id=?',previous.ownerId);
  if(pending){const job=JSON.parse(pending.job_json) as TransferJob;
   if(job.ownerId!==previous.ownerId||job.generation!==previous.accountGeneration||!Array.isArray(job.requests)||job.requests.some(request=>request.input.sourceId!==previous.sourceId||request.input.sourceGeneration!==previous.sourceGeneration))throw new HistoryTransferError('HISTORY_FENCED');
   await db.runAsync('delete from transfer_job where owner_id=?',previous.ownerId);
  }
  await db.runAsync('delete from history_sync_lease where owner_id=? and source_id=? and account_generation=? and source_generation=?',previous.ownerId,previous.sourceId,previous.accountGeneration,previous.sourceGeneration);
  const next={...previous,sourceGeneration:ack.sourceGeneration,lastDigest:null,attempts:0,nextAttemptAt:0};
  await db.runAsync('update history_sync_config set config_json=? where owner_id=?',JSON.stringify(next),previous.ownerId);
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');return next;
 });}catch(error){return syncFailure(error);}
}
async function ownSyncLease(db:DB,lease:HistorySyncLease){
 if(!lease.current())throw new HistoryTransferError('HISTORY_FENCED');
 const cfg=lease.config;const row=await db.getFirstAsync<{lease_id:string}>('select lease_id from history_sync_lease where owner_id=? and source_id=? and account_generation=? and source_generation=? and lease_id=? and expires_at>?',cfg.ownerId,cfg.sourceId,cfg.accountGeneration,cfg.sourceGeneration,lease.leaseId,lease.now());
 if(!row||!lease.current())throw new HistoryTransferError('HISTORY_FENCED');
}
export async function claimHistorySync(lease:HistorySyncLease):Promise<boolean>{
 validSyncConfig(lease.config);
 try{const db=await open();return await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!lease.current())throw new HistoryTransferError('HISTORY_FENCED');const cfg=lease.config;
  const row=await db.getFirstAsync<{lease_id:string;expires_at:number}>('select lease_id,expires_at from history_sync_lease where owner_id=? and source_id=?',cfg.ownerId,cfg.sourceId);
  if(row&&row.expires_at>lease.now()&&row.lease_id!==lease.leaseId)return false;
  await db.runAsync('insert into history_sync_lease(owner_id,source_id,account_generation,source_generation,lease_id,expires_at) values(?,?,?,?,?,?) on conflict(owner_id,source_id) do update set account_generation=excluded.account_generation,source_generation=excluded.source_generation,lease_id=excluded.lease_id,expires_at=excluded.expires_at',cfg.ownerId,cfg.sourceId,cfg.accountGeneration,cfg.sourceGeneration,lease.leaseId,lease.now()+120000);
  if(!lease.current())throw new HistoryTransferError('HISTORY_FENCED');return true;
 });}catch(error){return syncFailure(error);}
}
export async function renewHistorySync(lease:HistorySyncLease):Promise<boolean>{
 try{const db=await open();return await runOwnedTransaction(db,{kind:'foreground'},async db=>{try{await ownSyncLease(db,lease);}catch(error){if(error instanceof HistoryTransferError&&error.reason==='HISTORY_FENCED')return false;throw error;}
  await db.runAsync('update history_sync_lease set expires_at=? where owner_id=? and source_id=? and lease_id=?',lease.now()+120000,lease.config.ownerId,lease.config.sourceId,lease.leaseId);if(!lease.current())throw new HistoryTransferError('HISTORY_FENCED');return true;
 });}catch(error){return syncFailure(error);}
}
export async function releaseHistorySync(lease:HistorySyncLease):Promise<void>{
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{await db.runAsync('delete from history_sync_lease where owner_id=? and source_id=? and lease_id=?',lease.config.ownerId,lease.config.sourceId,lease.leaseId);});}catch(error){return syncFailure(error);}
}
export async function checkpointHistorySync(lease:HistorySyncLease,job:SyncTransferJob):Promise<void>{
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  await ownSyncLease(db,lease);const cfg=lease.config;
  if(job.ownerId!==cfg.ownerId||job.generation!==cfg.accountGeneration||job.requests.some(request=>request.input.sourceId!==cfg.sourceId||request.input.sourceGeneration!==cfg.sourceGeneration)||!Number.isInteger(job.next)||job.next<0||job.next>job.requests.length)throw new HistoryTransferError('HISTORY_SCHEMA');
  const row=await db.getFirstAsync<{job_json:string}>('select job_json from transfer_job where owner_id=?',cfg.ownerId);
  if(row){const old=JSON.parse(row.job_json) as SyncTransferJob;if(old.snapshotId!==job.snapshotId||old.next>job.next||JSON.stringify(old.requests)!==JSON.stringify(job.requests))throw new HistoryTransferError('HISTORY_CONFLICT');}
  await db.runAsync('insert into transfer_job(owner_id,job_json) values(?,?) on conflict(owner_id) do update set job_json=excluded.job_json',cfg.ownerId,JSON.stringify(job));await ownSyncLease(db,lease);
 });}catch(error){return syncFailure(error);}
}
export async function finishHistorySync(lease:HistorySyncLease,config:HistorySyncConfig,job:SyncTransferJob|null):Promise<void>{
 validSyncConfig(config);
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  await ownSyncLease(db,lease);
  if(config.ownerId!==lease.config.ownerId||config.sourceId!==lease.config.sourceId||config.sourceGeneration!==lease.config.sourceGeneration||config.accountGeneration!==lease.config.accountGeneration)throw new HistoryTransferError('HISTORY_FENCED');
  if(job){const row=await db.getFirstAsync<{job_json:string}>('select job_json from transfer_job where owner_id=?',config.ownerId);const saved=row?JSON.parse(row.job_json) as SyncTransferJob:null;if(!saved||saved.snapshotId!==job.snapshotId||saved.next!==saved.requests.length)throw new HistoryTransferError('HISTORY_CONFLICT');
   await db.runAsync('delete from transfer_job where owner_id=?',config.ownerId);
  }
  await db.runAsync('insert into history_sync_config(owner_id,config_json) values(?,?) on conflict(owner_id) do update set config_json=excluded.config_json',config.ownerId,JSON.stringify(config));await ownSyncLease(db,lease);
 });}catch(error){return syncFailure(error);}
}
export async function suspendLocalHistorySync():Promise<void>{
 try{const db=await open();await runOwnedTransaction(db,{kind:'privacy'},async db=>{
  await db.runAsync("update history_sync_config set config_json=json_set(config_json,'$.enabled',json('false'))");
  await db.runAsync('delete from history_sync_lease');
 });}catch(error){return syncFailure(error);}
}
export async function loadOwnerBaseline(owner:string):Promise<{snapshotId:string;revision:number;rows:readonly HistoryRow[];canonical:boolean}|null>{
 try{const db=await open();const row=await db.getFirstAsync<{snapshot_id:string;revision:number;rows_json:string;canonical:number|null}>('select b.snapshot_id,b.revision,b.rows_json,k.canonical from account_owner_base b left join account_owner_base_kind k on k.owner_id=b.owner_id where b.owner_id=?',owner);if(!row)return null;
  const rows:unknown=JSON.parse(row.rows_json);if(!Array.isArray(rows)||!Number.isSafeInteger(row.revision)||row.revision<0)throw new HistoryTransferError('HISTORY_SCHEMA');for(const item of rows)assertHistoryRow(item);return {snapshotId:row.snapshot_id,revision:row.revision,rows,canonical:row.canonical===1};
 }catch(error){return syncFailure(error);}
}
function validCorrectionJob(value:unknown,owner:string):asserts value is CorrectionJob{
 const job=value as CorrectionJob;
 if(!job||typeof job!=='object'||job.owner!==owner||typeof job.mutationId!=='string'||typeof job.baseAggregate!=='string'||!Number.isSafeInteger(job.generation)||job.generation<1||!Number.isSafeInteger(job.expectedOwnerRevision)||job.expectedOwnerRevision<0||typeof job.conflict!=='boolean'||!Array.isArray(job.currentRows)||!job.changes||!Array.isArray(job.changes.rows)||!Array.isArray(job.changes.deleted)||job.changes.rows.length+job.changes.deleted.length>100)throw new HistoryTransferError('HISTORY_SCHEMA');
 for(const row of [...job.currentRows,...job.changes.rows])assertHistoryRow(row);
 if(job.legacy&&(!job.legacy.buildId||!['baselineDigest','editedDigest'].every(field=>/^[a-f0-9]{64}$/.test(job.legacy![field as 'baselineDigest'|'editedDigest']))))throw new HistoryTransferError('HISTORY_SCHEMA');
 if(job.acceptedRevision!==undefined&&(!job.legacy||!Number.isSafeInteger(job.acceptedRevision)||job.acceptedRevision<1))throw new HistoryTransferError('HISTORY_SCHEMA');
 if(job.resolved!==undefined&&(!['accepted','proposed'].includes(job.resolved)||!job.conflict||!Number.isSafeInteger(job.resolutionRevision)||Number(job.resolutionRevision)<1))throw new HistoryTransferError('HISTORY_SCHEMA');
}
export async function loadCorrectionJob(owner:string):Promise<CorrectionJob|null>{
 try{const db=await open();const row=await db.getFirstAsync<{job_json:string}>('select job_json from account_correction_job where owner_id=?',owner);if(!row)return null;const job:unknown=JSON.parse(row.job_json);validCorrectionJob(job,owner);return job;}catch(error){return syncFailure(error);}
}
export async function saveCorrectionJob(job:CorrectionJob,current:()=>boolean):Promise<void>{
 validCorrectionJob(job,job.owner);
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  const saved=await db.getFirstAsync<{job_json:string}>('select job_json from account_correction_job where owner_id=?',job.owner);
  if(saved){const old:unknown=JSON.parse(saved.job_json);validCorrectionJob(old,job.owner);if(JSON.stringify({...old,conflict:false})!==JSON.stringify({...job,conflict:false})||old.conflict&&!job.conflict)throw new HistoryTransferError('HISTORY_CONFLICT');}
  await db.runAsync('insert into account_correction_job(owner_id,job_json) values(?,?) on conflict(owner_id) do update set job_json=excluded.job_json',job.owner,JSON.stringify(job));
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
 });}catch(error){return syncFailure(error);}
}
export async function acceptCorrectionJob(job:CorrectionJob,revision:number,digest:string,current:()=>boolean):Promise<void>{
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  const saved=await db.getFirstAsync<{job_json:string}>('select job_json from account_correction_job where owner_id=?',job.owner);
  if(!saved||(JSON.parse(saved.job_json) as CorrectionJob).mutationId!==job.mutationId)throw new HistoryTransferError('HISTORY_CONFLICT');
  if(job.legacy){await db.runAsync('update account_correction_job set job_json=? where owner_id=?',JSON.stringify({...job,acceptedRevision:revision}),job.owner);if(!current())throw new HistoryTransferError('HISTORY_FENCED');return;}
  await db.runAsync('insert into account_owner_base(owner_id,snapshot_id,revision,rows_json) values(?,?,?,?) on conflict(owner_id) do update set snapshot_id=excluded.snapshot_id,revision=excluded.revision,rows_json=excluded.rows_json',job.owner,job.baseAggregate,revision,JSON.stringify(job.currentRows));
  await db.runAsync('insert into account_replica_digest(owner_id,digest) values(?,?) on conflict(owner_id) do update set digest=excluded.digest',job.owner,digest);
  await db.runAsync('delete from account_correction_job where owner_id=?',job.owner);if(!current())throw new HistoryTransferError('HISTORY_FENCED');
 });}catch(error){return syncFailure(error);}
}
/** Retain the rejected/local branch until an authoritative pull acknowledges the resolution. */
export async function resolveCorrectionJob(job:CorrectionJob,revision:number,choice:'accepted'|'proposed',current:()=>boolean):Promise<void>{
 try{const db=await open();await runOwnedTransaction(db,{kind:'foreground'},async db=>{
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
  const saved=await db.getFirstAsync<{job_json:string}>('select job_json from account_correction_job where owner_id=?',job.owner);
  if(!saved)throw new HistoryTransferError('HISTORY_CONFLICT');const prior:unknown=JSON.parse(saved.job_json);validCorrectionJob(prior,job.owner);
  if(prior.mutationId!==job.mutationId||!prior.conflict||prior.resolved!==undefined&&(prior.resolved!==choice||prior.resolutionRevision!==revision))throw new HistoryTransferError('HISTORY_CONFLICT');
  const next={...prior,resolved:choice,resolutionRevision:revision};validCorrectionJob(next,job.owner);
  await db.runAsync('update account_correction_job set job_json=? where owner_id=?',JSON.stringify(next),job.owner);
  if(!current())throw new HistoryTransferError('HISTORY_FENCED');
 });}catch(error){return syncFailure(error);}
}
