-- Synthetic owner-only source/aggregate selection. Always rollback.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user)
values('14000000-0000-4000-8000-000000000001','selection@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at)
values('24000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001',now(),now());
insert into history_private.account(owner_id,history_consent,media_consent)
values('14000000-0000-4000-8000-000000000001',true,true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision)
values('14000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision)
values('14000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001',1,'initial',1,37,1);
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
values('14000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001',0,'[]','synthetic');
insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,state,expected_pages,metadata,engine_version,aggregate_revision)
values('14000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',1,0,history_private.current_source_plan('14000000-0000-4000-8000-000000000001'),'active',1,
'{"sourceCopies":[{"sourceId":"44000000-0000-4000-8000-000000000001","evidenceId":"84000000-0000-4000-8000-000000000001","localSourceRef":"PRIVATE_NATIVE_ASSET"},{"sourceId":"44000000-0000-4000-8000-000000000001","evidenceId":"84000000-0000-4000-8000-000000000002","localSourceRef":"PRIVATE_HIDDEN_ASSET"}],"privacy":{"hiddenEvidenceIds":["84000000-0000-4000-8000-000000000002"],"excludedEvidenceIds":[]}}','reconstruction-v1/trip-detector-v1.1',1);
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest)
values('14000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',0,'[{"kind":"evidence","key":"84000000-0000-4000-8000-000000000001","value":{"media_type":"image","captured_day":"2024-01-01"}},{"kind":"evidence","key":"84000000-0000-4000-8000-000000000002","value":{"media_type":"video","captured_day":"2024-01-02"}}]','synthetic');
update history_private.account set active_aggregate='74000000-0000-4000-8000-000000000001',aggregate_revision=1 where owner_id='14000000-0000-4000-8000-000000000001';
do $$
declare result jsonb;request jsonb:='{"installationId":"54000000-0000-4000-8000-000000000001","page":0}';
begin
 perform set_config('request.jwt.claims','{"sub":"14000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"24000000-0000-4000-8000-000000000001"}',true);
 if has_function_privilege('authenticated','history_private.pre_media_history(text,jsonb)','execute') then raise exception 'TEST_PRIVATE_WRAPPER_GRANT';end if;
 result:=public.travel_life_history('source-media',request);
 if result->>'status' is distinct from 'complete' or result->>'total'<>'1' or result->>'pages'<>'1'
  or result->'items'->0->>'id'<>'84000000-0000-4000-8000-000000000001' or result->'items'->0->>'sourceRef'<>'PRIVATE_NATIVE_ASSET'
  or result::text like '%PRIVATE_HIDDEN_ASSET%' then raise exception 'TEST_EXACT_VISIBLE_SOURCE_MAPPING';end if;
 result:=public.travel_life_history('source-media',request||'{"owner":"OTHER_OWNER"}');
 if result->>'error' is distinct from 'HISTORY_SCHEMA' or result::text like '%PRIVATE_%' then raise exception 'TEST_UNKNOWN_FIELD_REDACTION';end if;
 result:=public.travel_life_history('source-media',request||'{"page":1}');
 if result->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'TEST_PAGE_BOUND';end if;
 update history_private.source set snapshot_revision=2 where owner_id='14000000-0000-4000-8000-000000000001';
 result:=public.travel_life_history('source-media',request);
 if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_EXACT_AGGREGATE_SCOPE';end if;
 update history_private.source set snapshot_revision=1,state='disconnected' where owner_id='14000000-0000-4000-8000-000000000001';
 result:=public.travel_life_history('source-media',request);
 if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_STOPPED_SOURCE_NO_UPLOAD_SELECTION';end if;
 perform set_config('request.jwt.claims','{"sub":"14000000-0000-4000-8000-000000000099","role":"authenticated","is_anonymous":false,"session_id":"24000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('source-media',request);
 if result->>'error' is distinct from 'ACCOUNT_SESSION' or result::text like '%PRIVATE_%' then raise exception 'TEST_CROSS_OWNER_DENIAL';end if;
end $$;
rollback;
