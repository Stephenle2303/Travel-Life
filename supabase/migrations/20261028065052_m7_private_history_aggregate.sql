-- Requires M6 transfer guards. Private mappings are retained across source generations.
alter table history_private.account add column active_aggregate uuid;
alter table history_private.account add column aggregate_revision bigint not null default 0;
alter table history_private.account add column preferred_replay_source uuid;
create table history_private.identity_mapping (
 owner_id uuid not null references history_private.account(owner_id),
 source_id uuid not null,
 kind text not null check(kind in ('evidence','family','overlay','lineage','journey-correction','memory-correction','journey','command','place','policy','manual','home')),
 local_id text not null check(length(local_id) between 1 and 1024),
 account_id uuid not null default gen_random_uuid(),
 primary key(owner_id,source_id,kind,local_id), unique(owner_id,account_id)
);
create table history_private.aggregate (
 owner_id uuid not null references history_private.account(owner_id),
 aggregate_id uuid not null,
 account_generation bigint not null,
 expected_account_revision bigint not null,
 source_plan jsonb not null,
 state text not null default 'staging' check(state in ('staging','active')),
 expected_pages integer not null check(expected_pages between 1 and 10000),
 metadata jsonb not null check(octet_length(metadata::text)<=524288),
 engine_version text not null check(engine_version='reconstruction-v1/trip-detector-v1.1'),
 content_digest text,
 aggregate_revision bigint,
 created_at timestamptz not null default now(),
 primary key(owner_id,aggregate_id)
);
create table history_private.aggregate_page (
 owner_id uuid not null,
 aggregate_id uuid not null,
 page_number integer not null check(page_number>=0),
 records jsonb not null check(jsonb_typeof(records)='array' and jsonb_array_length(records)<=100 and octet_length(records::text)<=524288),
 content_digest text not null,
 primary key(owner_id,aggregate_id,page_number),
 foreign key(owner_id,aggregate_id) references history_private.aggregate(owner_id,aggregate_id) on delete cascade
);
alter table history_private.identity_mapping enable row level security;
alter table history_private.aggregate enable row level security;
alter table history_private.aggregate_page enable row level security;
revoke all on history_private.identity_mapping,history_private.aggregate,history_private.aggregate_page from public,anon,authenticated;

create function history_private.live_worker_owner(subject uuid,sid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select subject is not null and sid is not null
 and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=sid and s.user_id=subject and not u.is_anonymous and u.email_confirmed_at is not null
 and (s.not_after is null or s.not_after>now()))
 and not exists(select 1 from history_private.revoked_session r where r.owner_id=subject and r.session_id=sid)
$$;
revoke all on function history_private.live_worker_owner(uuid,uuid) from public,anon,authenticated;

-- Ordered exact plan includes the source fence even where there is no completed snapshot.
create function history_private.current_source_plan(subject uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',s.source_id,'sourceGeneration',s.generation,'state',s.state,
 'sourceSnapshotRevision',s.snapshot_revision,'snapshotId',x.snapshot_id,'pages',x.expected_pages)
 order by s.source_id),'[]'::jsonb)
 from history_private.source s left join lateral (
 select t.snapshot_id,t.expected_pages from history_private.snapshot t
 where t.owner_id=s.owner_id and t.source_id=s.source_id
 and t.state in ('initial','pending') and t.source_revision=s.snapshot_revision
 order by t.source_revision desc,t.snapshot_id limit 1
 ) x on true where s.owner_id=subject and s.state<>'removed'
$$;
revoke all on function history_private.current_source_plan(uuid) from public,anon,authenticated;

create function history_private.worker_action(subject uuid,sid uuid,action text,input jsonb)
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
  if input-array['accountGeneration','expectedAccountRevision','sourcePlan','keys']<>'{}'::jsonb or jsonb_typeof(input->'keys') is distinct from 'array' or jsonb_array_length(input->'keys')>100 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  for item in select * from jsonb_array_elements(input->'keys') loop
   if jsonb_typeof(item)<>'object' or item-array['sourceId','kind','localId']<>'{}'::jsonb
   or not exists(select 1 from jsonb_array_elements(plan) p where p->>'sourceId'=item->>'sourceId')
   or item->>'kind' not in ('evidence','family','overlay','lineage','journey-correction','memory-correction','journey','command','place','policy','manual','home')
   or jsonb_typeof(item->'sourceId') is distinct from 'string' or jsonb_typeof(item->'kind') is distinct from 'string'
   or jsonb_typeof(item->'localId') is distinct from 'string' or length(item->>'localId') not between 1 and 1024 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  end loop;
  select count(*) into total from history_private.identity_mapping where owner_id=subject;
  if total+jsonb_array_length(input->'keys')>1000000 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
  for item in select * from jsonb_array_elements(input->'keys') loop
   insert into history_private.identity_mapping(owner_id,source_id,kind,local_id) values(subject,(item->>'sourceId')::uuid,item->>'kind',item->>'localId') on conflict do nothing;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('sourceId',m.source_id,'kind',m.kind,'localId',m.local_id,'accountId',m.account_id) order by m.source_id,m.kind,m.local_id),'[]'::jsonb) into result
  from history_private.identity_mapping m where m.owner_id=subject and exists(select 1 from jsonb_array_elements(input->'keys') k where k->>'sourceId'=m.source_id::text and k->>'kind'=m.kind and k->>'localId'=m.local_id);
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
   select encode(extensions.digest(convert_to(g.metadata::text||coalesce(string_agg(content_digest,'' order by page_number),''),'UTF8'),'sha256'),'hex') into digest from history_private.aggregate_page where owner_id=subject and aggregate_id=operation;
   update history_private.aggregate set state='active',content_digest=digest,aggregate_revision=a.aggregate_revision+1 where owner_id=subject and aggregate_id=operation;
   update history_private.account set active_aggregate=operation,aggregate_revision=aggregate_revision+1,revision=revision+1,
    preferred_replay_source=coalesce(preferred_replay_source,(select source_id from history_private.snapshot where owner_id=subject and snapshot_id=a.active_snapshot)) where owner_id=subject;
   return jsonb_build_object('status','complete','aggregateId',operation,'aggregateRevision',a.aggregate_revision+1,'pages',g.expected_pages);
  end if;
 end if;
 return jsonb_build_object('error','HISTORY_SCHEMA');
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end $$;
revoke all on function history_private.worker_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
create function public.travel_life_history_worker(verified_owner uuid,verified_session uuid,action text,input jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select history_private.worker_action(verified_owner,verified_session,action,input) $$;
revoke all on function public.travel_life_history_worker(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant usage on schema history_private to service_role;
grant execute on function history_private.worker_action(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.travel_life_history_worker(uuid,uuid,text,jsonb) to service_role;

-- Delegate existing actions. The owner/session is derived inside the original boundary.
create or replace function public.travel_life_history(action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb; a history_private.account%rowtype; g history_private.aggregate%rowtype;
 sid uuid; records jsonb;
begin
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

-- Existing fences hide immediately; cleanup is atomic with owner account deletion.
create function history_private.purge_aggregate_on_account_fence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.delete_fenced_at is not null and old.delete_fenced_at is null then
  new.active_aggregate:=null; new.preferred_replay_source:=null;
  delete from history_private.aggregate where owner_id=new.owner_id;
  delete from history_private.identity_mapping where owner_id=new.owner_id;
 end if;
 return new;
end $$;
revoke all on function history_private.purge_aggregate_on_account_fence() from public,anon,authenticated;
create trigger history_aggregate_delete_fence before update of delete_fenced_at on history_private.account for each row execute function history_private.purge_aggregate_on_account_fence();
