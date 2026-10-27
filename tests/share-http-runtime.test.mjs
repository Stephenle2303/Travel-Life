import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProtocol } from '../supabase/functions/_shared/share-runtime.ts';
import { sha256, canonical } from '../supabase/functions/_shared/share-protocol.ts';
import { readFile, readdir } from 'node:fs/promises';

const snapshot = () => ({ schemaVersion:'travel-life-share-v1',version:'version_one',kind:'journey',title:'Synthetic highlight',destinations:[{key:'place',name:'Synthetic coast',country:'',centroid:null,date:null,status:'inferred'}],chapters:[{destinationKey:'place',mediaKeys:[]}],media:[],summary:{destinationCount:1,mediaCount:0} });
const capability = 'S'.repeat(43);
function harness(rpc) {
 const events=[]; const calls=[];
 const backend={rpc:async(...args)=>{calls.push(args); return rpc(...args);},storage:{from:()=>({download:async()=>({data:new Blob([new Uint8Array([1,2,3,4])],{type:'video/mp4'}),error:null}),upload:async()=>({error:null})})}};
 return {events,calls,backend};
}
const request=(body,headers={})=>new Request('https://synthetic.invalid/function',{method:'POST',headers:{'content-type':'application/json','x-travel-life-correlation':'local_12345678',...headers},body:JSON.stringify(body)});
test('recipient failures are indistinguishable and never expose backend content',async()=>{
 for(const variant of ['invalid','absent','revoked','expired','storage-error']){
  const h=harness(async()=>({data:null,error:variant==='storage-error'?{message:'PRIVATE_SENTINEL'}:null}));
  const response=await handleProtocol(request({action:'snapshot'},{'x-share-capability':variant==='invalid'?'bad':capability}),{...h,recipient:true,sink:e=>h.events.push(e)});
  assert.equal(response.status,404); assert.deepEqual(await response.json(),{status:'unavailable'}); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false); assert.equal(JSON.stringify(h.events).includes(capability),false);
  assert.equal(h.events.at(-1).correlationId,'local_12345678');
 }
});
test('snapshot sends capability digest to RPC and exact public payload to recipient',async()=>{
 const payload=snapshot();const h=harness(async()=>({data:{snapshot:payload,expiresAt:'2027-01-01T00:00:00Z'},error:null}));
 const response=await handleProtocol(request({action:'snapshot'},{'x-share-capability':capability}),{...h,recipient:true,sink:e=>h.events.push(e)});
 assert.equal(response.status,200);assert.deepEqual((await response.json()).snapshot,payload);
 assert.deepEqual(h.calls[0],['travel_life_share_read',{capability_hash:await sha256(capability),requested_version:null,requested_media:null}]);
});
test('every media range independently checks active membership and hides storage paths',async()=>{
 let active=true;const h=harness(async()=>({data:active?{objectPath:'PRIVATE_OBJECT',manifest:{byteLength:4,mimeType:'video/mp4'}}:null,error:null}));
 const make=()=>handleProtocol(request({action:'media',version:'version_one',mediaKey:'media_one'},{'x-share-capability':capability,range:'bytes=1-2'}),{...h,recipient:true,sink:e=>h.events.push(e)});
 const first=await make();assert.equal(first.status,206);assert.equal(first.headers.get('content-range'),'bytes 1-2/4');assert.deepEqual([...new Uint8Array(await first.arrayBuffer())],[2,3]);
 active=false;const afterRevoke=await make();assert.equal(afterRevoke.status,404);assert.deepEqual(await afterRevoke.json(),{status:'unavailable'});assert.equal(h.calls.length,2);assert.equal(JSON.stringify(h.events).includes('PRIVATE_OBJECT'),false);
});
test('owner auth and exact digest fail before a mutation, backend errors keep their boundary',async()=>{
 const h=harness(async()=>{throw new Error('PRIVATE_SENTINEL');});
 let response=await handleProtocol(request({action:'list'}),{...h,sink:e=>h.events.push(e)});assert.equal(response.status,401);assert.equal(h.calls.length,0);
 const payload=snapshot(); const body={action:'begin',requestId:'request_one',snapshot:payload,capability,expiresInDays:30,replaceShareId:null,contentDigest:'bad'};
 response=await handleProtocol(request(body),{...h,owner:'owner_one',sink:e=>h.events.push(e)});assert.equal(response.status,400);assert.equal(h.calls.length,0);assert.equal(h.events.at(-1).stage,'SHARE_SERIALIZE');
 body.contentDigest=await sha256(canonical(payload));response=await handleProtocol(request(body),{...h,owner:'owner_one',sink:e=>h.events.push(e)});assert.equal(response.status,503);assert.equal(h.events.at(-1).stage,'SHARE_QUOTA');assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
});
test('cross-origin requests cannot fetch a recipient snapshot or owner mutation',async()=>{
 const h=harness(async()=>({data:{},error:null}));
 const response=await handleProtocol(request({action:'list'},{origin:'https://hostile.invalid'}),{...h,owner:'owner_one',allowedOrigins:['https://viewer.invalid'],sink:e=>h.events.push(e)});
 assert.equal(response.status,403);assert.equal(h.calls.length,0);assert.equal(response.headers.get('access-control-allow-origin'),null);
});
test('backend and browser enforce their sole console boundary',async()=>{
 const roots=['supabase/functions/_shared','supabase/functions/travel-life-share','supabase/functions/travel-life-share-read','apps/share-viewer/src'];
 for(const root of roots) for(const file of await readdir(root)){
  if(!/\.tsx?$/.test(file))continue;
  const source=await readFile(`${root}/${file}`,'utf8');
  if(file==='share-diagnostics.ts'||root==='apps/share-viewer/src'&&file==='recipient.ts')continue;
  assert.doesNotMatch(source,/\bconsole\s*(?:\.|\[)/,`${root}/${file} must use the closed logger`);
 }
});
test('media publication cannot bypass the missing trusted-decoder gate',async()=>{
 const h=harness(async()=>({data:{status:'staged'},error:null}));
 const payload=snapshot();payload.media=[{key:'media_one',kind:'photo',mimeType:'image/jpeg',width:32,height:24,durationMillis:null,byteLength:3,sha256:'a'.repeat(64),caption:''}];payload.chapters[0].mediaKeys=['media_one'];payload.summary.mediaCount=1;
 const body={action:'begin',requestId:'request_one',snapshot:payload,capability,expiresInDays:30,replaceShareId:null,contentDigest:await sha256(canonical(payload))};
 const response=await handleProtocol(request(body),{...h,owner:'owner_one',sink:e=>h.events.push(e)});
 assert.equal(response.status,503);assert.equal(h.calls.length,0);assert.equal(h.events.at(-1).stage,'SHARE_VERIFY');
});
test('management diagnostics preserve the operation and stage without raw RPC errors',async()=>{
 for(const [action,body,operation,stage] of [
  ['revoke',{shareId:'00000000-0000-4000-8000-000000000001'},'SHARE_MANAGE','SHARE_REVOKE'],
  ['delete-all',{},'SHARE_DELETE_ALL','SHARE_DELETE_FENCE']
 ]){
  const h=harness(async()=>({data:null,error:{nested:'PRIVATE_SENTINEL'}}));
  await handleProtocol(request({action,...body}),{...h,owner:'owner_one',sink:e=>h.events.push(e)});
  assert.equal(h.events.at(-1).operation,operation);assert.equal(h.events.at(-1).stage,stage);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
 }
});
