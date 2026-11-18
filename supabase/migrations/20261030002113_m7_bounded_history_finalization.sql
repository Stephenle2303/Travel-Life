-- PostgREST hoists these function budgets before starting the transaction.
-- Only final activation receives extra time; role/global budgets stay unchanged.
create function public.travel_life_history_finalize(action text,input jsonb)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='60s' as $$
begin
 if action is distinct from 'activate' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 return public.travel_life_history(action,input);
end $$;
revoke all on function public.travel_life_history_finalize(text,jsonb) from public,anon;
grant execute on function public.travel_life_history_finalize(text,jsonb) to authenticated;

create function public.travel_life_history_finalize_worker(verified_owner uuid,verified_session uuid,action text,input jsonb)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='60s' as $$
begin
 if action is distinct from 'activate' or input->>'phase' is distinct from 'commit' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 return public.travel_life_history_worker(verified_owner,verified_session,action,input);
end $$;
revoke all on function public.travel_life_history_finalize_worker(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.travel_life_history_finalize_worker(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
