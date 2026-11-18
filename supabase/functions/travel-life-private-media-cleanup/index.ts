import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
import { privateMediaDiagnosticSink } from '../_shared/private-media-diagnostics.ts';
import { handlePrivateMediaCleanup } from '../_shared/private-media-cleanup.ts';
const safeFetch:typeof fetch=async(...args)=>{try{return await fetch(...args);}catch{return new Response('{"error":"unavailable"}',{status:503,headers:{'content-type':'application/json'}});}};
Deno.serve(request=>{
 const url=Deno.env.get('SUPABASE_URL')??'';const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 const disabled=()=>handlePrivateMediaCleanup(request,{configured:false,secret:'',backend:null as never,sink:privateMediaDiagnosticSink});
 if(!url||!key)return disabled();
 let client;try{client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}});}catch{return disabled();}
 return handlePrivateMediaCleanup(request,{secret:Deno.env.get('PRIVATE_MEDIA_CLEANUP_SECRET')??'',backend:client,sink:privateMediaDiagnosticSink});
});
