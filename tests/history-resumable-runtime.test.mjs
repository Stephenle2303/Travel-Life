import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleHistoryMerge} from '../supabase/functions/_shared/history-runtime.ts';
import {mergeAccountHistory,encodeHistoryRows,decodeHistoryRows} from '../supabase/functions/_shared/history-domain.js';

const owner='10000000-0000-4000-8000-000000000001',session='20000000-0000-4000-8000-000000000001',sourceId='30000000-0000-4000-8000-000000000001',snapshotId='40000000-0000-4000-8000-000000000001',operationId='50000000-0000-4000-8000-000000000001';
const correlation='local_'+'c'.repeat(32),clone=value=>JSON.parse(JSON.stringify(value));
const request=(input={operationId})=>new Request('https://synthetic.invalid',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json','x-travel-life-correlation':correlation},body:JSON.stringify(input)});
let fixturePromise;
async function fixture(){return fixturePromise??=(async()=>{
 const rows=Array.from({length:120},(_,index)=>({kind:'evidence',key:`synthetic-${index}`,value:{evidence_id:`synthetic-${index}`,source_ref:`synthetic-${index}`,media_type:'image',availability:'available',captured_day:new Date(Date.UTC(2020,0,1)+index*3_600_000).toISOString().slice(0,10),platform_duplicate_family_id:null,source_origin:null,duplicate_tuple_fingerprint:null,has_precise_offset:index%3?1:0,captured_at_millis:Date.UTC(2020,0,1)+index*3_600_000,modified_at_millis:null,location_available:null,latitude:index%2?null:10+(index%20)*.2,longitude:index%2?null:100+(index%20)*.2,reported_accuracy_meters:10,support_eligible:null,duplicate_tuple_version:null}}));
 const local=await mergeAccountHistory([{sourceId,rows}],{mapIdentity:(_source,_kind,id)=>id}),journey=local.projection.graph.journeys[0];
 const refs=local.projection.graph.memberships.slice(0,40).map(item=>JSON.stringify([item.journeyId,item.evidenceId]));
 rows.push({kind:'replay',key:'1',value:{record_id:1,revision:7,updated_at_millis:1,committed_overrides_json:JSON.stringify({keptMemoryRefs:refs,orderedMemoryRefs:[...refs].reverse(),autoGroupJourneyIds:[journey.id],direction:'newest-first',soundtrack:{kind:'custom',revision:'synthetic-audio',localUri:''}})}});
 const visits=new Map(local.projection.graph.visits.map(visit=>[visit.id,visit])),groups=journey.visitIds.map(id=>visits.get(id).evidenceIds.map(id=>`E:${id}`).sort());
 rows.push({kind:'journey-correction',key:'place',value:{revision_id:'place',action:'place',journey_id:journey.id,reviewed_support_json:JSON.stringify(groups.flat().sort()),reviewed_visits_json:JSON.stringify(groups),reviewed_family_snapshot_json:'{}',reviewed_snapshot_json:'{}',state:'effective',replaces_revision_id:null,command_key:null,owner_title:null,owner_date_kind:null,owner_date_start:null,owner_date_end:null,structural_boundary_json:null,owner_place_id:null,owner_place_name:'Synthetic place',owner_place_context:null,source_run_id:0,created_at_millis:1,owner_latitude:null,owner_longitude:null}});
 return rows;
})();}

async function harness(extraRows=[]){
 const rows=[...clone(await fixture()),...clone(extraRows)],wire=encodeHistoryRows(rows),sourcePages=[];for(let start=0;start<wire.length;start+=100)sourcePages.push(wire.slice(start,start+100));
 const plan={accountGeneration:1,expectedAccountRevision:4,ownerRevision:0,sourcePlan:[{sourceId,snapshotId,pages:sourcePages.length}],preferredReplaySourceId:sourceId};
 const state={phase:'prepare',parts:new Map(),output:new Map(),events:[],calls:[],identities:new Map(),before:null,after:null};
 const mapIdentity=(source,kind,id)=>{const local=id.length>1024?createHash('sha256').update(id).digest('hex'):id;const codec=id.length>1024?'sha256-v1':'literal';return allocate([source,kind,local,codec]);};
 const allocate=key=>{const text=JSON.stringify(key);if(!state.identities.has(text))state.identities.set(text,`80000000-0000-4000-8000-${String(state.identities.size+1).padStart(12,'0')}`);return state.identities.get(text);};
 const backend={rpc:async(name,args)=>{
  const call={name,...clone(args)};state.calls.push(call);const replacement=await state.before?.(call);if(replacement)return replacement;
  const {action,input}=args;let data;
  if(name==='travel_life_history_checkpoint'){
   if(action==='status')data=state.phase==='complete'?state.receipt:{status:state.phase,...(state.base?{base:state.base}:{}),preparedPages:state.count,outputPages:state.outputCount};
   else if(action==='start'){if(state.base)assert.deepEqual(input.base,state.base);state.base=clone(input.base);state.count=input.pages;data={status:'staging'};}
   else if(action==='page'){if(state.parts.has(input.page))assert.deepEqual(state.parts.get(input.page),input.records);state.parts.set(input.page,clone(input.records));data={status:'staging'};}
   else if(action==='seal'){assert.equal(state.parts.size,state.count);state.phase='build';data={status:'staged'};}
   else if(action==='read-batch')data={records:Array.from({length:input.count},(_,index)=>state.parts.get(input.page+index)?.[0])};
   else if(action==='ready'){assert.equal(state.output.size,input.pages);state.outputCount=input.pages;state.phase='finalize';data={status:'ready'};}
   else throw Error('FIXTURE_ACTION');
  }else if(action==='plan')data=clone(plan);
  else if(action==='page')data={records:clone(sourcePages[input.page])};
  else if(action==='map-identities')data={mappings:input.keys.map(key=>({...key,accountId:allocate([key.sourceId,key.kind,key.localId,key.localIdCodec??'literal'])}))};
  else if(action==='activate'){
   if(input.phase==='start'){state.outputCount=input.pages;state.metadata=clone(input.metadata);data={status:'staging'};}
   else if(input.phase==='page'){if(state.output.has(input.page))assert.deepEqual(state.output.get(input.page),input.records);state.output.set(input.page,clone(input.records));data={status:'staging'};}
   else{assert.equal(state.phase,'finalize');state.phase='complete';state.receipt={status:'complete',aggregateId:operationId,aggregateRevision:5,pages:state.outputCount};data=state.receipt;}
  }else throw Error('FIXTURE_ACTION');
  await state.after?.(call);return {data:clone(data),error:null};
 }};
 const run=async(input={operationId})=>{
  state.events=[];const response=await handleHistoryMerge(request(input),{resumable:true,backend,authenticate:async()=>({owner,session}),sink:event=>state.events.push(event)});return {response,body:await response.json()};
 };
 return {state,rows,plan,mapIdentity,run};
}

test('three fresh handlers prepare/build/finalize once, retain exact correction and Replay, then reconcile receipt',async()=>{
 const h=await harness(),original=clone(h.rows);
 assert.deepEqual((await h.run()).body,{status:'progress',operationId});assert.equal(h.state.phase,'build');assert.ok(h.state.count>1);
 assert.equal(h.state.calls.some(call=>call.action==='activate'),false);
 const reads=h.state.calls.filter(call=>call.name==='travel_life_history_worker'&&call.action==='page').length;
 assert.deepEqual((await h.run()).body,{status:'progress',operationId});assert.equal(h.state.phase,'finalize');
 assert.equal(h.state.calls.filter(call=>call.name==='travel_life_history_worker'&&call.action==='page').length,reads);
 const batches=h.state.calls.filter(call=>call.name==='travel_life_history_checkpoint'&&call.action==='read-batch');
 assert.equal(batches.length,Math.ceil(h.state.count/8));
 assert.ok(batches.every(call=>call.input.count>=1&&call.input.count<=8));
 assert.equal(h.state.calls.some(call=>call.input.phase==='commit'),false);
 const direct=await mergeAccountHistory([{sourceId,rows:h.rows}],{mapIdentity:h.mapIdentity,preferredReplaySourceId:sourceId});
 const output=decodeHistoryRows([...h.state.output].sort(([a],[b])=>a-b).flatMap(([,rows])=>rows));
 assert.deepEqual(output,direct.rows);assert.deepEqual(h.rows,original);
 assert.deepEqual(h.state.metadata.graphSummary,{journeys:direct.projection.graph.journeys.length,visits:direct.projection.graph.visits.length});
 const replay=JSON.parse(output.find(row=>row.kind==='replay').value.committed_overrides_json);
 assert.deepEqual(replay.orderedMemoryRefs,[...replay.keptMemoryRefs].reverse());assert.equal(replay.keptMemoryRefs.length,40);assert.equal(replay.soundtrack.revision,'synthetic-audio');
 assert.equal(output.find(row=>row.kind==='journey-correction').value.owner_place_name,'Synthetic place');
 const builtCalls=h.state.calls.length;const completed=await h.run();assert.equal(completed.body.status,'complete');assert.equal(h.state.phase,'complete');
 assert.deepEqual((await h.run()).body,completed.body);
 assert.deepEqual(h.state.calls.slice(builtCalls).map(call=>call.action),['status','activate','status','status']);
});

test('checkpoint restart retains the exact canonical owner journal edits, Replay selection and deletion at its owner revision',async()=>{
 const manual={kind:'manual',key:'retired-manual',value:{manual_id:'retired-manual',command_key:'manual-command',owner_label:'Synthetic removable trip',owner_context:'Synthetic',date_kind:'exact',date_start:'2020-01-01',date_end:'2020-01-02',latitude:10,longitude:20,created_at_millis:1}};
 const h=await harness([manual]);
 const baseline=await mergeAccountHistory([{sourceId,rows:h.rows}],{mapIdentity:h.mapIdentity,preferredReplaySourceId:sourceId});
 assert.deepEqual(baseline.review,[]);
 const correction=clone(baseline.rows.find(row=>row.kind==='journey-correction'));
 correction.value.owner_place_name='Synthetic owner journal place';
 const replay=clone(baseline.replay),sourceComposition=JSON.parse(replay.value.committed_overrides_json);
 const kept=sourceComposition.keptMemoryRefs.slice(0,5),ordered=[kept[4],kept[1],kept[3],kept[0],kept[2]];
 const selected={...sourceComposition,keptMemoryRefs:kept,orderedMemoryRefs:ordered,excludedMemoryRefs:sourceComposition.keptMemoryRefs.slice(5,7),direction:'oldest-first',soundtrack:{kind:'custom',revision:'synthetic-owner-score',localUri:''}};
 replay.value={...replay.value,revision:9,updated_at_millis:9,committed_overrides_json:JSON.stringify(selected)};
 const deleted=baseline.rows.find(row=>row.kind==='manual');assert.ok(deleted);
 h.plan.ownerRevision=7;
 h.plan.ownerChanges={rows:[correction,replay],deleted:[{kind:'manual',key:deleted.key}]};
 const journal=clone(h.plan.ownerChanges);
 assert.deepEqual((await h.run()).body,{status:'progress',operationId});
 assert.equal(h.state.phase,'build');assert.equal(h.state.base.ownerRevision,7);
 assert.equal(Object.hasOwn(h.state.base,'ownerChanges'),false);
 const preparedEnvelope=JSON.parse([...h.state.parts].sort(([a],[b])=>a-b).map(([,parts])=>parts[0]).join(''));
 assert.deepEqual(preparedEnvelope.options.accountOwnerChanges,journal);
 assert.deepEqual((await h.run()).body,{status:'progress',operationId});assert.equal(h.state.phase,'finalize');
 const output=decodeHistoryRows([...h.state.output].sort(([a],[b])=>a-b).flatMap(([,rows])=>rows));
 assert.equal(output.some(row=>row.kind==='manual'&&row.key===deleted.key),false);
 assert.deepEqual(output.find(row=>row.kind==='journey-correction'),correction);
 assert.deepEqual(output.find(row=>row.kind==='replay'),replay);
 assert.deepEqual(JSON.parse(output.find(row=>row.kind==='replay').value.committed_overrides_json),selected);
 assert.deepEqual(output.filter(row=>row.kind==='evidence'),baseline.rows.filter(row=>row.kind==='evidence'));
 assert.equal(h.state.metadata.ownerRevision,7);assert.deepEqual(h.state.metadata.review,[]);
 const completed=await h.run();assert.equal(completed.body.status,'complete');assert.equal(completed.body.aggregateId,operationId);
 assert.deepEqual(h.plan.ownerChanges,journal);
 assert.deepEqual((await h.run()).body,completed.body);
});

for(const [action,phase,stage] of [['status','prepare','HISTORY_CHECKPOINT_READ'],['start','prepare','HISTORY_CHECKPOINT_WRITE'],['page','prepare','HISTORY_CHECKPOINT_WRITE'],['seal','prepare','HISTORY_CHECKPOINT_SEAL'],['read-batch','build','HISTORY_CHECKPOINT_READ'],['ready','build','HISTORY_CHECKPOINT_SEAL']])test(`checkpoint ${action} network fault preserves operation correlation and redaction`,async()=>{
 const h=await harness();if(phase==='build')await h.run();
 h.state.before=call=>{if(call.name==='travel_life_history_checkpoint'&&call.action===action)throw Error('PRIVATE_SENTINEL SQL token');};
 const {response,body}=await h.run();assert.equal(response.status,503);assert.equal(body.error,'HISTORY_NETWORK');
 assert.deepEqual(h.state.events.at(-1),{operation:'HISTORY_SYNC',stage,reasonCode:'HISTORY_NETWORK',retryable:true,durableOutcome:'unknown',correlationId:correlation});
 assert.ok(h.state.events.every(event=>event.correlationId===correlation));assert.equal(h.state.events.filter(event=>!['START','CHECKPOINTED'].includes(event.reasonCode)).length,1);
 assert.equal(JSON.stringify(h.state.events).includes('PRIVATE_SENTINEL'),false);assert.equal(JSON.stringify(body).includes('PRIVATE_SENTINEL'),false);
 assert.equal(h.state.calls.filter(call=>call.action==='activate'&&call.input.phase==='commit').length,0);
});

for(const action of ['seal','ready','commit'])test(`lost ${action} acknowledgement resumes durable next phase under the identical operation`,async()=>{
 const h=await harness();if(action!=='seal')await h.run();if(action==='commit')await h.run();
 let lost=false;h.state.after=call=>{if(!lost&&(action==='commit'?call.action==='activate'&&call.input.phase==='commit':call.action===action)){lost=true;throw Error('PRIVATE_SENTINEL');}};
 assert.equal((await h.run()).response.status,503);assert.equal(lost,true);h.state.after=null;
 const resumed=await h.run();assert.equal(resumed.body.status,action==='seal'?'progress':'complete');
 if(action==='seal')assert.equal((await h.run()).body.status,'complete');
 assert.equal(h.state.calls.filter(call=>call.name==='travel_life_history_worker'&&call.action==='plan').length,1);
 assert.ok(h.state.calls.filter(call=>call.input.operationId).every(call=>call.input.operationId===operationId));
});

test('lost post-commit cleanup acknowledgement stays unknown until receipt retry without rebuilding',async()=>{
 const h=await harness();await h.run();await h.run();const builtCalls=h.state.calls.length;
 h.state.before=call=>{if(call.name==='travel_life_history_checkpoint'&&call.action==='status'&&h.state.phase==='complete')throw Error('PRIVATE_SENTINEL');};
 const result=await h.run();assert.equal(result.response.status,503);assert.equal(result.body.error,'HISTORY_NETWORK');assert.equal(h.state.phase,'complete');
 assert.deepEqual(h.state.events.at(-1),{operation:'HISTORY_SYNC',stage:'HISTORY_CHECKPOINT_READ',reasonCode:'HISTORY_NETWORK',retryable:true,durableOutcome:'unknown',correlationId:correlation});
 assert.equal(h.state.events.some(event=>event.reasonCode==='COMPLETE'),false);
 h.state.before=null;const reconciled=await h.run();assert.equal(reconciled.body.status,'complete');assert.equal(reconciled.body.aggregateId,operationId);
 assert.deepEqual(h.state.calls.slice(builtCalls).map(call=>call.action),['status','activate','status','status']);
 assert.equal(JSON.stringify(h.state.events).includes('PRIVATE_SENTINEL'),false);
});

test('prepare interruption cannot advance to build before the complete private checkpoint is sealed',async()=>{
 const h=await harness();h.state.before=call=>{if(call.name==='travel_life_history_checkpoint'&&call.action==='seal')throw Error('PRIVATE_SENTINEL');};
 assert.equal((await h.run()).response.status,503);assert.equal(h.state.phase,'prepare');assert.equal(h.state.output.size,0);
 h.state.before=null;assert.equal((await h.run()).body.status,'progress');assert.equal(h.state.phase,'build');assert.equal(h.state.output.size,0);
});

for(const malformed of [false,true])test(`concurrent checkpoint receipt ${malformed?'rejects malformed completion':'wins over pending build'}`,async()=>{
 const h=await harness();await h.run();const before=h.state.calls.length;
 h.state.before=call=>call.name==='travel_life_history_checkpoint'&&call.action==='read-batch'?{data:{status:'complete',aggregateId:malformed?sourceId:operationId,aggregateRevision:8,pages:4},error:null}:null;
 const result=await h.run();assert.equal(result.response.status,malformed?503:200);
 assert.equal(result.body.status,malformed?'unknown':'complete');
 assert.equal(h.state.calls.slice(before).some(call=>call.action==='activate'),false);
 assert.equal(h.state.events.at(-1).reasonCode,malformed?'HISTORY_NETWORK':'COMPLETE');
 assert.equal(h.state.events.at(-1).stage,'HISTORY_CHECKPOINT_READ');
 assert.ok(h.state.events.every(event=>event.correlationId===correlation));
});

test('malformed source preparation leaves no reusable private checkpoint or aggregate',async()=>{
 const h=await harness();h.state.before=call=>call.name==='travel_life_history_worker'&&call.action==='page'?{data:{records:'PRIVATE_SENTINEL'},error:null}:null;
 const result=await h.run();assert.equal(result.response.status,503);assert.equal(result.body.error,'HISTORY_NETWORK');assert.equal(h.state.phase,'prepare');assert.equal(h.state.parts.size,0);assert.equal(h.state.output.size,0);assert.equal(JSON.stringify(h.state.events).includes('PRIVATE_SENTINEL'),false);
});

for(const alteration of ['missing','malformed','extra-option','missing-mapping','invalid-preference','invalid-journal','invalid-deletion'])test(`private checkpoint ${alteration} is blocked before aggregate staging`,async()=>{
 const h=await harness();await h.run();
 if(alteration==='missing')h.state.parts.delete(0);
 else if(alteration==='malformed')h.state.parts.set(0,['PRIVATE_SENTINEL']);
 else{const envelope=JSON.parse([...h.state.parts].sort(([a],[b])=>a-b).map(([,parts])=>parts[0]).join(''));if(alteration==='extra-option')envelope.options.phase='PRIVATE_SENTINEL';else if(alteration==='invalid-preference')envelope.options.preferredReplaySourceId=null;else if(alteration==='invalid-journal')envelope.options.accountOwnerChanges={rows:[],deleted:'PRIVATE_SENTINEL'};else if(alteration==='invalid-deletion')envelope.options.accountOwnerChanges={rows:[],deleted:[{kind:'manual',key:null}]};else envelope.prepared.mappings=envelope.prepared.mappings.filter(item=>item.kind!=='evidence');const text=JSON.stringify(envelope);h.state.parts.clear();for(let start=0;start<text.length;start+=16_384)h.state.parts.set(h.state.parts.size,[text.slice(start,start+16_384)]);h.state.count=h.state.parts.size;}
 const result=await h.run();assert.equal(result.response.status,409);assert.equal(result.body.error,'HISTORY_SCHEMA');assert.equal(h.state.output.size,0);assert.equal(JSON.stringify(h.state.events).includes('PRIVATE_SENTINEL'),false);
});

test('client cannot submit phase, canonical rows or prepared content',async()=>{
 for(const extra of [{phase:'build'},{rows:[]},{prepared:{}}]){const h=await harness();const result=await h.run({operationId,...extra});assert.equal(result.response.status,409);assert.equal(result.body.error,'HISTORY_SCHEMA');assert.equal(h.state.calls.length,0);}
});

test('legacy requests keep their existing branch when resumable mode is enabled',async()=>{
 const h=await harness();h.state.before=call=>{assert.notEqual(call.name,'travel_life_history_checkpoint');assert.equal(call.action,'legacy-plan');return {data:{status:'accepted',ownerRevision:7},error:null};};
 const result=await h.run({operationId,legacy:{}});assert.equal(result.response.status,200);assert.deepEqual(result.body,{status:'accepted',ownerRevision:7});assert.equal(h.state.calls.some(call=>call.name==='travel_life_history_checkpoint'),false);
});
