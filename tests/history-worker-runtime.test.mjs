import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { handleHistoryMerge } from '../supabase/functions/_shared/history-runtime.ts';
import { createHistoryDiagnostic } from '../supabase/functions/_shared/history-diagnostics.ts';
import { safeHistoryCorrelation } from '../supabase/functions/_shared/history-diagnostics.ts';
import { authenticateHistoryToken } from '../supabase/functions/_shared/history-auth.ts';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { historyRowsJson,mergeAccountHistory,encodeHistoryRows,decodeHistoryRows } from '../supabase/functions/_shared/history-domain.js';
import { historyIdentityRequests,historyIdentityKey } from '../supabase/functions/_shared/history-identities.ts';
const owner='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001';
const source='40000000-0000-4000-8000-000000000001',snapshot='60000000-0000-4000-8000-000000000001',operation='70000000-0000-4000-8000-000000000001';
const correlation='local_'+'a'.repeat(32);
test('worker bundle preserves every compressed dataset byte and stays bounded',async()=>{
 const bundle=await readFile('supabase/functions/_shared/history-domain.js','utf8');
 const match=bundle.match(/const packedJson = (.*);/);assert.ok(match);
 const packed=JSON.parse(match[1]);assert.ok(Object.keys(packed).length);
 for(const [path,encoded] of Object.entries(packed)){
  const original=await readFile(`apps/mobile/src/${path}`,'utf8');
  assert.equal(gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'),original.trim());
 }
 assert.ok(Buffer.byteLength(bundle)<8_000_000);
});
test('keeps bounded mobile action correlations and replaces untrusted content',()=>{
 assert.equal(safeHistoryCorrelation('runtime-synthetic-1'),'runtime-synthetic-1');
 assert.match(safeHistoryCorrelation('runtime-PRIVATE_OWNER_SENTINEL-1'),/^local_[a-f0-9]{32}$/);
 assert.match(safeHistoryCorrelation('runtime-'+'a'.repeat(100)+'-1'),/^local_[a-f0-9]{32}$/);
});
const row={kind:'manual',key:'local-journey',value:{manual_id:'local-journey',command_key:'command',owner_label:'Synthetic',owner_context:'Fixture',date_kind:'exact',date_start:'2020-01-01',date_end:'2020-01-02',latitude:10,longitude:20,created_at_millis:1}};
const semanticDigest=rows=>createHash('sha256').update(historyRowsJson(rows)).digest('hex');
function legacyHarness(change=()=>null){
 const edited={...row,value:{...row.value,owner_label:'PRIVATE_CONTENT_SENTINEL'}};
 const legacy={generation:1,baseSnapshot:snapshot,expectedOwnerRevision:0,baselineDigest:semanticDigest([row]),editedDigest:semanticDigest([edited]),changes:{rows:[edited],deleted:[]}};
 const events=[],calls=[],identities=new Map();let translation=null;
 const options={authenticate:async()=>({owner,session}),sink:e=>events.push(e),backend:{rpc:async(_name,args)=>{
  calls.push(args);const custom=await change(args);if(custom)return custom;
  let data;
  if(args.action==='legacy-plan')data={status:'planned',kind:'initial',sourceId:source,baselinePages:1,canonicalPages:1,translated:translation};
  else if(args.action==='legacy-page')data={records:[row]};
  else if(args.action==='legacy-map')data={mappings:args.input.keys.map(key=>{const typed=JSON.stringify([key.sourceId,key.kind,key.localId]);if(!identities.has(typed))identities.set(typed,`80000000-0000-4000-8000-${String(identities.size+1).padStart(12,'0')}`);return {...key,accountId:identities.get(typed)};})};
  else if(args.action==='legacy-translate'){translation=args.input.changes;data={status:'staged'};}
  else if(args.action==='legacy-commit')data={status:'accepted',ownerRevision:1};
  else throw new Error('unexpected action');
  return {data,error:null};
 }}};
 return {legacy,events,calls,options};
}
test('legacy migration proves baseline, translates typed owner facts and journals the original expected revision',async()=>{
 const h=legacyHarness();const response=await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'accepted',ownerRevision:1});
 const translated=h.calls.find(call=>call.action==='legacy-translate').input.changes;
 assert.notEqual(translated.rows[0].key,row.key);assert.equal(translated.rows[0].value.owner_label,'PRIVATE_CONTENT_SENTINEL');
 assert.equal(h.calls[0].input.legacy.expectedOwnerRevision,0);assert.ok(h.events.every(event=>event.correlationId===correlation));
 assert.equal(h.events.filter(event=>event.reasonCode==='COMPLETE').length,1);
 assert.ok(!JSON.stringify(h.events).includes('PRIVATE_CONTENT_SENTINEL'));
});
test('legacy mapping allocations remain unique across more than one hundred typed keys',async()=>{
 const baseline=Array.from({length:60},(_,index)=>({...row,key:`manual-${index}`,value:{...row.value,manual_id:`manual-${index}`,command_key:`command-${index}`}}));
 const edited=baseline.map((value,index)=>index?value:{...value,value:{...value.value,owner_label:'Synthetic updated'}});
 const h=legacyHarness(args=>args.action==='legacy-page'?{data:{records:baseline},error:null}:null);
 h.legacy.baselineDigest=semanticDigest(baseline);h.legacy.editedDigest=semanticDigest(edited);h.legacy.changes={rows:[edited[0]],deleted:[]};
 assert.equal((await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options)).status,200);
 assert.equal(h.calls.filter(call=>call.action==='legacy-map').length,2);assert.equal(h.calls.find(call=>call.action==='legacy-translate').input.changes.rows.length,1);
});
test('known typed malformed changes classify as schema and redact their content',async()=>{
 const h=legacyHarness();h.legacy.changes={rows:[],deleted:[{kind:'privacy',key:'PRIVATE_SCHEMA_SENTINEL'}]};
 const response=await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options);
 assert.equal(response.status,409);assert.equal(h.events.at(-1).reasonCode,'HISTORY_SCHEMA');assert.equal(h.events.at(-1).stage,'HISTORY_SCHEMA');assert.ok(!JSON.stringify(h.events).includes('PRIVATE_'));
});
for(const path of ['cached-plan','cached-translation','fresh-commit'])for(const ownerRevision of [-1,0,1.5,Number.MAX_SAFE_INTEGER+1,'1']){
 test(`legacy ${path} malformed accepted revision ${ownerRevision} never emits completion`,async()=>{
  const h=legacyHarness(args=>{
   if(path==='cached-plan'&&args.action==='legacy-plan')return {data:{status:'accepted',ownerRevision},error:null};
   if(path==='cached-translation'&&args.action==='legacy-plan')return {data:{status:'planned',kind:'initial',translated:{rows:[],deleted:[]}},error:null};
   if(args.action==='legacy-commit')return {data:{status:'accepted',ownerRevision},error:null};return null;
  });
  assert.equal((await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options)).status,503);
  assert.equal(h.events.at(-1).reasonCode,'HISTORY_NETWORK');assert.ok(!h.events.some(event=>event.reasonCode==='COMPLETE'));
 });
}
for(const [action,stage] of [['legacy-plan','HISTORY_AUTHORITY'],['legacy-page','HISTORY_READ'],['legacy-map','HISTORY_SCHEMA'],['legacy-translate','HISTORY_STAGE'],['legacy-commit','HISTORY_CORRECTION']]){
 test(`legacy ${action} unknown acknowledgement retains precise safe diagnostics`,async()=>{
  const h=legacyHarness(args=>{if(args.action===action)throw new Error('PRIVATE_TOKEN_SENTINEL');return null;});
  const response=await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options);
  assert.equal(response.status,503);assert.equal(h.events.at(-1).stage,stage);assert.equal(h.events.at(-1).reasonCode,'HISTORY_NETWORK');assert.equal(h.events.at(-1).durableOutcome,'unknown');
  assert.ok(!JSON.stringify(h.events).includes('PRIVATE_'));assert.ok(h.events.every(event=>event.correlationId===correlation));
 });
}
test('legacy unknown kind and mismatched baseline retain review without identity guessing or writes',async()=>{
 for(const mode of ['kind','digest']){
  const h=legacyHarness(args=>mode==='kind'&&args.action==='legacy-plan'?{data:{status:'planned',kind:'unknown'},error:null}:null);
  if(mode==='digest')h.legacy.baselineDigest='0'.repeat(64);
  const response=await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options);
  assert.equal(response.status,409);assert.equal(h.events.at(-1).reasonCode,mode==='digest'?'HISTORY_REVIEW':'HISTORY_SCHEMA');
  assert.ok(!h.calls.some(call=>['legacy-map','legacy-translate','legacy-commit'].includes(call.action)));
 }
});
test('legacy retry reconciles immutable translation after commit acknowledgement is lost',async()=>{
 let failed=false;const h=legacyHarness(args=>{if(args.action==='legacy-commit'&&!failed){failed=true;throw new Error('lost ack');}return null;});
 assert.equal((await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options)).status,503);
 const reads=h.calls.filter(call=>call.action==='legacy-page').length;
 assert.equal((await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options)).status,200);
 assert.equal(h.calls.filter(call=>call.action==='legacy-page').length,reads);assert.equal(h.calls.filter(call=>call.action==='legacy-translate').length,1);
});
test('proved aggregate baseline skips source normalization and cancellation retains prior authority',async()=>{
 const h=legacyHarness(args=>args.action==='legacy-plan'?{data:{status:'planned',kind:'aggregate',baselinePages:1,canonicalPages:1,translated:null},error:null}:null);
 assert.equal((await handleHistoryMerge(request({operationId:operation,legacy:h.legacy}),h.options)).status,200);
 assert.ok(!h.calls.some(call=>call.action==='legacy-map'));assert.equal(h.calls.find(call=>call.action==='legacy-translate').input.changes.rows[0].key,row.key);
 const abort=new AbortController();const cancelled=legacyHarness(args=>{if(args.action==='legacy-plan')abort.abort();return null;});
 const req=new Request('https://synthetic.invalid/merge',{method:'POST',signal:abort.signal,headers:{authorization:'Bearer SYNTHETIC_TOKEN'},body:JSON.stringify({operationId:operation,legacy:cancelled.legacy})});
 assert.equal((await handleHistoryMerge(req,cancelled.options)).status,409);assert.equal(cancelled.events.at(-1).reasonCode,'HISTORY_CANCELLED');assert.equal(cancelled.events.at(-1).durableOutcome,'skipped');
});
const request=(body={operationId:operation},headers={})=>new Request('https://synthetic.invalid/merge',{method:'POST',headers:{authorization:'Bearer SYNTHETIC_TOKEN','x-travel-life-correlation':correlation,...headers},body:JSON.stringify(body)});
function harness(change=()=>null,domain) {
 const events=[],calls=[],mappings=new Map(); let counter=0;
 const options={authenticate:async()=>({owner,session}),sink:e=>events.push(e),domain,backend:{rpc:async(name,args)=>{
  calls.push({name,...args}); const custom=await change(args);if(custom) return custom;
  let data;
  if(args.action==='plan')data={status:'planned',accountGeneration:1,expectedAccountRevision:2,preferredReplaySourceId:source,sourcePlan:[{sourceId:source,sourceGeneration:1,sourceSnapshotRevision:1,snapshotId:snapshot,pages:1}]};
  else if(args.action==='page')data={records:[row]};
  else if(args.action==='map-identities')data={mappings:args.input.keys.map(key=>{
   const identity=JSON.stringify(key); if(!mappings.has(identity))mappings.set(identity,`80000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`);return {...key,accountId:mappings.get(identity)};
  })};
  else data=args.input.phase==='commit'?{status:'complete',aggregateId:operation,aggregateRevision:1}:{status:'staging'};
  return {data,error:null};
 }}};
 return {events,calls,options};
}
test('worker executes the actual portable policy, typed mappings and exact activation plan',async()=>{
 const h=harness();const response=await handleHistoryMerge(request(),h.options); assert.equal(response.status,200);
 assert.equal((await response.json()).aggregateId,operation);
 const commit=h.calls.at(-1);assert.equal(commit.input.phase,'commit');assert.equal(commit.input.expectedAccountRevision,2);
 assert.equal(commit.name,'travel_life_history_finalize_worker');
 assert.ok(h.calls.slice(0,-1).every(call=>call.name==='travel_life_history_worker'));
 assert.deepEqual(commit.input.sourcePlan,h.calls.find(x=>x.action==='page').input.sourcePlan);
 const staged=h.calls.find(x=>x.action==='activate'&&x.input.phase==='page').input.records;
 const metadata=h.calls.find(x=>x.action==='activate'&&x.input.phase==='start').input.metadata;
 assert.equal(metadata.metadataVersion,2);assert.equal(typeof metadata.graphSummary.journeys,'number');assert.equal('projection' in metadata,false);assert.ok(Array.isArray(metadata.privacy.hiddenEvidenceIds));
 assert.equal(staged[0].kind,'manual');assert.notEqual(staged[0].key,row.key);
 assert.ok(h.events.every(e=>e.correlationId===correlation));assert.equal(h.events.filter(e=>e.reasonCode==='COMPLETE').length,1);
 assert.equal(JSON.stringify(h.events).includes('Synthetic'),false);
});

