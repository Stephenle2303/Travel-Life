import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { execute, getMediaInformation } from 'munim-ffmpeg';
import { nativePhotoAccess } from '@/photo-access/native-adapter';
import { prepareSelectedDerivative } from '@/share/derivative';
import { recordAppDiagnostic, type AppDiagnosticEvent } from '@/diagnostics/app-diagnostics';
import { privateMediaManifest, type PrivateMediaManifest } from '../../../../supabase/functions/_shared/private-media-protocol';
import { scrubMp4Metadata, verifyPrivateContainer } from '../../../../supabase/functions/_shared/share-media';
import { AccountMediaError } from './media-cache';

const stageMap:Partial<Record<NonNullable<AppDiagnosticEvent['stage']>,NonNullable<AppDiagnosticEvent['stage']>>>={SHARE_COPY:'MEDIA_COPY',SHARE_DECODE:'MEDIA_DECODE',SHARE_ENCODE:'MEDIA_ENCODE',SHARE_VERIFY:'MEDIA_VERIFY'};
const reasonMap:Partial<Record<AppDiagnosticEvent['reasonCode'],ConstructorParameters<typeof AccountMediaError>[0]>>={SHARE_STORAGE:'MEDIA_STORAGE',SHARE_DECODE:'MEDIA_DECODE',SHARE_ENCODE:'MEDIA_ENCODE',SHARE_VERIFY:'MEDIA_VERIFY',SHARE_CODEC:'MEDIA_UNAVAILABLE',SHARE_QUOTA:'MEDIA_QUOTA'};
const bytesOf=(base64:string)=>Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
const base64Of=(bytes:Uint8Array)=>{let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(value);};
export async function privatePreparedBytes(uri:string):Promise<Uint8Array>{
 if(!FileSystem.cacheDirectory||!uri.startsWith(FileSystem.cacheDirectory)||!/^private-selected-[a-f0-9-]{36}\.(jpg|mp4)$/.test(uri.slice(FileSystem.cacheDirectory.length)))throw new AccountMediaError('MEDIA_SCHEMA');
 const info=await FileSystem.getInfoAsync(uri);if(!info.exists||!info.size||info.size>100*1024*1024)throw new AccountMediaError('MEDIA_UNAVAILABLE');
 return bytesOf(await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64}));
}
/** Only this generated derivative may be read/deleted by the private upload queue. */
export async function removePrivatePrepared(uri:string){
 if(!FileSystem.cacheDirectory||!uri.startsWith(FileSystem.cacheDirectory)||!/^private-selected-[a-f0-9-]{36}\.(jpg|mp4)$/.test(uri.slice(FileSystem.cacheDirectory.length)))throw new AccountMediaError('MEDIA_SCHEMA');
 try{await FileSystem.deleteAsync(uri,{idempotent:true});}catch{throw new AccountMediaError('MEDIA_STORAGE','MEDIA_CLEANUP');}
}
export async function cleanupUnownedPrepared(owned:ReadonlySet<string>,correlationId:string){
 if(!FileSystem.cacheDirectory)throw new AccountMediaError('MEDIA_STORAGE','MEDIA_CLEANUP');
 try{for(const name of await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory)){
  if(!/^private-selected-[a-f0-9-]{36}(\.(jpg|mp4)|-source)$/.test(name))continue;
  const uri=FileSystem.cacheDirectory+name;if(!owned.has(uri))await FileSystem.deleteAsync(uri,{idempotent:true});
 }}catch{recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage:'MEDIA_CLEANUP',reasonCode:'MEDIA_STORAGE',retryable:true,durableOutcome:'unknown',correlationId});throw new AccountMediaError('MEDIA_STORAGE','MEDIA_CLEANUP');}
}
export async function preparePrivateMedia(input:({kind:'photo'|'video';sourceRef:string}|{kind:'audio';localUri:string})&{current:()=>boolean;consented:()=>Promise<boolean>;correlationId:string}):Promise<{uri:string;manifest:PrivateMediaManifest}>{
 let stage:AppDiagnosticEvent['stage']='MEDIA_AUTH';let generated:string|null=null;let staged:string|null=null;
 const current=()=>{if(!input.current())throw new AccountMediaError('MEDIA_ACCESS',stage);};
 const event=(reasonCode:AppDiagnosticEvent['reasonCode'],durableOutcome:AppDiagnosticEvent['durableOutcome'])=>recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage,reasonCode,durableOutcome,retryable:reasonCode==='MEDIA_STORAGE',correlationId:input.correlationId});
 const enter=(value:AppDiagnosticEvent['stage'])=>{stage=value;current();event('START','unchanged');};
 event('START','unchanged');
 try{
  current();if(!await input.consented())throw new AccountMediaError('MEDIA_CONSENT');current();
  if(!FileSystem.cacheDirectory)throw new AccountMediaError('MEDIA_STORAGE','MEDIA_COPY');
  const key=Crypto.randomUUID();generated=`${FileSystem.cacheDirectory}private-selected-${key}.${input.kind==='photo'?'jpg':'mp4'}`;
  let manifest:PrivateMediaManifest;
  if(input.kind!=='audio'){
   const permission=await nativePhotoAccess.inspect();current();if(!permission||!['full','limited'].includes(permission.scope))throw new AccountMediaError('MEDIA_ACCESS');
   const preview=(await nativePhotoAccess.resolveOwnerPreviews!([input.sourceRef],1))[0];current();
   if(!preview?.uri||preview.availability!=='available'||preview.kind!==input.kind)throw new AccountMediaError('MEDIA_UNAVAILABLE');
   let result;
   try{result=await prepareSelectedDerivative(preview.uri,input.kind,input.correlationId,detail=>{stage=stageMap[detail.stage!]??'MEDIA_VERIFY';if(detail.reasonCode==='START')event('START','unchanged');});}
   catch(error){if(error&&typeof error==='object'&&'stage' in error)stage=stageMap[String(error.stage) as NonNullable<AppDiagnosticEvent['stage']>]??stage;const reason=error&&typeof error==='object'&&'reason' in error?reasonMap[String(error.reason) as AppDiagnosticEvent['reasonCode']]:undefined;throw new AccountMediaError(reason??'UNKNOWN',stage);}
   try{current();enter('MEDIA_COPY');await FileSystem.copyAsync({from:result.uri,to:generated});}
   finally{await FileSystem.deleteAsync(result.uri,{idempotent:true});}
   const {kind,mimeType,byteLength,sha256,width,height,durationMillis}=result.manifest;
   manifest={contractVersion:'travel-life-private-media-v1',kind,mimeType,byteLength,sha256,width,height,durationMillis};
  }else{
   if(!input.localUri.startsWith('file:///'))throw new AccountMediaError('MEDIA_UNAVAILABLE');
   enter('MEDIA_COPY');const info=await FileSystem.getInfoAsync(input.localUri);current();
   if(!info.exists||!info.size||info.size>5_000_000)throw new AccountMediaError('MEDIA_QUOTA');
   staged=`${FileSystem.cacheDirectory}private-selected-${key}-source`;
   await FileSystem.copyAsync({from:input.localUri,to:staged});current();
   enter('MEDIA_DECODE');const source=await getMediaInformation(staged);current();
   if(!source.streams?.some(stream=>stream.codec_type==='audio'))throw new AccountMediaError('MEDIA_DECODE');
   const duration=Number(source.format?.duration);if(!Number.isFinite(duration)||duration<=0||duration>3600)throw new AccountMediaError('MEDIA_QUOTA');
   enter('MEDIA_ENCODE');const encoded=await execute(['-y','-i',staged,'-map','0:a:0','-vn','-sn','-dn','-map_metadata','-1','-map_metadata:s','-1','-map_chapters','-1','-c:a','aac','-b:a','128k','-fflags','+bitexact','-flags:a','+bitexact','-metadata','encoder=','-metadata:s:a','encoder=','-metadata:s:a','handler_name=SoundHandler','-use_editlist','0',generated]);current();
   if(!encoded.success)throw new AccountMediaError('MEDIA_ENCODE');
   enter('MEDIA_VERIFY');const output=await getMediaInformation(generated);current();
   const streams=output.streams??[];if(streams.length!==1||streams[0].codec_type!=='audio'||streams[0].codec_name!=='aac')throw new AccountMediaError('MEDIA_VERIFY');
   const bytes=scrubMp4Metadata(bytesOf(await FileSystem.readAsStringAsync(generated,{encoding:FileSystem.EncodingType.Base64})));
   await FileSystem.writeAsStringAsync(generated,base64Of(bytes),{encoding:FileSystem.EncodingType.Base64});
   const digest=new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,Uint8Array.from(bytes).buffer));
   manifest={contractVersion:'travel-life-private-media-v1',kind:'audio',mimeType:'audio/mp4',byteLength:bytes.length,sha256:Array.from(digest).map(byte=>byte.toString(16).padStart(2,'0')).join(''),width:null,height:null,durationMillis:Math.round(Number(output.format?.duration)*1000)};
  }
  enter('MEDIA_VERIFY');const bytes=await privatePreparedBytes(generated);current();
  if(!privateMediaManifest(manifest)||!verifyPrivateContainer(bytes,manifest))throw new AccountMediaError('MEDIA_VERIFY');
  if(!await input.consented())throw new AccountMediaError('MEDIA_CONSENT');current();
  return {uri:generated,manifest};
 }catch(error){
  if(error instanceof AccountMediaError&&error.boundary)stage=error.boundary;
  const reason=error instanceof AccountMediaError?error.reason:stage==='MEDIA_COPY'?'MEDIA_STORAGE':stage==='MEDIA_DECODE'?'MEDIA_DECODE':stage==='MEDIA_ENCODE'?'MEDIA_ENCODE':stage==='MEDIA_VERIFY'?'MEDIA_VERIFY':'UNKNOWN';
  event(reason,reason==='MEDIA_ACCESS'?'skipped':['MEDIA_STORAGE','MEDIA_NETWORK','UNKNOWN'].includes(reason)?'unknown':'blocked');
  if(generated)await FileSystem.deleteAsync(generated,{idempotent:true}).catch(()=>{recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage:'MEDIA_CLEANUP',reasonCode:'MEDIA_STORAGE',retryable:true,durableOutcome:'unknown',correlationId:input.correlationId});});
  throw new AccountMediaError(reason,stage);
 }finally{if(staged)await FileSystem.deleteAsync(staged,{idempotent:true}).catch(()=>{recordAppDiagnostic({operation:'PRIVATE_MEDIA',stage:'MEDIA_CLEANUP',reasonCode:'MEDIA_STORAGE',retryable:true,durableOutcome:'unknown',correlationId:input.correlationId});});}
}
