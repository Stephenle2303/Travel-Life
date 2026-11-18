begin;
do $$
begin
 if has_function_privilege('anon','public.travel_life_history_read(text,jsonb)','execute') or not has_function_privilege('authenticated','public.travel_life_history_read(text,jsonb)','execute') then raise exception 'READ_ACCESS';end if;
 if (select prosecdef or not proconfig @> array['statement_timeout=60s','search_path=""'] from pg_proc where oid='public.travel_life_history_read(text,jsonb)'::regprocedure) then raise exception 'READ_CONFIG';end if;
 if public.travel_life_history_read('status','{}')->>'error' is distinct from 'HISTORY_SCHEMA' or public.travel_life_history_read('pull','{"snapshotId":"synthetic","page":0}')->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'READ_ACTION_ESCAPE';end if;
 if public.travel_life_history_read('pull','{"aggregateId":"70000000-0000-4000-8000-000000000001","page":0}')->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'READ_SESSION';end if;
 if has_function_privilege('anon','public.travel_life_history_finalize(text,jsonb)','execute') or not has_function_privilege('authenticated','public.travel_life_history_finalize(text,jsonb)','execute') then raise exception 'FINALIZE_SOURCE_ACCESS';end if;
 if has_function_privilege('authenticated','public.travel_life_history_finalize_worker(uuid,uuid,text,jsonb)','execute') or has_function_privilege('anon','public.travel_life_history_finalize_worker(uuid,uuid,text,jsonb)','execute') or not has_function_privilege('service_role','public.travel_life_history_finalize_worker(uuid,uuid,text,jsonb)','execute') then raise exception 'FINALIZE_WORKER_ACCESS';end if;
 if exists(select 1 from pg_proc where oid in ('public.travel_life_history_finalize(text,jsonb)'::regprocedure,'public.travel_life_history_finalize_worker(uuid,uuid,text,jsonb)'::regprocedure) and (prosecdef or not proconfig @> array['statement_timeout=60s','search_path=""'])) then raise exception 'FINALIZE_CONFIG';end if;
 if public.travel_life_history_finalize('status','{}')->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'FINALIZE_ACTION_ESCAPE';end if;
 if public.travel_life_history_finalize_worker(null,null,'activate','{"phase":"start"}')->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'FINALIZE_PHASE_ESCAPE';end if;
 if public.travel_life_history_finalize_worker(null,null,'plan','{"phase":"commit"}')->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'FINALIZE_WORKER_ACTION_ESCAPE';end if;
 if public.travel_life_history_finalize_worker(null,null,'activate','{"phase":"commit"}')->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'FINALIZE_WORKER_SESSION';end if;
end $$;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('18000000-0000-4000-8000-000000000001','budget@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('28000000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000001',now(),now());
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"28000000-0000-4000-8000-000000000001"}',true);
select public.travel_life_history('status','{}');
select public.travel_life_history('consent','{"mutationId":"38000000-0000-4000-8000-000000000001","generation":1,"history":true,"media":false}');
select public.travel_life_history('register-source','{"mutationId":"38000000-0000-4000-8000-000000000002","generation":1,"sourceId":"48000000-0000-4000-8000-000000000001","installationId":"58000000-0000-4000-8000-000000000001"}');
select public.travel_life_history('begin','{"mutationId":"38000000-0000-4000-8000-000000000003","generation":1,"sourceId":"48000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"68000000-0000-4000-8000-000000000001","pages":1,"schemaVersion":37,"sourceSnapshotRevision":0}');
select public.travel_life_history('page','{"mutationId":"38000000-0000-4000-8000-000000000004","generation":1,"sourceId":"48000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"68000000-0000-4000-8000-000000000001","page":0,"records":[]}');
do $$declare input jsonb:='{"mutationId":"38000000-0000-4000-8000-000000000005","generation":1,"sourceId":"48000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"68000000-0000-4000-8000-000000000001"}';result jsonb;
begin
 result:=public.travel_life_history_finalize('activate',input);
 if result->>'status' is distinct from 'initial' or public.travel_life_history_finalize('activate',input) is distinct from result then raise exception 'FINALIZE_SOURCE_RECEIPT';end if;
 perform set_config('request.jwt.claims','{}',true);
 if public.travel_life_history_finalize('activate',input)->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'FINALIZE_SOURCE_SESSION';end if;
end $$;
select 'PASS: finalization function budgets, invoker/access/action/phase/session guards and immutable source receipt';
rollback;
