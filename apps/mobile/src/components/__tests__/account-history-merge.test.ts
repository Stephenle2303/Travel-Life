import { collectAccountIdentityKeys, mergeAccountHistory, HistoryMergeError, translateLegacyOwnerChanges } from '@/account/history-merge';
import { applyOwnerChanges, ownerChanges } from '@/account/correction-journal';
import { historyLayouts, type HistoryRow } from '@/account/history-contract';
import { projectCanonicalHistory } from '@/reconstruction/canonical-projection';
import type { EvidenceRow, JourneyCorrectionRevision } from '@/reconstruction/canonical-core';

function row(kind:string, value:Record<string,string|number|null>):HistoryRow {
  const fields=Object.fromEntries(Object.entries(historyLayouts[kind].fields).map(([key,type])=>[key,type.endsWith('?')?null:type==='number'?0:'']));
  const full={...fields,...value}; return {kind,key:String(full[historyLayouts[kind].key]),value:full};
}
const evidence=(id:string,day='2024-01-01',extra:Record<string,string|number|null>={})=>row('evidence',{evidence_id:id,source_ref:id,media_type:'image',availability:'available',has_precise_offset:1,captured_at_millis:Date.parse(`${day}T12:00:00Z`),captured_day:day,latitude:13.7,longitude:100.5,reported_accuracy_meters:10,...extra});
const mapIdentity=(source:string,kind:string,id:string)=>`${source}/${kind}/${id}`;
const options={mapIdentity};