test('large source provenance uses a bounded plan-derived header without dropping semantic evidence',async()=>{
 const rows=Array.from({length:3000},(_,index)=>({kind:'evidence',key:`synthetic-${index}`,value:{evidence_id:`synthetic-${index}`,source_ref:`fixture-${index}-${'x'.repeat(100)}`,media_type:'image',availability:'available',captured_day:'2024-01-01',platform_duplicate_family_id:null,source_origin:null,duplicate_tuple_fingerprint:null,has_precise_offset:1,captured_at_millis:Date.parse('2024-01-01T00:00:00Z')+index*1000,modified_at_millis:null,location_available:null,latitude:13.7+(index%1203)*0.000001,longitude:100.5,reported_accuracy_meters:10,support_eligible:null,duplicate_tuple_version:null}}));
 const pages=Array.from({length:30},(_,index)=>rows.slice(index*100,index*100+100));
 const h=harness(args=>{
  if(args.action==='plan')return {data:{status:'planned',accountGeneration:1,expectedAccountRevision:2,sourcePlan:[{sourceId:source,sourceGeneration:1,sourceSnapshotRevision:1,snapshotId:snapshot,pages:pages.length}]},error:null};
  if(args.action==='page')return {data:{records:pages[args.input.page]},error:null};return null;
 });
 assert.equal((await handleHistoryMerge(request(),h.options)).status,200);
 const start=h.calls.find(call=>call.action==='activate'&&call.input.phase==='start');
 assert.equal(start.input.metadata.metadataVersion,3);assert.equal(start.input.metadata.sourceCopiesFromPlan,true);assert.equal('sourceCopies' in start.input.metadata,false);
 assert.ok(Buffer.byteLength(JSON.stringify(start.input))<400000);
 const output=h.calls.filter(call=>call.action==='activate'&&call.input.phase==='page').flatMap(call=>call.input.records);
 assert.equal(output.filter(row=>row.kind==='evidence').length,3000);
 assert.equal(h.events.at(-1).reasonCode,'COMPLETE');assert.ok(h.events.some(event=>event.stage==='HISTORY_METADATA'));
 assert.equal(JSON.stringify(h.events).includes('fixture-'),false);
});
test('residual oversized metadata blocks before activation with correlated redacted quota diagnostics',async()=>{
 const h=harness(()=>null,{collectAccountIdentityKeys:()=>[],mergeAccountHistory:async()=>({rows:[],projection:{graph:{journeys:[],visits:[]}},sourceCopies:[],review:[],replay:null,pendingReplay:[],privacy:{hiddenEvidenceIds:['PRIVATE_SENTINEL'.repeat(30000)]}})});
 const response=await handleHistoryMerge(request(),h.options);
 assert.equal(response.status,409);assert.deepEqual(await response.json(),{status:'blocked',error:'HISTORY_QUOTA'});
 assert.equal(h.calls.some(call=>call.action==='activate'),false);
 assert.deepEqual(h.events.at(-1),{operation:'HISTORY_SYNC',stage:'HISTORY_METADATA',reasonCode:'HISTORY_QUOTA',retryable:false,durableOutcome:'blocked',correlationId:correlation});
 assert.equal(h.events.filter(event=>event.reasonCode!=='START').length,1);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
});

