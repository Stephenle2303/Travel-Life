-- Versioned staging records are collapsed atomically before activation.
alter table history_private.identity_mapping add column local_id_codec text not null default 'literal' check(local_id_codec in ('literal','sha256-v1'));
alter table history_private.identity_mapping drop constraint identity_mapping_pkey;
alter table history_private.identity_mapping add primary key(owner_id,source_id,kind,local_id_codec,local_id);
alter table history_private.aggregate_page drop constraint aggregate_page_records_check;
alter table history_private.aggregate_page add constraint aggregate_page_records_check check(jsonb_typeof(records)='array' and jsonb_array_length(records)<=100);

alter function history_private.valid_record(jsonb) rename to valid_record_before_replay_fragments;
create function history_private.valid_record(row_value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare v jsonb:=row_value->'value'; idx numeric; cnt numeric; rev numeric; updated numeric;
begin
 if row_value->>'kind'<>'replay-fragment' then return history_private.valid_record_before_replay_fragments(row_value);end if;
 if jsonb_typeof(row_value) is distinct from 'object' or row_value-array['kind','key','value']<>'{}'::jsonb or jsonb_typeof(row_value->'key') is distinct from 'string' or jsonb_typeof(v) is distinct from 'object' or v-array['record_id','revision','updated_at_millis','codec_version','part_index','part_count','committed_fragment']<>'{}'::jsonb or (select count(*) from jsonb_object_keys(v))<>7 then return false;end if;
 if jsonb_typeof(v->'record_id') is distinct from 'number' or v->>'record_id'<>'1' or jsonb_typeof(v->'codec_version') is distinct from 'number' or v->>'codec_version'<>'1' or jsonb_typeof(v->'revision') is distinct from 'number' or jsonb_typeof(v->'updated_at_millis') is distinct from 'number' or jsonb_typeof(v->'part_index') is distinct from 'number' or jsonb_typeof(v->'part_count') is distinct from 'number' or jsonb_typeof(v->'committed_fragment') is distinct from 'string' then return false;end if;
 idx:=(v->>'part_index')::numeric;cnt:=(v->>'part_count')::numeric;rev:=(v->>'revision')::numeric;updated:=(v->>'updated_at_millis')::numeric;
 if idx<>trunc(idx) or cnt<>trunc(cnt) or idx<0 or cnt<1 or cnt>4096 or idx>=cnt or rev<>trunc(rev) or rev<0 or rev>9007199254740991 or updated<>trunc(updated) or updated<0 or updated>9007199254740991 or row_value->>'key'<>'1:'||idx::text then return false;end if;
 return length(v->>'committed_fragment')+length(regexp_replace(v->>'committed_fragment',U&'[\0001-\FFFF]','','g'))<=16384 and octet_length(v->>'committed_fragment')<=65536;
exception when others then return false;end $$;
revoke all on function history_private.valid_record(jsonb),history_private.valid_record_before_replay_fragments(jsonb) from public,anon,authenticated;

-- This trusted internal helper checks the assembled semantic record, then replaces
-- fragments only after the existing activation has passed every authority guard.
create function history_private.collapse_replay_fragments(subject uuid, target uuid, aggregate_mode boolean) returns void language plpgsql security definer set search_path='' as $$
declare p record; r jsonb; v jsonb; parts text:=''; expected integer:=0; count_expected integer; revision text; updated text; first_page integer; first_ordinal integer; seen_replay boolean:=false; fragment_ended boolean:=false; assembled jsonb; cleaned jsonb; composition jsonb; fld text; arr jsonb;
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
    parts:=parts||(v->>'committed_fragment');if octet_length(parts)>67108864 then raise exception using errcode='22023';end if;expected:=expected+1;
   end if;
  end loop;
 end loop;
 if expected=0 then return;end if;
 if expected<>count_expected or seen_replay then raise exception using errcode='22023';end if;
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
 for p in select page_number,records from history_private.snapshot_page where not aggregate_mode and owner_id=subject and snapshot_id=target union all select page_number,records from history_private.aggregate_page where aggregate_mode and owner_id=subject and aggregate_id=target order by page_number loop
  select coalesce(jsonb_agg(case when p.page_number=first_page and ord=first_ordinal then assembled else value end order by ord),'[]'::jsonb) into cleaned from jsonb_array_elements(p.records) with ordinality x(value,ord) where value->>'kind'<>'replay-fragment' or p.page_number=first_page and ord=first_ordinal;
  if aggregate_mode then update history_private.aggregate_page set records=cleaned where owner_id=subject and aggregate_id=target and page_number=p.page_number;else update history_private.snapshot_page set records=cleaned where owner_id=subject and snapshot_id=target and page_number=p.page_number;end if;
 end loop;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception using errcode='22023';end $$;
revoke all on function history_private.collapse_replay_fragments(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function history_private.account_action(action text, input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 subject uuid := auth.uid();
 sid uuid;
 a history_private.account%rowtype;
 s history_private.source%rowtype;
 snap history_private.snapshot%rowtype;
 previous history_private.receipt%rowtype;
 mutation uuid;
 result jsonb;
 request_digest text;
 row_value jsonb;
 total bigint;
begin
 if subject is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 begin sid := (auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then return jsonb_build_object('error','ACCOUNT_SESSION'); end;
 if sid is null or not exists(select 1 from auth.sessions x join auth.users u on u.id=x.user_id where x.id=sid and x.user_id=subject and u.is_anonymous=false and u.email_confirmed_at is not null and (x.not_after is null or x.not_after>now())) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>524288 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 if input ? 'ownerId' or input ? 'owner_id' or input ? 'user_id' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 insert into history_private.account(owner_id) values(subject) on conflict do nothing;
 select * into a from history_private.account where owner_id=subject for update;
 if exists(select 1 from history_private.revoked_session where owner_id=subject and session_id=sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if action='status' or action='deletion-status' then
   if input<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   select coalesce(jsonb_agg(jsonb_build_object('sourceId',source_id,'generation',generation,'state',state,'lastUpdatedAt',last_updated_at,'sourceSnapshotRevision',snapshot_revision) order by source_id),'[]') into result from history_private.source where owner_id=subject;
   return jsonb_build_object('status',case when a.delete_fenced_at is null then 'active' else 'deleted' end,'generation',a.generation,'revision',a.revision,'historyConsent',a.history_consent,'mediaConsent',a.media_consent,'activeSnapshot',a.active_snapshot,'sources',result);
 end if;
 if a.delete_fenced_at is not null then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if action='pull' then
   if (input - array['snapshotId','page'])<>'{}'::jsonb or jsonb_typeof(input->'page')<>'number' or (input->>'page') !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   select * into snap from history_private.snapshot where owner_id=subject and snapshot_id=(input->>'snapshotId')::uuid and snapshot_id=a.active_snapshot and state='initial';
   if not found then return jsonb_build_object('error','HISTORY_STALE'); end if;
   select records into result from history_private.snapshot_page where owner_id=subject and snapshot_id=snap.snapshot_id and page_number=(input->>'page')::integer;
   if not found then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   return jsonb_build_object('status','complete','snapshotId',snap.snapshot_id,'page',(input->>'page')::integer,'pages',snap.expected_pages,'schemaVersion',snap.schema_version,'records',result);
 end if;
 if input->>'mutationId' is null or input->>'generation' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 begin mutation := (input->>'mutationId')::uuid; exception when invalid_text_representation then return jsonb_build_object('error','HISTORY_SCHEMA'); end;
 request_digest := encode(extensions.digest(convert_to(action || input::text,'UTF8'),'sha256'),'hex');
 select * into previous from history_private.receipt where owner_id=subject and mutation_id=mutation;
 if found then
   if previous.digest<>request_digest then return jsonb_build_object('error','HISTORY_CONFLICT'); end if;
   return previous.result;
 end if;
 if input->>'generation'<>a.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if action='consent' then
   if (input-array['mutationId','generation','history','media'])<>'{}'::jsonb or jsonb_typeof(input->'history')<>'boolean' or jsonb_typeof(input->'media')<>'boolean' or input->'history' is null or input->'media' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   update history_private.account set history_consent=(input->>'history')::boolean,media_consent=(input->>'media')::boolean,revision=revision+1 where owner_id=subject;
   result := jsonb_build_object('status','complete','revision',a.revision+1);
 elsif action='register-source' then
   if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT'); end if;
   if (input-array['mutationId','generation','installationId','sourceId'])<>'{}'::jsonb or input->>'installationId' is null or input->>'sourceId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   insert into history_private.source(owner_id,source_id,installation_id) values(subject,(input->>'sourceId')::uuid,(input->>'installationId')::uuid) on conflict(owner_id,installation_id) do nothing;
   select * into s from history_private.source where owner_id=subject and installation_id=(input->>'installationId')::uuid;
   if s.state<>'active' then return jsonb_build_object('error','HISTORY_FENCED'); end if;
   result:=jsonb_build_object('status','complete','sourceId',s.source_id,'sourceGeneration',s.generation,'sourceSnapshotRevision',s.snapshot_revision);
 elsif action in ('begin','page','activate','source-control') then
   if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT'); end if;
   select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid for update;
   if not found or s.state<>'active' or input->>'sourceGeneration' is null or input->>'sourceGeneration'<>s.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
   if action='begin' then
     if input->>'sourceSnapshotRevision' is null or input->>'sourceSnapshotRevision'<>s.snapshot_revision::text then return jsonb_build_object('error','HISTORY_STALE'); end if;
     if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId','pages','schemaVersion','sourceSnapshotRevision'])<>'{}'::jsonb or input->>'schemaVersion'<>'37' or input->>'pages' !~ '^[0-9]{1,5}$' or input->>'snapshotId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
     select count(*) into total from history_private.snapshot where owner_id=subject;
     if total>=20 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
     insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,base_source_revision) values(subject,(input->>'snapshotId')::uuid,s.source_id,s.generation,'staging',(input->>'pages')::integer,37,s.snapshot_revision);
     result:=jsonb_build_object('status','staging','snapshotId',input->>'snapshotId');
   elsif action='source-control' then
     if (input-array['mutationId','generation','sourceId','sourceGeneration','mode'])<>'{}'::jsonb or input->>'mode' not in ('paused','disconnected','removed') then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
     update history_private.source set generation=generation+1,state=input->>'mode' where owner_id=subject and source_id=s.source_id;
     update history_private.account set revision=revision+1 where owner_id=subject;
     if input->>'mode'='removed' then
       update history_private.account set active_snapshot=null where owner_id=subject and active_snapshot in(select snapshot_id from history_private.snapshot where owner_id=subject and source_id=s.source_id);
       delete from history_private.snapshot where owner_id=subject and source_id=s.source_id;
     end if;
     result:=jsonb_build_object('status','complete','sourceGeneration',s.generation+1);
   else
     select * into snap from history_private.snapshot where owner_id=subject and snapshot_id=(input->>'snapshotId')::uuid and source_id=s.source_id and state='staging' for update;
     if not found then return jsonb_build_object('error','HISTORY_STALE'); end if;
     if action='page' then
       if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId','page','records'])<>'{}'::jsonb or jsonb_typeof(input->'records')<>'array' or input->>'page' !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       if (input->>'page')::integer>=snap.expected_pages or jsonb_array_length(input->'records')>100 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       select coalesce(sum(octet_length(records::text)),0) into total from history_private.snapshot_page where owner_id=subject;
       if total + octet_length((input->'records')::text)>67108864 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
       for row_value in select * from jsonb_array_elements(input->'records') loop
         if not history_private.valid_record(row_value) then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
         if jsonb_typeof(row_value) is distinct from 'object' or (row_value-array['kind','key','value'])<>'{}'::jsonb or row_value->>'kind' is null or row_value->>'kind' not in ('evidence','overlay','journey-correction','memory-correction','privacy','home','manual','replay','replay-fragment') or row_value->>'key' is null or length(row_value->>'key')>1024 or row_value->'value' is null or jsonb_typeof(row_value->'value')<>'object' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       end loop;
       insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest) values(subject,snap.snapshot_id,(input->>'page')::integer,input->'records',request_digest);
       result:=jsonb_build_object('status','complete','page',(input->>'page')::integer);
     else
       if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId'])<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       select count(*) into total from history_private.snapshot_page where owner_id=subject and snapshot_id=snap.snapshot_id;
       if total<>snap.expected_pages then return jsonb_build_object('error','HISTORY_INCOMPLETE'); end if;
       if snap.base_source_revision<>s.snapshot_revision then return jsonb_build_object('error','HISTORY_STALE'); end if;
       perform history_private.collapse_replay_fragments(subject,snap.snapshot_id,false);
       if (select coalesce(sum(octet_length(records::text)),0) from history_private.snapshot_page where owner_id=subject)>67108864 then raise exception using errcode='22023';end if;
       update history_private.snapshot set source_revision=s.snapshot_revision+1 where owner_id=subject and snapshot_id=snap.snapshot_id;
       update history_private.source set snapshot_revision=snapshot_revision+1 where owner_id=subject and source_id=s.source_id;
       if a.active_snapshot is null then
         update history_private.account set active_snapshot=snap.snapshot_id,revision=revision+1 where owner_id=subject;
         update history_private.snapshot set state='initial' where owner_id=subject and snapshot_id=snap.snapshot_id;
         result:=jsonb_build_object('status','initial','snapshotId',snap.snapshot_id,'revision',a.revision+1);
       else
         update history_private.account set revision=revision+1 where owner_id=subject;
         update history_private.snapshot set state='pending' where owner_id=subject and snapshot_id=snap.snapshot_id;
         result:=jsonb_build_object('status','pending','snapshotId',snap.snapshot_id);
       end if;
       update history_private.source set last_updated_at=now() where owner_id=subject and source_id=s.source_id;
     end if;
   end if;
 elsif action='delete-account' then
   if not exists(select 1 from auth.sessions where id=sid and user_id=subject and created_at>now()-interval '10 minutes') then return jsonb_build_object('error','ACCOUNT_REAUTH'); end if;
   if (input-array['mutationId','generation'])<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   update history_private.account set generation=generation+1,delete_fenced_at=now(),history_consent=false,media_consent=false,active_snapshot=null where owner_id=subject;
   delete from history_private.snapshot where owner_id=subject;
   delete from history_private.source where owner_id=subject;
   delete from history_private.receipt where owner_id=subject;
   result:=jsonb_build_object('status','deleted','generation',a.generation+1);
 elsif action='revoke-session' then
   if (input-array['mutationId','generation','sessionId'])<>'{}'::jsonb or input->>'sessionId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   if not exists(select 1 from auth.sessions where id=(input->>'sessionId')::uuid and user_id=subject) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
   insert into history_private.revoked_session(owner_id,session_id) values(subject,(input->>'sessionId')::uuid) on conflict do nothing;
   result:=jsonb_build_object('status','complete');
 else return jsonb_build_object('error','HISTORY_SCHEMA');
 end if;
 insert into history_private.receipt(owner_id,mutation_id,digest,result) values(subject,mutation,request_digest,result);
 return result;
exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end;
$$;

create or replace function history_private.pre_owner_worker(subject uuid,sid uuid,action text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a history_private.account%rowtype; g history_private.aggregate%rowtype;
 plan jsonb; item jsonb; result jsonb; old_page history_private.aggregate_page%rowtype;
 operation uuid; page_index integer; total bigint; digest text;
begin
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>524288 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT'); end if;
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 plan:=history_private.current_source_plan(subject);
 if action='plan' then
  if input-array['operationId']<>'{}'::jsonb or input->>'operationId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  operation:=(input->>'operationId')::uuid;
  select * into g from history_private.aggregate where owner_id=subject and aggregate_id=operation and account_generation=a.generation and state='active';
  if found then return jsonb_build_object('status','complete','aggregateId',g.aggregate_id,'aggregateRevision',g.aggregate_revision,'pages',g.expected_pages); end if;
  if jsonb_array_length(plan)=0 or exists(select 1 from jsonb_array_elements(plan) p where p->>'snapshotId' is null) then return jsonb_build_object('error','HISTORY_INCOMPLETE'); end if;
  return jsonb_build_object('status','planned','accountGeneration',a.generation,'expectedAccountRevision',a.revision,
   'sourcePlan',plan,'preferredReplaySourceId',coalesce(a.preferred_replay_source,(select source_id from history_private.snapshot where owner_id=subject and snapshot_id=a.active_snapshot)));
 end if;
 if input->>'accountGeneration' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if input->'sourcePlan' is distinct from plan or input->>'expectedAccountRevision' is distinct from a.revision::text then return jsonb_build_object('error','HISTORY_STALE'); end if;
 if action='page' then
  if input-array['accountGeneration','expectedAccountRevision','sourcePlan','snapshotId','page']<>'{}'::jsonb or input->>'page' !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  select p into item from jsonb_array_elements(plan) p where p->>'snapshotId'=input->>'snapshotId';
  if item is null or (input->>'page')::integer >= (item->>'pages')::integer then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  select records into result from history_private.snapshot_page where owner_id=subject and snapshot_id=(input->>'snapshotId')::uuid and page_number=(input->>'page')::integer;
  if result is null then return jsonb_build_object('error','HISTORY_INCOMPLETE'); end if;
  return jsonb_build_object('records',result);
 elsif action='map-identities' then
  if input-array['accountGeneration','expectedAccountRevision','sourcePlan','keys']<>'{}'::jsonb or jsonb_typeof(input->'keys') is distinct from 'array' or jsonb_array_length(input->'keys')>100 then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  for item in select * from jsonb_array_elements(input->'keys') loop
   if jsonb_typeof(item)<>'object' or item-array['sourceId','kind','localId','localIdCodec']<>'{}'::jsonb or not exists(select 1 from jsonb_array_elements(plan) p where p->>'sourceId'=item->>'sourceId') or item->>'kind' not in ('evidence','family','overlay','lineage','journey-correction','memory-correction','journey','command','place','policy','manual','home') or jsonb_typeof(item->'sourceId') is distinct from 'string' or jsonb_typeof(item->'kind') is distinct from 'string' or jsonb_typeof(item->'localId') is distinct from 'string' or (not(item ? 'localIdCodec') and length(item->>'localId') not between 1 and 1024) or (item ? 'localIdCodec' and (item->>'localIdCodec' is distinct from 'sha256-v1' or item->>'localId' !~ '^[a-f0-9]{64}$')) then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  end loop;
  select count(*) into total from history_private.identity_mapping where owner_id=subject;
  if total+jsonb_array_length(input->'keys')>1000000 then return jsonb_build_object('error','HISTORY_QUOTA');end if;
  for item in select * from jsonb_array_elements(input->'keys') loop
   insert into history_private.identity_mapping(owner_id,source_id,kind,local_id_codec,local_id) values(subject,(item->>'sourceId')::uuid,item->>'kind',coalesce(item->>'localIdCodec','literal'),item->>'localId') on conflict do nothing;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('sourceId',m.source_id,'kind',m.kind,'localId',m.local_id,'accountId',m.account_id)||case when m.local_id_codec='sha256-v1' then jsonb_build_object('localIdCodec','sha256-v1') else '{}'::jsonb end order by m.source_id,m.kind,m.local_id_codec,m.local_id),'[]'::jsonb) into result from history_private.identity_mapping m where m.owner_id=subject and exists(select 1 from jsonb_array_elements(input->'keys') k where k->>'sourceId'=m.source_id::text and k->>'kind'=m.kind and k->>'localId'=m.local_id and coalesce(k->>'localIdCodec','literal')=m.local_id_codec);
  return jsonb_build_object('mappings',result);
 elsif action='activate' then
  operation:=(input->>'operationId')::uuid;
  if operation is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  select * into g from history_private.aggregate where owner_id=subject and aggregate_id=operation for update;
  if input->>'phase'='start' then
   if input-array['accountGeneration','expectedAccountRevision','sourcePlan','operationId','phase','pages','metadata','engineVersion']<>'{}'::jsonb
    or input->>'pages' !~ '^[0-9]{1,5}$' or jsonb_typeof(input->'metadata') is distinct from 'object'
    or input->>'engineVersion' is distinct from 'reconstruction-v1/trip-detector-v1.1' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   if g.aggregate_id is not null then
    if g.account_generation<>a.generation or g.source_plan<>plan or g.expected_pages<>(input->>'pages')::integer or g.metadata<>input->'metadata' or g.engine_version<>input->>'engineVersion' then return jsonb_build_object('error','HISTORY_CONFLICT'); end if;
   else
    select count(*) into total from history_private.aggregate where owner_id=subject;
    if total>=20 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
    insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,expected_pages,metadata,engine_version)
    values(subject,operation,a.generation,a.revision,plan,(input->>'pages')::integer,input->'metadata',input->>'engineVersion');
   end if;
   return jsonb_build_object('status','staging');
  end if;
  if g.aggregate_id is null or g.source_plan<>plan or g.account_generation<>a.generation or g.expected_account_revision<>a.revision then return jsonb_build_object('error','HISTORY_STALE'); end if;
  if input->>'phase'='page' then
   if input-array['accountGeneration','expectedAccountRevision','sourcePlan','operationId','phase','page','records']<>'{}'::jsonb
    or input->>'page' !~ '^[0-9]{1,5}$' or jsonb_typeof(input->'records') is distinct from 'array' or jsonb_array_length(input->'records')>100 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   page_index:=(input->>'page')::integer;
   if page_index>=g.expected_pages then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   for item in select * from jsonb_array_elements(input->'records') loop
    if not history_private.valid_record(item) then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   end loop;
   digest:=encode(extensions.digest(convert_to((input->'records')::text,'UTF8'),'sha256'),'hex');
   select * into old_page from history_private.aggregate_page where owner_id=subject and aggregate_id=operation and page_number=page_index;
   if found then
    if old_page.content_digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT'); end if;
   else
    if g.state<>'staging' then return jsonb_build_object('error','HISTORY_STALE'); end if;
    select coalesce(sum(octet_length(records::text)),0) into total from history_private.aggregate_page where owner_id=subject;
    if total+octet_length((input->'records')::text)>67108864 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
    insert into history_private.aggregate_page values(subject,operation,page_index,input->'records',digest);
   end if;
   return jsonb_build_object('status','staged','page',page_index);
  elsif input->>'phase'='commit' then
   if input-array['accountGeneration','expectedAccountRevision','sourcePlan','operationId','phase']<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   select count(*) into total from history_private.aggregate_page where owner_id=subject and aggregate_id=operation;
   if total<>g.expected_pages then return jsonb_build_object('error','HISTORY_INCOMPLETE'); end if;
   perform history_private.collapse_replay_fragments(subject,operation,true);
   if (select coalesce(sum(octet_length(records::text)),0) from history_private.aggregate_page where owner_id=subject)>67108864 then raise exception using errcode='22023';end if;
   select encode(extensions.digest(convert_to(g.metadata::text||coalesce(string_agg(content_digest,'' order by page_number),''),'UTF8'),'sha256'),'hex') into digest from history_private.aggregate_page where owner_id=subject and aggregate_id=operation;
   update history_private.aggregate set state='active',content_digest=digest,aggregate_revision=a.aggregate_revision+1 where owner_id=subject and aggregate_id=operation;
   update history_private.account set active_aggregate=operation,aggregate_revision=aggregate_revision+1,revision=revision+1,
    preferred_replay_source=coalesce(preferred_replay_source,(select source_id from history_private.snapshot where owner_id=subject and snapshot_id=a.active_snapshot)) where owner_id=subject;
   return jsonb_build_object('status','complete','aggregateId',operation,'aggregateRevision',a.aggregate_revision+1,'pages',g.expected_pages);
  end if;
 end if;
 return jsonb_build_object('error','HISTORY_SCHEMA');
exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end $$;