describe('verified legacy owner translation',()=>{
 const manual=(label:string)=>row('manual',{manual_id:'manual',command_key:'cmd',owner_label:label,owner_context:'Synthetic place',date_kind:'exact',date_start:'2024-01-01',date_end:'2024-01-02',latitude:0,longitude:0});
 it('retains review when deleting a manual trip would dangle unchanged canonical Replay',async()=>{
  const baseline=[manual('Before')];const canonical=await mergeAccountHistory([{sourceId:'A',rows:baseline}],options);
  const replay=row('replay',{record_id:1,revision:1,committed_overrides_json:JSON.stringify({autoGroupJourneyIds:['manual:A/manual/manual']})});
  await expect(translateLegacyOwnerChanges({sourceId:'A',baseline,changes:ownerChanges(baseline,[]),canonicalRows:[...canonical.rows,replay],mapIdentity})).rejects.toMatchObject({code:'HISTORY_REVIEW'});
 });
 it('scans admitted large privacy history without spreading it into engine arguments',async()=>{
  const baseline=[manual('Before')];const privacy=Array.from({length:140000},(_,index)=>row('privacy',{revision:index+1,policy_id:'existing',command_key:`privacy-${index}`,action:'hide',target_kind:'manual',manual_id:'A/manual/manual',reviewed_evidence_json:'[]',reviewed_family_json:'[]',reviewed_label:'Synthetic'}));
  const changes=await translateLegacyOwnerChanges({sourceId:'A',baseline,changes:ownerChanges(baseline,[manual('After')]),canonicalRows:[{...manual('Before'),key:'A/manual/manual',value:{...manual('Before').value,manual_id:'A/manual/manual'}},...privacy],mapIdentity});
  expect(changes.rows[0].value.owner_label).toBe('After');
 });
 it('uses typed owner IDs, preserves prose and independent facts, and journals removals',async()=>{
  const baseline=[manual('Before')],current=[manual('After')];
  const canonical=await mergeAccountHistory([{sourceId:'A',rows:baseline},{sourceId:'B',rows:[manual('Independent')]}],options);
  const changes=await translateLegacyOwnerChanges({sourceId:'A',baseline,changes:ownerChanges(baseline,current),canonicalRows:canonical.rows,mapIdentity});
  expect(changes.rows[0].key).toBe('A/manual/manual');expect(changes.rows[0].value.owner_label).toBe('After');
  const rebuilt=await mergeAccountHistory([{sourceId:'A',rows:baseline},{sourceId:'B',rows:[manual('Independent')]}],{...options,accountOwnerChanges:changes});
  expect(rebuilt.rows.filter(row=>row.kind==='manual').map(row=>row.value.owner_label)).toEqual(['After','Independent']);
  const removed=await translateLegacyOwnerChanges({sourceId:'A',baseline,changes:ownerChanges(baseline,[]),canonicalRows:canonical.rows,mapIdentity});
  expect(removed.deleted).toEqual([{kind:'manual',key:'A/manual/manual'}]);
 });
 it('reserves privacy identities above normalized source bounds and preserves action order through later source growth',async()=>{
  const privacy=(revision:number,action:string,policy='policy')=>row('privacy',{revision,policy_id:policy,command_key:`privacy-${revision}`,action,target_kind:'manual',manual_id:'manual',reviewed_evidence_json:'[]',reviewed_family_json:'[]',reviewed_label:'Synthetic'});
  const baseline=[manual('Before')],edited=[...baseline,privacy(1,'hide'),privacy(2,'restore'),privacy(3,'hide')];
  const canonical=await mergeAccountHistory([{sourceId:'A',rows:baseline},{sourceId:'B',rows:[manual('Independent'),privacy(1,'hide','independent')]}],options);
  const changes=await translateLegacyOwnerChanges({sourceId:'A',baseline,changes:ownerChanges(baseline,edited),canonicalRows:canonical.rows,mapIdentity});
  expect(changes.rows.map(row=>row.value.revision)).toEqual([1000000001,1000000002,1000000003]);
  const rebuilt=await mergeAccountHistory([{sourceId:'A',rows:baseline},{sourceId:'B',rows:[manual('Independent'),privacy(1,'hide','independent'),privacy(2,'restore','independent'),privacy(3,'hide','independent')]}],{...options,accountOwnerChanges:changes});
  expect(rebuilt.rows.filter(row=>row.kind==='privacy')).toHaveLength(6);expect(rebuilt.privacy.hiddenManualIds).toEqual(['A/manual/manual','B/manual/manual']);
 });
 it('remaps exact Replay manual groups and soundtrack against canonical account context',async()=>{
  const replay=row('replay',{record_id:1,revision:1,committed_overrides_json:JSON.stringify({keptMemoryRefs:[],orderedMemoryRefs:[],excludedGroupJourneyIds:[],autoGroupJourneyIds:['manual:manual'],soundtrack:{kind:'bundled',revision:'happy-moments-1.4'}})});
  const baseline=[manual('Before')],edited=[...baseline,replay];const canonical=await mergeAccountHistory([{sourceId:'A',rows:baseline}],options);
  const changes=await translateLegacyOwnerChanges({sourceId:'A',baseline,changes:ownerChanges(baseline,edited),canonicalRows:canonical.rows,mapIdentity});
  expect(JSON.parse(String(changes.rows[0].value.committed_overrides_json))).toMatchObject({autoGroupJourneyIds:['manual:A/manual/manual'],soundtrack:{kind:'bundled',revision:'happy-moments-1.4'}});
  expect(applyOwnerChanges(canonical.rows,changes).some(row=>row.kind==='replay')).toBe(true);
 });
 it('proves Replay group mapping after a verified duplicate changes the canonical representative',async()=>{
  const baseline=[evidence('one'),evidence('two','2024-01-02')];
  const local=await projectCanonicalHistory({rows:baseline.map(row=>row.value as unknown as EvidenceRow),excluded:new Set(),privateFilter:{excluded:new Set()},configuredHomeAreas:[],storedCorrections:[],storedMemoryCorrections:[]});
  const journey=local.graph.journeys[0].id;
  const replay=row('replay',{record_id:1,revision:1,committed_overrides_json:JSON.stringify({orderedMemoryRefs:[JSON.stringify([journey,'one'])],keptMemoryRefs:[JSON.stringify([journey,'one'])],autoGroupJourneyIds:[journey]})});
  const canonical=await mergeAccountHistory([{sourceId:'Z',rows:baseline},{sourceId:'A',rows:[evidence('copy-one'),evidence('copy-two','2024-01-02')]}],{...options,verifiedDuplicates:[{sourceId:'Z',evidenceId:'one',digest:'a'.repeat(64)},{sourceId:'A',evidenceId:'copy-one',digest:'a'.repeat(64)},{sourceId:'Z',evidenceId:'two',digest:'b'.repeat(64)},{sourceId:'A',evidenceId:'copy-two',digest:'b'.repeat(64)}]});
  const changes=await translateLegacyOwnerChanges({sourceId:'Z',baseline,changes:ownerChanges(baseline,[...baseline,replay]),canonicalRows:canonical.rows,mapIdentity});
  expect(JSON.parse(String(changes.rows[0].value.committed_overrides_json)).autoGroupJourneyIds).toEqual([canonical.projection.graph.journeys[0].id]);
 });
});

