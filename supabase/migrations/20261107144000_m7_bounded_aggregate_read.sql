-- Only immutable aggregate readback receives this function-scoped budget.
create function public.travel_life_history_read(action text,input jsonb)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='60s' as $$
begin
 if action is distinct from 'pull' or input is null or jsonb_typeof(input) is distinct from 'object'
  or input-array['aggregateId','page']<>'{}'::jsonb or jsonb_typeof(input->'aggregateId') is distinct from 'string'
 then return '{"error":"HISTORY_SCHEMA"}';end if;
 return public.travel_life_history(action,input);
end $$;
revoke all on function public.travel_life_history_read(text,jsonb) from public,anon;
grant execute on function public.travel_life_history_read(text,jsonb) to authenticated;
notify pgrst,'reload schema';
