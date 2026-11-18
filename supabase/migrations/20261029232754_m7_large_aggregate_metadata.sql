-- Keep per-RPC input bounded; complete metadata is assembled inside fenced commit.
alter table history_private.aggregate drop constraint aggregate_metadata_check;
alter table history_private.aggregate add constraint aggregate_metadata_check check(octet_length(metadata::text)<=67108864);
create function history_private.finalize_aggregate_metadata(subject uuid, source_plan jsonb, header jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare copies jsonb;
begin
 if not (header ? 'sourceCopiesFromPlan') then return header;end if;
 if header->'sourceCopiesFromPlan' is distinct from 'true'::jsonb or header->'metadataVersion' is distinct from '3'::jsonb or header ? 'sourceCopies' then raise exception using errcode='22023';end if;
 if exists(
  select 1 from jsonb_array_elements(source_plan) plan
  join history_private.snapshot_page p on p.owner_id=subject and p.snapshot_id=(plan->>'snapshotId')::uuid
  cross join lateral jsonb_array_elements(p.records) r
  left join history_private.identity_mapping m on m.owner_id=subject and m.source_id=(plan->>'sourceId')::uuid and m.kind='evidence' and m.local_id_codec='literal' and m.local_id=r->>'key'
  where r->>'kind'='evidence' and m.account_id is null
 ) then raise exception using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',plan->>'sourceId','localEvidenceId',r->>'key','localSourceRef',r->'value'->>'source_ref','evidenceId',m.account_id,'availability',r->'value'->>'availability') order by plan->>'sourceId',r->>'key'),'[]'::jsonb) into copies
 from jsonb_array_elements(source_plan) plan
 join history_private.snapshot_page p on p.owner_id=subject and p.snapshot_id=(plan->>'snapshotId')::uuid
 cross join lateral jsonb_array_elements(p.records) r
 join history_private.identity_mapping m on m.owner_id=subject and m.source_id=(plan->>'sourceId')::uuid and m.kind='evidence' and m.local_id_codec='literal' and m.local_id=r->>'key'
 where r->>'kind'='evidence';
 return (header-'sourceCopiesFromPlan')||jsonb_build_object('sourceCopies',copies);
end $$;
revoke all on function history_private.finalize_aggregate_metadata(uuid,jsonb,jsonb) from public,anon,authenticated;
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
   g.metadata:=history_private.finalize_aggregate_metadata(subject,g.source_plan,g.metadata);
   if octet_length(g.metadata::text)>67108864 then raise exception using errcode='54000';end if;
   update history_private.aggregate set metadata=g.metadata where owner_id=subject and aggregate_id=operation;
   if (select coalesce(sum(octet_length(records::text)),0) from history_private.aggregate_page where owner_id=subject)+(select coalesce(sum(octet_length(metadata::text)),0) from history_private.aggregate where owner_id=subject)>67108864 then raise exception using errcode='54000';end if;
   select encode(extensions.digest(convert_to(g.metadata::text||coalesce(string_agg(content_digest,'' order by page_number),''),'UTF8'),'sha256'),'hex') into digest from history_private.aggregate_page where owner_id=subject and aggregate_id=operation;
   update history_private.aggregate set state='active',content_digest=digest,aggregate_revision=a.aggregate_revision+1 where owner_id=subject and aggregate_id=operation;
   update history_private.account set active_aggregate=operation,aggregate_revision=aggregate_revision+1,revision=revision+1,
    preferred_replay_source=coalesce(preferred_replay_source,(select source_id from history_private.snapshot where owner_id=subject and snapshot_id=a.active_snapshot)) where owner_id=subject;
   return jsonb_build_object('status','complete','aggregateId',operation,'aggregateRevision',a.aggregate_revision+1,'pages',g.expected_pages);
  end if;
 end if;
 return jsonb_build_object('error','HISTORY_SCHEMA');
exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
 when program_limit_exceeded then return jsonb_build_object('error','HISTORY_QUOTA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end $$;
