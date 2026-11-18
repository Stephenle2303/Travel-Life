-- Private account transfer. No client may address another owner in the payload.
create schema if not exists history_private;
revoke all on schema history_private from public, anon;
grant usage on schema history_private to authenticated;

create table if not exists history_private.account (
 owner_id uuid primary key references auth.users(id),
 generation bigint not null default 1,
 revision bigint not null default 0,
 history_consent boolean not null default false,
 media_consent boolean not null default false,
 active_snapshot uuid,
 delete_fenced_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists history_private.source (
 owner_id uuid not null references history_private.account(owner_id),
 source_id uuid not null,
 installation_id uuid not null,
 generation bigint not null default 1,
 state text not null default 'active' check(state in ('active','paused','disconnected','removed')),
 last_updated_at timestamptz,
 primary key(owner_id,source_id),
 unique(owner_id,installation_id)
);
create table if not exists history_private.snapshot (
 owner_id uuid not null references history_private.account(owner_id),
 snapshot_id uuid not null,
 source_id uuid not null,
 source_generation bigint not null,
 state text not null check(state in ('staging','initial','pending','removed')),
 expected_pages integer not null check(expected_pages between 1 and 10000),
 schema_version integer not null check(schema_version=37),
 created_at timestamptz not null default now(),
 primary key(owner_id,snapshot_id),
 foreign key(owner_id,source_id) references history_private.source(owner_id,source_id)
);
create table if not exists history_private.snapshot_page (
 owner_id uuid not null,
 snapshot_id uuid not null,
 page_number integer not null check(page_number>=0),
 records jsonb not null check(jsonb_typeof(records)='array' and jsonb_array_length(records)<=100),
 content_digest text not null,
 primary key(owner_id,snapshot_id,page_number),
 foreign key(owner_id,snapshot_id) references history_private.snapshot(owner_id,snapshot_id) on delete cascade
);
create table if not exists history_private.receipt (
 owner_id uuid not null references history_private.account(owner_id),
 mutation_id uuid not null,
 digest text not null,
 result jsonb not null,
 primary key(owner_id,mutation_id)
);
create table if not exists history_private.revoked_session (
 owner_id uuid not null references history_private.account(owner_id),
 session_id uuid not null,
 primary key(owner_id,session_id)
);
alter table history_private.account enable row level security;
alter table history_private.source enable row level security;
alter table history_private.snapshot enable row level security;
alter table history_private.snapshot_page enable row level security;
alter table history_private.receipt enable row level security;
alter table history_private.revoked_session enable row level security;
revoke all on all tables in schema history_private from public,anon,authenticated;

create or replace function history_private.valid_record(row_value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare layouts jsonb := '{"evidence":{"key":"evidence_id","fields":{"evidence_id":"text","source_ref":"text","media_type":"text","availability":"text","captured_day":"text?","platform_duplicate_family_id":"text?","source_origin":"text?","duplicate_tuple_fingerprint":"text?","has_precise_offset":"number","captured_at_millis":"number?","modified_at_millis":"number?","location_available":"number?","latitude":"number?","longitude":"number?","reported_accuracy_meters":"number?","support_eligible":"number?","duplicate_tuple_version":"number?"}},"overlay":{"key":"overlay_id","fields":{"overlay_id":"text","target_kind":"text","target_id":"text","correction_scope":"text","owner_action":"text","owner_value":"text?","identity_lineage_id":"text?","replaces_overlay_id":"text?","created_at_millis":"number","revision":"number"}},"journey-correction":{"key":"revision_id","fields":{"revision_id":"text","action":"text","journey_id":"text","reviewed_support_json":"text","state":"text","reviewed_snapshot_json":"text","reviewed_visits_json":"text","reviewed_family_snapshot_json":"text","replaces_revision_id":"text?","command_key":"text?","owner_title":"text?","owner_date_kind":"text?","owner_date_start":"text?","owner_date_end":"text?","structural_boundary_json":"text?","owner_place_id":"text?","owner_place_name":"text?","owner_place_context":"text?","source_run_id":"number","created_at_millis":"number","owner_latitude":"number?","owner_longitude":"number?"}},"memory-correction":{"key":"revision_id","fields":{"revision_id":"text","action":"text","source_evidence_id":"text","journey_id":"text","reviewed_support_json":"text","state":"text","command_key":"text","reviewed_family_snapshot_json":"text","replaces_revision_id":"text?","source_run_id":"number","created_at_millis":"number"}},"privacy":{"key":"revision","fields":{"policy_id":"text","command_key":"text","action":"text","target_kind":"text","reviewed_evidence_json":"text","reviewed_family_json":"text","reviewed_label":"text","manual_id":"text?","revision":"number","source_run_id":"number","created_at_millis":"number"}},"home":{"key":"area_id","fields":{"area_id":"text","origin":"text","effective_start_day":"text?","effective_end_day":"text?","owner_label":"text?","latitude":"number","longitude":"number","radius_meters":"number"}},"manual":{"key":"manual_id","fields":{"manual_id":"text","command_key":"text","owner_label":"text","owner_context":"text","date_kind":"text","date_start":"text","date_end":"text","latitude":"number","longitude":"number","created_at_millis":"number"}},"replay":{"key":"record_id","fields":{"committed_overrides_json":"text","record_id":"number","revision":"number","updated_at_millis":"number"}}}'::jsonb;
declare layout jsonb := layouts->(row_value->>'kind');
declare item record; declare value jsonb; declare parsed jsonb;
begin
 if layout is null or (select count(*) from jsonb_object_keys(row_value))<>3 or jsonb_typeof(row_value->'value') is distinct from 'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(row_value->'value'))<>(select count(*) from jsonb_object_keys(layout->'fields')) then return false; end if;
 if row_value->>'key' is distinct from row_value->'value'->>(layout->>'key') then return false; end if;
 for item in select f.key,f.value #>> '{}' as kind from jsonb_each(layout->'fields') as f loop
  value := row_value->'value'->item.key;
  if value is null then return false; end if;
  if value='null'::jsonb and right(item.kind,1)='?' then continue; end if;
  if left(item.kind,4)='text' then
   if jsonb_typeof(value)<>'string' or length(value#>>'{}')>100000 then return false; end if;
   if right(item.key,5)='_json' then parsed:=(value#>>'{}')::jsonb; if jsonb_typeof(parsed) not in ('array','object') then return false; end if; end if;
  else
   if jsonb_typeof(value)<>'number' or abs((value#>>'{}')::numeric)>9007199254740991 then return false; end if;
   if item.key in ('latitude','owner_latitude') and abs((value#>>'{}')::numeric)>90 then return false; end if;
   if item.key in ('longitude','owner_longitude') and abs((value#>>'{}')::numeric)>180 then return false; end if;
  end if;
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
revoke all on function history_private.valid_record(jsonb) from public,anon,authenticated;

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
   select coalesce(jsonb_agg(jsonb_build_object('sourceId',source_id,'generation',generation,'state',state,'lastUpdatedAt',last_updated_at) order by source_id),'[]') into result from history_private.source where owner_id=subject;
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
   result:=jsonb_build_object('status','complete','sourceId',s.source_id,'sourceGeneration',s.generation);
 elsif action in ('begin','page','activate','source-control') then
   if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT'); end if;
   select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid for update;
   if not found or s.state<>'active' or input->>'sourceGeneration' is null or input->>'sourceGeneration'<>s.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
   if action='begin' then
     if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId','pages','schemaVersion'])<>'{}'::jsonb or input->>'schemaVersion'<>'37' or input->>'pages' !~ '^[0-9]{1,5}$' or input->>'snapshotId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
     select count(*) into total from history_private.snapshot where owner_id=subject;
     if total>=20 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
     insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version) values(subject,(input->>'snapshotId')::uuid,s.source_id,s.generation,'staging',(input->>'pages')::integer,37);
     result:=jsonb_build_object('status','staging','snapshotId',input->>'snapshotId');
   elsif action='source-control' then
     if (input-array['mutationId','generation','sourceId','sourceGeneration','mode'])<>'{}'::jsonb or input->>'mode' not in ('paused','disconnected','removed') then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
     update history_private.source set generation=generation+1,state=input->>'mode' where owner_id=subject and source_id=s.source_id;
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
         if jsonb_typeof(row_value)<>'object' or (row_value-array['kind','key','value'])<>'{}'::jsonb or row_value->>'kind' is null or row_value->>'kind' not in ('evidence','overlay','journey-correction','memory-correction','privacy','home','manual','replay') or row_value->>'key' is null or length(row_value->>'key')>1024 or row_value->'value' is null or jsonb_typeof(row_value->'value')<>'object' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       end loop;
       insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest) values(subject,snap.snapshot_id,(input->>'page')::integer,input->'records',request_digest);
       result:=jsonb_build_object('status','complete','page',(input->>'page')::integer);
     else
       if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId'])<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       select count(*) into total from history_private.snapshot_page where owner_id=subject and snapshot_id=snap.snapshot_id;
       if total<>snap.expected_pages then return jsonb_build_object('error','HISTORY_INCOMPLETE'); end if;
       if a.active_snapshot is null then
         update history_private.account set active_snapshot=snap.snapshot_id,revision=revision+1 where owner_id=subject;
         update history_private.snapshot set state='initial' where owner_id=subject and snapshot_id=snap.snapshot_id;
         result:=jsonb_build_object('status','initial','snapshotId',snap.snapshot_id,'revision',a.revision+1);
       else
         update history_private.snapshot set state='pending' where owner_id=subject and snapshot_id=snap.snapshot_id;
         result:=jsonb_build_object('status','pending','snapshotId',snap.snapshot_id);
       end if;
       update history_private.source set last_updated_at=now() where owner_id=subject and source_id=s.source_id;
     end if;
   end if;
 elsif action='delete-account' then
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
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end;
$$;
revoke all on function history_private.account_action(text,jsonb) from public,anon;
grant execute on function history_private.account_action(text,jsonb) to authenticated;
create or replace function public.travel_life_history(action text,input jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select history_private.account_action(action,input) $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;
