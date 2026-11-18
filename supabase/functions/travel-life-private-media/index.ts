import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
import createCore from '../_shared/vendor/ffmpeg-core.mjs';
import { authenticateHistoryToken } from '../_shared/history-auth.ts';
import { createPrivateMediaDecoder } from '../_shared/private-media-decoder.ts';
import { privateMediaDiagnosticSink } from '../_shared/private-media-diagnostics.ts';
import { handlePrivateMedia } from '../_shared/private-media-runtime.ts';

const decode=createPrivateMediaDecoder({factory:async options=>{
  if(!globalThis.location)Object.defineProperty(globalThis,'location',{value:{href:'https://decoder.invalid/ffmpeg-core.mjs'},configurable:true});
  return createCore(options);
}});
const safeFetch:typeof fetch=async(...args)=>{try{return await fetch(...args);}catch{return new Response('{"error":"unavailable"}',{status:503,headers:{'content-type':'application/json'}});}};
Deno.serve(request=>{
 const url=Deno.env.get('SUPABASE_URL')??'';const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 const disabled=()=>handlePrivateMedia(request,{configured:false,backend:null as never,authenticate:async()=>null,decode,sink:privateMediaDiagnosticSink});
 if(!url||!key||Deno.env.get('PRIVATE_MEDIA_ENABLED')!=='true')return disabled();
 let client;try{client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}});}catch{return disabled();}
 return handlePrivateMedia(request,{configured:true,backend:client,authenticate:token=>authenticateHistoryToken(token,value=>client.auth.getUser(value)),decode,sink:privateMediaDiagnosticSink});
});
