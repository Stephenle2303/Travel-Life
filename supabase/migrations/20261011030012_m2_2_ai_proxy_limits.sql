-- M2.2 stores only anonymous-subject quota and sanitized accounting metadata.
-- Request bodies, provider responses, source references and raw traces never enter
-- these tables. The quota helper has the smallest necessary definer scope: it uses
-- the authenticated caller from auth.uid(), accepts only bounded constants, and
-- holds the global row lock which RLS alone cannot safely coordinate.
create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.ai_daily_usage (
  subject_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  requests_reserved integer not null default 0 check (requests_reserved >= 0),
  input_tokens_reserved integer not null default 0 check (input_tokens_reserved >= 0),
  output_tokens_reserved integer not null default 0 check (output_tokens_reserved >= 0),
  primary key (subject_id, usage_day)
);

create table if not exists private.ai_deployment_daily_usage (
  usage_day date primary key,
  usd_reserved numeric(10, 4) not null default 0 check (usd_reserved >= 0)
);

alter table private.ai_daily_usage enable row level security;
alter table private.ai_deployment_daily_usage enable row level security;

-- Clients have no direct table access. The Edge Function invokes the helper with
-- the caller JWT; the helper itself rejects a missing subject.
revoke all on table private.ai_daily_usage from anon, authenticated;
revoke all on table private.ai_deployment_daily_usage from anon, authenticated;

create or replace function public.reserve_travel_life_ai_quota(
  requested_input_tokens integer,
  requested_output_tokens integer,
  requested_usd numeric
) returns table (reserved boolean, reason text, remaining_requests integer, usd_reserved numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_subject uuid := auth.uid();
  current_day date := current_date;
  next_request_count integer;
  next_usd_reserved numeric;
begin
  if current_subject is null then
    return query select false, 'unauthenticated'::text, 0, 0::numeric;
    return;
  end if;
  if requested_input_tokens < 0 or requested_input_tokens > 2000
     or requested_output_tokens < 0 or requested_output_tokens > 800
     or requested_usd < 0 or requested_usd > 0.0200 then
    return query select false, 'invalid-reservation'::text, 0, 0::numeric;
    return;
  end if;

  insert into private.ai_daily_usage (subject_id, usage_day)
  values (current_subject, current_day)
  on conflict do nothing;
  insert into private.ai_deployment_daily_usage (usage_day)
  values (current_day)
  on conflict do nothing;

  -- Lock both rows in a stable order so concurrent anonymous sessions cannot
  -- oversubscribe the per-subject or deployment-wide limits.
  perform 1 from private.ai_daily_usage
    where subject_id = current_subject and usage_day = current_day for update;
  select usd_reserved into next_usd_reserved from private.ai_deployment_daily_usage
    where usage_day = current_day for update;
  select requests_reserved + 1 into next_request_count from private.ai_daily_usage
    where subject_id = current_subject and usage_day = current_day;

  if next_request_count > 10 then
    return query select false, 'daily-request-limit'::text, 0, next_usd_reserved;
    return;
  end if;
  if next_usd_reserved + requested_usd > 5.0000 then
    return query select false, 'daily-budget-limit'::text, 10 - (next_request_count - 1), next_usd_reserved;
    return;
  end if;

  update private.ai_daily_usage set
    requests_reserved = requests_reserved + 1,
    input_tokens_reserved = input_tokens_reserved + requested_input_tokens,
    output_tokens_reserved = output_tokens_reserved + requested_output_tokens
    where subject_id = current_subject and usage_day = current_day;
  update private.ai_deployment_daily_usage set usd_reserved = usd_reserved + requested_usd
    where usage_day = current_day;

  return query select true, null::text, 10 - next_request_count, next_usd_reserved + requested_usd;
end;
$$;

revoke all on function public.reserve_travel_life_ai_quota(integer, integer, numeric) from public;
grant execute on function public.reserve_travel_life_ai_quota(integer, integer, numeric) to authenticated;
