-- Source evidence can be removed without deleting independently owner-entered facts.
-- Removed source rows are durable fences; retained snapshots contain no evidence.
create index if not exists history_snapshot_source_idx on history_private.snapshot(owner_id,source_id);

create or replace function history_private.current_source_plan(subject uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',s.source_id,'sourceGeneration',s.generation,'state',s.state,
 'sourceSnapshotRevision',s.snapshot_revision,'snapshotId',x.snapshot_id,'pages',x.expected_pages,
 'retainedOwnerFacts',s.state='removed') order by s.source_id),'[]'::jsonb)
 from history_private.source s left join lateral (
  select t.snapshot_id,t.expected_pages from history_private.snapshot t
  where t.owner_id=s.owner_id and t.source_id=s.source_id and t.state in ('initial','pending')
  and t.source_revision=s.snapshot_revision order by t.snapshot_id limit 1
 ) x on true where s.owner_id=subject and (s.state<>'removed' or x.snapshot_id is not null)
$$;
revoke all on function history_private.current_source_plan(uuid) from public,anon,authenticated;

-- Pause/disconnect fence new work but do not invalidate already-retained content.
-- Ignore only the read-control generation/state; membership/content stays exact.
create function history_private.same_source_content(left_plan jsonb,right_plan jsonb) returns boolean
language sql immutable set search_path='' as $$
 select (select coalesce(jsonb_agg(p-array['sourceGeneration','state','retainedOwnerFacts'] order by p->>'sourceId'),'[]'::jsonb) from jsonb_array_elements(left_plan) p)
 is not distinct from
 (select coalesce(jsonb_agg(p-array['sourceGeneration','state','retainedOwnerFacts'] order by p->>'sourceId'),'[]'::jsonb) from jsonb_array_elements(right_plan) p)
$$;
revoke all on function history_private.same_source_content(jsonb,jsonb) from public,anon,authenticated;

