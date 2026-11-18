-- Local draft after source-impact. No hosted deployment is implied.
-- No FK to Auth: a minimal fence and receipt must survive identity deletion.
create table history_private.account_deletion (
 owner_id uuid primary key,mutation_id uuid not null,request_digest text not null,
 ticket_digest text not null unique,state text not null check(state in ('pending','metadata-purged','completed')),
 lease_id uuid,lease_until timestamptz,requested_at timestamptz not null default now(),completed_at timestamptz
);
alter table history_private.account_deletion enable row level security;
revoke all on history_private.account_deletion from public,anon,authenticated;
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_account_deletion;
revoke all on function history_private.pre_account_deletion(text,jsonb) from public,anon,authenticated;

create function public.travel_life_history(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid();a history_private.account%rowtype;old history_private.account_deletion%rowtype;
 base jsonb;mutation uuid;ticket_hash text;request_hash text;sid uuid;
begin
 if exists(select 1 from history_private.account_deletion where owner_id=subject) then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if action<>'delete-account' then return history_private.pre_account_deletion(action,input);end if;
 base:=history_private.account_action('status','{}');if base ? 'error' then return base;end if;
 sid:=(auth.jwt()->>'session_id')::uuid;
 if not exists(select 1 from auth.sessions where id=sid and user_id=subject and created_at>now()-interval '10 minutes') then return jsonb_build_object('error','ACCOUNT_REAUTH');end if;
 if input is null or jsonb_typeof(input)<>'object' or input-array['mutationId','generation','ticket']<>'{}'::jsonb
  or input->>'ticket' is null or input->>'ticket'!~'^[a-f0-9]{64}$' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 select * into a from history_private.account where owner_id=subject for update;
 -- Recheck after the account lock: concurrent requests cannot replace a receipt.
 if exists(select 1 from history_private.account_deletion where owner_id=subject) then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 ticket_hash:=encode(extensions.digest(convert_to(input->>'ticket','UTF8'),'sha256'),'hex');
 request_hash:=encode(extensions.digest(convert_to(input::text,'UTF8'),'sha256'),'hex');
 insert into history_private.account_deletion(owner_id,mutation_id,request_digest,ticket_digest,state) values(subject,mutation,request_hash,ticket_hash,'pending');
 -- Existing triggers fence aggregates and queue every private object for cleanup.
 update history_private.account set generation=generation+1,delete_fenced_at=now(),history_consent=false,media_consent=false,active_snapshot=null where owner_id=subject;
 update auth.sessions set not_after=least(coalesce(not_after,now()),now()) where user_id=subject;
 return jsonb_build_object('status','pending');
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

-- A 256-bit capability exposes only one fixed state; no subject or content.
create function public.travel_life_deletion_status(ticket text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare deletion_state text;
begin
 if ticket is null or ticket!~'^[a-f0-9]{64}$' then return '{"status":"unavailable"}'::jsonb;end if;
 select state into deletion_state from history_private.account_deletion where ticket_digest=encode(extensions.digest(convert_to(ticket,'UTF8'),'sha256'),'hex');
 return jsonb_build_object('status',case when deletion_state='completed' then 'completed' when deletion_state is not null then 'pending' else 'unavailable' end);
end $$;
revoke all on function public.travel_life_deletion_status(text) from public;
grant execute on function public.travel_life_deletion_status(text) to anon,authenticated;

create function public.travel_life_account_deletion(action text,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job history_private.account_deletion%rowtype;items jsonb:='[]';token uuid;table_name text;
begin
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>4096 then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if action='lease' then
  if input<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  for job in select d.* from history_private.account_deletion d where d.state<>'completed' and (d.lease_until is null or d.lease_until<now())
   order by d.requested_at,d.owner_id for update of d skip locked limit 10 loop
   token:=gen_random_uuid();update history_private.account_deletion set lease_id=token,lease_until=now()+interval '5 minutes' where owner_id=job.owner_id;
   items:=items||jsonb_build_array(jsonb_build_object('owner',job.owner_id,'leaseId',token));
  end loop;
  return jsonb_build_object('status','complete','items',items);
 end if;
 if input-array['owner','leaseId']<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 select * into job from history_private.account_deletion where owner_id=(input->>'owner')::uuid and lease_id=(input->>'leaseId')::uuid and lease_until>now() for update;
 if not found then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if action='purge' then
  if exists(select 1 from history_private.media_cleanup where owner_id=job.owner_id) or exists(select 1 from history_private.media_artifact where owner_id=job.owner_id) then return jsonb_build_object('status','pending');end if;
  -- Fixed private tables only; identifiers never come from caller input.
  foreach table_name in array array['owner_proposal','owner_journal','source_preview_receipt','media_receipt','media_attachment','snapshot','aggregate','identity_mapping','source','receipt','revoked_session'] loop
   if to_regclass(format('history_private.%I',table_name)) is not null then execute format('delete from history_private.%I where owner_id=$1',table_name) using job.owner_id;end if;
  end loop;
  delete from history_private.account where owner_id=job.owner_id;
  update history_private.account_deletion set state='metadata-purged' where owner_id=job.owner_id;
  return jsonb_build_object('status','metadata-purged');
 elsif action='complete' then
  if job.state<>'metadata-purged' or exists(select 1 from auth.users where id=job.owner_id) then return jsonb_build_object('error','HISTORY_INCOMPLETE');end if;
  update history_private.account_deletion set state='completed',completed_at=now(),lease_id=null,lease_until=null where owner_id=job.owner_id;
  return jsonb_build_object('status','completed');
 end if;
 return jsonb_build_object('error','HISTORY_SCHEMA');
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_account_deletion(text,jsonb) from public,anon,authenticated;
grant execute on function public.travel_life_account_deletion(text,jsonb) to service_role;
