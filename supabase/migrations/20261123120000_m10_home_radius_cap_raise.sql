-- M10.10 (decision 0023/detector-v1-3.md): the owner's Home radius becomes
-- a free number up to 300 km (was a fixed 50 km ceiling). This WIDENS a
-- boundary rather than tightening one, so it cannot be layered as a thin
-- wrapper the way every prior guard in this lineage was (a wrapper can only
-- add a further `return false`, never undo one `valid_record_home_radius_v1`
-- already made) — the whole function is restated here with only the one
-- threshold changed. Preserve immutable deployed migrations: the superseded
-- function is kept under its own name, same as every earlier step in this
-- chain.
--
-- PREPARED, NOT DEPLOYED: this migration must not be applied to the hosted
-- Supabase project until the owner explicitly approves the deploy (every
-- prior raise of this cap — local SQLite, in-app validation, the account
-- history contract — ships first; this is the one that needs that approval,
-- per AGENTS.md's "A Supabase deploy needs owner approval").
--
-- Also closes a pre-existing gap found while restating this function
-- (code review, 2026-11-23): the deployed guard's `home` origin allow-list
-- was missing `'manual-pin'`, even though the client always writes that
-- origin for an owner-pinned Home (InitialHomeSetup in mobile-screens.tsx)
-- and the account history contract already accepts it. Deployed as-is,
-- that gap would reject every manually-pinned Home's history row
-- regardless of radius. Fixed here rather than carried forward unchanged.
alter function history_private.valid_record(jsonb) rename to valid_record_home_radius_v1;
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
 -- Two changes from valid_record_home_radius_v1: 50000 -> 300000, and
 -- 'manual-pin' added to the origin allow-list (see the pre-existing-gap
 -- note at the top of this migration).
 if kind='home' and (v->>'origin' not in ('observed-area','legacy','manual-pin') or (v->>'radius_meters')::numeric<=0 or (v->>'radius_meters')::numeric>300000) then return false; end if;
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
