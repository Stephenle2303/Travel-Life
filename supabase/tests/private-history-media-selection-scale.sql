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

-- Large, incompressible synthetic metadata reproduces repeated TOAST expansion.
update history_private.aggregate set metadata=jsonb_build_object(
 'sourceCopies',(select jsonb_agg(jsonb_build_object('sourceId','44000000-0000-4000-8000-000000000001','evidenceId','84000000-0000-4000-8000-'||lpad(n::text,12,'0'),'localSourceRef','SYNTHETIC_NATIVE_'||n) order by n) from generate_series(1,3000) n),
 'privacy',jsonb_build_object('hiddenEvidenceIds',jsonb_build_array('84000000-0000-4000-8000-000000000001'),'excludedEvidenceIds',jsonb_build_array('84000000-0000-4000-8000-000000000002')),
 '_fixturePadding',(select string_agg(md5(n::text),'') from generate_series(1,262144) n)),expected_pages=126
where aggregate_id='74000000-0000-4000-8000-000000000001';
delete from history_private.aggregate_page where aggregate_id='74000000-0000-4000-8000-000000000001';
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest)
select '14000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',(n-1)/24,
 jsonb_agg(jsonb_build_object('kind','evidence','key','84000000-0000-4000-8000-'||lpad(n::text,12,'0'),'value',jsonb_build_object('media_type',case when n%2=0 then 'video' else 'image' end,'captured_day','2024-01-01')) order by n),'synthetic'
from generate_series(1,3000) n group by (n-1)/24;
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest)
select '14000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',125,
 jsonb_build_array(jsonb_build_object('kind','replay','key','1','value',jsonb_build_object('committed_overrides_json',jsonb_build_object('soundtrack',jsonb_build_object('kind','custom','revision','synthetic-scale-track'),'syntheticPadding',(select string_agg(md5(n::text),'') from generate_series(1,131072) n))::text))),'synthetic';
update history_private.account set preferred_replay_source='44000000-0000-4000-8000-000000000001' where owner_id='14000000-0000-4000-8000-000000000001';
update history_private.aggregate set source_plan=history_private.current_source_plan(owner_id) where aggregate_id='74000000-0000-4000-8000-000000000001';
insert into history_private.media_artifact(owner_id,artifact_id,account_generation,source_id,source_generation,consent_generation,target,target_key,manifest,expected_revision,storage_path,byte_length,state)
select '14000000-0000-4000-8000-000000000001',id::uuid,1,'44000000-0000-4000-8000-000000000001',1,1,'{}',target_key,'{}',0,'synthetic/'||id,1,'active'
from (values('94000000-0000-4000-8000-000000000001','evidence:84000000-0000-4000-8000-000000000003'),('94000000-0000-4000-8000-000000000002','soundtrack:synthetic-scale-track')) q(id,target_key);
insert into history_private.media_attachment(owner_id,target_key,artifact_id,revision)
select owner_id,target_key,artifact_id,case when target_key like 'evidence:%' then 7 else 11 end from history_private.media_artifact where owner_id='14000000-0000-4000-8000-000000000001';
create temporary table media_scale_metric(seconds numeric);
set local statement_timeout='5s';
do $$
declare result jsonb;request jsonb:='{"installationId":"54000000-0000-4000-8000-000000000001","page":0}';started timestamptz:=clock_timestamp();
begin
 perform set_config('request.jwt.claims','{"sub":"14000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"24000000-0000-4000-8000-000000000001"}',true);
 if has_function_privilege('authenticated','history_private.pre_account_controls(text,jsonb)','execute') then raise exception 'TEST_MEDIA_SCALE_PRIVATE_GRANT';end if;
 result:=public.travel_life_history('source-media',request);
 if result->>'status' is distinct from 'complete' or result->>'total' is distinct from '2998' or result->>'pages' is distinct from '125' or jsonb_array_length(result->'items') is distinct from 24 or result->'items'->0->>'id' is distinct from '84000000-0000-4000-8000-000000000003' or result->'items'->0->>'kind' is distinct from 'photo' or result->'items'->0->>'expectedRevision' is distinct from '7' or result->'items'->1->>'expectedRevision' is distinct from '0' or result->'soundtrack'->>'expectedRevision' is distinct from '11' or result->'soundtrack'->>'revision' is distinct from 'synthetic-scale-track' then raise exception 'TEST_MEDIA_SCALE_FIRST_PAGE';end if;
 result:=public.travel_life_history('source-media',request||'{"page":124}');
 if result->>'status' is distinct from 'complete' or jsonb_array_length(result->'items') is distinct from 22 or result->'items'->21->>'sourceRef' is distinct from 'SYNTHETIC_NATIVE_3000' or result->'items'->21->>'kind' is distinct from 'video' then raise exception 'TEST_MEDIA_SCALE_LAST_PAGE';end if;
 result:=public.travel_life_history('source-media',request||'{"page":125}');
 if result->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'TEST_MEDIA_SCALE_PAGE_BOUND';end if;
 insert into media_scale_metric values(extract(epoch from clock_timestamp()-started));
end $$;
select 'PASS: source media3000, private metadata8MiB, Replay4MiB, exact privacy/pages/audio/grants, seconds='||round(seconds,3) from media_scale_metric;
-- Exercise the production sequential pagination pattern, separately from the
-- unchanged per-request 5s regression above. This test-only block has a total budget.
set local statement_timeout='120s';
do $$
declare page_index integer;result jsonb;seen bigint:=0;started timestamptz:=clock_timestamp();
begin
 for page_index in 0..124 loop
  result:=public.travel_life_history('source-media',jsonb_build_object('installationId','54000000-0000-4000-8000-000000000001','page',page_index));
  if result->>'status' is distinct from 'complete' or (result->>'page')::integer is distinct from page_index then raise exception 'TEST_MEDIA_SCALE_SEQUENTIAL_PAGE';end if;
  seen:=seen+jsonb_array_length(result->'items');
 end loop;
 if seen is distinct from 2998 then raise exception 'TEST_MEDIA_SCALE_SEQUENTIAL_CARDINALITY';end if;
 insert into media_scale_metric values(extract(epoch from clock_timestamp()-started));
end $$;
select 'PASS: complete125-page sequential mapping, seconds='||round(max(seconds),3) from media_scale_metric;
rollback;