test('metadata quota counts Unicode bytes rather than UTF16 characters',async()=>{
 const h=harness(()=>null,{collectAccountIdentityKeys:()=>[],mergeAccountHistory:async()=>({rows:[],projection:{graph:{journeys:[],visits:[]}},sourceCopies:[],review:[],replay:null,pendingReplay:[],privacy:{hiddenEvidenceIds:['é'.repeat(200001)]}})});
 const response=await handleHistoryMerge(request(),h.options);
 assert.equal(response.status,409);assert.equal(h.events.at(-1).reasonCode,'HISTORY_QUOTA');assert.equal(h.events.at(-1).stage,'HISTORY_METADATA');
 assert.equal(h.calls.some(call=>call.action==='activate'),false);
 assert.ok(!JSON.stringify(h.events).includes('é'));
});

test('long structural Replay survives real worker reconstruction, fragment activation and semantic restore',async()=>{
 const rows=Array.from({length:500},(_,index)=>({kind:'evidence',key:`synthetic-evidence-${String(index).padStart(20,'0')}`,value:{evidence_id:`synthetic-evidence-${String(index).padStart(20,'0')}`,source_ref:`fixture-${index}`,media_type:'image',availability:'available',captured_day:index<288?'2024-01-01':'2024-01-02',platform_duplicate_family_id:null,source_origin:null,duplicate_tuple_fingerprint:null,has_precise_offset:1,captured_at_millis:Date.parse('2024-01-01T00:00:00Z')+index*300000,modified_at_millis:null,location_available:null,latitude:13.7,longitude:100.5,reported_accuracy_meters:10,support_eligible:null,duplicate_tuple_version:null}}));
 const original=await mergeAccountHistory([{sourceId:source,rows}],{mapIdentity:(_source,_kind,local)=>local});
 const journey=original.projection.graph.journeys[0].id;assert.ok(journey.length>10000);
 const refs=[2,0,1].map(index=>JSON.stringify([journey,rows[index].key]));
 const composition={keptMemoryRefs:refs,orderedMemoryRefs:refs,excludedMemoryRefs:[JSON.stringify([journey,rows[3].key])],excludedGroupJourneyIds:[],autoGroupJourneyIds:[journey],direction:'newest-first',directionPreferenceVersion:1,soundtrack:{kind:'custom',revision:'synthetic-score',localUri:''}};
 const replay={kind:'replay',key:'1',value:{record_id:1,revision:7,updated_at_millis:1,committed_overrides_json:JSON.stringify(composition)}};
 assert.ok(replay.value.committed_overrides_json.length>100000);
 const wire=encodeHistoryRows([...rows,replay]),pages=[];for(let index=0;index<wire.length;index+=100)pages.push(wire.slice(index,index+100));
 const h=harness(args=>{
  if(args.action==='plan')return {data:{status:'planned',accountGeneration:1,expectedAccountRevision:2,preferredReplaySourceId:source,sourcePlan:[{sourceId:source,sourceGeneration:1,sourceSnapshotRevision:1,snapshotId:snapshot,pages:pages.length}]},error:null};
  if(args.action==='page')return {data:{records:pages[args.input.page]},error:null};return null;
 });
 assert.equal((await handleHistoryMerge(request(),h.options)).status,200);
 const keys=h.calls.filter(call=>call.action==='map-identities').flatMap(call=>call.input.keys);
 assert.ok(keys.some(key=>key.kind==='journey'&&key.localIdCodec==='sha256-v1'&&/^[a-f0-9]{64}$/.test(key.localId)));
 const restored=decodeHistoryRows(h.calls.filter(call=>call.action==='activate'&&call.input.phase==='page').flatMap(call=>call.input.records));
 const final=restored.find(row=>row.kind==='replay'),selected=JSON.parse(final.value.committed_overrides_json);
 const finalEvidence=restored.filter(row=>row.kind==='evidence');const bySource=new Map(finalEvidence.map(row=>[row.value.captured_at_millis,row.key]));
 assert.deepEqual(selected.orderedMemoryRefs.map(ref=>JSON.parse(ref)[1]),[2,0,1].map(index=>bySource.get(rows[index].value.captured_at_millis)));
 assert.deepEqual(selected.soundtrack,composition.soundtrack);assert.equal(selected.direction,composition.direction);assert.equal(selected.autoGroupJourneyIds.length,1);
 const metadata=h.calls.find(call=>call.action==='activate'&&call.input.phase==='start').input.metadata;
 assert.equal(metadata.metadataVersion,2);assert.equal(metadata.replaySummary.selected,true);assert.equal(metadata.sourceCopies.length,500);assert.deepEqual(metadata.privacy,{hiddenEvidenceIds:[],excludedEvidenceIds:[],hiddenManualIds:[]});
 assert.ok(!('replay' in metadata)&&!('pendingReplay' in metadata)&&!('graph' in metadata));assert.ok(JSON.stringify(metadata).length<200000);assert.ok(!JSON.stringify(h.events).includes('synthetic-score'));
});
test('long SQL mapping namespace cannot collide with a literal digest-shaped key',async()=>{
 const original={sourceId:source,kind:'journey',localId:'structural:'.repeat(2000)};
 const [hashed]=await historyIdentityRequests([original]);const [literal]=await historyIdentityRequests([{...original,localId:hashed.wire.localId}]);
 assert.equal(hashed.wire.localIdCodec,'sha256-v1');assert.equal(literal.wire.localIdCodec,undefined);assert.notEqual(historyIdentityKey(hashed.wire),historyIdentityKey(literal.wire));assert.equal(hashed.original.localId,original.localId);
});

