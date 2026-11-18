-- Assemble validated fragments once; preserve transactional activation and receipts.
create or replace function history_private.collapse_replay_fragments(subject uuid, target uuid, aggregate_mode boolean) returns void language plpgsql security definer set search_path='' as $$
declare p record; r jsonb; v jsonb; parts text; total_bytes bigint:=0; last_page integer; expected integer:=0; count_expected integer; revision text; updated text; first_page integer; first_ordinal integer; seen_replay boolean:=false; fragment_ended boolean:=false; assembled jsonb; cleaned jsonb; composition jsonb; fld text; arr jsonb;
begin
 for p in select page_number,records from history_private.snapshot_page where not aggregate_mode and owner_id=subject and snapshot_id=target union all select page_number,records from history_private.aggregate_page where aggregate_mode and owner_id=subject and aggregate_id=target order by page_number loop
  for r in select value from jsonb_array_elements(p.records) with ordinality x(value,ord) order by ord loop
   if r->>'kind'='replay' then seen_replay:=true;end if;
   if expected>0 and r->>'kind'<>'replay-fragment' then fragment_ended:=true;end if;
   if r->>'kind'='replay-fragment' then
    if fragment_ended or not history_private.valid_record(r) then raise exception using errcode='22023';end if;
    v:=r->'value';
    if expected=0 then count_expected:=(v->>'part_count')::integer;revision:=v->>'revision';updated:=v->>'updated_at_millis';first_page:=p.page_number;select ord::integer into first_ordinal from jsonb_array_elements(p.records) with ordinality x(value,ord) where value=r limit 1;end if;
    if (v->>'part_index')::integer<>expected or (v->>'part_count')::integer<>count_expected or v->>'revision'<>revision or v->>'updated_at_millis'<>updated then raise exception using errcode='22023';end if;
    total_bytes:=total_bytes+octet_length(v->>'committed_fragment');if total_bytes>67108864 then raise exception using errcode='22023';end if;expected:=expected+1;last_page:=p.page_number;
   end if;
  end loop;
 end loop;
 if expected=0 then return;end if;
 if expected<>count_expected or seen_replay then raise exception using errcode='22023';end if;
 select string_agg(x.value->'value'->>'committed_fragment','' order by pages.page_number,x.ord) into parts
 from (select page_number,records from history_private.snapshot_page where not aggregate_mode and owner_id=subject and snapshot_id=target and page_number between first_page and last_page
 union all select page_number,records from history_private.aggregate_page where aggregate_mode and owner_id=subject and aggregate_id=target and page_number between first_page and last_page) pages
 cross join lateral jsonb_array_elements(pages.records) with ordinality x(value,ord)
 where x.value->>'kind'='replay-fragment';
 composition:=parts::jsonb;
 if jsonb_typeof(composition)<>'object' or composition-array['keptEvidenceIds','excludedEvidenceIds','orderedEvidenceIds','keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs','excludedGroupJourneyIds','autoGroupJourneyIds','direction','directionPreferenceVersion','soundtrack']<>'{}'::jsonb then raise exception using errcode='22023';end if;
 foreach fld in array array['keptEvidenceIds','excludedEvidenceIds','orderedEvidenceIds','keptMemoryRefs','excludedMemoryRefs','orderedMemoryRefs','excludedGroupJourneyIds','autoGroupJourneyIds'] loop
  if composition ? fld then arr:=composition->fld;if jsonb_typeof(arr)<>'array' or jsonb_array_length(arr)>100000 or exists(select 1 from jsonb_array_elements(arr) x where jsonb_typeof(x)<>'string') or (select count(*) from jsonb_array_elements_text(arr))<>(select count(distinct x) from jsonb_array_elements_text(arr) x) then raise exception using errcode='22023';end if;end if;
 end loop;
 assembled:=jsonb_build_object('kind','replay','key','1','value',jsonb_build_object('record_id',1,'revision',revision::numeric,'updated_at_millis',updated::numeric,'committed_overrides_json',parts));
 -- Validate all non-composition fields through the existing closed validator.
 if not history_private.valid_record_before_replay_fragments(jsonb_set(assembled,'{value,committed_overrides_json}',to_jsonb('{}'::text))) then raise exception using errcode='22023';end if;
 if composition ? 'direction' and (jsonb_typeof(composition->'direction') is distinct from 'string' or composition->>'direction' not in ('oldest-first','newest-first')) then raise exception using errcode='22023';end if;
 if composition ? 'directionPreferenceVersion' and (jsonb_typeof(composition->'directionPreferenceVersion')<>'number' or (composition->>'directionPreferenceVersion')::numeric<1 or trunc((composition->>'directionPreferenceVersion')::numeric)<>(composition->>'directionPreferenceVersion')::numeric or (composition->>'directionPreferenceVersion')::numeric>9007199254740991) then raise exception using errcode='22023';end if;
 if composition ? 'soundtrack' then v:=composition->'soundtrack';if jsonb_typeof(v) is distinct from 'object' or (v->>'kind'='bundled' and (v-array['kind','revision']<>'{}'::jsonb or v->>'revision' is distinct from 'happy-moments-1.4')) or (v->>'kind'='custom' and (v-array['kind','revision','localUri']<>'{}'::jsonb or v->>'localUri' is distinct from '' or jsonb_typeof(v->'revision') is distinct from 'string' or length(v->>'revision')=0)) or coalesce(v->>'kind','') not in ('bundled','custom') then raise exception using errcode='22023';end if;end if;
 for p in select page_number,records from history_private.snapshot_page where not aggregate_mode and owner_id=subject and snapshot_id=target and page_number between first_page and last_page union all select page_number,records from history_private.aggregate_page where aggregate_mode and owner_id=subject and aggregate_id=target and page_number between first_page and last_page order by page_number loop
  select coalesce(jsonb_agg(case when p.page_number=first_page and ord=first_ordinal then assembled else value end order by ord),'[]'::jsonb) into cleaned from jsonb_array_elements(p.records) with ordinality x(value,ord) where value->>'kind'<>'replay-fragment' or p.page_number=first_page and ord=first_ordinal;
  if aggregate_mode then update history_private.aggregate_page set records=cleaned where owner_id=subject and aggregate_id=target and page_number=p.page_number;else update history_private.snapshot_page set records=cleaned where owner_id=subject and snapshot_id=target and page_number=p.page_number;end if;
 end loop;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception using errcode='22023';end $$;


