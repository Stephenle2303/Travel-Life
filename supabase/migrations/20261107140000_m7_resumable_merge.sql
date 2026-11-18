-- Durable private CPU split. No client can supply prepared content or a phase.
create table history_private.merge_checkpoint (
 owner_id uuid not null references history_private.account(owner_id) on delete cascade,
 operation_id uuid not null,
 domain_digest text not null check(domain_digest ~ '^[a-f0-9]{64}$'),
 base jsonb not null check(jsonb_typeof(base)='object' and octet_length(base::text)<=400000),
 expected_pages integer not null check(expected_pages between 1 and 10000),
 state text not null default 'prepare' check(state in ('prepare','build','finalize')),
 output_pages integer check(output_pages between 1 and 10000),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 primary key(owner_id,operation_id)
);
create table history_private.merge_checkpoint_page (
 owner_id uuid not null,
 operation_id uuid not null,
 page_number integer not null check(page_number between 0 and 9999),
 records jsonb not null check(jsonb_typeof(records)='array' and jsonb_array_length(records)<=100 and octet_length(records::text)<=400000),
 content_digest text not null check(content_digest ~ '^[a-f0-9]{64}$'),
 primary key(owner_id,operation_id,page_number),
 foreign key(owner_id,operation_id) references history_private.merge_checkpoint(owner_id,operation_id) on delete cascade
);
-- A content-free expired-operation receipt prevents silently rebasing an old
-- operation after its private prepared data has been removed.
create table history_private.expired_merge_checkpoint (
 owner_id uuid not null references history_private.account(owner_id) on delete cascade,
 operation_id uuid not null,
 primary key(owner_id,operation_id)
);
alter table history_private.merge_checkpoint enable row level security;
alter table history_private.merge_checkpoint_page enable row level security;
alter table history_private.expired_merge_checkpoint enable row level security;
revoke all on history_private.merge_checkpoint,history_private.merge_checkpoint_page,history_private.expired_merge_checkpoint from public,anon,authenticated,service_role;