test('removed-source owner facts reach canonical merge without source evidence',async()=>{
 const h=harness(args=>args.action==='plan'?{data:{status:'planned',accountGeneration:1,expectedAccountRevision:2,sourcePlan:[{sourceId:source,sourceGeneration:2,state:'removed',sourceSnapshotRevision:2,snapshotId:snapshot,pages:1,retainedOwnerFacts:true}]},error:null}:null);
 assert.equal((await handleHistoryMerge(request(),h.options)).status,200);
 const rows=h.calls.find(x=>x.action==='activate'&&x.input.phase==='page').input.records;
 assert.equal(rows.length,1);assert.equal(rows[0].kind,'manual');
 assert.ok(h.events.every(e=>e.correlationId===correlation));
});
test('unresolved removed-source privacy gates activation and preserves exact correlated review classification',async()=>{
 const privacy={kind:'privacy',key:'1',value:{revision:1,policy_id:'policy',command_key:'command',action:'hide',target_kind:'inferred',manual_id:null,reviewed_evidence_json:'["removed"]',reviewed_family_json:'["E:removed"]',reviewed_label:'PRIVATE_SENTINEL',source_run_id:0,created_at_millis:1}};
 const h=harness(args=>args.action==='plan'?{data:{status:'planned',accountGeneration:1,expectedAccountRevision:2,sourcePlan:[{sourceId:source,sourceGeneration:2,state:'removed',sourceSnapshotRevision:2,snapshotId:snapshot,pages:1,retainedOwnerFacts:true}]},error:null}:args.action==='page'?{data:{records:[privacy]},error:null}:null);
 const response=await handleHistoryMerge(request(),h.options);
 assert.equal(response.status,409);assert.deepEqual(h.events.at(-1),{operation:'HISTORY_SYNC',stage:'HISTORY_REVIEW_RETAINED_SOURCE',reasonCode:'HISTORY_REVIEW',retryable:false,durableOutcome:'blocked',correlationId:correlation});
 assert.equal(h.calls.some(x=>x.action==='activate'),false);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);assert.equal((await response.text()).includes('PRIVATE_SENTINEL'),false);
});
test('retained-fact flag cannot authorize evidence or masquerade as an active source',async()=>{
 for(const state of ['active','removed']){
  const h=harness(args=>args.action==='plan'?{data:{status:'planned',accountGeneration:1,expectedAccountRevision:2,sourcePlan:[{sourceId:source,sourceGeneration:2,state,sourceSnapshotRevision:2,snapshotId:snapshot,pages:1,retainedOwnerFacts:true}]},error:null}:args.action==='page'?{data:{records:[{...row,kind:'evidence'}]},error:null}:null);
  assert.equal((await handleHistoryMerge(request(),h.options)).status,409);assert.equal(h.events.at(-1).reasonCode,'HISTORY_SCHEMA');assert.equal(h.calls.some(x=>x.action==='activate'),false);
 }
});
test('complementary source snapshots run jointly through canonical grouping without fabricated duplicate proof',async()=>{
 const secondSource='40000000-0000-4000-8000-000000000002',secondSnapshot='60000000-0000-4000-8000-000000000002';
 const evidence=day=>({kind:'evidence',key:'same-local-id',value:{evidence_id:'same-local-id',source_ref:'synthetic-reference',media_type:'image',availability:'available',captured_day:day,platform_duplicate_family_id:null,source_origin:null,duplicate_tuple_fingerprint:null,has_precise_offset:1,captured_at_millis:Date.parse(day+'T12:00:00Z'),modified_at_millis:null,location_available:1,latitude:13.7,longitude:100.5,reported_accuracy_meters:10,support_eligible:1,duplicate_tuple_version:null}});
 const h=harness(args=>{
  if(args.action==='plan')return {data:{status:'planned',accountGeneration:1,expectedAccountRevision:2,preferredReplaySourceId:source,sourcePlan:[{sourceId:source,sourceGeneration:1,sourceSnapshotRevision:1,snapshotId:snapshot,pages:1},{sourceId:secondSource,sourceGeneration:1,sourceSnapshotRevision:1,snapshotId:secondSnapshot,pages:1}]},error:null};
  if(args.action==='page')return {data:{records:[evidence(args.input.snapshotId===snapshot?'2024-01-01':'2024-01-02')]},error:null};
  return null;
 });
 const response=await handleHistoryMerge(request(),h.options);assert.equal(response.status,200);
 const metadata=h.calls.find(x=>x.action==='activate'&&x.input.phase==='start').input.metadata;
 const rows=h.calls.find(x=>x.action==='activate'&&x.input.phase==='page').input.records;
 assert.equal(rows.length,2);assert.notEqual(rows[0].key,rows[1].key);assert.equal(metadata.sourceCopies.length,2);assert.equal(metadata.graphSummary.journeys,1);
 assert.equal(rows.every(row=>row.value.platform_duplicate_family_id===null),true);
});
test('stored activation receipt ends retry without another merge or activation',async()=>{
 const h=harness(args=>args.action==='plan'?{data:{status:'complete',aggregateId:operation,aggregateRevision:4,pages:1},error:null}:null);
 assert.equal((await handleHistoryMerge(request(),h.options)).status,200);assert.equal(h.calls.length,1);
});
test('lost commit acknowledgement reconciles the same operation without second activation',async()=>{
 let committed=false,commits=0;
 const h=harness(args=>{
  if(args.action==='plan'&&committed)return {data:{status:'complete',aggregateId:operation,aggregateRevision:1,pages:1},error:null};
  if(args.action==='activate'&&args.input.phase==='commit'){committed=true;commits++;throw new Error('PRIVATE_SENTINEL_LOST_ACK');}
  return null;
 });
 const lost=await handleHistoryMerge(request(),h.options);assert.equal(lost.status,503);assert.equal(h.events.at(-1).durableOutcome,'unknown');
 const reconciled=await handleHistoryMerge(request(),h.options);assert.equal(reconciled.status,200);assert.equal(commits,1);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
});
test('untrusted owners, oversized streamed body and cross-origin input fail before private RPC',async()=>{
 for(const req of [request({operationId:operation,ownerId:'PRIVATE_SENTINEL'}),request({operationId:'PRIVATE_SENTINEL'}),request({operationId:operation},{origin:'https://hostile.invalid'}),request({operationId:operation,padding:'S'.repeat(5000)})]){
  const h=harness();const response=await handleHistoryMerge(req,h.options);assert.equal(response.status,409);assert.equal(h.calls.length,0);assert.equal(h.events.at(-1).reasonCode,'HISTORY_SCHEMA');assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
 }
});
test('anonymous, missing identity and auth exceptions never read input pages',async()=>{
 for(const authenticate of [async()=>null,async()=>({owner:'PRIVATE_SENTINEL',session}),async()=>{throw new Error('PRIVATE_SENTINEL');}]){
  const h=harness();h.options.authenticate=authenticate;const response=await handleHistoryMerge(request(),h.options);assert.ok([401,503].includes(response.status));assert.equal(h.calls.length,0);assert.equal(h.events.at(-1).stage,'HISTORY_AUTH');assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);assert.equal((await response.text()).includes('PRIVATE_SENTINEL'),false);
 }
});
for(const boundary of ['plan','page','map-identities','activate'])test(`transport fault at ${boundary} preserves exact stage and unknown acknowledgement`,async()=>{
 const h=harness(args=>{if(args.action===boundary)throw new Error('PRIVATE_SENTINEL SQL token');});
 const response=await handleHistoryMerge(request(),h.options);assert.equal(response.status,503);
 const last=h.events.at(-1);assert.equal(last.reasonCode,'HISTORY_NETWORK');assert.equal(last.stage,boundary==='activate'?'HISTORY_ACTIVATE_START':'HISTORY_ACK');assert.equal(last.durableOutcome,'unknown');
 assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);assert.equal((await response.text()).includes('PRIVATE_SENTINEL'),false);
});
test('CAS stale is a lifecycle skip; schema, auth, review and quota remain distinct',async()=>{
 for(const [reason,stage,outcome]of [['HISTORY_STALE','HISTORY_ACTIVATE_START','skipped'],['HISTORY_SCHEMA','HISTORY_ACTIVATE_START','blocked'],['ACCOUNT_SESSION','HISTORY_AUTH','blocked'],['HISTORY_QUOTA','HISTORY_ACTIVATE_START','blocked'],['HISTORY_INCOMPLETE','HISTORY_ACTIVATE_START','blocked']]){
  const h=harness(args=>args.action==='activate'?{data:{error:reason},error:null}:null);await handleHistoryMerge(request(),h.options);assert.equal(h.events.at(-1).stage,stage);assert.equal(h.events.at(-1).reasonCode,reason);assert.equal(h.events.at(-1).durableOutcome,outcome);assert.equal(h.events.filter(e=>e.reasonCode!=='START').length,1);
 }
});

