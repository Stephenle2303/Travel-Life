/** Explicit opt-in wire DTO; local-only SourceCandidate never crosses the network. */
export const HISTORY_CONTRACT = 'travel-life-history-v1' as const;
type Field = 'text' | 'number' | 'text?' | 'number?';
type Layout = { table: string; key: string; fields: Record<string,Field> };
const textFields = (required: string, nullable = ''): Record<string,Field> => Object.fromEntries([
  ...required.split(' ').filter(Boolean).map(key=>[key,'text' as const]),
  ...nullable.split(' ').filter(Boolean).map(key=>[key,'text?' as const]),
]);
const numbers = (required: string, nullable = ''): Record<string,Field> => Object.fromEntries([
  ...required.split(' ').filter(Boolean).map(key=>[key,'number' as const]),
  ...nullable.split(' ').filter(Boolean).map(key=>[key,'number?' as const]),
]);
export const historyLayouts: Record<string,Layout> = {
  evidence:{table:'canonical_evidence',key:'evidence_id',fields:{...textFields('evidence_id source_ref media_type availability','captured_day platform_duplicate_family_id source_origin duplicate_tuple_fingerprint'),...numbers('has_precise_offset','captured_at_millis modified_at_millis location_available latitude longitude reported_accuracy_meters support_eligible duplicate_tuple_version')}},
  overlay:{table:'correction_overlays',key:'overlay_id',fields:{...textFields('overlay_id target_kind target_id correction_scope owner_action','owner_value identity_lineage_id replaces_overlay_id'),...numbers('created_at_millis revision')}},
  'journey-correction':{table:'journey_correction_revision',key:'revision_id',fields:{...textFields('revision_id action journey_id reviewed_support_json state reviewed_snapshot_json reviewed_visits_json reviewed_family_snapshot_json','replaces_revision_id command_key owner_title owner_date_kind owner_date_start owner_date_end structural_boundary_json owner_place_id owner_place_name owner_place_context'),...numbers('source_run_id created_at_millis','owner_latitude owner_longitude')}},
  'memory-correction':{table:'journey_memory_correction_revision',key:'revision_id',fields:{...textFields('revision_id action source_evidence_id journey_id reviewed_support_json state command_key reviewed_family_snapshot_json','replaces_revision_id'),...numbers('source_run_id created_at_millis')}},
  privacy:{table:'journey_privacy_revision',key:'revision',fields:{...textFields('policy_id command_key action target_kind reviewed_evidence_json reviewed_family_json reviewed_label','manual_id'),...numbers('revision source_run_id created_at_millis')}},
  home:{table:'configured_home_area',key:'area_id',fields:{...textFields('area_id origin','effective_start_day effective_end_day owner_label'),...numbers('latitude longitude radius_meters')}},
  manual:{table:'manual_journey',key:'manual_id',fields:{...textFields('manual_id command_key owner_label owner_context date_kind date_start date_end'),...numbers('latitude longitude created_at_millis')}},
  replay:{table:'replay_draft',key:'record_id',fields:{...textFields('committed_overrides_json'),...numbers('record_id revision updated_at_millis')}},
};
export type HistoryRow = Readonly<{kind:string;key:string;value:Record<string,string|number|null>}>;
export type ReplayContractCategory='JSON'|'FIELDS'|'ARRAYS'|'ARRAY_TYPE'|'ARRAY_COUNT'|'ARRAY_ITEM_TYPE'|'ARRAY_ITEM_SIZE'|'ARRAY_DUPLICATE'|'DIRECTION'|'AUDIO'|'SIZE'|'ROW';
export class HistoryContractError extends Error {
  constructor(readonly replayCategory?:ReplayContractCategory) { super('Private history needs a compatible transfer.'); this.name='HistoryContractError'; }
}
const enumFields: Record<string,Record<string,readonly (string|number)[]>>={
  evidence:{media_type:['image','video'],availability:['available','unavailable','unknown'],has_precise_offset:[0,1],location_available:[0,1],support_eligible:[0,1]},
  overlay:{target_kind:['evidence','history'],correction_scope:['inclusion','label','note'],owner_action:['apply','remove']},
  'journey-correction':{action:['confirm','reject','claim','place','split','merge','remove-visit'],state:['effective','pending_remap','superseded'],owner_date_kind:['exact','approximate']},
  'memory-correction':{action:['assign','move','reject','unassign'],state:['effective','pending_remap','superseded']},
  privacy:{action:['hide','exclude','restore'],target_kind:['manual','inferred']},
  home:{origin:['observed-area','legacy','manual-pin']},manual:{date_kind:['exact','approximate']},replay:{record_id:[1]},
};
export function assertPortableReplay(input:unknown):void {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new HistoryContractError('ROW');
  const composition=input as Record<string,unknown>;
  const arrays=['keptEvidenceIds','excludedEvidenceIds','orderedEvidenceIds','keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs','excludedGroupJourneyIds','autoGroupJourneyIds'];
  const allowed=[...arrays,'direction','directionPreferenceVersion','soundtrack'];
  if(Object.keys(composition).some(key=>!allowed.includes(key)))throw new HistoryContractError('FIELDS');
  for(const key of arrays){
    const value=composition[key];if(value===undefined)continue;
    if(!Array.isArray(value))throw new HistoryContractError('ARRAY_TYPE');
    if(value.length>100000)throw new HistoryContractError('ARRAY_COUNT');
    if(value.some(item=>typeof item!=='string'))throw new HistoryContractError('ARRAY_ITEM_TYPE');
    if(value.some(item=>item.length>67_108_864))throw new HistoryContractError('ARRAY_ITEM_SIZE');
    if(new Set(value).size!==value.length)throw new HistoryContractError('ARRAY_DUPLICATE');
  }
  if(composition.direction!==undefined&&!['oldest-first','newest-first'].includes(String(composition.direction)))throw new HistoryContractError('DIRECTION');
  if(composition.directionPreferenceVersion!==undefined&&(!Number.isSafeInteger(composition.directionPreferenceVersion)||Number(composition.directionPreferenceVersion)<1))throw new HistoryContractError('DIRECTION');
  if(composition.soundtrack!==undefined){
    const raw=composition.soundtrack;if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new HistoryContractError('AUDIO');
    const audio=raw as Record<string,unknown>;
    if(audio.kind==='bundled'){if(Object.keys(audio).length!==2||audio.revision!=='happy-moments-1.4')throw new HistoryContractError('AUDIO');}
    else if(audio.kind==='custom'){if(Object.keys(audio).length!==3||typeof audio.revision!=='string'||!audio.revision||audio.localUri!=='')throw new HistoryContractError('AUDIO');}
    else throw new HistoryContractError('AUDIO');
  }
}
// Cache only successful immutable JSON bodies; all mutable row fields are checked anew.
const validatedReplayBodies=new WeakMap<object,string>();
export function assertHistoryRow(input: unknown): asserts input is HistoryRow {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new HistoryContractError();
  const row=input as HistoryRow;
  if(Object.keys(row).length!==3 || typeof row.kind!=='string' || !Object.hasOwn(historyLayouts,row.kind) || typeof row.key!=='string' || row.key.length>1024 || !row.value || typeof row.value!=='object' || Array.isArray(row.value)) throw new HistoryContractError();
  const layout=historyLayouts[row.kind]; const entries=Object.entries(layout.fields);
  if(Object.keys(row.value).length!==entries.length || String(row.value[layout.key])!==row.key) throw new HistoryContractError();
  for(const [key,type] of entries) {
    const value=row.value[key];
    if(value===null && type.endsWith('?')) continue;
    if(type.startsWith('text')) { const maximum=row.kind==='replay'&&key==='committed_overrides_json'?67_108_864:100000;if(typeof value!=='string' || value.length>maximum) throw new HistoryContractError(row.kind==='replay'&&typeof value==='string'&&value.length>maximum?'SIZE':undefined); }
    else if(typeof value!=='number' || !Number.isFinite(value) || Math.abs(value)>Number.MAX_SAFE_INTEGER) throw new HistoryContractError();
    if(key.endsWith('_json') && typeof value==='string') {
      if(row.kind==='replay'&&validatedReplayBodies.get(row.value)===value)continue;
      let parsed: unknown;
      try { parsed=JSON.parse(value); } catch { throw new HistoryContractError(); }
      if(!parsed || typeof parsed!=='object') throw new HistoryContractError();
      if(row.kind==='replay'){
        assertPortableReplay(parsed);
        validatedReplayBodies.set(row.value,value);
      }
    }
    if((key==='latitude' || key==='owner_latitude') && typeof value==='number' && Math.abs(value)>90) throw new HistoryContractError();
    if((key==='longitude' || key==='owner_longitude') && typeof value==='number' && Math.abs(value)>180) throw new HistoryContractError();
    const accepted=enumFields[row.kind]?.[key];if(accepted&&value!==null&&!accepted.includes(value as string|number))throw new HistoryContractError();
    if(['revision','source_run_id','created_at_millis','updated_at_millis','captured_at_millis','modified_at_millis'].includes(key)&&typeof value==='number'&&(!Number.isSafeInteger(value)||value<0))throw new HistoryContractError();
    if(['date_start','date_end','captured_day','owner_date_start','owner_date_end','effective_start_day','effective_end_day'].includes(key)&&typeof value==='string'){
      const date=new Date(value+'T00:00:00Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new HistoryContractError();
    }
  }
  if(row.kind==='home'&&(Number(row.value.radius_meters)<=0||Number(row.value.radius_meters)>50000))throw new HistoryContractError();
  if(row.kind==='privacy'){
    const value=row.value;
    if(value.target_kind==='manual'&&(value.manual_id===null||value.action==='exclude')||value.target_kind==='inferred'&&value.manual_id!==null)throw new HistoryContractError();
    if(!Array.isArray(JSON.parse(String(value.reviewed_evidence_json)))||!Array.isArray(JSON.parse(String(value.reviewed_family_json))))throw new HistoryContractError();
  }
}

/** Portable composition retains identity/choices while removing device-local handles. */
export function portableReplayJson(value: string): string {
  let parsed:unknown;try{parsed=JSON.parse(value);}catch{throw new HistoryContractError('JSON');}
  if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw new HistoryContractError('ROW');
  const result={...parsed} as Record<string,unknown>;
  delete result.preparedArtifact;
  if(result.soundtrack && typeof result.soundtrack==='object' && !Array.isArray(result.soundtrack)) {
    const soundtrack={...result.soundtrack} as Record<string,unknown>;
    if(soundtrack.kind==='custom') soundtrack.localUri='';
    result.soundtrack=soundtrack;
  }
  // Actual persisted preference calls this music in older versions.
  if(result.music && typeof result.music==='object' && !Array.isArray(result.music)) {
    const music={...result.music} as Record<string,unknown>; if(music.kind==='custom') music.localUri=''; result.music=music;
  }
  assertPortableReplay(result);return JSON.stringify(result);
}
