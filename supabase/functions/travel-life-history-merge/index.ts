import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
import { handleHistoryMerge } from '../_shared/history-runtime.ts';
import { historyDiagnosticSink } from '../_shared/history-diagnostics.ts';
import { authenticateHistoryToken } from '../_shared/history-auth.ts';

// Explicit Auth verification precedes use of the service-only worker RPC.
// Prevent SDK transport exception logging by supplying a closed rejected-fetch response.
const safeFetch: typeof fetch = async (...args) => {
  try { return await fetch(...args); }
  catch { return new Response('{"error":"unavailable"}',{status:503,headers:{'content-type':'application/json'}}); }
};
Deno.serve(request => {
  const url=Deno.env.get('SUPABASE_URL')??'';
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  const disabled=()=>handleHistoryMerge(request,{configured:false,backend:{rpc:async()=>({data:null,error:true})},authenticate:async()=>null,sink:historyDiagnosticSink});
  if(!url || !key || Deno.env.get('HISTORY_MERGE_ENABLED')!=='true') return disabled();
  let client;
  try { client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}}); }
  catch { return disabled(); }
  return handleHistoryMerge(request,{
    resumable:true,
    backend:client,
    authenticate:token=>authenticateHistoryToken(token,value=>client.auth.getUser(value)),
    sink:historyDiagnosticSink,
  });
});
