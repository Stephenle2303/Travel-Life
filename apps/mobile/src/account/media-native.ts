import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { AccountMediaError, createAccountMediaResolver, type AccountMediaCache } from './media-cache';
import { createMediaTransport } from './media-transport';
import { createAccountMediaAdapter, currentAccountMediaScope } from './media-adapter';
import { getAccountService } from './service';
import { classifyHistoryFailure, createHistoryTransport, historyStatus } from './history-transfer';

let initialized=false;

/** Private bounded session cache. URLs/owner IDs never become filesystem names. */
export function createNativeAccountMedia(owner:string,snapshotId:string,current:()=>boolean){
 const entries=new Map<string,{file:File;size:number}>();
 const directory=new Directory(Paths.cache,'account-private-media',Crypto.randomUUID());
 let used=0;let disposed=false;
 const live=()=>!disposed&&current();
 const initialize=()=>{
  if(initialized)return;
  const root=new Directory(Paths.cache,'account-private-media');
  root.create({intermediates:true,idempotent:true});
  // Only this module's generated session directories are candidates. A process
  // restart never makes old bytes authoritative; clear its orphaned sessions.
  for(const child of root.list())if(child instanceof Directory&&/^[a-f0-9-]{36}$/i.test(child.name))child.delete();
  initialized=true;
 };
 const cache:AccountMediaCache={
  async read(key){initialize();const entry=entries.get(key);return entry?.file.exists?entry.file.bytes():null;},
  async remove(key,expectedUri){const entry=entries.get(key);if(entry&&(!expectedUri||entry.file.uri===expectedUri)){if(entry.file.exists)entry.file.delete();entries.delete(key);used-=entry.size;}},
  async write(key,bytes,kind){
   if(!live())throw new AccountMediaError('MEDIA_ACCESS');
   const old=entries.get(key);
   // An unchanged verified cache hit needs no rewrite or new native handle.
   if(old?.file.exists)return old.file.uri;
   if(used+bytes.length>256*1024*1024)throw new AccountMediaError('MEDIA_STORAGE');
   initialize();directory.create({intermediates:true,idempotent:true});
   const file=new File(directory,`${Crypto.randomUUID()}.${kind==='photo'?'jpg':'mp4'}`);
   try{file.create();file.write(bytes);if(!live())throw new AccountMediaError('MEDIA_ACCESS');}
   catch(error){if(file.exists)file.delete();throw error;}
   entries.set(key,{file,size:bytes.length});used+=bytes.length;return file.uri;
  },
 };
 const config={url:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_URL,key:process.env.EXPO_PUBLIC_TRAVEL_LIFE_SUPABASE_PUBLISHABLE_KEY,session:(correlationId?:string)=>getAccountService().getVerifiedSession(correlationId),owner,current:live};
 const transport=createMediaTransport({...config,invalidateSession:async()=>{if(live()&&getAccountService().getLocalOwner()===owner)await getAccountService().invalidateSession();},enabled:process.env.EXPO_PUBLIC_TRAVEL_LIFE_PRIVATE_MEDIA_ENABLED==='true'});
 const history=createHistoryTransport({...config,fence:{owner,current:live}});
 const resolver=createAccountMediaResolver({correlation:()=>`local_${Crypto.randomUUID().replaceAll('-','')}`,authorize:(id,correlation,target)=>transport.authorize(target??{kind:'evidence',id},correlation),download:transport.download,digest:async bytes=>Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,Uint8Array.from(bytes).buffer))).map(byte=>byte.toString(16).padStart(2,'0')).join(''),cache});
 const adapter=createAccountMediaAdapter({current:live,authorized:async()=>{
  const correlationId=createDiagnosticCorrelationId();
  const emit=(reasonCode:'START'|'COMPLETE'|'MEDIA_ACCESS'|'MEDIA_NETWORK'|'ACCOUNT_SESSION'|'ACCOUNT_STORAGE'|'MEDIA_SCHEMA'|'HISTORY_FENCED'|'HISTORY_CONSENT'|'MEDIA_CONSENT'|'MEDIA_SCOPE',durableOutcome:'unchanged'|'complete'|'skipped'|'unknown'|'blocked')=>recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage:reasonCode==='ACCOUNT_STORAGE'?'ACCOUNT_SECURE_DELETE':reasonCode==='MEDIA_SCHEMA'?'MEDIA_VERIFY':'MEDIA_AUTH',reasonCode,durableOutcome,retryable:reasonCode==='MEDIA_NETWORK',correlationId});
  emit('START','unchanged');
  try{
   const status=historyStatus(await history({action:'status',input:{}}));
   const current=live();const allowed=current&&currentAccountMediaScope(status,snapshotId);
   const reason=!current?'HISTORY_FENCED':status.status!=='active'?'MEDIA_ACCESS':!status.historyConsent?'HISTORY_CONSENT':!status.mediaConsent?'MEDIA_CONSENT':!allowed?'MEDIA_SCOPE':'COMPLETE';
   emit(reason,allowed?'complete':'skipped');return allowed;
  }
  catch(error){
   const reason=classifyHistoryFailure(error);
   if(reason==='ACCOUNT_SESSION'&&live()&&getAccountService().getLocalOwner()===owner){
    try{await getAccountService().invalidateSession();emit('ACCOUNT_SESSION','blocked');}
    catch{emit('ACCOUNT_STORAGE','blocked');}return false;
   }
   const denied=!live()||['ACCOUNT_SESSION','HISTORY_FENCED','HISTORY_CONSENT'].includes(reason);
   emit(denied?'MEDIA_ACCESS':reason==='HISTORY_SCHEMA'?'MEDIA_SCHEMA':'MEDIA_NETWORK',denied?'skipped':reason==='HISTORY_SCHEMA'?'blocked':'unknown');return false;
  }
 },resolve:target=>resolver({owner,evidenceId:target.kind==='evidence'?target.id:target.revision,target,current:live})});
 return {adapter,dispose(){
  disposed=true;
  try{if(directory.exists)directory.delete();entries.clear();used=0;}
  catch{recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage:'MEDIA_CACHE',reasonCode:'MEDIA_STORAGE',retryable:true,durableOutcome:'unknown',correlationId:createDiagnosticCorrelationId()});}
 }};
}
