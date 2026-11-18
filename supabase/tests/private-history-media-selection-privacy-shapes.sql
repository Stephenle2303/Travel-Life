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
declare field text;shape jsonb;result jsonb;expected bigint;
begin
 perform set_config('request.jwt.claims','{"sub":"14000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"24000000-0000-4000-8000-000000000001"}',true);
 foreach field in array array['hiddenEvidenceIds','excludedEvidenceIds','both'] loop
 for shape in select value from (values(null::jsonb),('null'::jsonb),('[]'::jsonb),('{}'::jsonb),('["84000000-0000-4000-8000-000000000001",null,42]'::jsonb),('{"84000000-0000-4000-8000-000000000001":false}'::jsonb),('"84000000-0000-4000-8000-000000000001"'::jsonb),('true'::jsonb)) q(value) loop
  select count(*) into expected from history_private.aggregate g cross join lateral jsonb_array_elements(g.metadata->'sourceCopies') c where g.aggregate_id='74000000-0000-4000-8000-000000000001' and not coalesce(shape?(c->>'evidenceId'),false);
  update history_private.aggregate set metadata=jsonb_set(metadata,'{privacy}',jsonb_build_object('hiddenEvidenceIds',case when field in ('hiddenEvidenceIds','both') then shape else '[]'::jsonb end,'excludedEvidenceIds',case when field in ('excludedEvidenceIds','both') then shape else '[]'::jsonb end)) where aggregate_id='74000000-0000-4000-8000-000000000001';
  result:=public.travel_life_history('source-media','{"installationId":"54000000-0000-4000-8000-000000000001","page":0}');
  if result->>'status' is distinct from 'complete' or (result->>'total')::bigint is distinct from expected or jsonb_array_length(result->'items') is distinct from expected then raise exception 'TEST_MEDIA_PRIVACY_SHAPE_PARITY';end if;
 end loop;
 end loop;
end $$;
select 'PASS: source media privacy membership parity for arrays, objects, strings, null and scalars';
rollback;