create function history_private.checkpoint_action(subject uuid,sid uuid,action text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 operation uuid; domain text; live_plan jsonb; live_base jsonb;
 job history_private.merge_checkpoint%rowtype;
 staged history_private.aggregate%rowtype;
 prior_page history_private.merge_checkpoint_page%rowtype;
 page_index integer; page_count integer; total bigint; body_bytes integer; digest text; retired_reason text;
begin
 -- The original service boundary takes the account lock and checks live Auth,
 -- consent, deletion, source snapshot generations and account revision.
 if not history_private.live_worker_owner(subject,sid) then return '{"error":"ACCOUNT_SESSION"}';end if;
 if input is null or jsonb_typeof(input) is distinct from 'object' or octet_length(input::text)>524288
  or action is null or action not in ('status','start','page','seal','read','ready')
  or jsonb_typeof(input->'operationId') is distinct from 'string'
  or jsonb_typeof(input->'domainDigest') is distinct from 'string'
  or input->>'domainDigest' !~ '^[a-f0-9]{64}$' then return '{"error":"HISTORY_SCHEMA"}';end if;
 operation:=(input->>'operationId')::uuid; domain:=input->>'domainDigest';
 if (action in ('status','seal') and input-array['operationId','domainDigest']<>'{}'::jsonb)
  or (action='start' and input-array['operationId','domainDigest','base','pages']<>'{}'::jsonb)
  or (action='page' and input-array['operationId','domainDigest','page','records']<>'{}'::jsonb)
  or (action='read' and input-array['operationId','domainDigest','page']<>'{}'::jsonb)
  or (action='ready' and input-array['operationId','domainDigest','pages']<>'{}'::jsonb)
 then return '{"error":"HISTORY_SCHEMA"}';end if;
 live_plan:=history_private.worker_action(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if live_plan ? 'error' then return live_plan;end if;
 if live_plan->>'status'='complete' then
  -- The aggregate receipt is now the immutable retry authority. Release its
  -- prepared private body immediately instead of occupying the live-job quota.
  delete from history_private.merge_checkpoint where owner_id=subject and operation_id=operation;
  return live_plan;
 end if;
 if live_plan->>'status' is distinct from 'planned' then return '{"error":"HISTORY_STALE"}';end if;
 -- Owner changes can include a full Replay. They belong only in the chunked
 -- prepared envelope; ownerRevision is the small immutable authority fence.
 live_base:=live_plan-array['status','ownerChanges'];
 select * into job from history_private.merge_checkpoint where owner_id=subject and operation_id=operation for update;
 if found and job.base->'accountGeneration' is distinct from live_base->'accountGeneration' then retired_reason:='HISTORY_FENCED';
 elsif found and (job.expires_at<=now() or job.domain_digest<>domain or job.base is distinct from live_base) then retired_reason:='HISTORY_STALE';end if;
 -- A pre-checkpoint worker may have left derived staging under the same UUID.
 -- Its old domain/header cannot be resumed or silently overwritten by this one.
 if job.operation_id is null and exists(select 1 from history_private.aggregate where owner_id=subject and aggregate_id=operation and state='staging') then retired_reason:='HISTORY_STALE';end if;
 if action in ('status','start') then
  -- A current server plan is authoritative for this owner's superseded bases.
  -- A different worker version may retire only its exact operation's digest;
  -- it must never invalidate another operation merely for using a newer domain.
  insert into history_private.expired_merge_checkpoint(owner_id,operation_id)
   select owner_id,operation_id from history_private.merge_checkpoint where owner_id=subject
    and (expires_at<=now() or base is distinct from live_base or (operation_id=operation and domain_digest<>domain))
   on conflict do nothing;
 end if;
 if retired_reason is not null then
  insert into history_private.expired_merge_checkpoint values(subject,operation) on conflict do nothing;
 end if;
 -- Only derived uncommitted output is retired. Completed aggregates remain the
 -- original receipt authority and are never removed by checkpoint maintenance.
 delete from history_private.aggregate g where g.owner_id=subject and g.state='staging'
  and (action in ('status','start') or g.aggregate_id=operation)
  and exists(select 1 from history_private.expired_merge_checkpoint r where r.owner_id=g.owner_id and r.operation_id=g.aggregate_id);
 delete from history_private.merge_checkpoint c where c.owner_id=subject
  and (action in ('status','start') or c.operation_id=operation)
  and exists(select 1 from history_private.expired_merge_checkpoint r where r.owner_id=c.owner_id and r.operation_id=c.operation_id);
 if retired_reason is not null then return jsonb_build_object('error',retired_reason);end if;
 if exists(select 1 from history_private.expired_merge_checkpoint where owner_id=subject and operation_id=operation) then return '{"error":"HISTORY_STALE"}';end if;
 if action='status' then
  if job.operation_id is null then return jsonb_build_object('status','prepare','base',live_base,'preparedPages',0);end if;
  return jsonb_build_object('status',job.state,'base',job.base,'preparedPages',job.expected_pages,'outputPages',job.output_pages);
 elsif action='start' then
  if jsonb_typeof(input->'base') is distinct from 'object' or input->'base' is distinct from live_base
   then return '{"error":"HISTORY_STALE"}';end if;
  if jsonb_typeof(input->'pages') is distinct from 'number' or input->>'pages' !~ '^[0-9]{1,5}$'
   or (input->>'pages')::integer not between 1 and 10000 then return '{"error":"HISTORY_SCHEMA"}';end if;
  page_count:=(input->>'pages')::integer;
  if octet_length(live_base::text)>400000 then return '{"error":"HISTORY_QUOTA"}';end if;
  if job.operation_id is not null then
   if job.expected_pages<>page_count then return '{"error":"HISTORY_CONFLICT"}';end if;
  else
   if (select count(*) from history_private.merge_checkpoint where owner_id=subject)>=20 then return '{"error":"HISTORY_QUOTA"}';end if;
   if (select count(*) from history_private.merge_checkpoint where owner_id=subject)
    +(select count(*) from history_private.expired_merge_checkpoint where owner_id=subject)>=10000 then return '{"error":"HISTORY_QUOTA"}';end if;
   insert into history_private.merge_checkpoint(owner_id,operation_id,domain_digest,base,expected_pages)
    values(subject,operation,domain,live_base,page_count);
  end if;
  return jsonb_build_object('status',coalesce(job.state,'prepare'),'base',live_base,'preparedPages',page_count);
 end if;
 if job.operation_id is null then return '{"error":"HISTORY_INCOMPLETE"}';end if;
 if action in ('page','read') then
  if jsonb_typeof(input->'page') is distinct from 'number' or input->>'page' !~ '^[0-9]{1,5}$' then return '{"error":"HISTORY_SCHEMA"}';end if;
  page_index:=(input->>'page')::integer;
  if page_index>=job.expected_pages then return '{"error":"HISTORY_SCHEMA"}';end if;
  select * into prior_page from history_private.merge_checkpoint_page where owner_id=subject and operation_id=operation and page_number=page_index;
  if action='read' then
   if job.state='prepare' or prior_page.operation_id is null then return '{"error":"HISTORY_INCOMPLETE"}';end if;
   return jsonb_build_object('records',prior_page.records);
  end if;
  if jsonb_typeof(input->'records') is distinct from 'array' then return '{"error":"HISTORY_SCHEMA"}';end if;
  if jsonb_array_length(input->'records')>100 then return '{"error":"HISTORY_QUOTA"}';end if;
  body_bytes:=octet_length((input->'records')::text);
  if body_bytes>400000 then return '{"error":"HISTORY_QUOTA"}';end if;
  digest:=encode(extensions.digest(convert_to((input->'records')::text,'UTF8'),'sha256'),'hex');
  if prior_page.operation_id is not null then
   if prior_page.content_digest<>digest then return '{"error":"HISTORY_CONFLICT"}';end if;
  else
   if job.state<>'prepare' then return '{"error":"HISTORY_STALE"}';end if;
   select coalesce(sum(octet_length(records::text)),0) into total from history_private.merge_checkpoint_page where owner_id=subject;
   if total+body_bytes>67108864 then return '{"error":"HISTORY_QUOTA"}';end if;
   insert into history_private.merge_checkpoint_page values(subject,operation,page_index,input->'records',digest);
  end if;
  return jsonb_build_object('status',job.state,'page',page_index);
 elsif action='seal' then
  select count(*) into total from history_private.merge_checkpoint_page where owner_id=subject and operation_id=operation;
  if total<>job.expected_pages then return '{"error":"HISTORY_INCOMPLETE"}';end if;
  if job.state='prepare' then update history_private.merge_checkpoint set state='build' where owner_id=subject and operation_id=operation;end if;
  return jsonb_build_object('status',case when job.state='prepare' then 'build' else job.state end,'base',job.base,'preparedPages',job.expected_pages);
 elsif action='ready' then
  if jsonb_typeof(input->'pages') is distinct from 'number' or input->>'pages' !~ '^[0-9]{1,5}$'
   or (input->>'pages')::integer not between 1 and 10000 then return '{"error":"HISTORY_SCHEMA"}';end if;
  if job.state='prepare' then return '{"error":"HISTORY_INCOMPLETE"}';end if;
  page_count:=(input->>'pages')::integer;
  select * into staged from history_private.aggregate where owner_id=subject and aggregate_id=operation for update;
  if not found or staged.state<>'staging' or staged.expected_pages<>page_count then return '{"error":"HISTORY_INCOMPLETE"}';end if;
  if staged.source_plan is distinct from job.base->'sourcePlan'
   or staged.account_generation::text is distinct from job.base->>'accountGeneration'
   or staged.expected_account_revision::text is distinct from job.base->>'expectedAccountRevision'
   or staged.metadata->>'ownerRevision' is distinct from job.base->>'ownerRevision'
   or staged.metadata->>'domainSourceDigest' is distinct from job.domain_digest
   then return '{"error":"HISTORY_STALE"}';end if;
  select count(*) into total from history_private.aggregate_page where owner_id=subject and aggregate_id=operation;
  if total<>page_count or exists(select 1 from history_private.aggregate_page where owner_id=subject and aggregate_id=operation and page_number not between 0 and page_count-1) then return '{"error":"HISTORY_INCOMPLETE"}';end if;
  if job.output_pages is not null and job.output_pages<>page_count then return '{"error":"HISTORY_CONFLICT"}';end if;
  update history_private.merge_checkpoint set state='finalize',output_pages=page_count where owner_id=subject and operation_id=operation;
  return jsonb_build_object('status','finalize','base',job.base,'preparedPages',job.expected_pages,'outputPages',page_count);
 end if;
 return '{"error":"HISTORY_SCHEMA"}';
exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return '{"error":"HISTORY_SCHEMA"}';
 when program_limit_exceeded then return '{"error":"HISTORY_QUOTA"}';
 when unique_violation then return '{"error":"HISTORY_CONFLICT"}';
end $$;
revoke all on function history_private.checkpoint_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function history_private.checkpoint_action(uuid,uuid,text,jsonb) to service_role;
create function public.travel_life_history_checkpoint(verified_owner uuid,verified_session uuid,action text,input jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select history_private.checkpoint_action(verified_owner,verified_session,action,input)
$$;
revoke all on function public.travel_life_history_checkpoint(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.travel_life_history_checkpoint(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
