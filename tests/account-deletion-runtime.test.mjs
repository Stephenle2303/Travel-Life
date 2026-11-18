import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleAccountDeletionCleanup} from '../supabase/functions/_shared/account-deletion-cleanup.ts';

const owner='17000000-0000-4000-8000-000000000001',leaseId='37000000-0000-4000-8000-000000000001';
function fixture(){
 const events=[],calls=[];let purge='metadata-purged';let present=true;let lost=false;
 const options={secret:'x'.repeat(64),sink:event=>events.push(event),rpc:async(action,input)=>{
  calls.push(action);if(action==='lease')return {status:'complete',items:[{owner,leaseId}]};
  if(action==='purge')return {status:purge};if(action==='complete'&&lost)throw new Error('PRIVATE_ACK');return {status:'completed'};
 },user:async()=>present,removeUser:async()=>{calls.push('auth-delete');present=false;}};
 return {options,events,calls,pending:()=>{purge='pending';},lose:()=>{lost=true;},missing:()=>{present=false;}};
}
const request=()=>new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-account-cleanup':'x'.repeat(64)}});
test('account scheduler admits bounded empty JSON object bodies',async()=>{
 for(const body of ['{}',' \n { } \t']){
  const f=fixture();const req=new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-account-cleanup':f.options.secret,'content-type':'application/json'},body});
  assert.equal((await handleAccountDeletionCleanup(req,f.options)).status,200);assert.deepEqual(f.calls,['lease','purge','auth-delete','complete']);
 }
});
test('account cleanup rejects malformed/nonempty/oversized bodies with fixed redacted schema diagnostics',async()=>{
 for(const body of ['{"scope":"PRIVATE_BODY_SENTINEL"}','null','[]','""','false','42','{','{}{}',' '.repeat(65)+'{}',new Uint8Array([0xff])]){
  const f=fixture();const req=new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-account-cleanup':f.options.secret},body});
  assert.equal((await handleAccountDeletionCleanup(req,f.options)).status,400);assert.deepEqual(f.calls,[]);
  assert.equal(f.events.at(-1).stage,'HISTORY_AUTH');assert.equal(f.events.at(-1).reasonCode,'HISTORY_SCHEMA');assert.equal(f.events.at(-1).durableOutcome,'blocked');
  assert.ok(!JSON.stringify(f.events).includes('PRIVATE_BODY_SENTINEL'));assert.ok(!JSON.stringify(f.events).includes(f.options.secret));
 }
});
test('account cleanup validates the entire bounded stream and cancels excessive input',async()=>{
 for(const excessive of [false,true]){
  const f=fixture();let cancelled=false;const chunks=[new TextEncoder().encode('{'),new TextEncoder().encode(excessive?' '.repeat(65):' }')];
  const body=new ReadableStream({pull(controller){if(chunks.length)controller.enqueue(chunks.shift());else controller.close();},cancel(){cancelled=true;}});
  const req=new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-account-cleanup':f.options.secret},body,duplex:'half'});
  assert.equal((await handleAccountDeletionCleanup(req,f.options)).status,excessive?400:200);
  if(excessive){assert.equal(cancelled,true);assert.deepEqual(f.calls,[]);}
 }
 const f=fixture();const broken=new ReadableStream({pull(){throw new Error('PRIVATE_STREAM_SENTINEL');}});
 assert.equal((await handleAccountDeletionCleanup(new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-account-cleanup':f.options.secret},body:broken,duplex:'half'}),f.options)).status,400);assert.deepEqual(f.calls,[]);assert.ok(!JSON.stringify(f.events).includes('PRIVATE_STREAM_SENTINEL'));
});
test('account cleanup rejects unauthorized capability and browser origin before RPC even with scheduler JSON',async()=>{
 for(const headers of [{},{'x-account-cleanup':'PRIVATE_WRONG_CAPABILITY'},{'x-account-cleanup':'x'.repeat(64),origin:'null'},{'x-account-cleanup':'x'.repeat(64),origin:'https://synthetic.invalid'}]){
  const f=fixture();assert.equal((await handleAccountDeletionCleanup(new Request('https://synthetic.invalid/cleanup',{method:'POST',headers,body:'{}'}),f.options)).status,403);assert.deepEqual(f.calls,[]);assert.equal(f.events.at(-1).reasonCode,'ACCOUNT_SESSION');assert.ok(!JSON.stringify(f.events).includes('PRIVATE_WRONG_CAPABILITY'));
 }
});
test('account cleanup waits for media proof then deletes Auth and acknowledges with closed diagnostics',async()=>{
 const f=fixture();f.pending();assert.equal((await handleAccountDeletionCleanup(request(),f.options)).status,200);assert.deepEqual(f.calls,['lease','purge']);
 const g=fixture();assert.equal((await handleAccountDeletionCleanup(request(),g.options)).status,200);assert.deepEqual(g.calls,['lease','purge','auth-delete','complete']);
 assert.equal(g.events.at(-1).durableOutcome,'complete');assert.equal(new Set(g.events.map(e=>e.correlationId)).size,1);assert.ok(!JSON.stringify(g.events).includes(owner));
});
test('lost Auth/purge acknowledgements remain retryable and missing user reconciles safely',async()=>{
 const f=fixture();f.lose();assert.equal((await handleAccountDeletionCleanup(request(),f.options)).status,503);assert.equal(f.events.at(-1).stage,'HISTORY_DELETE_ACK');assert.equal(f.events.at(-1).durableOutcome,'unknown');assert.ok(!JSON.stringify(f.events).includes('PRIVATE_ACK'));
 const g=fixture();g.missing();await handleAccountDeletionCleanup(request(),g.options);assert.deepEqual(g.calls,['lease','purge','complete']);
});
test('caller secret and hostile service response fail before Auth deletion',async()=>{
 const f=fixture();assert.equal((await handleAccountDeletionCleanup(new Request('https://synthetic.invalid/cleanup',{method:'POST'}),f.options)).status,403);assert.deepEqual(f.calls,[]);
 const g=fixture();g.options.rpc=async()=>({status:'complete',items:[{owner:'PRIVATE_TOKEN',leaseId}]});assert.equal((await handleAccountDeletionCleanup(request(),g.options)).status,503);assert.deepEqual(g.calls,[]);assert.ok(!JSON.stringify(g.events).includes('PRIVATE_TOKEN'));
});