-- Count supplementary code points directly rather than removing every BMP character.
create or replace function history_private.valid_record(row_value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare v jsonb:=row_value->'value'; idx numeric; cnt numeric; rev numeric; updated numeric;
begin
 if row_value->>'kind'<>'replay-fragment' then return history_private.valid_record_before_replay_fragments(row_value);end if;
 if jsonb_typeof(row_value) is distinct from 'object' or row_value-array['kind','key','value']<>'{}'::jsonb or jsonb_typeof(row_value->'key') is distinct from 'string' or jsonb_typeof(v) is distinct from 'object' or v-array['record_id','revision','updated_at_millis','codec_version','part_index','part_count','committed_fragment']<>'{}'::jsonb or (select count(*) from jsonb_object_keys(v))<>7 then return false;end if;
 if jsonb_typeof(v->'record_id') is distinct from 'number' or v->>'record_id'<>'1' or jsonb_typeof(v->'codec_version') is distinct from 'number' or v->>'codec_version'<>'1' or jsonb_typeof(v->'revision') is distinct from 'number' or jsonb_typeof(v->'updated_at_millis') is distinct from 'number' or jsonb_typeof(v->'part_index') is distinct from 'number' or jsonb_typeof(v->'part_count') is distinct from 'number' or jsonb_typeof(v->'committed_fragment') is distinct from 'string' then return false;end if;
 idx:=(v->>'part_index')::numeric;cnt:=(v->>'part_count')::numeric;rev:=(v->>'revision')::numeric;updated:=(v->>'updated_at_millis')::numeric;
 if idx<>trunc(idx) or cnt<>trunc(cnt) or idx<0 or cnt<1 or cnt>4096 or idx>=cnt or rev<>trunc(rev) or rev<0 or rev>9007199254740991 or updated<>trunc(updated) or updated<0 or updated>9007199254740991 or row_value->>'key'<>'1:'||idx::text then return false;end if;
 return length(v->>'committed_fragment')+regexp_count(v->>'committed_fragment',U&'[\+010000-\+10FFFF]')<=16384 and octet_length(v->>'committed_fragment')<=65536;
exception when others then return false;end $$;