for(const phase of ['start','page','commit'])for(const [reason,outcome,status] of [['HISTORY_NETWORK','unknown',503],['HISTORY_STALE','skipped',409],['HISTORY_SCHEMA','blocked',409]])test(`activation ${phase} ${reason} preserves phase, correlation and redaction`,async()=>{
 const h=harness(args=>{
  if(args.action!=='activate'||args.input.phase!==phase)return null;
  if(reason==='HISTORY_NETWORK')throw new Error('PRIVATE_SENTINEL SQL token');
  return {data:{error:reason,detail:'PRIVATE_SENTINEL'},error:null};
 });
 const response=await handleHistoryMerge(request(),h.options);
 assert.equal(response.status,status);
 assert.deepEqual(h.events.at(-1),{operation:'HISTORY_SYNC',stage:`HISTORY_ACTIVATE_${phase.toUpperCase()}`,reasonCode:reason,retryable:reason==='HISTORY_NETWORK',durableOutcome:outcome,correlationId:correlation});
 assert.equal(h.events.filter(event=>event.reasonCode!=='START').length,1);
 assert.ok(h.events.every(event=>event.correlationId===correlation));
 assert.ok(h.events.some(event=>event.stage==='HISTORY_ACTIVATE'&&event.reasonCode==='START'));
 assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
 assert.equal((await response.text()).includes('PRIVATE_SENTINEL'),false);
 assert.deepEqual(Object.keys(h.events.at(-1)).sort(),['correlationId','durableOutcome','operation','reasonCode','retryable','stage']);
 const phases=h.calls.filter(call=>call.action==='activate').map(call=>call.input.phase);
 assert.deepEqual(phases,['start','page','commit'].slice(0,['start','page','commit'].indexOf(phase)+1));
});

