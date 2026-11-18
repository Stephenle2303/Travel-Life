-- Preserve immutable deployed migrations; tighten only the reviewed boundaries.
alter function history_private.valid_record(jsonb) rename to valid_record_layout_v1;
create function history_private.valid_record(row_value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare v jsonb:=row_value->'value'; kind text:=row_value->>'kind'; composition jsonb; audio jsonb; field text; item jsonb; numeric_value numeric;
begin
 if not history_private.valid_record_layout_v1(row_value) then return false; end if;
 for field in select jsonb_object_keys(v) loop
  if field in ('revision','source_run_id','created_at_millis','updated_at_millis','captured_at_millis','modified_at_millis') and v->field<>'null'::jsonb then
   numeric_value:=(v->>field)::numeric;if numeric_value<0 or trunc(numeric_value)<>numeric_value then return false; end if;
  end if;
  if field in ('date_start','date_end','captured_day','owner_date_start','owner_date_end','effective_start_day','effective_end_day') and v->field<>'null'::jsonb then
   if v->>field !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((v->>field)::date,'YYYY-MM-DD')<>v->>field then return false; end if;
  end if;
 end loop;
 if kind='manual' and v->>'date_kind' not in ('exact','approximate') then return false; end if;
 if kind='home' and (v->>'origin' not in ('observed-area','legacy') or (v->>'radius_meters')::numeric<=0 or (v->>'radius_meters')::numeric>50000) then return false; end if;
 if kind='evidence' and (v->>'media_type' not in ('image','video') or v->>'availability' not in ('available','unavailable','unknown') or v->>'has_precise_offset' not in ('0','1')) then return false; end if;
 if kind='journey-correction' and v->>'action' not in ('confirm','reject','claim','place','split','merge','remove-visit') then return false; end if;
 if kind='memory-correction' and v->>'action' not in ('assign','move','reject','unassign') then return false; end if;
 if kind in ('journey-correction','memory-correction') and v->>'state' not in ('effective','pending_remap','superseded') then return false; end if;
 if kind='privacy' then
  if v->>'action' not in ('hide','exclude','restore') or v->>'target_kind' not in ('manual','inferred') then return false; end if;
  if v->>'target_kind'='manual' and (v->'manual_id'='null'::jsonb or v->>'action'='exclude') or v->>'target_kind'='inferred' and v->'manual_id'<>'null'::jsonb then return false; end if;
  if jsonb_typeof((v->>'reviewed_evidence_json')::jsonb)<>'array' or jsonb_typeof((v->>'reviewed_family_json')::jsonb)<>'array' then return false; end if;
 end if;
 if kind='replay' then
  if v->>'record_id'<>'1' then return false; end if;
  composition:=(v->>'committed_overrides_json')::jsonb;
  if jsonb_typeof(composition)<>'object' or composition-array['keptEvidenceIds','excludedEvidenceIds','orderedEvidenceIds','keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs','excludedGroupJourneyIds','autoGroupJourneyIds','direction','directionPreferenceVersion','soundtrack']<>'{}'::jsonb then return false; end if;
  foreach field in array array['keptEvidenceIds','excludedEvidenceIds','orderedEvidenceIds','keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs','excludedGroupJourneyIds','autoGroupJourneyIds'] loop
   if composition ? field then
    if jsonb_typeof(composition->field)<>'array' then return false; end if;
    for item in select * from jsonb_array_elements(composition->field) loop if jsonb_typeof(item)<>'string' then return false; end if;end loop;
   end if;
  end loop;
  if composition ? 'direction' and composition->>'direction' not in ('oldest-first','newest-first') then return false; end if;
  if composition ? 'soundtrack' then
   audio:=composition->'soundtrack';if jsonb_typeof(audio)<>'object' then return false;end if;
   if audio->>'kind'='bundled' then
    if audio-array['kind','revision']<>'{}'::jsonb or audio->>'revision' is distinct from 'happy-moments-1.4' then return false;end if;
   elsif audio->>'kind'='custom' then
    if audio-array['kind','revision','localUri']<>'{}'::jsonb or audio->>'localUri' is distinct from '' or jsonb_typeof(audio->'revision') is distinct from 'string' or length(audio->>'revision')<1 then return false;end if;
   else return false;end if;
  end if;
 end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow or invalid_datetime_format then return false;
end $$;
revoke all on function history_private.valid_record(jsonb) from public,anon,authenticated;

create function history_private.control_source(input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid();sid uuid; a history_private.account%rowtype;s history_private.source%rowtype;old history_private.receipt%rowtype;mutation uuid;digest text;result jsonb;
begin
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then return jsonb_build_object('error','ACCOUNT_SESSION');end;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION');end if;
 if input is null or jsonb_typeof(input)<>'object' or input-array['mutationId','generation','sourceId','sourceGeneration','mode']<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if input->>'mode' is null or input->>'mode' not in ('active','paused','disconnected','removed') then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null or input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 digest:=encode(extensions.digest(convert_to('source-control'||input::text,'UTF8'),'sha256'),'hex');
 select * into old from history_private.receipt where owner_id=subject and mutation_id=mutation;
 if found then if old.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT');end if;return old.result;end if;
 select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid for update;
 if not found or s.state='removed' or input->>'sourceGeneration' is distinct from s.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 update history_private.source set generation=generation+1,state=input->>'mode' where owner_id=subject and source_id=s.source_id;
 update history_private.account set revision=revision+1,active_aggregate=null where owner_id=subject;
 if input->>'mode'='removed' then
  update history_private.account set active_snapshot=null,preferred_replay_source=case when preferred_replay_source=s.source_id then null else preferred_replay_source end where owner_id=subject and active_snapshot in(select snapshot_id from history_private.snapshot where owner_id=subject and source_id=s.source_id);
  delete from history_private.aggregate where owner_id=subject;
  delete from history_private.snapshot where owner_id=subject and source_id=s.source_id;
 end if;
 result:=jsonb_build_object('status','complete','sourceGeneration',s.generation+1);
 insert into history_private.receipt(owner_id,mutation_id,digest,result)values(subject,mutation,digest,result);return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function history_private.control_source(jsonb) from public,anon,authenticated;
create or replace function public.travel_life_history(action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb; a history_private.account%rowtype; g history_private.aggregate%rowtype;
 sid uuid; records jsonb;
begin
 if action='source-control' then return history_private.control_source(input); end if;
 if action='pull' and input ? 'aggregateId' then
  base:=history_private.account_action('status','{}');
  if base ? 'error' then return base; end if;
  if base->>'status'<>'active' then return jsonb_build_object('error','HISTORY_FENCED'); end if;
  if input-array['aggregateId','page']<>'{}'::jsonb or input->>'page' !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  select * into a from history_private.account where owner_id=auth.uid();
  select * into g from history_private.aggregate where owner_id=auth.uid() and aggregate_id=(input->>'aggregateId')::uuid and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
  if not found or g.source_plan<>history_private.current_source_plan(auth.uid()) then return jsonb_build_object('error','HISTORY_STALE'); end if;
  select p.records into records from history_private.aggregate_page p where p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id and p.page_number=(input->>'page')::integer;
  if records is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  return jsonb_build_object('status','complete','snapshotId',g.aggregate_id,'aggregateId',g.aggregate_id,'aggregateRevision',g.aggregate_revision,'page',(input->>'page')::integer,'pages',g.expected_pages,'schemaVersion',37,'records',records);
 end if;
 base:=history_private.account_action(action,input);
 if action='status' and not base ? 'error' then
  select * into a from history_private.account where owner_id=auth.uid();
  select * into g from history_private.aggregate where owner_id=auth.uid() and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation and source_plan=history_private.current_source_plan(auth.uid()) and a.delete_fenced_at is null;
  return base||jsonb_build_object('activeAggregate',g.aggregate_id,'aggregateRevision',a.aggregate_revision,'aggregatePages',g.expected_pages);
 end if;
 return base;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;
