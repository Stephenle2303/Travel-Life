import test from 'node:test';
import assert from 'node:assert/strict';
import { handleShareCleanup } from '../supabase/functions/_shared/share-cleanup.ts';
const item={objectPath:'PRIVATE_SENTINEL',versionId:'synthetic_version',mediaKey:'synthetic_media',lease:'synthetic_lease'};
test('cleanup identifies lease, deletion and acknowledgement failure without releasing quota early',async()=>{
 for(const [failure,stage] of [['lease','SHARE_CLEANUP_LEASE'],['delete','SHARE_OBJECT_DELETE'],['ack','SHARE_CLEANUP_ACK'],['none','SHARE_CLEANUP_ACK']]){
  const logs=[];const calls=[];
  const backend={rpc:async(name)=>{calls.push(name);return name==='travel_life_share_cleanup'?{data:failure==='lease'?null:[item],error:failure==='lease'?{raw:'PRIVATE_SENTINEL'}:null}:{data:failure!=='ack',error:null};},storage:{from:()=>({remove:async()=>{calls.push('remove');return{error:failure==='delete'?{raw:'PRIVATE_SENTINEL'}:null};}})}};
  const response=await handleShareCleanup(new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{authorization:'Bearer '+'S'.repeat(43)}}),{backend,secret:'S'.repeat(43),sink:e=>logs.push(e)});
  assert.equal(response.status,failure==='none'?200:503);assert.equal(logs.at(-1).stage,stage);assert.equal(logs.at(-1).operation,'SHARE_CLEANUP');assert.equal(JSON.stringify(logs).includes('PRIVATE_SENTINEL'),false);
  assert.equal(new Set(logs.map(e=>e.correlationId)).size,1);
  if(['lease','delete'].includes(failure))assert.equal(calls.includes('travel_life_share_cleanup_ack'),false);
 }
});
test('cleanup requires its server-only secret and rejects oversized lease batches',async()=>{
 let touched=false;const logs=[];const backend={rpc:async()=>{touched=true;return{data:Array(26).fill(item),error:null};},storage:{from:()=>{throw new Error('should not delete');}}};
 const denied=await handleShareCleanup(new Request('https://synthetic.invalid',{method:'POST'}),{backend,secret:'S'.repeat(43),sink:e=>logs.push(e)});assert.equal(denied.status,503);assert.equal(touched,false);
 const large=await handleShareCleanup(new Request('https://synthetic.invalid',{method:'POST',headers:{authorization:'Bearer '+'S'.repeat(43)}}),{backend,secret:'S'.repeat(43),sink:e=>logs.push(e)});assert.equal(large.status,503);assert.equal(logs.at(-1).stage,'SHARE_CLEANUP_LEASE');
});