test('successful activation keeps general marker and fixed ordered phase milestones',async()=>{
 const h=harness();const response=await handleHistoryMerge(request(),h.options);assert.equal(response.status,200);
 const events=h.events.filter(event=>event.stage.startsWith('HISTORY_ACTIVATE'));
 assert.deepEqual(events.map(event=>[event.stage,event.reasonCode]),[['HISTORY_ACTIVATE','START'],['HISTORY_ACTIVATE_START','START'],['HISTORY_ACTIVATE_PAGE','START'],['HISTORY_ACTIVATE_COMMIT','START'],['HISTORY_ACTIVATE_COMMIT','COMPLETE']]);
 assert.ok(events.every(event=>event.correlationId===correlation));
});
test('review or typed canonical errors retain prior aggregate without any staging',async()=>{
 for(const [domain,expectedStage] of [[{collectAccountIdentityKeys:()=>[],mergeAccountHistory:async()=>({review:[{reason:'correction-needs-review'}]})},'HISTORY_REVIEW_CORRECTION'],[{collectAccountIdentityKeys:()=>{throw Object.assign(new Error('PRIVATE_SENTINEL'),{code:'HISTORY_SCHEMA'});},mergeAccountHistory:async()=>null},'HISTORY_REBUILD']]){
  const h=harness(()=>null,domain);const response=await handleHistoryMerge(request(),h.options);assert.equal(response.status,409);assert.equal(h.calls.some(c=>c.action==='activate'),false);assert.equal(h.events.at(-1).stage,expectedStage);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
 }
});
test('diagnostic logger strips arbitrary content and generates safe invalid correlations',()=>{
 const events=[];const log=createHistoryDiagnostic(e=>events.push(e));log({operation:'PRIVATE_SENTINEL',stage:'PRIVATE_SENTINEL',reasonCode:'PRIVATE_SENTINEL',correlationId:'PRIVATE_SENTINEL',durableOutcome:'PRIVATE_SENTINEL',token:'PRIVATE_SENTINEL',error:new Error('PRIVATE_SENTINEL')});
 assert.equal(JSON.stringify(events).includes('PRIVATE_SENTINEL'),false);assert.equal(events[0].reasonCode,'UNKNOWN');assert.match(events[0].correlationId,/^local_[a-f0-9]{32}$/);assert.deepEqual(Object.keys(events[0]).sort(),['correlationId','durableOutcome','operation','reasonCode','retryable','stage']);
});

