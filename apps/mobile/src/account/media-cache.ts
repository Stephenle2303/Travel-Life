import { createDiagnosticCorrelationId, recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { privateMediaManifest, type PrivateMediaManifest, type PrivateMediaTarget } from '../../../../supabase/functions/_shared/private-media-protocol';

type AuthorizedMedia={artifactId:string;revision:number;manifest:PrivateMediaManifest;url:string};
export type AccountMediaCache={read(key:string):Promise<Uint8Array|null>;write(key:string,bytes:Uint8Array,kind?:PrivateMediaManifest['kind']):Promise<string>;remove(key:string,expectedUri?:string):Promise<void>};
export class AccountMediaError extends Error {
  constructor(readonly reason:'MEDIA_ACCESS'|'MEDIA_NETWORK'|'MEDIA_VERIFY'|'MEDIA_STORAGE'|'ACCOUNT_SESSION'|'ACCOUNT_STORAGE'|'MEDIA_SCHEMA'|'MEDIA_CONFLICT'|'MEDIA_CONSENT'|'MEDIA_SCOPE'|'MEDIA_QUOTA'|'MEDIA_UNAVAILABLE'|'MEDIA_DECODE'|'MEDIA_ENCODE'|'ALREADY_RUNNING'|'UNKNOWN',readonly boundary:AppDiagnosticEvent['stage']|undefined=reason==='MEDIA_VERIFY'?'MEDIA_VERIFY':undefined){super('Account media is unavailable.');this.name='AccountMediaError';}
}
/** URLs are ephemeral; cache authority always comes from a fresh owner request. */
export function createAccountMediaResolver(options:{authorize(id:string,correlationId:string,target?:PrivateMediaTarget):Promise<AuthorizedMedia>;download(url:string,maxBytes:number):Promise<Uint8Array>;digest(bytes:Uint8Array):Promise<string>;cache:AccountMediaCache;correlation?:()=>string}){
  return async(input:{owner:string;evidenceId:string;target?:PrivateMediaTarget;current:()=>boolean}):Promise<{uri:string;kind:PrivateMediaManifest['kind']} >=>{
    const correlationId=(options.correlation??createDiagnosticCorrelationId)();let stage:AppDiagnosticEvent['stage']='MEDIA_AUTH';
    const check=()=>{if(!input.current())throw new AccountMediaError('MEDIA_ACCESS');};
    const emit=(reasonCode:AppDiagnosticEvent['reasonCode'],durableOutcome:AppDiagnosticEvent['durableOutcome'])=>recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage,reasonCode,durableOutcome,retryable:reasonCode==='MEDIA_NETWORK'||reasonCode==='MEDIA_STORAGE',correlationId});
    emit('START','unchanged');
    try{
      check();stage='MEDIA_FETCH';const media=await options.authorize(input.evidenceId,correlationId,input.target);check();
      stage='MEDIA_VERIFY';const manifest=privateMediaManifest(media.manifest);
      if(!manifest||(input.target?.kind==='soundtrack')!==(manifest.kind==='audio')||!Number.isSafeInteger(media.revision)||media.revision<1||!(/^[a-f0-9-]{36}$/i).test(media.artifactId)||!media.url.startsWith('https://'))throw new AccountMediaError('MEDIA_VERIFY');
      const key=JSON.stringify([input.owner,media.artifactId,media.revision]);
      stage='MEDIA_CACHE';let bytes=await options.cache.read(key);check();
      stage='MEDIA_VERIFY';
      if(bytes&&(bytes.length!==manifest.byteLength||await options.digest(bytes)!==manifest.sha256)){await options.cache.remove(key);bytes=null;}
      if(!bytes){stage='MEDIA_FETCH';bytes=await options.download(media.url,manifest.byteLength);check();stage='MEDIA_VERIFY';if(bytes.length!==manifest.byteLength||await options.digest(bytes)!==manifest.sha256)throw new AccountMediaError('MEDIA_VERIFY');}
      check();stage='MEDIA_CACHE';const uri=await options.cache.write(key,bytes,manifest.kind);
      if(!input.current()){await options.cache.remove(key,uri);throw new AccountMediaError('MEDIA_ACCESS');}
      emit('COMPLETE','complete');return {uri,kind:manifest.kind};
    }catch(error){if(error instanceof AccountMediaError&&error.boundary)stage=error.boundary;const reason=error instanceof AccountMediaError?error.reason:stage==='MEDIA_CACHE'?'MEDIA_STORAGE':stage==='MEDIA_VERIFY'?'MEDIA_VERIFY':'MEDIA_NETWORK';emit(reason,reason==='MEDIA_ACCESS'||reason==='ALREADY_RUNNING'?'skipped':['MEDIA_STORAGE','MEDIA_NETWORK','UNKNOWN'].includes(reason)?'unknown':'blocked');throw new AccountMediaError(reason,stage);}
  };
}