create or replace function history_private.control_source(input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid(); sid uuid; a history_private.account%rowtype; s history_private.source%rowtype;
 old history_private.receipt%rowtype; mutation uuid; digest text; result jsonb;
 retained uuid; latest uuid; retained_pages integer:=0; page_data jsonb; source_page record;
begin
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then return jsonb_build_object('error','ACCOUNT_SESSION'); end;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>4096
 or input-array['mutationId','generation','sourceId','sourceGeneration','mode']<>'{}'::jsonb
 or input->>'mode' is null or input->>'mode' not in ('active','paused','disconnected','removed') then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 mutation:=(input->>'mutationId')::uuid;
 if mutation is null or input->>'sourceId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null or input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 digest:=encode(extensions.digest(convert_to('source-control'||input::text,'UTF8'),'sha256'),'hex');
 select * into old from history_private.receipt where owner_id=subject and mutation_id=mutation;
 if found then
  if old.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT'); end if;
  return old.result;
 end if;
 select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid for update;
 if not found or s.state='removed' or input->>'sourceGeneration' is distinct from s.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if input->>'mode'='removed' then
  select snapshot_id into latest from history_private.snapshot where owner_id=subject and source_id=s.source_id
   and source_revision=s.snapshot_revision and state in ('initial','pending') order by snapshot_id limit 1;
  retained:=gen_random_uuid();
  -- Stage before deleting old pages. The transaction hides all intermediate state.
  insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision)
  values(subject,retained,s.source_id,s.generation+1,'pending',1,37,s.snapshot_revision+1);
  for source_page in select records from history_private.snapshot_page where owner_id=subject and snapshot_id=latest order by page_number loop
   select coalesce(jsonb_agg(case when r->>'kind' in ('journey-correction','memory-correction') and r->'value'->>'state'<>'superseded'
    then jsonb_set(r,'{value,state}','"pending_remap"'::jsonb) else r end order by position),'[]'::jsonb)
   into page_data from jsonb_array_elements(source_page.records) with ordinality as items(r,position) where r->>'kind'<>'evidence';
   if jsonb_array_length(page_data)>0 then
    insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
    values(subject,retained,retained_pages,page_data,encode(extensions.digest(convert_to(page_data::text,'UTF8'),'sha256'),'hex'));
    retained_pages:=retained_pages+1;
   end if;
  end loop;
  if retained_pages=0 then delete from history_private.snapshot where owner_id=subject and snapshot_id=retained;
  else update history_private.snapshot set expected_pages=retained_pages where owner_id=subject and snapshot_id=retained; end if;
  update history_private.source set generation=generation+1,state='removed',snapshot_revision=snapshot_revision+1 where owner_id=subject and source_id=s.source_id;
  -- All old aggregate content may contain removed evidence. Fence it before purge.
  update history_private.account set revision=revision+1,active_aggregate=null,active_snapshot=null,
   preferred_replay_source=case when preferred_replay_source=s.source_id and retained_pages=0 then null else preferred_replay_source end where owner_id=subject;
  delete from history_private.aggregate where owner_id=subject;
  delete from history_private.snapshot where owner_id=subject and source_id=s.source_id and snapshot_id<>retained;
  result:=jsonb_build_object('status','complete','sourceGeneration',s.generation+1,'retainedOwnerFacts',retained_pages>0,'reviewRequired',exists(
   select 1 from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r
   where p.owner_id=subject and p.snapshot_id=retained and (r->>'kind' in ('overlay','replay')
    or r->>'kind'='privacy' and r->'value'->>'target_kind'='inferred'
    or r->>'kind' in ('journey-correction','memory-correction') and r->'value'->>'state'<>'superseded')));
 else
  update history_private.source set generation=generation+1,state=input->>'mode' where owner_id=subject and source_id=s.source_id;
  update history_private.account set revision=revision+1 where owner_id=subject;
  result:=jsonb_build_object('status','complete','sourceGeneration',s.generation+1);
 end if;
 insert into history_private.receipt(owner_id,mutation_id,digest,result) values(subject,mutation,digest,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function history_private.control_source(jsonb) from public,anon,authenticated;

-- Explicit resolution keeps the immutable owner proposal available for inspection.
-- The owner chooses to archive source-dependent proposals and keep independent facts.
create function history_private.resolve_removed_source(input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid(); sid uuid; a history_private.account%rowtype; s history_private.source%rowtype;
 old history_private.receipt%rowtype; mutation uuid; digest text; result jsonb;
 retained uuid:=gen_random_uuid(); latest uuid; retained_pages integer:=0; page_data jsonb; source_page record;
begin
 begin sid:=(auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then return jsonb_build_object('error','ACCOUNT_SESSION'); end;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>4096
 or input-array['mutationId','generation','sourceId','sourceGeneration','expectedSourceRevision','mode']<>'{}'::jsonb
 or input->>'mode' is distinct from 'archive-source-proposals' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 mutation:=(input->>'mutationId')::uuid;
 if mutation is null or input->>'sourceId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null or input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 digest:=encode(extensions.digest(convert_to('resolve-conflict'||input::text,'UTF8'),'sha256'),'hex');
 select * into old from history_private.receipt where owner_id=subject and mutation_id=mutation;
 if found then
  if old.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT'); end if;
  return old.result;
 end if;
 select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid for update;
 if not found or s.state<>'removed' or input->>'sourceGeneration' is distinct from s.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if input->>'expectedSourceRevision' is distinct from s.snapshot_revision::text then return jsonb_build_object('error','HISTORY_CONFLICT'); end if;
 select snapshot_id into latest from history_private.snapshot where owner_id=subject and source_id=s.source_id
  and source_revision=s.snapshot_revision and state='pending' order by snapshot_id limit 1;
 if latest is null then return jsonb_build_object('error','HISTORY_STALE'); end if;
 insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision)
 values(subject,retained,s.source_id,s.generation,'pending',1,37,s.snapshot_revision+1);
 for source_page in select records from history_private.snapshot_page where owner_id=subject and snapshot_id=latest order by page_number loop
  select coalesce(jsonb_agg(r order by position),'[]'::jsonb) into page_data
  from jsonb_array_elements(source_page.records) with ordinality as items(r,position)
  where r->>'kind' in ('manual','home') or r->>'kind'='privacy' and r->'value'->>'target_kind'='manual';
  if jsonb_array_length(page_data)>0 then
   insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
   values(subject,retained,retained_pages,page_data,encode(extensions.digest(convert_to(page_data::text,'UTF8'),'sha256'),'hex'));
   retained_pages:=retained_pages+1;
  end if;
 end loop;
 if retained_pages=0 then delete from history_private.snapshot where owner_id=subject and snapshot_id=retained;
 else update history_private.snapshot set expected_pages=retained_pages where owner_id=subject and snapshot_id=retained; end if;
 update history_private.snapshot set state='removed' where owner_id=subject and snapshot_id=latest;
 update history_private.source set snapshot_revision=snapshot_revision+1 where owner_id=subject and source_id=s.source_id;
 update history_private.account set revision=revision+1,active_aggregate=null,active_snapshot=null,
  preferred_replay_source=case when preferred_replay_source=s.source_id then null else preferred_replay_source end where owner_id=subject;
 delete from history_private.aggregate where owner_id=subject;
 result:=jsonb_build_object('status','complete','sourceSnapshotRevision',s.snapshot_revision+1,'retainedOwnerFacts',retained_pages>0);
 insert into history_private.receipt(owner_id,mutation_id,digest,result) values(subject,mutation,digest,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function history_private.resolve_removed_source(jsonb) from public,anon,authenticated;

create or replace function public.travel_life_history(action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb; a history_private.account%rowtype; g history_private.aggregate%rowtype; records jsonb; x history_private.snapshot%rowtype;
begin
 if action='source-control' then return history_private.control_source(input); end if;
 if action='resolve-conflict' then return history_private.resolve_removed_source(input); end if;
 if action='source-review' then
  base:=history_private.account_action('status','{}');
  if base ? 'error' then return base; end if;
  if base->>'status'<>'active' then return jsonb_build_object('error','HISTORY_FENCED'); end if;
  if input is null or jsonb_typeof(input)<>'object' or input-array['sourceId','page','archived']<>'{}'::jsonb
   or input ? 'archived' and jsonb_typeof(input->'archived') is distinct from 'boolean'
   or input->>'sourceId' is null or input->>'page' is null or input->>'page' !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  select t.* into x from history_private.snapshot t join history_private.source s on s.owner_id=t.owner_id and s.source_id=t.source_id
   where s.owner_id=auth.uid() and s.source_id=(input->>'sourceId')::uuid and s.state='removed'
   and t.state=case when input->>'archived'='true' then 'removed' else 'pending' end order by t.source_revision desc limit 1;
  if not found then return jsonb_build_object('error','HISTORY_STALE'); end if;
  select p.records into records from history_private.snapshot_page p where p.owner_id=auth.uid() and p.snapshot_id=x.snapshot_id and p.page_number=(input->>'page')::integer;
  if records is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  return jsonb_build_object('status','complete','sourceSnapshotRevision',x.source_revision,'archived',x.state='removed','page',(input->>'page')::integer,'pages',x.expected_pages,'records',records);
 end if;
 if action='pull' and input ? 'aggregateId' then
  base:=history_private.account_action('status','{}');
  if base ? 'error' then return base; end if;
  if base->>'status'<>'active' then return jsonb_build_object('error','HISTORY_FENCED'); end if;
  if input-array['aggregateId','page']<>'{}'::jsonb or input->>'page' !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  select * into a from history_private.account where owner_id=auth.uid();
  select * into g from history_private.aggregate where owner_id=auth.uid() and aggregate_id=(input->>'aggregateId')::uuid and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
  if not found or not history_private.same_source_content(g.source_plan,history_private.current_source_plan(auth.uid())) then return jsonb_build_object('error','HISTORY_STALE'); end if;
  select p.records into records from history_private.aggregate_page p where p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id and p.page_number=(input->>'page')::integer;
  if records is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
  return jsonb_build_object('status','complete','snapshotId',g.aggregate_id,'aggregateId',g.aggregate_id,'aggregateRevision',g.aggregate_revision,'page',(input->>'page')::integer,'pages',g.expected_pages,'schemaVersion',37,'records',records);
 end if;
 base:=history_private.account_action(action,input);
 if action='status' and not base ? 'error' then
  select * into a from history_private.account where owner_id=auth.uid();
  select * into g from history_private.aggregate where owner_id=auth.uid() and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation and history_private.same_source_content(source_plan,history_private.current_source_plan(auth.uid())) and a.delete_fenced_at is null;
  return base||jsonb_build_object('activeAggregate',g.aggregate_id,'aggregateRevision',a.aggregate_revision,'aggregatePages',g.expected_pages);
 end if;
 return base;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;
