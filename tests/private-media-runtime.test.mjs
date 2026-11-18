import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { handlePrivateMedia } from '../supabase/functions/_shared/private-media-runtime.ts';
import { handlePrivateMediaCleanup } from '../supabase/functions/_shared/private-media-cleanup.ts';
import { createPrivateMediaDiagnostic } from '../supabase/functions/_shared/private-media-diagnostics.ts';
import { executePrivateMediaDecode,createPrivateMediaDecoder,readDecoderAsset } from '../supabase/functions/_shared/private-media-decoder.ts';
import { PRIVATE_MEDIA_CONTRACT,privateMediaManifest,mediaDigest } from '../supabase/functions/_shared/private-media-protocol.ts';
const owner='14000000-0000-4000-8000-000000000001',session='24000000-0000-4000-8000-000000000001',source='44000000-0000-4000-8000-000000000001',evidence='84000000-0000-4000-8000-000000000001',artifact='74000000-0000-4000-8000-000000000001',lease='94000000-0000-4000-8000-000000000001';
const correlation='local_'+'b'.repeat(32),path=owner+'/'+artifact;
const jpeg=new Uint8Array(await readFile(new URL('./fixtures/share/synthetic-clean.jpg',import.meta.url)));
test('decoder asset reads exact bounded stream and rejects short or excess bytes',async()=>{
 const stream=(chunks,cancel=()=>{})=>new ReadableStream({pull(c){chunks.length?c.enqueue(Uint8Array.from(chunks.shift())):c.close();},cancel});
 assert.deepEqual(await readDecoderAsset(stream([[1,2],[3]]),3),Uint8Array.from([1,2,3]));
 await assert.rejects(readDecoderAsset(stream([[1]]),2),{reason:'MEDIA_VERIFY',boundary:'MEDIA_DECODE'});
 let cancelled=false;await assert.rejects(readDecoderAsset(stream([[1,2,3]],()=>{cancelled=true;}),2),{reason:'MEDIA_VERIFY',boundary:'MEDIA_DECODE'});assert.equal(cancelled,true);
});
test('digest hashes the supplied view range without including adjacent bytes',async()=>{
 const view=Uint8Array.from([90,1,2,3,91]).subarray(1,4);
 assert.equal(await mediaDigest(view),createHash('sha256').update(Uint8Array.from([1,2,3])).digest('hex'));
});
const manifest={contractVersion:PRIVATE_MEDIA_CONTRACT,kind:'photo',mimeType:'image/jpeg',width:32,height:24,durationMillis:null,byteLength:jpeg.length,sha256:createHash('sha256').update(jpeg).digest('hex')};
const stageInput={action:'stage',mutationId:lease,accountGeneration:1,sourceId:source,sourceGeneration:1,target:{kind:'evidence',id:evidence},expectedRevision:0,manifest};
const request=(input=stageInput)=>new Request('https://synthetic.invalid/media',{method:'POST',headers:{authorization:'Bearer PRIVATE_TOKEN','x-travel-life-correlation':correlation},body:JSON.stringify(input)});
const upload=(bytes=jpeg)=>new Request('https://synthetic.invalid/media',{method:'PUT',headers:{authorization:'Bearer PRIVATE_TOKEN','x-travel-life-correlation':correlation,'x-travel-life-artifact':artifact,'content-type':'application/octet-stream'},body:bytes});
function harness(change=()=>null){
 const events=[],calls=[],stored=new Map();
 const bucket={upload:async(key,bytes,options)=>{calls.push({storage:'upload',key,options});stored.set(key,bytes);return {error:null};},download:async key=>({data:stored.has(key)?new Blob([stored.get(key)]):null,error:null}),createSignedUrl:async(key,seconds)=>{calls.push({storage:'signed',key,seconds});return {data:{signedUrl:'https://synthetic.invalid/PRIVATE_SIGNED_URL'},error:null};},remove:async keys=>{calls.push({storage:'remove',keys});keys.forEach(key=>stored.delete(key));return {error:null};}};
 const options={configured:true,authenticate:async()=>({owner,session}),decode:async()=>true,sink:event=>events.push(event),backend:{storage:{from:name=>{assert.equal(name,'travel-life-private-media');return bucket;}},rpc:async(name,args)=>{
  calls.push({name,...args});const changed=await change(args);if(changed)return changed;
  const data=args.action==='upload-context'?{status:'staged',artifactId:artifact,manifest,storagePath:path,uploadLease:lease}:args.action==='download'?{status:'complete',artifactId:artifact,revision:1,manifest,storagePath:path}:{status:args.action==='verify'?'verified':args.action==='stage'?'staged':'complete',artifactId:artifact,revision:1};return {data,error:null};
 }}};
 return {events,calls,options,bucket,stored};
}
test('private media stage, full verification and immutable upload carry one closed correlation',async()=>{
 const h=harness();assert.equal((await handlePrivateMedia(request(),h.options)).status,200);
 const response=await handlePrivateMedia(upload(),h.options);assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'verified',artifactId:artifact});
 assert.equal(h.calls.find(call=>call.storage==='upload').options.upsert,false);assert.equal(h.calls.find(call=>call.action==='verify').input.uploadLease,lease);
 assert.ok(h.events.every(event=>event.correlationId===correlation));assert.equal(JSON.stringify(h.events).includes('PRIVATE_TOKEN'),false);assert.equal(JSON.stringify(h.events).includes(path),false);
});
test('disabled gate and malformed/oversized input reject before upload or decoding',async()=>{
 const h=harness();h.options.configured=false;assert.equal((await handlePrivateMedia(request(),h.options)).status,503);assert.equal(h.events.at(-1).stage,'MEDIA_CONFIG');assert.equal(h.calls.length,0);
 for(const input of [{...stageInput,ownerId:'PRIVATE_SENTINEL'},{...stageInput,manifest:{...manifest,width:99999}},{...stageInput,manifest:{...manifest,kind:'audio',mimeType:'audio/mp4',width:null,height:null,durationMillis:1}}]){
  const x=harness();assert.equal((await handlePrivateMedia(request(input),x.options)).status,409);assert.equal(x.calls.length,0);assert.equal(x.events.at(-1).reasonCode,'MEDIA_SCHEMA');
 }
 const x=harness();assert.equal((await handlePrivateMedia(upload(new Uint8Array(jpeg.length+1)),x.options)).status,409);assert.equal(x.events.at(-1).reasonCode,'MEDIA_QUOTA');
});
test('digest/structure and decoder failures remain distinct without uploading unverified bytes',async()=>{
 const corrupt=new Uint8Array(jpeg);corrupt[5]^=1;
 const h=harness();assert.equal((await handlePrivateMedia(upload(corrupt),h.options)).status,409);assert.equal(h.events.at(-1).stage,'MEDIA_VERIFY');assert.equal(h.calls.some(call=>call.storage==='upload'),false);
 const x=harness();x.options.decode=async()=>false;assert.equal((await handlePrivateMedia(upload(),x.options)).status,409);assert.equal(x.events.at(-1).reasonCode,'MEDIA_DECODE');assert.equal(x.events.at(-1).stage,'MEDIA_DECODE');assert.equal(x.calls.some(call=>call.storage==='upload'),false);
});
test('lost upload acknowledgement reconciles immutable stored bytes and unknown verify retains them',async()=>{
 const h=harness(args=>{if(args.action==='verify')throw new Error('PRIVATE_SENTINEL_DATABASE');});
 h.bucket.upload=async(key,bytes)=>{h.stored.set(key,bytes);return {error:{message:'PRIVATE_SENTINEL_LOST_UPLOAD'}};};
 const response=await handlePrivateMedia(upload(),h.options);assert.equal(response.status,503);assert.equal(h.events.at(-1).stage,'MEDIA_ACK');assert.equal(h.events.at(-1).durableOutcome,'unknown');assert.equal(h.stored.has(path),true);assert.equal(h.calls.some(call=>call.storage==='remove'),false);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
});
test('late upload after source removal compensates a proven fence and never activates',async()=>{
 let removedDuringUpload=false;
 const h=harness(args=>args.action==='verify'&&removedDuringUpload?{data:{error:'HISTORY_FENCED'},error:null}:null);
 h.bucket.upload=async(key,bytes)=>{removedDuringUpload=true;h.stored.delete(key);h.stored.set(key,bytes);return {error:null};};
 const response=await handlePrivateMedia(upload(),h.options);assert.equal(response.status,409);assert.equal(h.stored.has(path),false);assert.equal(h.calls.filter(call=>call.storage==='remove').length,1);assert.equal(h.events.at(-1).reasonCode,'HISTORY_FENCED');assert.equal(h.events.at(-1).durableOutcome,'skipped');assert.equal(h.calls.some(call=>call.action==='activate'),false);
});
test('download signs only authorized active content for five minutes and never logs its URL',async()=>{
 const h=harness();const response=await handlePrivateMedia(request({action:'download',target:{kind:'evidence',id:evidence}}),h.options);assert.equal(response.status,200);assert.equal((await response.json()).expiresInSeconds,300);assert.equal(h.calls.find(call=>call.storage==='signed').seconds,300);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SIGNED_URL'),false);
 const x=harness(args=>args.action==='download'?{data:{error:'MEDIA_SCOPE'},error:null}:null);assert.equal((await handlePrivateMedia(request({action:'download',target:{kind:'evidence',id:evidence}}),x.options)).status,409);assert.equal(x.calls.some(call=>call.storage==='signed'),false);
});
for(const [action,boundary]of [['stage','MEDIA_STAGE'],['upload-context','MEDIA_ELIGIBILITY'],['verify','MEDIA_ACK'],['activate','MEDIA_ACTIVATE'],['download','MEDIA_FETCH']])test(`private media transport failure at ${action} preserves exact stage and redaction`,async()=>{
 const h=harness(args=>{if(args.action===action)throw new Error('PRIVATE_SECRET SQL location');});
 const req=action==='upload-context'||action==='verify'?upload():request(action==='stage'?stageInput:action==='activate'?{action,mutationId:lease,artifactId:artifact,expectedRevision:0}:{action,target:{kind:'evidence',id:evidence}});
 const response=await handlePrivateMedia(req,h.options);assert.equal(response.status,503);assert.deepEqual(h.events.at(-1),{operation:'PRIVATE_MEDIA',stage:boundary,reasonCode:'MEDIA_NETWORK',retryable:true,durableOutcome:'unknown',correlationId:correlation});assert.equal((await response.text()).includes('PRIVATE_SECRET'),false);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SECRET'),false);
});
test('decoder command maps every admitted stream to EOF and rejects empty output without frame caps',()=>{
 const calls=[];const core={ret:0,FS:{writeFile:(...args)=>calls.push(['write',...args])},reset:()=>{},setTimeout:value=>calls.push(['timeout',value]),exec:(...args)=>calls.push(['exec',...args])};
 assert.equal(executePrivateMediaDecode(core,jpeg,{...manifest,kind:'video'}),true);const args=calls.find(call=>call[0]==='exec');assert.ok(args.includes('0:v:0'));assert.ok(args.includes('0:a:0?'));assert.ok(args.includes('empty_output+empty_output_stream'));assert.equal(args.includes('-t'),false);assert.equal(args.includes('-frames:v'),false);
 core.ret=1;assert.equal(executePrivateMediaDecode(core,jpeg,manifest),false);
});
test('decoder asset integrity fails closed before factory access',async()=>{
 let called=false;const decoder=createPrivateMediaDecoder({factory:async()=>{called=true;throw new Error('PRIVATE_SENTINEL');},assetBytes:new Uint8Array(1)});
 await assert.rejects(decoder(jpeg,manifest,correlation),{reason:'MEDIA_VERIFY',boundary:'MEDIA_DECODE'});assert.equal(called,false);
});
test('private media logger drops raw identifiers/content and replaces hostile correlation',()=>{
 const events=[];createPrivateMediaDiagnostic(event=>events.push(event))({stage:'MEDIA_DECODE',reasonCode:'MEDIA_DECODE',durableOutcome:'blocked',correlationId:'PRIVATE_SENTINEL',error:{message:'PRIVATE_SENTINEL'},storagePath:path});assert.equal(JSON.stringify(events).includes('PRIVATE_SENTINEL'),false);assert.equal(JSON.stringify(events).includes(path),false);assert.deepEqual(Object.keys(events[0]),['operation','stage','reasonCode','retryable','durableOutcome','correlationId']);assert.match(events[0].correlationId,/^local_[a-f0-9]{32}$/);
});
test('cleanup requires secret, deletes only leased paths and acknowledges only after storage deletion',async()=>{
 const h=harness();h.options.backend.rpc=async(name,args)=>{h.calls.push({name,...args});return {data:args.action==='lease'?{items:[{storagePath:path,leaseId:lease}]}:{status:'complete'},error:null};};
 const options={backend:h.options.backend,secret:'s'.repeat(43),sink:event=>h.events.push(event)};
 const request=()=>new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-private-media-cleanup':'s'.repeat(43)}});
 assert.equal((await handlePrivateMediaCleanup(request(),options)).status,200);assert.deepEqual(h.calls.map(call=>call.action??call.storage),['lease','remove','ack']);
 h.calls.length=0;assert.equal((await handlePrivateMediaCleanup(new Request('https://synthetic.invalid/cleanup',{method:'POST'}),options)).status,403);assert.equal(h.calls.length,0);
 h.bucket.remove=async()=>({error:{message:'PRIVATE_SENTINEL'}});assert.equal((await handlePrivateMediaCleanup(request(),options)).status,503);assert.equal(h.calls.some(call=>call.action==='ack'),false);assert.equal(h.events.at(-1).reasonCode,'MEDIA_STORAGE');assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
});
test('media scheduler admits bounded empty JSON object bodies',async()=>{
 for(const body of ['{}',' \n { } \t']){
  const h=harness();h.options.backend.rpc=async(name,args)=>{h.calls.push({name,...args});return {data:{items:[]},error:null};};
  const options={backend:h.options.backend,secret:'s'.repeat(43),sink:event=>h.events.push(event)};
  const req=new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-private-media-cleanup':options.secret,'content-type':'application/json'},body});
  assert.equal((await handlePrivateMediaCleanup(req,options)).status,200);assert.equal(h.calls.length,1);
 }
});
test('media cleanup rejects malformed/nonempty/oversized scheduler input without RPC or private diagnostics',async()=>{
 for(const body of ['{"scope":"PRIVATE_BODY_SENTINEL"}','null','[]','""','false','42','{','{}{}',' '.repeat(65)+'{}',new Uint8Array([0xff])]){
  const h=harness();const options={backend:h.options.backend,secret:'s'.repeat(43),sink:event=>h.events.push(event)};
  const req=new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-private-media-cleanup':options.secret},body});
  assert.equal((await handlePrivateMediaCleanup(req,options)).status,400);assert.equal(h.calls.length,0);assert.equal(h.events.at(-1).stage,'MEDIA_AUTH');assert.equal(h.events.at(-1).reasonCode,'MEDIA_SCHEMA');assert.equal(h.events.at(-1).durableOutcome,'blocked');assert.ok(!JSON.stringify(h.events).includes('PRIVATE_BODY_SENTINEL'));assert.ok(!JSON.stringify(h.events).includes(options.secret));
 }
});
test('media cleanup reads a complete bounded streamed object and cancels excessive chunks',async()=>{
 for(const excessive of [false,true]){
  const h=harness();h.options.backend.rpc=async(name,args)=>{h.calls.push({name,...args});return {data:{items:[]},error:null};};
  const options={backend:h.options.backend,secret:'s'.repeat(43),sink:event=>h.events.push(event)};let cancelled=false;
  const chunks=[new TextEncoder().encode('{'),new TextEncoder().encode(excessive?' '.repeat(65):' }')];
  const body=new ReadableStream({pull(controller){if(chunks.length)controller.enqueue(chunks.shift());else controller.close();},cancel(){cancelled=true;}});
  const req=new Request('https://synthetic.invalid/cleanup',{method:'POST',headers:{'x-private-media-cleanup':options.secret},body,duplex:'half'});
  assert.equal((await handlePrivateMediaCleanup(req,options)).status,excessive?400:200);if(excessive){assert.equal(cancelled,true);assert.equal(h.calls.length,0);}
 }
});
test('media cleanup still rejects missing/wrong capability and browser origin with empty JSON',async()=>{
 for(const headers of [{},{'x-private-media-cleanup':'PRIVATE_WRONG_CAPABILITY'},{'x-private-media-cleanup':'s'.repeat(43),origin:'null'},{'x-private-media-cleanup':'s'.repeat(43),origin:'https://synthetic.invalid'}]){
  const h=harness();const options={backend:h.options.backend,secret:'s'.repeat(43),sink:event=>h.events.push(event)};
  assert.equal((await handlePrivateMediaCleanup(new Request('https://synthetic.invalid/cleanup',{method:'POST',headers,body:'{}'}),options)).status,403);assert.equal(h.calls.length,0);assert.equal(h.events.at(-1).reasonCode,'ACCOUNT_SESSION');assert.ok(!JSON.stringify(h.events).includes('PRIVATE_WRONG_CAPABILITY'));
 }
});
test('admission limits are explicit and custom audio cannot masquerade as visual evidence',()=>{
 assert.ok(privateMediaManifest(manifest));assert.equal(privateMediaManifest({...manifest,byteLength:20*1024*1024+1}),null);assert.ok(privateMediaManifest({...manifest,kind:'audio',mimeType:'audio/mp4',width:null,height:null,durationMillis:1000}));
});
