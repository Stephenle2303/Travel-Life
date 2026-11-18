import {createClient} from 'npm:@supabase/supabase-js@2.95.3';
import {handleAccountDeletionCleanup} from '../_shared/account-deletion-cleanup.ts';
import {historyDiagnosticSink} from '../_shared/history-diagnostics.ts';
import {mediaObject} from '../_shared/private-media-protocol.ts';

const safeFetch:typeof fetch=async(...args)=>{try{return await fetch(...args);}catch{return new Response('{"error":"unavailable"}',{status:503,headers:{'content-type':'application/json'}});}};
Deno.serve(request=>{
 const url=Deno.env.get('SUPABASE_URL')??'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
 const disabled=()=>handleAccountDeletionCleanup(request,{configured:false,secret:'',sink:historyDiagnosticSink,rpc:null as never,user:null as never,removeUser:null as never});
 if(!url||!key||Deno.env.get('ACCOUNT_DELETION_ENABLED')!=='true')return disabled();
 let client;try{client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}});}catch{return disabled();}
 return handleAccountDeletionCleanup(request,{
  secret:Deno.env.get('ACCOUNT_CLEANUP_SECRET')??'',sink:historyDiagnosticSink,
  rpc:async(action,input)=>{const result=await client.rpc('travel_life_account_deletion',{action,input});if(result.error||!mediaObject(result.data)||result.data.error)throw new Error('unavailable');return result.data;},
  user:async owner=>{const result=await client.auth.admin.getUserById(owner);if(result.error){if(result.error.code==='user_not_found')return false;throw new Error('unavailable');}return result.data.user!==null;},
  removeUser:async owner=>{const result=await client.auth.admin.deleteUser(owner);if(result.error)throw new Error('unavailable');},
 });
});
