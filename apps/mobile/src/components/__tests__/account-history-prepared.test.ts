import { prepareAccountHistory, mergePreparedAccountHistory, mergeAccountHistory, type AccountHistorySource, type PreparedAccountHistory } from '@/account/history-merge';
import { historyLayouts, type HistoryRow } from '@/account/history-contract';
import { projectCanonicalHistory } from '@/reconstruction/canonical-projection';
import type { EvidenceRow } from '@/reconstruction/canonical-core';

const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
function row(kind:string,values:Record<string,string|number|null>):HistoryRow {
  const fields=Object.fromEntries(Object.entries(historyLayouts[kind].fields).map(([key,type])=>[key,type.endsWith('?')?null:type==='number'?0:'']));
  const value={...fields,...values};return {kind,key:String(value[historyLayouts[kind].key]),value};
}
const evidence=(id:string,index=0)=>row('evidence',{evidence_id:id,source_ref:id,media_type:'image',availability:'available',has_precise_offset:index%3?1:0,captured_at_millis:Date.UTC(2020,0,1)+index*3_600_000,captured_day:new Date(Date.UTC(2020,0,1)+index*3_600_000).toISOString().slice(0,10),latitude:index%2?null:10+(index%20)*.2,longitude:index%2?null:100+(index%20)*.2,reported_accuracy_meters:10});
const options={mapIdentity:(source:string,kind:string,id:string)=>`${source}/${kind}/${id}`};
const view=(result:Awaited<ReturnType<typeof mergeAccountHistory>>)=>({rows:result.rows,graph:result.projection.graph,review:result.review,privacy:result.privacy,replay:result.replay,pendingReplay:result.pendingReplay,mappings:result.mappings,sourceCopies:result.sourceCopies});

async function fixture(){
  const rows=Array.from({length:90},(_,index)=>evidence(`mixed-${index}`,index));
  const projected=await projectCanonicalHistory({rows:rows.map(item=>item.value as unknown as EvidenceRow),excluded:new Set(),privateFilter:{excluded:new Set()},configuredHomeAreas:[],storedCorrections:[],storedMemoryCorrections:[]});
  const journey=projected.graph.journeys[0];const visits=new Map(projected.graph.visits.map(visit=>[visit.id,visit]));
  const groups=journey.visitIds.map(id=>visits.get(id)!.evidenceIds.map(id=>`E:${id}`).sort());
  const refs=projected.graph.memberships.slice(0,12).map(item=>JSON.stringify([item.journeyId,item.evidenceId]));
  rows.push(row('replay',{record_id:1,revision:7,updated_at_millis:1,committed_overrides_json:JSON.stringify({keptMemoryRefs:refs,orderedMemoryRefs:[...refs].reverse(),autoGroupJourneyIds:[journey.id],direction:'newest-first',soundtrack:{kind:'custom',revision:'synthetic-audio',localUri:''}})}));
  rows.push(row('journey-correction',{revision_id:'place',action:'place',journey_id:journey.id,reviewed_support_json:JSON.stringify(groups.flat().sort()),reviewed_visits_json:JSON.stringify(groups),reviewed_family_snapshot_json:'{}',reviewed_snapshot_json:'{}',state:'effective',owner_place_name:'Synthetic place'}));
  rows.push(row('privacy',{revision:1,policy_id:'hide',command_key:'hide-command',action:'hide',target_kind:'inferred',reviewed_evidence_json:'["mixed-0"]',reviewed_family_json:'[]',reviewed_label:'Synthetic hidden support'}));
  return [{sourceId:'A',rows}];
}

it('roundtrips a prepared mixed-GPS correction and exact Replay without retaining the original large body',async()=>{
  const sources=await fixture(),before=copy(sources),stages:string[]=[];
  const prepared=prepareAccountHistory(sources,{...options,profile:stage=>stages.push(stage)});
  expect(stages).toEqual(['HISTORY_NORMALIZE']);expect(sources).toEqual(before);
  expect(prepared.original[0].rows.find(item=>item.kind==='replay')!.value.committed_overrides_json).toBe('{}');
  expect(prepared.sources[0].rows.find(item=>item.kind==='replay')!.value.committed_overrides_json).not.toBe('{}');
  const restored=copy(prepared),checkpointBefore=copy(restored);
  const split=await mergePreparedAccountHistory(restored),direct=await mergeAccountHistory(sources,options);
  expect(view(split)).toEqual(view(direct));expect(split.review).toEqual([]);expect(split.replay).not.toBeNull();
  expect(split.privacy.hiddenEvidenceIds).toEqual(['A/evidence/mixed-0']);
  const composition=JSON.parse(String(split.replay!.value.committed_overrides_json));
  expect(composition.orderedMemoryRefs).toEqual([...composition.keptMemoryRefs].reverse());
  expect(composition.soundtrack).toEqual({kind:'custom',revision:'synthetic-audio',localUri:''});
  expect(split.rows.find(item=>item.kind==='journey-correction')!.value.owner_place_name).toBe('Synthetic place');
  expect(restored).toEqual(checkpointBefore);expect(sources).toEqual(before);
  expect(view(await mergePreparedAccountHistory(restored))).toEqual(view(split));
});

