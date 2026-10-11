-- The Edge Function validates an anonymous user JWT, then invokes this helper
-- through its server-only Supabase admin client. Clients cannot reserve quota
-- directly or starve the shared deployment budget.
revoke all on function public.reserve_travel_life_ai_quota(integer, integer, numeric) from public, anon, authenticated;
drop function public.reserve_travel_life_ai_quota(integer, integer, numeric);

create function public.reserve_travel_life_ai_quota(
  requested_subject uuid,
  requested_input_tokens integer,
  requested_output_tokens integer,
  requested_usd numeric
) returns table (reserved boolean, reason text, remaining_requests integer, usd_reserved numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_subject uuid := requested_subject;
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

revoke all on function public.reserve_travel_life_ai_quota(uuid, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.reserve_travel_life_ai_quota(uuid, integer, integer, numeric) to service_role;