describe('canonical multi-source history domain',()=>{
  it('clears intermediate correction review only when the final canonical graph uniquely maps that revision',async()=>{
    const rows=Array.from({length:90},(_,index)=>{
      const timestamp=Date.UTC(2020,0,1)+index*3_600_000;
      return evidence(`pending-${String(index).padStart(3,'0')}`,new Date(timestamp).toISOString().slice(0,10),{source_origin:'capture-like',captured_at_millis:timestamp,has_precise_offset:index%3?1:0,latitude:index%2?null:10+(index%20)*.2,longitude:index%2?null:100+(index%20)*.2});
    });
    const input={rows:rows.map(item=>item.value as unknown as EvidenceRow),excluded:new Set<string>(),privateFilter:{excluded:new Set<string>()},configuredHomeAreas:[],storedCorrections:[],storedMemoryCorrections:[]};
    const first=await projectCanonicalHistory(input);
    const visits=new Map(first.graph.visits.map(visit=>[visit.id,visit]));
    const groups=first.graph.journeys[0].visitIds.map(id=>visits.get(id)!.evidenceIds.map(id=>`E:${id}`).sort());
    const correction=row('journey-correction',{revision_id:'final-place',action:'place',journey_id:first.graph.journeys[0].id,reviewed_support_json:JSON.stringify(groups.flat().sort()),reviewed_visits_json:JSON.stringify(groups),reviewed_family_snapshot_json:'{}',state:'effective',command_key:'final-command',reviewed_snapshot_json:'{}'});
    const result=await projectCanonicalHistory({...input,storedCorrections:[correction.value as unknown as JourneyCorrectionRevision]});
    expect(result.finalMatches.has('final-place')).toBe(true);
    expect(result.pendingFinalRemaps).toEqual([]);
    const merged=await mergeAccountHistory([{sourceId:'A',rows:[...rows,correction]}],options);
    expect(merged.review).toEqual([]);
    expect(merged.rows.find(item=>item.kind==='journey-correction')!.value.state).toBe('effective');
    const legacyRows=rows.map(item=>({...item,value:{...item.value,source_origin:null}}));
    const legacy=await mergeAccountHistory([{sourceId:'A',rows:[...legacyRows,correction]}],options);
    expect(legacy.review).toEqual([]);
    expect(legacy.rows.filter(item=>item.kind==='evidence').every(item=>item.value.source_origin===null)).toBe(true);
    const missing={...correction.value,revision_id:'missing-review',reviewed_support_json:'["E:missing"]',reviewed_visits_json:'[["E:missing"]]'};
    const unresolved=await projectCanonicalHistory({...input,storedCorrections:[missing as unknown as JourneyCorrectionRevision]});
    expect(unresolved.finalMatches.size).toBe(0);
    expect(unresolved.pendingFinalRemaps.map(item=>item.revision_id)).toEqual(['missing-review']);
    const unavailable=evidence('unavailable-review','2020-01-01',{availability:'unavailable',source_origin:'capture-like'});
    const pending=row('journey-correction',{...correction.value,revision_id:'unavailable-review',reviewed_support_json:'["E:unavailable-review"]',reviewed_visits_json:'[["E:unavailable-review"]]'});
    const mixed=await projectCanonicalHistory({...input,rows:[...input.rows,unavailable.value as unknown as EvidenceRow],storedCorrections:[correction.value,pending.value] as unknown as JourneyCorrectionRevision[]});
    expect(mixed.finalMatches.has('final-place')).toBe(true);
    expect(mixed.pendingFinalRemaps.map(item=>item.revision_id)).toEqual(['unavailable-review']);
    const mixedMerge=await mergeAccountHistory([{sourceId:'A',rows:[...rows,unavailable,correction,pending]}],options);
    expect(mixedMerge.review).toEqual([{reason:'correction-needs-review',revisionId:'A/journey-correction/unavailable-review'}]);
  });
  it('retains independent owner facts after source removal without recreating evidence',async()=>{
    const manual=row('manual',{manual_id:'manual',command_key:'cmd',owner_label:'Owner trip',owner_context:'Owner place',latitude:10,longitude:20,date_kind:'exact',date_start:'2020-01-01',date_end:'2020-01-01'});
    const home=row('home',{area_id:'home',origin:'observed-area',owner_label:'Owner home',latitude:1,longitude:2,radius_meters:5000});
    const privacy=row('privacy',{revision:1,policy_id:'policy',command_key:'hide-manual',action:'hide',target_kind:'manual',manual_id:'manual',reviewed_evidence_json:'[]',reviewed_family_json:'[]',reviewed_label:'Owner trip'});
    const result=await mergeAccountHistory([{sourceId:'A',retainedOwnerFacts:true,rows:[manual,home,privacy]},{sourceId:'B',rows:[evidence('survives')]}],options);
    expect(result.review).toEqual([]);expect(result.rows.filter(row=>row.kind==='evidence')).toHaveLength(1);
    expect(result.rows.find(row=>row.kind==='manual')?.value.owner_label).toBe('Owner trip');
    expect(result.privacy.hiddenManualIds).toEqual(['A/manual/manual']);
    expect(result.sourceCopies.map(copy=>copy.sourceId)).toEqual(['B']);
  });
  it('preserves removed-source correction and privacy scopes as proposals and gates activation',async()=>{
    const correction=row('journey-correction',{revision_id:'rev',action:'confirm',journey_id:'old',reviewed_support_json:'["E:removed"]',reviewed_visits_json:'[["E:removed"]]',reviewed_family_snapshot_json:'{}',reviewed_snapshot_json:'{"title":"PRIVATE_OWNER_FACT"}',state:'effective'});
    const privacy=row('privacy',{revision:1,policy_id:'policy',command_key:'hide',action:'hide',target_kind:'inferred',reviewed_evidence_json:'["removed"]',reviewed_family_json:'["E:removed"]',reviewed_label:'PRIVATE_OWNER_FACT'});
    const sources=[{sourceId:'A',retainedOwnerFacts:true,rows:[correction,privacy]},{sourceId:'B',rows:[evidence('survives')]}];
    const allocated=collectAccountIdentityKeys(sources);
    expect(allocated).toContainEqual({sourceId:'A',kind:'evidence',localId:'removed'});
    const result=await mergeAccountHistory(sources,options);
    expect(result.review).toContainEqual({reason:'correction-needs-review',sourceId:'A'});
    expect(result.rows.find(row=>row.kind==='journey-correction')?.value.state).toBe('pending_remap');
    expect(result.rows.find(row=>row.kind==='journey-correction')?.value.reviewed_snapshot_json).toContain('PRIVATE_OWNER_FACT');
    expect(result.privacy.hiddenEvidenceIds).toEqual(['A/evidence/removed']);
    expect(result.projection.evidence).toHaveLength(1);
    expect(JSON.stringify(result.review)).not.toContain('PRIVATE_OWNER_FACT');
    await expect(mergeAccountHistory([{sourceId:'A',retainedOwnerFacts:true,rows:[evidence('removed')]}],options)).rejects.toMatchObject({code:'HISTORY_SCHEMA'});
    await expect(mergeAccountHistory([{sourceId:'A',rows:[correction,privacy]}],options)).rejects.toMatchObject({code:'HISTORY_SCHEMA'});
  });
  it('isolates colliding IDs and is deterministic across input/source order',async()=>{
    const a={sourceId:'A',rows:[evidence('same')]}; const b={sourceId:'B',rows:[evidence('same','2024-01-02')]};
    const first=await mergeAccountHistory([a,b],options),second=await mergeAccountHistory([b,a],options);
    expect(first.rows).toEqual(second.rows); expect(first.projection.graph).toEqual(second.projection.graph);
    expect(first.sourceCopies.map(x=>x.evidenceId)).toEqual(['A/evidence/same','B/evidence/same']);
    expect(first.projection.evidence).toHaveLength(2);
  });
  it('requires verified bytes to combine copied support and retains every source copy',async()=>{
    const sources=[{sourceId:'A',rows:[evidence('one')]},{sourceId:'B',rows:[evidence('two')]}];
    const unproven=await mergeAccountHistory(sources,options);
    expect(new Set(unproven.projection.evidence.map(x=>x.duplicateFamilyId))).toEqual(new Set([null]));
    const merged=await mergeAccountHistory(sources,{...options,verifiedDuplicates:[{sourceId:'A',evidenceId:'one',digest:'a'.repeat(64)},{sourceId:'B',evidenceId:'two',digest:'a'.repeat(64)}]});
    expect(merged.sourceCopies).toHaveLength(2);
    expect(new Set(merged.projection.evidence.map(x=>x.duplicateFamilyId)).size).toBe(1);
    expect(merged.projection.graph.visits.flatMap(x=>x.evidenceIds)).toHaveLength(1);
  });
  it('keeps support from an available verified copy and abstains on conflicting copy metadata',async()=>{
    const duplicates=[{sourceId:'A',evidenceId:'one',digest:'b'.repeat(64)},{sourceId:'B',evidenceId:'two',digest:'b'.repeat(64)}];
    const merged=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one',undefined,{availability:'unavailable'})]},{sourceId:'B',rows:[evidence('two')]}],{...options,verifiedDuplicates:duplicates});
    expect(merged.projection.graph.visits).toHaveLength(1); expect(merged.sourceCopies[0].availability).toBe('unavailable');
    const conflict=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one')]},{sourceId:'B',rows:[evidence('two',undefined,{longitude:120})]}],{...options,verifiedDuplicates:duplicates});
    expect(conflict.projection.graph.visits).toHaveLength(0); expect(conflict.review).toEqual(expect.arrayContaining([expect.objectContaining({reason:'duplicate-metadata-conflict'})]));
  });
  it('remaps nested reviewed identity fields while preserving owner prose and local soundtrack identity',async()=>{
    const correction=row('journey-correction',{revision_id:'rev',action:'confirm',journey_id:'old',reviewed_support_json:'["E:one"]',reviewed_visits_json:'[["E:one"]]',reviewed_family_snapshot_json:'{}',reviewed_snapshot_json:'{"title":"E:one PRIVATE_PROSE"}',state:'effective',command_key:'cmd'});
    const privacy=row('privacy',{revision:1,policy_id:'policy',command_key:'privacy-cmd',action:'hide',target_kind:'inferred',reviewed_evidence_json:'["one"]',reviewed_family_json:'["E:one"]',reviewed_label:'E:one PRIVATE_PROSE'});
    const merged=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one'),correction,privacy]}],options);
    const normalized=merged.rows.find(x=>x.kind==='journey-correction')!;
    expect(normalized.value.reviewed_support_json).toBe('["E:A/evidence/one"]');
    expect(normalized.value.reviewed_visits_json).toBe('[["E:A/evidence/one"]]');
    expect(normalized.value.reviewed_snapshot_json).toContain('E:one PRIVATE_PROSE');
    expect(merged.rows.find(x=>x.kind==='privacy')!.value.reviewed_family_json).toBe('["E:A/evidence/one"]');
    expect(merged.privacy.hiddenEvidenceIds).toEqual(['A/evidence/one']);
  });
  it('remaps platform family snapshots, manual/home and structural boundaries without changing values',async()=>{
    const correction=row('journey-correction',{revision_id:'rev',action:'confirm',journey_id:'old',reviewed_support_json:'["F:family"]',reviewed_visits_json:'[["F:family"]]',reviewed_family_snapshot_json:JSON.stringify({'F:family':{memberIds:['one'],tupleVersion:1,tupleFingerprint:'tuple'}}),reviewed_snapshot_json:'{}',state:'effective',structural_boundary_json:'["F:family"]'});
    const manual=row('manual',{manual_id:'manual',command_key:'cmd',owner_label:'manual',owner_context:'A',latitude:10,longitude:20,date_kind:'exact',date_start:'2020-01-01',date_end:'2020-01-01'});
    const home=row('home',{area_id:'home',origin:'observed-area',owner_label:'home',latitude:1,longitude:2,radius_meters:5000});
    const merged=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one',undefined,{platform_duplicate_family_id:'family',duplicate_tuple_version:1,duplicate_tuple_fingerprint:'tuple'}),correction,manual,home]}],options);
    const normalized=merged.rows.find(x=>x.kind==='journey-correction')!;
    expect(JSON.parse(String(normalized.value.reviewed_family_snapshot_json))).toEqual({'F:A/family/family':{memberIds:['A/evidence/one'],tupleVersion:1,tupleFingerprint:'tuple'}});
    expect(normalized.value.structural_boundary_json).toBe('["F:A/family/family"]');
    expect(merged.rows.find(x=>x.kind==='manual')!.key).toBe('A/manual/manual');
    expect(merged.rows.find(x=>x.kind==='home')!.value.owner_label).toBe('home');
  });
  it('returns fixed review errors for missing identity and unsupported history overlays',async()=>{
    const privacy=row('privacy',{revision:1,policy_id:'policy',command_key:'cmd',action:'hide',target_kind:'inferred',reviewed_evidence_json:'["PRIVATE_MISSING"]',reviewed_family_json:'[]',reviewed_label:'PRIVATE_PROSE'});
    await expect(mergeAccountHistory([{sourceId:'A',rows:[privacy]}],options)).rejects.toMatchObject({code:'HISTORY_SCHEMA',message:'Private history needs compatible identities.'});
    const overlay=row('overlay',{overlay_id:'overlay',target_kind:'history',target_id:'PRIVATE_TARGET',correction_scope:'label',owner_action:'apply',owner_value:'PRIVATE_PROSE',created_at_millis:1,revision:1});
    await expect(mergeAccountHistory([{sourceId:'A',rows:[overlay]}],options)).rejects.toBeInstanceOf(HistoryMergeError);
    await expect(mergeAccountHistory([{sourceId:'A',rows:[overlay]}],options)).rejects.toMatchObject({code:'HISTORY_REVIEW'});
  });
  it('preserves first accepted Replay selection and reports unmappable groups rather than dropping them',async()=>{
    const replay=row('replay',{record_id:1,revision:1,updated_at_millis:1,committed_overrides_json:JSON.stringify({keptMemoryRefs:['["missing","one"]'],orderedMemoryRefs:['["missing","one"]'],excludedGroupJourneyIds:['missing'],soundtrack:{kind:'custom',revision:'score',localUri:''}})});
    const merged=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one'),replay]}],options);
    expect(merged.review).toEqual(expect.arrayContaining([expect.objectContaining({reason:'replay-group-needs-review'})]));
    expect(merged.replay).toBeNull(); expect(merged.pendingReplay).toHaveLength(1);
    expect(JSON.stringify(merged.pendingReplay)).not.toContain('file:///PRIVATE');
    expect(JSON.stringify(merged.pendingReplay)).not.toContain('fileKey');
  });
  it('collects every required key before merge and remaps valid committed Replay references in exact order',async()=>{
    const localRows=[evidence('one'),evidence('two','2024-01-02')];
    const projected=await projectCanonicalHistory({rows:localRows.map(row=>row.value as unknown as EvidenceRow),excluded:new Set(),privateFilter:{excluded:new Set()},configuredHomeAreas:[],storedCorrections:[],storedMemoryCorrections:[]});
    const journey=projected.graph.journeys[0].id;
    const replay=row('replay',{record_id:1,revision:7,updated_at_millis:1,committed_overrides_json:JSON.stringify({keptMemoryRefs:[JSON.stringify([journey,'two']),JSON.stringify([journey,'one'])],orderedMemoryRefs:[JSON.stringify([journey,'two']),JSON.stringify([journey,'one'])],excludedGroupJourneyIds:[],autoGroupJourneyIds:[journey],direction:'newest-first',soundtrack:{kind:'custom',revision:'soundtrack-7',localUri:''}})});
    const sources=[{sourceId:'A',rows:[...localRows,replay]},{sourceId:'B',rows:[evidence('three')]}];
    const allocated=collectAccountIdentityKeys(sources); const keys=new Set(allocated.map(item=>JSON.stringify(item)));
    const result=await mergeAccountHistory(sources,{mapIdentity(sourceId,kind,localId){expect(keys.has(JSON.stringify({sourceId,kind,localId}))).toBe(true);return mapIdentity(sourceId,kind,localId);},preferredReplaySourceId:'A'});
    expect(result.review).toEqual([]); expect(result.replay).not.toBeNull();
    const composition=JSON.parse(String(result.replay!.value.committed_overrides_json));
    expect(composition.orderedMemoryRefs.map((ref:string)=>JSON.parse(ref)[1])).toEqual(['A/evidence/two','A/evidence/one']);
    expect(composition.soundtrack).toEqual({kind:'custom',revision:'soundtrack-7',localUri:''});
    expect(composition.direction).toBe('newest-first');
  });
  it('keeps mixed-GPS memberships canonical and reconciles exact legacy Replay groups without dropping choices',async()=>{
    const localRows=Array.from({length:90},(_,index)=>{
      const timestamp=Date.UTC(2020,0,1)+index*3_600_000;
      const item=evidence(`mixed-${index}`,new Date(timestamp).toISOString().slice(0,10));
      return {...item,value:{...item.value,source_origin:'capture-like',captured_at_millis:timestamp,has_precise_offset:index%3?1:0,
        latitude:index%2?null:10+(index%20)*.2,longitude:index%2?null:100+(index%20)*.2}};
    });
    const projected=await projectCanonicalHistory({rows:localRows.map(item=>item.value as unknown as EvidenceRow),excluded:new Set(),privateFilter:{excluded:new Set()},configuredHomeAreas:[],storedCorrections:[],storedMemoryCorrections:[]});
    const groups=new Set(projected.graph.journeys.map(item=>item.id));
    expect(projected.graph.memberships.every(item=>groups.has(item.journeyId))).toBe(true);
    const legacy=[...projected.legacyJourneyMappings].find(([before,after])=>before!==after)!;
    expect(legacy).toBeDefined();
    const selected=projected.graph.memberships.filter(item=>Number(item.evidenceId.slice(6))%2===1).slice(0,8);
    expect(selected).toHaveLength(8);
    const refs=selected.map(item=>JSON.stringify([legacy[0],item.evidenceId]));
    const replay=row('replay',{record_id:1,revision:3,updated_at_millis:1,committed_overrides_json:JSON.stringify({keptMemoryRefs:refs,orderedMemoryRefs:[...refs].reverse(),autoGroupJourneyIds:[legacy[0]],direction:'newest-first'})});
    const result=await mergeAccountHistory([{sourceId:'A',rows:[...localRows,replay]}],options);
    expect(result.review).toEqual([]);expect(result.replay).not.toBeNull();
    const composition=JSON.parse(String(result.replay!.value.committed_overrides_json));
    expect(composition.keptMemoryRefs.map((ref:string)=>JSON.parse(ref)[1])).toEqual(selected.map(item=>`A/evidence/${item.evidenceId}`));
    expect(composition.orderedMemoryRefs).toEqual([...composition.keptMemoryRefs].reverse());
    expect(composition.keptMemoryRefs.every((ref:string)=>result.projection.graph.journeys.some(item=>item.id===JSON.parse(ref)[0]))).toBe(true);
  });
  it('expands restrictions across proven copies, preserves unknown origin and orders each privacy policy monotonically',async()=>{
    const policy=(revision:number,action:string)=>row('privacy',{revision,policy_id:'policy',command_key:`command-${revision}`,action,target_kind:'inferred',reviewed_evidence_json:'["one"]',reviewed_family_json:'[]',reviewed_label:'Private'});
    const sources=[{sourceId:'A',rows:[evidence('one',undefined,{source_origin:'unknown'}),policy(2,'restore'),policy(1,'hide')]},{sourceId:'B',rows:[evidence('two')]}];
    const optionsWithBytes={...options,verifiedDuplicates:[{sourceId:'A',evidenceId:'one',digest:'c'.repeat(64)},{sourceId:'B',evidenceId:'two',digest:'c'.repeat(64)}]};
    const restored=await mergeAccountHistory(sources,optionsWithBytes);
    expect(restored.privacy.hiddenEvidenceIds).toEqual([]);
    expect(restored.rows.find(row=>row.kind==='evidence')!.value.source_origin).toBe('unknown');
    const hidden=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one'),policy(1,'hide')]},sources[1]],optionsWithBytes);
    expect(hidden.privacy.hiddenEvidenceIds).toEqual(['A/evidence/one','B/evidence/two']);
  });
  it('returns only fixed failure fields when deep correction scopes contain private malformed data',async()=>{
    const correction=row('journey-correction',{revision_id:'rev',action:'split',journey_id:'old',reviewed_support_json:'["E:one"]',reviewed_visits_json:'[["E:one"]]',reviewed_family_snapshot_json:'{}',reviewed_snapshot_json:'{"title":"PRIVATE_SENTINEL"}',structural_boundary_json:'{"PRIVATE_SENTINEL":[]}',state:'effective'});
    const error=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one'),correction]}],options).catch(error=>error);
    expect(error).toMatchObject({name:'HistoryMergeError',code:'HISTORY_SCHEMA'});
    expect(JSON.stringify(error)).not.toContain('PRIVATE_SENTINEL'); expect(error.message).not.toContain('PRIVATE_SENTINEL');
  });
  it('retains reviewable confirm ambiguity but rejects an unsafe structural boundary',async()=>{
    const correction=(action:string)=>row('journey-correction',{revision_id:'review',action,journey_id:'old',reviewed_support_json:'["E:one","E:two"]',reviewed_visits_json:'[["E:one"],["E:two"]]',reviewed_family_snapshot_json:'{}',reviewed_snapshot_json:'{}',structural_boundary_json:action==='split'?'["E:one","E:two"]':null,state:'effective'});
    const source={sourceId:'A',rows:[evidence('one'),evidence('two','2024-01-15'),correction('confirm')]};
    const pending=await mergeAccountHistory([source],options);
    expect(pending.review).toEqual(expect.arrayContaining([expect.objectContaining({reason:'correction-needs-review'})]));
    await expect(mergeAccountHistory([{sourceId:'A',rows:[...source.rows.slice(0,2),correction('split')]}],options)).rejects.toMatchObject({code:'HISTORY_REVIEW'});
  });
  it('rejects colliding allocator IDs and contradictory byte verification instead of merging unrelated data',async()=>{
    const sources=[{sourceId:'A',rows:[evidence('one')]},{sourceId:'B',rows:[evidence('two')]}];
    await expect(mergeAccountHistory(sources,{mapIdentity:()=> 'same'})).rejects.toMatchObject({code:'HISTORY_SCHEMA'});
    await expect(mergeAccountHistory(sources,{...options,verifiedDuplicates:[{sourceId:'A',evidenceId:'one',digest:'a'.repeat(64)},{sourceId:'A',evidenceId:'one',digest:'b'.repeat(64)}]})).rejects.toMatchObject({code:'HISTORY_SCHEMA'});
  });
  it('does not replace the first accepted Replay when another source contributes a composition',async()=>{
    const composition=(revision:number)=>row('replay',{record_id:1,revision,updated_at_millis:revision,committed_overrides_json:JSON.stringify({excludedGroupJourneyIds:[],autoGroupJourneyIds:[],direction:revision===1?'newest-first':'oldest-first',soundtrack:{kind:'bundled',revision:'happy-moments-1.4'}})});
    const merged=await mergeAccountHistory([{sourceId:'A',rows:[evidence('one'),composition(2)]},{sourceId:'B',rows:[evidence('two'),composition(1)]}],{...options,preferredReplaySourceId:'B'});
    expect(JSON.parse(String(merged.replay!.value.committed_overrides_json)).direction).toBe('newest-first');
    expect(merged.pendingReplay).toHaveLength(1); expect(merged.pendingReplay[0].value.revision).toBe(2);
  });
});
