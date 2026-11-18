-- Synthetic fixtures only. All identities and content are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user)
values('10000000-0000-4000-8000-000000000001','synthetic-a@example.invalid',now(),false,false),
('10000000-0000-4000-8000-000000000002','synthetic-b@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now(),now()),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',now(),now());
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"20000000-0000-4000-8000-000000000001"}',true);
do $$
declare result jsonb; previous jsonb; base jsonb;
begin
 if has_table_privilege('authenticated','history_private.snapshot_page','select') or has_function_privilege('anon','public.travel_life_history(text,jsonb)','execute') then raise exception 'TEST_ACCESS_GRANT'; end if;
 result:=public.travel_life_history('status','{}');
 if result->>'status'<>'active' then raise exception 'TEST_STATUS'; end if;
 result:=public.travel_life_history('register-source','{"mutationId":"30000000-0000-4000-8000-000000000001","generation":1,"sourceId":"40000000-0000-4000-8000-000000000001","installationId":"50000000-0000-4000-8000-000000000001"}');
 if result->>'error'<>'HISTORY_CONSENT' then raise exception 'TEST_CONSENT_REQUIRED'; end if;
 result:=public.travel_life_history('consent','{"mutationId":"30000000-0000-4000-8000-000000000002","generation":1,"history":true,"media":false}');
 previous:=result;
 result:=public.travel_life_history('consent','{"mutationId":"30000000-0000-4000-8000-000000000002","generation":1,"history":true,"media":false}');
 if result<>previous then raise exception 'TEST_RECEIPT'; end if;
 result:=public.travel_life_history('consent','{"mutationId":"30000000-0000-4000-8000-000000000002","generation":1,"history":false,"media":false}');
 if result->>'error'<>'HISTORY_CONFLICT' then raise exception 'TEST_RECEIPT_CONFLICT'; end if;
 result:=public.travel_life_history('register-source','{"mutationId":"30000000-0000-4000-8000-000000000003","generation":1,"sourceId":"40000000-0000-4000-8000-000000000001","installationId":"50000000-0000-4000-8000-000000000001"}');
 if result->>'status'<>'complete' then raise exception 'TEST_SOURCE'; end if;
 base:='{"generation":1,"sourceId":"40000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"60000000-0000-4000-8000-000000000001"}';
 result:=public.travel_life_history('begin',base||'{"mutationId":"30000000-0000-4000-8000-000000000004","pages":1,"schemaVersion":37,"sourceSnapshotRevision":0}');
 if result->>'status'<>'staging' then raise exception 'TEST_BEGIN'; end if;
 result:=public.travel_life_history('activate',base||'{"mutationId":"30000000-0000-4000-8000-000000000005"}');
 if result->>'error'<>'HISTORY_INCOMPLETE' then raise exception 'TEST_INCOMPLETE'; end if;
 result:=public.travel_life_history('page',base||'{"mutationId":"30000000-0000-4000-8000-000000000006","page":0,"records":[{"kind":"manual","key":"x","value":{"sql":"PRIVATE_SENTINEL"}}]}');
 if result->>'error'<>'HISTORY_SCHEMA' then raise exception 'TEST_ROW_SCHEMA'; end if;
 result:=public.travel_life_history('page',base||'{"mutationId":"30000000-0000-4000-8000-000000000007","page":0,"records":[{"kind":"manual","key":"x","value":{"manual_id":"x","command_key":"c","owner_label":"Synthetic","owner_context":"Fixture","latitude":10,"longitude":20,"date_kind":"exact","date_start":"2020-01-01","date_end":"2020-01-02","created_at_millis":1}}]}');
 if result->>'status'<>'complete' then raise exception 'TEST_PAGE'; end if;
 result:=public.travel_life_history('activate',base||'{"mutationId":"30000000-0000-4000-8000-000000000008"}');
 if result->>'status'<>'initial' then raise exception 'TEST_ACTIVATE'; end if;
 result:=public.travel_life_history('pull','{"snapshotId":"60000000-0000-4000-8000-000000000001","page":0}');
 if jsonb_array_length(result->'records')<>1 then raise exception 'TEST_PULL'; end if;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"session_id":"20000000-0000-4000-8000-000000000002"}',true);
 result:=public.travel_life_history('pull','{"snapshotId":"60000000-0000-4000-8000-000000000001","page":0}');
 if result->>'error'<>'HISTORY_STALE' then raise exception 'TEST_CROSS_OWNER'; end if;
 perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"20000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('delete-account','{"mutationId":"30000000-0000-4000-8000-000000000009","generation":1}'::jsonb||case when to_regprocedure('history_private.pre_account_deletion(text,jsonb)') is not null then jsonb_build_object('ticket',repeat('c',64)) else '{}'::jsonb end);
 if result->>'status' is distinct from (case when to_regprocedure('history_private.pre_account_deletion(text,jsonb)') is not null then 'pending' else 'deleted' end) then raise exception 'TEST_DELETE'; end if;
 result:=public.travel_life_history('page',base||'{"mutationId":"30000000-0000-4000-8000-000000000010","page":0,"records":[]}');
 if result->>'error'<>'HISTORY_FENCED' then raise exception 'TEST_RESURRECTION'; end if;
 delete from auth.sessions where id='20000000-0000-4000-8000-000000000001';
 result:=public.travel_life_history('status','{}');
 if result->>'error' is distinct from (case when to_regprocedure('history_private.pre_account_deletion(text,jsonb)') is not null then 'HISTORY_FENCED' else 'ACCOUNT_SESSION' end) then raise exception 'TEST_REVOKED_JWT'; end if;
end $$;
select 'PASS: consent, receipts, schema, activation, owner isolation, deletion and live-session fences' as result;
rollback;
