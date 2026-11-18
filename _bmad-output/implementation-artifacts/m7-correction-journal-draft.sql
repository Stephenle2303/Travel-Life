-- Local draft after M6 deletion; no hosted migration or enablement implied.
create table history_private.owner_journal(owner_id uuid primary key references history_private.account(owner_id),revision bigint not null default 0,changes jsonb not null default '{"rows":[],"deleted":[]}');
create table history_private.owner_proposal(owner_id uuid not null references history_private.account(owner_id),mutation_id uuid not null,digest text not null,base_aggregate uuid not null,expected_revision bigint not null,source_plan jsonb not null,changes jsonb not null,accepted_before jsonb not null,state text not null check(state in ('accepted','conflict','resolved')),result jsonb not null,primary key(owner_id,mutation_id));
alter table history_private.owner_journal enable row level security;
alter table history_private.owner_proposal enable row level security;
revoke all on history_private.owner_journal,history_private.owner_proposal from public,anon,authenticated;

create function history_private.valid_owner_changes(changes jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare item jsonb;seen text[]:='{}';identity text;
begin
 if changes is null or jsonb_typeof(changes)<>'object' or changes-array['rows','deleted']<>'{}'::jsonb or jsonb_typeof(changes->'rows') is distinct from 'array' or jsonb_typeof(changes->'deleted') is distinct from 'array'
  or jsonb_array_length(changes->'rows')+jsonb_array_length(changes->'deleted')>100 or octet_length(changes::text)>450000 then return false;end if;
 for item in select * from jsonb_array_elements(changes->'rows') loop
  if item->>'kind' not in ('overlay','journey-correction','memory-correction','privacy','home','manual','replay') or not history_private.valid_record(item) then return false;end if;
  identity:=jsonb_build_array(item->>'kind',item->>'key')::text;if identity=any(seen) then return false;end if;seen:=array_append(seen,identity);
 end loop;
 for item in select * from jsonb_array_elements(changes->'deleted') loop
  if jsonb_typeof(item)<>'object' or item-array['kind','key']<>'{}'::jsonb or item->>'kind' not in ('manual','home','replay') or item->>'key' is null or length(item->>'key') not between 1 and 1024 then return false;end if;
  identity:=jsonb_build_array(item->>'kind',item->>'key')::text;if identity=any(seen) then return false;end if;seen:=array_append(seen,identity);
 end loop;return true;
end $$;
revoke all on function history_private.valid_owner_changes(jsonb) from public,anon,authenticated;
create function history_private.combine_owner_changes(previous jsonb,delta jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('rows',coalesce((select jsonb_agg(r order by r->>'kind',r->>'key') from (
  select r from jsonb_array_elements(previous->'rows') r where not exists(select 1 from jsonb_array_elements((delta->'rows')||(delta->'deleted')) d where d->>'kind'=r->>'kind' and d->>'key'=r->>'key')
  union all select r from jsonb_array_elements(delta->'rows') r) q),'[]'::jsonb),
 'deleted',coalesce((select jsonb_agg(r order by r->>'kind',r->>'key') from (
  select r from jsonb_array_elements(previous->'deleted') r where not exists(select 1 from jsonb_array_elements((delta->'rows')||(delta->'deleted')) d where d->>'kind'=r->>'kind' and d->>'key'=r->>'key')
  union all select r from jsonb_array_elements(delta->'deleted') r) q),'[]'::jsonb))
$$;
revoke all on function history_private.combine_owner_changes(jsonb,jsonb) from public,anon,authenticated;
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_owner_journal;
revoke all on function history_private.pre_owner_journal(text,jsonb) from public,anon,authenticated;
create function public.travel_life_history(action text,input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare a history_private.account%rowtype;g history_private.aggregate%rowtype;j history_private.owner_journal%rowtype;p history_private.owner_proposal%rowtype;
 base jsonb;mutation uuid;digest text;delta jsonb;combined jsonb;accepted_context jsonb;result jsonb;page_index integer;total bigint;accepted boolean;resolving boolean;privacy_max bigint;
begin
 if action='pull' and input ? 'aggregateId' and exists(select 1 from history_private.owner_journal journal join history_private.account account on account.owner_id=journal.owner_id join history_private.aggregate aggregate on aggregate.owner_id=account.owner_id and aggregate.aggregate_id=account.active_aggregate where account.owner_id=auth.uid() and journal.revision>coalesce((aggregate.metadata->>'ownerRevision')::bigint,0)) then
  base:=history_private.pre_owner_journal('status','{}');if base ? 'error' then return base;end if;return jsonb_build_object('error','HISTORY_STALE');
 end if;
 if action not in ('status','correction-propose','correction-conflicts','correction-resolve') then return history_private.pre_owner_journal(action,input);end if;
 base:=history_private.pre_owner_journal('status','{}');if base ? 'error' then return base;end if;
 select * into a from history_private.account where owner_id=auth.uid() for update;
 select * into j from history_private.owner_journal where owner_id=a.owner_id;
 if action='status' then
  select * into g from history_private.aggregate where owner_id=a.owner_id and aggregate_id=a.active_aggregate and state='active';
  if coalesce(j.revision,0)>coalesce((g.metadata->>'ownerRevision')::bigint,0) then base:=base||'{"activeAggregate":null,"activeSnapshot":null,"aggregatePages":null,"pendingMerge":true,"ownerPending":true}'::jsonb;end if;
  return base||jsonb_build_object('ownerRevision',coalesce(j.revision,0),'correctionConflicts',(select count(*) from history_private.owner_proposal where owner_id=a.owner_id and state='conflict'));
 end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>460000 then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if action='correction-conflicts' then
  if input-array['page']<>'{}'::jsonb or input->>'page' is null or input->>'page'!~'^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  page_index:=(input->>'page')::integer;select count(*) into total from history_private.owner_proposal where owner_id=a.owner_id and state='conflict';
  if page_index>=greatest(1,total) then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select jsonb_build_object('mutationId',mutation_id,'proposed',changes,'accepted',accepted_before) into result from history_private.owner_proposal where owner_id=a.owner_id and state='conflict' order by mutation_id limit 1 offset page_index;
  return jsonb_build_object('status','complete','page',page_index,'pages',greatest(1,total),'ownerRevision',coalesce(j.revision,0),'accountGeneration',a.generation,'aggregateId',a.active_aggregate,'proposal',result);
 end if;
 mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 digest:=encode(extensions.digest(convert_to(action||input::text,'UTF8'),'sha256'),'hex');
 select * into p from history_private.owner_proposal where owner_id=a.owner_id and mutation_id=mutation;
 if found then if p.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT');end if;return p.result;end if;
 if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT');end if;
 if input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 resolving:=action='correction-resolve';
 if resolving then
  if input-array['mutationId','generation','expectedOwnerRevision','proposalId','choice']<>'{}'::jsonb or input->>'choice' not in ('accepted','proposed') then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select * into p from history_private.owner_proposal where owner_id=a.owner_id and mutation_id=(input->>'proposalId')::uuid and state='conflict';
  if not found then return jsonb_build_object('error','HISTORY_STALE');end if;
  if p.source_plan is distinct from history_private.current_source_plan(a.owner_id) then return jsonb_build_object('error','HISTORY_FENCED');end if;
  if input->>'expectedOwnerRevision' is distinct from coalesce(j.revision,0)::text then return jsonb_build_object('error','HISTORY_CONFLICT');end if;
  delta:=case when input->>'choice'='proposed' then p.changes else '{"rows":[],"deleted":[]}'::jsonb end;
  -- Two offline privacy proposals can share a provisional append key. Resolution
  -- is a new fresh-CAS owner action: append its immutable policy actions after all
  -- accepted actions rather than replacing an unrelated policy by numeric row key.
  select greatest(1000000000,coalesce(max((r->'value'->>'revision')::bigint),0)) into privacy_max from (
   select r from history_private.aggregate_page pg cross join lateral jsonb_array_elements(pg.records) r where pg.owner_id=a.owner_id and pg.aggregate_id=a.active_aggregate
   union all select r from jsonb_array_elements(coalesce(j.changes->'rows','[]'::jsonb)) r
  ) policies where r->>'kind'='privacy';
  if privacy_max+(select count(*) from jsonb_array_elements(delta->'rows') r where r->>'kind'='privacy')>9007199254740991 then return '{"error":"HISTORY_QUOTA"}';end if;
  select jsonb_set(delta,'{rows}',coalesce(jsonb_agg(r order by ordinal),'[]'::jsonb)) into delta from (
   select r,ordinal from jsonb_array_elements(delta->'rows') with ordinality q(r,ordinal) where r->>'kind'<>'privacy'
   union all
   select jsonb_set(jsonb_set(r,'{key}',to_jsonb((privacy_max+row_number() over(order by (r->'value'->>'revision')::bigint))::text)),'{value,revision}',to_jsonb(privacy_max+row_number() over(order by (r->'value'->>'revision')::bigint))),ordinal
   from jsonb_array_elements(delta->'rows') with ordinality q(r,ordinal) where r->>'kind'='privacy'
  ) appended;
 else
  if input-array['mutationId','generation','baseAggregate','expectedOwnerRevision','changes']<>'{}'::jsonb or input->>'expectedOwnerRevision' is null or input->>'expectedOwnerRevision'!~'^[0-9]{1,16}$' or not history_private.valid_owner_changes(input->'changes') then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select * into g from history_private.aggregate where owner_id=a.owner_id and aggregate_id=(input->>'baseAggregate')::uuid and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
  if not found or not history_private.readable_prior_aggregate(a.owner_id,g.source_plan) then return jsonb_build_object('error','HISTORY_FENCED');end if;
  delta:=input->'changes';
 end if;
 accepted:=input->>'expectedOwnerRevision'=coalesce(j.revision,0)::text;
 select jsonb_build_object('rows',coalesce(jsonb_agg(row_value order by row_value->>'kind',row_value->>'key'),'[]'::jsonb),'deleted','[]'::jsonb) into accepted_context from (
  select coalesce((select r from jsonb_array_elements(j.changes->'rows') r where r->>'kind'=d->>'kind' and r->>'key'=d->>'key'),
   (select r from history_private.aggregate_page pg cross join lateral jsonb_array_elements(pg.records) r where pg.owner_id=a.owner_id and pg.aggregate_id=a.active_aggregate and r->>'kind'=d->>'kind' and r->>'key'=d->>'key')) row_value
  from jsonb_array_elements((delta->'rows')||(delta->'deleted')) d
  where not exists(select 1 from jsonb_array_elements(j.changes->'deleted') r where r->>'kind'=d->>'kind' and r->>'key'=d->>'key')
 ) current_target where row_value is not null;
 if accepted then
  combined:=history_private.combine_owner_changes(coalesce(j.changes,'{"rows":[],"deleted":[]}'::jsonb),delta);
  if octet_length(combined::text)>400000 or jsonb_array_length(combined->'rows')+jsonb_array_length(combined->'deleted')>10000 then return jsonb_build_object('error','HISTORY_QUOTA');end if;
  insert into history_private.owner_journal(owner_id,revision,changes) values(a.owner_id,coalesce(j.revision,0)+1,combined) on conflict(owner_id) do update set revision=excluded.revision,changes=excluded.changes;
  update history_private.account set revision=revision+1 where owner_id=a.owner_id;
  result:=jsonb_build_object('status','accepted','ownerRevision',coalesce(j.revision,0)+1);
  if resolving then update history_private.owner_proposal set state='resolved' where owner_id=a.owner_id and mutation_id=p.mutation_id;end if;
 else result:=jsonb_build_object('status','conflict','ownerRevision',coalesce(j.revision,0));end if;
 insert into history_private.owner_proposal(owner_id,mutation_id,digest,base_aggregate,expected_revision,source_plan,changes,accepted_before,state,result)
 values(a.owner_id,mutation,digest,coalesce(a.active_aggregate,g.aggregate_id),(input->>'expectedOwnerRevision')::bigint,history_private.current_source_plan(a.owner_id),delta,accepted_context,case when accepted then 'accepted' else 'conflict' end,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

alter function history_private.worker_action(uuid,uuid,text,jsonb) rename to pre_owner_worker;
create function history_private.worker_action(subject uuid,sid uuid,action text,input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;j history_private.owner_journal%rowtype;
begin
 result:=history_private.pre_owner_worker(subject,sid,action,input);
 if action='plan' and result->>'status'='planned' then
  select * into j from history_private.owner_journal where owner_id=subject;
  return result||jsonb_build_object('ownerRevision',coalesce(j.revision,0),'ownerChanges',coalesce(j.changes,'{"rows":[],"deleted":[]}'::jsonb));
 end if;return result;
end $$;
revoke all on function history_private.worker_action(uuid,uuid,text,jsonb) from public,anon,authenticated;

alter function history_private.media_scope(uuid,uuid,jsonb) rename to pre_owner_media_scope;
create function history_private.media_scope(subject uuid,source uuid,target jsonb) returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from history_private.owner_journal journal join history_private.account account on account.owner_id=journal.owner_id join history_private.aggregate aggregate on aggregate.owner_id=account.owner_id and aggregate.aggregate_id=account.active_aggregate where account.owner_id=subject and journal.revision>coalesce((aggregate.metadata->>'ownerRevision')::bigint,0))
 and history_private.pre_owner_media_scope(subject,source,target)
$$;
revoke all on function history_private.media_scope(uuid,uuid,jsonb) from public,anon,authenticated;