const canonicalPhases=['REBUILD_PROCESSING','REBUILD_BASELINE_GRAPH','REBUILD_BASELINE_MAPPING','REBUILD_CONSTRAINED_GRAPH','REBUILD_CONFIRMED_MAPPING','REBUILD_MEMORY_OVERLAY','REBUILD_OWNER_MERGE','REBUILD_CONTINUITY','REBUILD_MEMBERSHIP','REBUILD_FINAL_MAPPING'];
for(const stage of ['HISTORY_NORMALIZE','HISTORY_PROJECT','HISTORY_REPLAY_PROJECT','HISTORY_REPLAY_MAP',...['HISTORY_PROJECT','HISTORY_REPLAY_PROJECT'].flatMap(prefix=>canonicalPhases.map(phase=>`${prefix}_${phase}`))])test(`merge CPU boundary ${stage} retains fixed stage, correlation and redaction`,async()=>{
 const h=harness(()=>null,{collectAccountIdentityKeys:()=>[],mergeAccountHistory:async(_sources,options)=>{
  options.profile(stage);throw Object.assign(new Error('PRIVATE_SENTINEL'),{code:'HISTORY_REVIEW'});
 }});
 const response=await handleHistoryMerge(request(),h.options),last=h.events.at(-1);
 assert.equal(response.status,409);assert.equal(last.stage,stage);assert.equal(last.reasonCode,'HISTORY_REVIEW');assert.equal(last.durableOutcome,'blocked');
 assert.equal(last.correlationId,correlation);assert.equal(h.events.filter(event=>event.reasonCode!=='START').length,1);
 assert.equal(h.calls.some(call=>call.action==='activate'),false);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
 assert.equal((await response.text()).includes('PRIVATE_SENTINEL'),false);
 assert.deepEqual(Object.keys(last).sort(),['correlationId','durableOutcome','operation','reasonCode','retryable','stage']);
});

test('real canonical projection forwards fixed account and source Replay phases',async()=>{
 const events=[];
 const local={kind:'manual',key:'local-journey',value:{manual_id:'local-journey',command_key:'command',owner_label:'Synthetic',owner_context:'Fixture',date_kind:'exact',date_start:'2020-01-01',date_end:'2020-01-02',latitude:10,longitude:20,created_at_millis:1}};
 const replay={kind:'replay',key:'1',value:{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:JSON.stringify({autoGroupJourneyIds:['manual:local-journey'],direction:'newest-first'})}};
 const result=await mergeAccountHistory([{sourceId:source,rows:[local,replay]}],{mapIdentity:(_source,_kind,id)=>id,profile:stage=>events.push(stage)});
 assert.equal(result.review.length,0);
 for(const prefix of ['HISTORY_PROJECT','HISTORY_REPLAY_PROJECT'])assert.deepEqual(events.filter(stage=>stage.startsWith(prefix+'_REBUILD_')),canonicalPhases.map(phase=>`${prefix}_${phase}`));
 assert.equal(JSON.stringify(events).includes('Synthetic'),false);
});

