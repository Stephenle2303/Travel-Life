-- M2.5 operational evidence intentionally has no subject, request, response,
-- provider, session, or application-data columns. It is writable only by the
-- Edge Function service role and is never exposed through the Data API.
create table private.ai_operational_attempts (
  id bigint generated always as identity primary key,
  outcome text not null check (outcome in ('started', 'proposal', 'unavailable', 'timeout', 'cancelled', 'refused', 'invalid-response')),
  input_tokens integer null check (input_tokens is null or (input_tokens >= 0 and input_tokens <= 2000)),
  output_tokens integer null check (output_tokens is null or (output_tokens >= 0 and output_tokens <= 800)),
  calculated_usd numeric(10, 6) null check (calculated_usd is null or (calculated_usd >= 0 and calculated_usd <= 0.020000)),
  elapsed_millis integer null check (elapsed_millis is null or elapsed_millis >= 0),
  contract_version text not null check (contract_version = 'travel-life-ai-v1'),
  rule_version text not null check (rule_version = 'reconstruction-v1'),
  model_version text not null check (model_version = 'gpt-5.4-mini-2026-03-17'),
  prompt_version text not null check (prompt_version = 'travel-life-ai-prompt-v1'),
  created_at timestamptz not null default now(),
  settled_at timestamptz null
);

alter table private.ai_operational_attempts enable row level security;
revoke all on table private.ai_operational_attempts from public, anon, authenticated;

create function public.open_travel_life_ai_attempt(
  attempt_contract_version text,
  attempt_rule_version text,
  attempt_model_version text,
  attempt_prompt_version text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare attempt_id bigint;
begin
  insert into private.ai_operational_attempts (outcome, contract_version, rule_version, model_version, prompt_version)
  values ('started', attempt_contract_version, attempt_rule_version, attempt_model_version, attempt_prompt_version)
  returning id into attempt_id;
  return attempt_id;
end;
$$;

create function public.settle_travel_life_ai_attempt(
  attempt_id bigint,
  attempt_outcome text,
  attempt_input_tokens integer,
  attempt_output_tokens integer,
  attempt_calculated_usd numeric,
  attempt_elapsed_millis integer
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.ai_operational_attempts set
    outcome = attempt_outcome,
    input_tokens = attempt_input_tokens,
    output_tokens = attempt_output_tokens,
    calculated_usd = attempt_calculated_usd,
    elapsed_millis = attempt_elapsed_millis,
    settled_at = now()
  where id = attempt_id and outcome = 'started';
end;
$$;

revoke all on function public.open_travel_life_ai_attempt(text, text, text, text) from public, anon, authenticated;
revoke all on function public.settle_travel_life_ai_attempt(bigint, text, integer, integer, numeric, integer) from public, anon, authenticated;
grant execute on function public.open_travel_life_ai_attempt(text, text, text, text) to service_role;
grant execute on function public.settle_travel_life_ai_attempt(bigint, text, integer, integer, numeric, integer) to service_role;