it('preserves removed-source Replay presence and all pending choices as explicit review',async()=>{
  const replay=row('replay',{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:JSON.stringify({autoGroupJourneyIds:['removed'],direction:'oldest-first'})});
  const sources:AccountHistorySource[]=[{sourceId:'removed',retainedOwnerFacts:true,rows:[replay]},{sourceId:'B',rows:[evidence('survives')]}];
  const split=await mergePreparedAccountHistory(copy(prepareAccountHistory(sources,options)));
  expect(view(split)).toEqual(view(await mergeAccountHistory(sources,options)));
  expect(split.review).toContainEqual({reason:'correction-needs-review',sourceId:'removed'});
  expect(split.replay).toBeNull();expect(split.pendingReplay).toHaveLength(1);
  expect(JSON.parse(String(split.pendingReplay[0].value.committed_overrides_json)).autoGroupJourneyIds).toEqual(['removed/journey/removed']);
});

it('reuses the prepared checkpoint without mutation when verified duplicates decorate normalized rows',async()=>{
  const a=evidence('one'),b={...evidence('two'),value:{...evidence('two').value,latitude:10,longitude:100}};
  const sources:AccountHistorySource[]=[{sourceId:'A',rows:[a]},{sourceId:'B',rows:[b]}];
  const prepared=copy(prepareAccountHistory(sources,options)),before=copy(prepared);
  const verifiedDuplicates=[{sourceId:'A',evidenceId:'one',digest:'a'.repeat(64)},{sourceId:'B',evidenceId:'two',digest:'a'.repeat(64)}];
  const split=await mergePreparedAccountHistory(prepared,{verifiedDuplicates});
  expect(view(split)).toEqual(view(await mergeAccountHistory(sources,{...options,verifiedDuplicates})));
  expect(prepared).toEqual(before);expect(sources[0].rows[0].value.platform_duplicate_family_id).toBeNull();
  expect(view(await mergePreparedAccountHistory(prepared,{verifiedDuplicates}))).toEqual(view(split));
});

it('rejects malformed checkpoints and missing or aliased typed mappings without allocating replacements',async()=>{
  const valid=prepareAccountHistory(await fixture(),options);
  const mutations:((prepared:PreparedAccountHistory)=>unknown)[]=[
    prepared=>({...prepared,extra:true}),
    prepared=>({...prepared,sources:[]}),
    prepared=>({...prepared,mappings:prepared.mappings.filter(item=>item.kind!=='evidence')}),
    prepared=>({...prepared,mappings:prepared.mappings.filter(item=>item.kind!=='journey')}),
    prepared=>({...prepared,mappings:[...prepared.mappings,prepared.mappings[0]]}),
    prepared=>({...prepared,mappings:prepared.mappings.map((item,index)=>index===1?{...item,accountId:prepared.mappings[0].accountId}:item)}),
    prepared=>{const value=copy(prepared);value.original[0].rows.find(item=>item.kind==='replay')!.value.committed_overrides_json='{"direction":"oldest-first"}';return value;},
    prepared=>{const value=copy(prepared);value.sources[0].rows.find(item=>item.kind==='replay')!.value.committed_overrides_json='{"preparedArtifact":"PRIVATE_SENTINEL"}';return value;},
  ];
  for(const mutate of mutations)await expect(mergePreparedAccountHistory(mutate(copy(valid)) as PreparedAccountHistory)).rejects.toMatchObject({code:'HISTORY_SCHEMA'});
});