for(const [reason,stage,detail] of [['duplicate-metadata-conflict','HISTORY_REVIEW_DUPLICATE',{}],['correction-needs-review','HISTORY_REVIEW_CORRECTION',{}],['correction-needs-review','HISTORY_REVIEW_CORRECTION_REMAP',{revisionId:'PRIVATE_SENTINEL'}],['correction-needs-review','HISTORY_REVIEW_RETAINED_SOURCE',{sourceId:'PRIVATE_SENTINEL'}],['replay-group-needs-review','HISTORY_REVIEW_REPLAY_GROUP',{}]])test(`review ${stage} retains exact safe category`,async()=>{
 const h=harness(()=>null,{collectAccountIdentityKeys:()=>[],mergeAccountHistory:async()=>({review:[{reason,...detail}]})});
 const response=await handleHistoryMerge(request(),h.options);
 assert.equal(response.status,409);assert.equal(h.events.at(-1).stage,stage);assert.equal(h.events.at(-1).reasonCode,'HISTORY_REVIEW');assert.equal(h.events.at(-1).correlationId,correlation);
 assert.equal(h.calls.some(call=>call.action==='activate'),false);assert.equal(JSON.stringify(h.events).includes('PRIVATE_SENTINEL'),false);
});

test('absent committed source Replay group remains reviewable with no private group diagnostic',async()=>{
 const stages=[];const replay={kind:'replay',key:'1',value:{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:JSON.stringify({autoGroupJourneyIds:['PRIVATE_SENTINEL'],direction:'newest-first'})}};
 const result=await mergeAccountHistory([{sourceId:source,rows:[row,replay]}],{mapIdentity:(_s,kind,id)=>`${kind}:${id}`,profile:stage=>stages.push(stage)});
 assert.equal(result.review[0].reason,'replay-group-needs-review');assert.equal(result.pendingReplay.length,1);assert.equal(result.replay,null);
 assert.ok(stages.includes('HISTORY_REPLAY_GROUP_ABSENT'));assert.equal(JSON.stringify(stages).includes('PRIVATE_SENTINEL'),false);
});
test('cancellation between reads and staging skips activation without claiming rollback',async()=>{
 const controller=new AbortController();const h=harness(args=>{if(args.action==='map-identities')controller.abort();return null;});
 const response=await handleHistoryMerge(new Request(request(),{signal:controller.signal}),h.options);
 assert.equal(response.status,409);assert.equal(h.calls.some(x=>x.action==='activate'),false);assert.equal(h.events.at(-1).reasonCode,'HISTORY_CANCELLED');assert.equal(h.events.at(-1).durableOutcome,'skipped');
});
test('backend RPC exceptions with unknown cause stay unknown and do not serialize database details',async()=>{
 const h=harness(()=>({data:null,error:{code:'XX000',message:'PRIVATE_SENTINEL',details:'PRIVATE_SENTINEL'}}));
 const response=await handleHistoryMerge(request(),h.options);assert.equal(response.status,503);assert.equal(h.events.at(-1).reasonCode,'UNKNOWN');assert.equal(h.events.at(-1).stage,'HISTORY_ACK');assert.equal((await response.text()).includes('PRIVATE_SENTINEL'),false);
});
test('configuration is a separate fail-closed boundary without auth or RPC work',async()=>{
 const h=harness();h.options.configured=false;h.options.authenticate=()=>{throw new Error('should not authenticate');};
 await handleHistoryMerge(request(),h.options);assert.equal(h.calls.length,0);assert.equal(h.events.at(-1).stage,'HISTORY_CONFIG');assert.equal(h.events.at(-1).reasonCode,'HISTORY_UNAVAILABLE');
});
test('Auth verified identity rejects anonymous, unconfirmed, mismatched and absent sessions',async()=>{
 const token=claims=>`synthetic.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
 const valid={sub:owner,is_anonymous:false,session_id:session};
 const user={id:owner,is_anonymous:false,email_confirmed_at:'2026-01-01'};
 const lookup=async()=>({data:{user},error:null});
 assert.deepEqual(await authenticateHistoryToken(token(valid),lookup),{owner,session});
 for(const claims of [{...valid,sub:'other'},{...valid,is_anonymous:true},{sub:owner,is_anonymous:false}])assert.equal(await authenticateHistoryToken(token(claims),lookup),null);
 for(const altered of [{...user,is_anonymous:true},{...user,email_confirmed_at:undefined}])assert.equal(await authenticateHistoryToken(token(valid),async()=>({data:{user:altered},error:null})),null);
 assert.equal(await authenticateHistoryToken(token(valid),async()=>({data:{user},error:{message:'PRIVATE_SENTINEL'}})),null);
});
test('worker native-free generated graph is current and direct consoles stay forbidden',async()=>{
 execFileSync(process.execPath,['scripts/build-history-domain.mjs','--check']);
 for(const directory of ['supabase/functions/travel-life-history-merge','supabase/functions/_shared'])for(const file of await readdir(directory)){
  if(!file.startsWith('history-')&&file!=='legacy-history-runtime.ts'&&directory.endsWith('_shared'))continue;
  const text=await readFile(`${directory}/${file}`,'utf8');assert.doesNotMatch(text,/\bconsole\s*(?:\.|\[)/);assert.doesNotMatch(text,/expo-sqlite|react-native|service_role.*mobile/);
 }
});
