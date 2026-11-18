export const PRIVATE_MEDIA_CONTRACT='travel-life-private-media-v1' as const;
export type PrivateMediaManifest={contractVersion:typeof PRIVATE_MEDIA_CONTRACT;kind:'photo'|'video'|'audio';mimeType:'image/jpeg'|'video/mp4'|'audio/mp4';byteLength:number;sha256:string;width:number|null;height:number|null;durationMillis:number|null};
export type PrivateMediaTarget={kind:'evidence';id:string}|{kind:'soundtrack';revision:string};
export const mediaObject=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const mediaUuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export const mediaKeys=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export const mediaInteger=(value:unknown,min:number,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
export function privateMediaTarget(value:unknown):PrivateMediaTarget|null {
  if(!mediaObject(value))return null;
  if(value.kind==='evidence'&&mediaKeys(value,['kind','id'])&&mediaUuid(value.id))return value as PrivateMediaTarget;
  if(value.kind==='soundtrack'&&mediaKeys(value,['kind','revision'])&&typeof value.revision==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value.revision))return value as PrivateMediaTarget;
  return null;
}
/** These are admission limits, not a claim every admitted file fits Edge resources. */
export function privateMediaManifest(value:unknown):PrivateMediaManifest|null {
  if(!mediaObject(value)||!mediaKeys(value,['contractVersion','kind','mimeType','byteLength','sha256','width','height','durationMillis'])||value.contractVersion!==PRIVATE_MEDIA_CONTRACT||typeof value.sha256!=='string'||!(/^[a-f0-9]{64}$/).test(value.sha256))return null;
  if(!mediaInteger(value.byteLength,1,value.kind==='photo'?20*1024*1024:100*1024*1024))return null;
  if(value.kind==='photo'){
    if(value.mimeType!=='image/jpeg'||!mediaInteger(value.width,1,8192)||!mediaInteger(value.height,1,8192)||value.width*value.height>16777216||value.durationMillis!==null)return null;
  }else if(value.kind==='video'){
    if(value.mimeType!=='video/mp4'||!mediaInteger(value.width,1,3840)||!mediaInteger(value.height,1,3840)||value.width*value.height>8294400||!mediaInteger(value.durationMillis,1,3600000))return null;
  }else if(value.kind==='audio'){
    if(value.mimeType!=='audio/mp4'||value.width!==null||value.height!==null||!mediaInteger(value.durationMillis,1,3600000))return null;
  }else return null;
  return value as PrivateMediaManifest;
}
export async function mediaDigest(bytes:Uint8Array):Promise<string>{
 // WebCrypto reads only this view's byte range. Avoid an additional 32 MiB WASM
 // copy; Uint8Array.from also needlessly duplicated ordinary media payloads.
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))).map(value=>value.toString(16).padStart(2,'0')).join('');
}
export class PrivateMediaFault extends Error {
  readonly reason:string;readonly boundary?:string;
  constructor(reason:string,boundary?:string){super('Private media is unavailable.');this.name='PrivateMediaFault';this.reason=reason;this.boundary=boundary;}
}
