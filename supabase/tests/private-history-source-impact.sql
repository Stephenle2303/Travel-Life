-- Synthetic source coverage/impact/CAS. Always rollback.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('16000000-0000-4000-8000-000000000001','impact@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001',now(),now());
insert into history_private.account(owner_id,history_consent) values('16000000-0000-4000-8000-000000000001',true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision) values('16000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision) values('16000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001',1,'initial',1,37,1);
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest) values('16000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001',0,'[{"kind":"evidence","key":"evidence-one","value":{"captured_day":"2024-01-01","media_type":"image"}},{"kind":"manual","key":"manual-one","value":{"owner_label":"Synthetic trip"}}]','synthetic');
do $$
declare result jsonb;request jsonb;subject uuid:='16000000-0000-4000-8000-000000000001';
begin
 perform set_config('request.jwt.claims','{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"26000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('status','{}');
 if result->'sources'->0->'coverage'->>'acceptedMetadata'<>'1' or result->'sources'->0->'coverage'->>'observedStart'<>'2024-01-01' or result->'sources'->0->'coverage'->>'acknowledgedMedia'<>'0' then raise exception 'TEST_OBSERVED_COVERAGE';end if;
 result:=public.travel_life_history('source-impact','{"sourceId":"46000000-0000-4000-8000-000000000001","page":0}');
 if result->>'status' is distinct from 'complete' or result->>'total'<>'2' or jsonb_array_length(result->'records')<>2 then raise exception 'TEST_EXACT_SOURCE_IMPACT';end if;
 request:='{"mutationId":"76000000-0000-4000-8000-000000000001","generation":1,"sourceId":"46000000-0000-4000-8000-000000000001","sourceGeneration":1,"mode":"removed","expectedSourceRevision":1,"expectedAccountRevision":99}';
 result:=public.travel_life_history('source-control',request);if result->>'error' is distinct from 'HISTORY_CONFLICT' then raise exception 'TEST_STALE_PREVIEW';end if;
 if not exists(select 1 from history_private.source where owner_id=subject and state='active') then raise exception 'TEST_CONFLICT_RETAINS';end if;
 result:=public.travel_life_history('source-control',request-array['expectedSourceRevision','expectedAccountRevision']);if result->>'error' is distinct from 'HISTORY_CONFLICT' then raise exception 'TEST_PREVIEW_REQUIRED';end if;
 request:=request||'{"expectedAccountRevision":0}';
 result:=public.travel_life_history('source-control',request);if result->>'status' is distinct from 'complete' then raise exception 'TEST_PREVIEWED_REMOVAL';end if;
 result:=public.travel_life_history('source-control',request);if result->>'status' is distinct from 'complete' then raise exception 'TEST_REMOVAL_RETRY';end if;
 result:=public.travel_life_history('source-control',request||'{"expectedAccountRevision":99}');if result->>'error' is distinct from 'HISTORY_CONFLICT' then raise exception 'TEST_PREVIEW_RECEIPT_CONTENT_CONFLICT';end if;
 if not exists(select 1 from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=subject and r->>'kind'='manual') then raise exception 'TEST_OWNER_FACT_PRESERVED';end if;
 perform set_config('request.jwt.claims','{"sub":"16000000-0000-4000-8000-000000000099","role":"authenticated","is_anonymous":false,"session_id":"26000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('source-impact','{"sourceId":"46000000-0000-4000-8000-000000000001","page":0}');if result->>'error' is distinct from 'ACCOUNT_SESSION' or result::text like '%Synthetic trip%' then raise exception 'TEST_CROSS_OWNER_IMPACT';end if;
end $$;
rollback;