it('stores a repeated long Replay journey identity once in typed tuples and keeps every choice',async()=>{
  const legacy='legacy-structural-'.repeat(200);
  const replay=row('replay',{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:JSON.stringify({keptMemoryRefs:[JSON.stringify([legacy,'one'])],orderedMemoryRefs:[JSON.stringify([legacy,'one'])],autoGroupJourneyIds:[legacy]})});
  const mappings=new Map<string,string>();
  const allocation={mapIdentity:(source:string,kind:string,id:string)=>{const key=JSON.stringify([source,kind,id]);if(!mappings.has(key))mappings.set(key,`opaque-${mappings.size}`);return mappings.get(key)!;}};
  const sources=[{sourceId:'A',rows:[evidence('one'),replay]}];
  const prepared=copy(prepareAccountHistory(sources,allocation));
  expect(prepared.mappings.filter(item=>item.kind==='journey'&&item.localId===legacy)).toHaveLength(1);
  expect(JSON.stringify(prepared).split(legacy)).toHaveLength(2);
  const result=await mergePreparedAccountHistory(prepared);
  expect(result.review).toContainEqual({reason:'replay-group-needs-review',sourceId:'A'});
  const retained=JSON.parse(String(result.pendingReplay[0].value.committed_overrides_json));
  expect(retained.keptMemoryRefs).toEqual(retained.orderedMemoryRefs);
  expect(retained.autoGroupJourneyIds).toEqual([prepared.mappings.find(item=>item.kind==='journey')!.accountId]);
});

it('requires every manual, command, privacy, overlay and nested correction identity tuple',async()=>{
  const manual=row('manual',{manual_id:'manual',command_key:'manual-command',owner_label:'Synthetic manual',owner_context:'Synthetic context',date_kind:'exact',date_start:'2020-01-01',date_end:'2020-01-02',latitude:10,longitude:100});
  const privacy=row('privacy',{revision:1,policy_id:'hide',command_key:'privacy-command',action:'hide',target_kind:'manual',manual_id:'manual',reviewed_evidence_json:'[]',reviewed_family_json:'[]',reviewed_label:'Synthetic manual'});
  const overlay=row('overlay',{overlay_id:'overlay',target_kind:'evidence',target_id:'one',correction_scope:'label',owner_action:'apply',owner_value:'Synthetic label',identity_lineage_id:'lineage',replaces_overlay_id:'old-overlay',revision:1});
  const home=row('home',{area_id:'home',origin:'observed-area',latitude:10,longitude:100,radius_meters:1000});
  const correction=row('journey-correction',{revision_id:'removed-correction',action:'confirm',journey_id:'old-journey',reviewed_support_json:'["F:removed-family"]',reviewed_visits_json:'[["F:removed-family"]]',reviewed_family_snapshot_json:JSON.stringify({'F:removed-family':{memberIds:['removed-evidence'],tupleVersion:1,tupleFingerprint:'synthetic-family'}}),reviewed_snapshot_json:'{}',state:'superseded',command_key:'correction-command',replaces_revision_id:'older-correction',owner_place_id:'place'});
  const sources:AccountHistorySource[]=[{sourceId:'A',rows:[evidence('one'),manual,privacy,overlay,home]},{sourceId:'removed',retainedOwnerFacts:true,rows:[correction]}];
  const prepared=copy(prepareAccountHistory(sources,options)),before=copy(prepared);
  expect((await mergePreparedAccountHistory(prepared)).privacy.hiddenManualIds).toEqual(['A/manual/manual']);
  for(let index=0;index<prepared.mappings.length;index++){
    const missing={...prepared,mappings:prepared.mappings.filter((_,position)=>position!==index)};
    await expect(mergePreparedAccountHistory(missing)).rejects.toMatchObject({code:'HISTORY_SCHEMA'});
  }
  const manualOnly=prepareAccountHistory([{sourceId:'A',rows:[manual]}],options);
  await expect(mergePreparedAccountHistory({...manualOnly,mappings:[]})).rejects.toMatchObject({code:'HISTORY_SCHEMA'});
  expect(prepared).toEqual(before);
});

it('rejects changed normalized identities or facts even when individual rows remain schema-valid',async()=>{
  const valid=prepareAccountHistory(await fixture(),options);
  const mutations:((prepared:PreparedAccountHistory)=>void)[]=[
    prepared=>{prepared.sources[0].rows.find(item=>item.kind==='journey-correction')!.value.owner_place_name='Changed fact';},
    prepared=>{prepared.sources[0].rows.find(item=>item.kind==='evidence')!.value.source_ref='Changed provenance';},
    prepared=>{prepared.sources[0].rows.find(item=>item.kind==='privacy')!.value.reviewed_evidence_json='[]';},
    prepared=>{prepared.sources[0].rows.find(item=>item.kind==='journey-correction')!.value.command_key='Missing command mapping';},
  ];
  for(const mutate of mutations){const prepared=copy(valid);mutate(prepared);await expect(mergePreparedAccountHistory(prepared)).rejects.toMatchObject({code:'HISTORY_SCHEMA'});}
});
