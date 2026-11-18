import { mediaDigest, PrivateMediaFault, type PrivateMediaManifest } from './private-media-protocol.ts';

type Core={FS:{writeFile(name:string,bytes:Uint8Array):void;unlink(name:string):void};setLogger(callback:()=>void):void;setProgress(callback:()=>void):void;reset():void;setTimeout(milliseconds:number):void;exec(...args:string[]):void;ret:number};
type Factory=(options:{wasmBinary:Uint8Array;print:()=>void;printErr:()=>void})=>Promise<Core>;
const ASSET='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm';
const DIGEST='9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7';
const LENGTH=32232419;
/** One bounded allocation; never keep every fetch chunk beside a second copy. */
export async function readDecoderAsset(body:ReadableStream<Uint8Array>,length:number):Promise<Uint8Array>{
 const reader=body.getReader();const bytes=new Uint8Array(length);let used=0;
 try{
  while(true){const chunk=await reader.read();if(chunk.done)break;
   if(chunk.value.length>length-used){await reader.cancel();throw new PrivateMediaFault('MEDIA_VERIFY','MEDIA_DECODE');}
   bytes.set(chunk.value,used);used+=chunk.value.length;
  }
  if(used!==length)throw new PrivateMediaFault('MEDIA_VERIFY','MEDIA_DECODE');
  return bytes;
 }finally{reader.releaseLock();}
}
export function executePrivateMediaDecode(core:Core,bytes:Uint8Array,manifest:PrivateMediaManifest):boolean {
  const name=manifest.kind==='photo'?'input.jpg':'input.mp4';
  core.FS.writeFile(name,bytes);core.reset();core.setTimeout(1500);
  core.exec('-nostdin','-v','error','-xerror','-err_detect','explode','-abort_on','empty_output+empty_output_stream','-protocol_whitelist','file,pipe','-i',name,'-map',manifest.kind==='audio'?'0:a:0':'0:v:0',...(manifest.kind==='video'?['-map','0:a:0?']:[]),'-f','null','-');
  return core.ret===0;
}
/** One request-owned core; no reused private FS/heap or Worker wrapper. */
export function createPrivateMediaDecoder(options:{factory:Factory;fetcher?:typeof fetch;assetBytes?:Uint8Array}){
  let running=false;
  return async(bytes:Uint8Array,manifest:PrivateMediaManifest,_correlationId:string):Promise<boolean>=>{
    if(running)throw new PrivateMediaFault('MEDIA_BUSY','MEDIA_DECODE');running=true;
    let core:Core|undefined;const name=manifest.kind==='photo'?'input.jpg':'input.mp4';
    try{
      let asset=options.assetBytes;
      if(!asset){
        let response;try{response=await (options.fetcher??fetch)(ASSET,{signal:AbortSignal.timeout(15000)});}catch{throw new PrivateMediaFault('MEDIA_UNAVAILABLE','MEDIA_DECODE');}
        if(!response.ok||!response.body)throw new PrivateMediaFault('MEDIA_UNAVAILABLE','MEDIA_DECODE');
        asset=await readDecoderAsset(response.body,LENGTH);
      }
      if(asset.length!==LENGTH||await mediaDigest(asset)!==DIGEST)throw new PrivateMediaFault('MEDIA_VERIFY','MEDIA_DECODE');
      try{core=await options.factory({wasmBinary:asset,print:()=>{},printErr:()=>{}});core.setLogger(()=>{});core.setProgress(()=>{});}catch{throw new PrivateMediaFault('MEDIA_UNAVAILABLE','MEDIA_DECODE');}
      // Structural admission already rejects extra tracks. Map every allowed
      // video/audio stream, decode to EOF, and reject empty output. No frame cap.
      return executePrivateMediaDecode(core,bytes,manifest);
    }catch(error){if(error instanceof PrivateMediaFault)throw error;throw new PrivateMediaFault('UNKNOWN','MEDIA_DECODE');}
    finally{
      // reset() does not erase FS. Always unlink request bytes explicitly.
      if(core)try{core.FS.unlink(name);}catch{running=false;throw new PrivateMediaFault('MEDIA_STORAGE','MEDIA_CLEANUP');}
      core=undefined;running=false;
    }
  };
}
