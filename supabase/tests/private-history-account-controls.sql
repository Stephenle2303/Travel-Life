begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 ('15000000-0000-4000-8000-000000000001','fixture@example.invalid',now(),false),
 ('15000000-0000-4000-8000-000000000002','other@example.invalid',now(),false);
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001',now(),now()),
 ('25000000-0000-4000-8000-000000000002','15000000-0000-4000-8000-000000000001',now(),now()),
 ('25000000-0000-4000-8000-000000000003','15000000-0000-4000-8000-000000000002',now(),now());
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","is_anonymous":false,"session_id":"25000000-0000-4000-8000-000000000001"}',true);
do $$
declare r jsonb;q jsonb;previous jsonb;
begin
 r:=public.travel_life_history('sessions','{"page":0}');
 if r->>'status' is distinct from 'complete' or jsonb_array_length(r->'sessions')<>2 or r::text like '%25000000-0000-4000-8000-000000000003%' then raise exception 'TEST_SESSION_OWNER_SCOPE';end if;
 if r::text like '%email%' or r::text like '%token%' then raise exception 'TEST_SESSION_MINIMAL_DTO';end if;
 q:='{"mutationId":"35000000-0000-4000-8000-000000000001","generation":1,"expectedRevision":0,"history":true,"media":false}';
 r:=public.travel_life_history('consent',q);if r->>'status' is distinct from 'complete' then raise exception 'TEST_CONSENT_CAS';end if;previous:=r;
 r:=public.travel_life_history('consent',q);if r is distinct from previous then raise exception 'TEST_CONSENT_RECEIPT';end if;
 r:=public.travel_life_history('consent',q||'{"mutationId":"35000000-0000-4000-8000-000000000002","media":true}');
 if r->>'error' is distinct from 'HISTORY_CONFLICT' then raise exception 'TEST_STALE_REENABLE';end if;
 r:=public.travel_life_history('consent',q||'{"mutationId":"35000000-0000-4000-8000-000000000002","expectedRevision":1,"history":false,"media":true}');
 if r->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'TEST_MEDIA_REQUIRES_HISTORY';end if;
 r:=public.travel_life_history('revoke-session','{"mutationId":"35000000-0000-4000-8000-000000000003","generation":1,"sessionId":"25000000-0000-4000-8000-000000000003"}');
 if r->>'error' is distinct from 'HISTORY_STALE' or exists(select 1 from auth.sessions where id='25000000-0000-4000-8000-000000000003' and not_after is not null) then raise exception 'TEST_CROSS_OWNER_REVOKE';end if;
 q:='{"mutationId":"35000000-0000-4000-8000-000000000004","generation":1,"sessionId":"25000000-0000-4000-8000-000000000002"}';
 r:=public.travel_life_history('revoke-session',q);if r->>'status' is distinct from 'complete' then raise exception 'TEST_REVOKE';end if;previous:=r;
 r:=public.travel_life_history('revoke-session',q);if r is distinct from previous then raise exception 'TEST_REVOKE_RECEIPT';end if;
 if not exists(select 1 from auth.sessions where id='25000000-0000-4000-8000-000000000002' and not_after<=now()) then raise exception 'TEST_REFRESH_EXPIRY';end if;
 r:=public.travel_life_history('sessions','{"page":0}');if jsonb_array_length(r->'sessions')<>1 then raise exception 'TEST_REVOKED_NOT_LISTED';end if;
 perform set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","is_anonymous":false,"session_id":"25000000-0000-4000-8000-000000000002"}',true);
 r:=public.travel_life_history('status','{}');if r->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_REVOKED_ACCESS';end if;
end $$;
select 'PASS: session inventory, owner isolation, Auth expiry, immutable revocation and consent CAS';
rollback;
