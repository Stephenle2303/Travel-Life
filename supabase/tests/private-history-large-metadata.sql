-- Synthetic source-copy provenance assembly; always rollback.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('16000000-0000-4000-8000-000000000001','metadata@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001',now(),now());
insert into history_private.account(owner_id,history_consent,media_consent) values('16000000-0000-4000-8000-000000000001',true,true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision) values('16000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision) values('16000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001',1,'initial',30,37,1);
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
select '16000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001',n/100,
 jsonb_agg(jsonb_build_object('kind','evidence','key','local-'||n,'value',jsonb_build_object('source_ref','synthetic-'||n||repeat('x',100),'availability',case when n%2=0 then 'available' else 'unknown' end,'media_type','image','captured_day','2024-01-01')) order by n),'synthetic'
from generate_series(0,2999) n group by n/100;
insert into history_private.identity_mapping(owner_id,source_id,kind,local_id)
select '16000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','evidence','local-'||n from generate_series(0,2999) n;
-- Finalized Replay can share a source page with evidence. Project scalars before
-- the mapping join so the large unrelated body is never expanded per mapping.
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
select owner_id,snapshot_id,30,jsonb_build_array(records->99),'synthetic'
from history_private.snapshot_page where snapshot_id='66000000-0000-4000-8000-000000000001' and page_number=29;
update history_private.snapshot_page set records=records-99 where snapshot_id='66000000-0000-4000-8000-000000000001' and page_number=29;
update history_private.snapshot set expected_pages=31 where snapshot_id='66000000-0000-4000-8000-000000000001';
-- A disconnected retained source can reuse a local key with independent provenance.
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision,state) values('16000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000002',1,'disconnected');
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision) values('16000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000002',1,'pending',1,37,1);
insert into history_private.snapshot_page values('16000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000002',0,'[{"kind":"evidence","key":"local-0","value":{"source_ref":"other-synthetic","availability":"unavailable","media_type":"image","captured_day":"2024-01-02"}}]','synthetic');
insert into history_private.identity_mapping(owner_id,source_id,kind,local_id) values('16000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000002','evidence','local-0');
update history_private.account set active_snapshot='66000000-0000-4000-8000-000000000001' where owner_id='16000000-0000-4000-8000-000000000001';
create temporary table metadata_test_input as
select jsonb_build_object('accountGeneration',p->'accountGeneration','expectedAccountRevision',p->'expectedAccountRevision','sourcePlan',p->'sourcePlan','operationId','76000000-0000-4000-8000-000000000001') as base
from (select public.travel_life_history_worker('16000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','plan','{"operationId":"76000000-0000-4000-8000-000000000001"}') p) plan;
select public.travel_life_history_worker('16000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','activate',base||'{"phase":"start","pages":32,"metadata":{"metadataVersion":3,"sourceCopiesFromPlan":true,"privacy":{"hiddenEvidenceIds":[],"excludedEvidenceIds":[]}},"engineVersion":"reconstruction-v1/trip-detector-v1.1"}') from metadata_test_input;
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest)
select p.owner_id,'76000000-0000-4000-8000-000000000001',p.page_number,
 jsonb_agg(jsonb_build_object('kind','evidence','key',m.account_id,'value',r->'value') order by m.account_id),'synthetic'
from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r
join history_private.identity_mapping m on m.owner_id=p.owner_id and m.source_id='46000000-0000-4000-8000-000000000001' and m.kind='evidence' and m.local_id=r->>'key'
where p.owner_id='16000000-0000-4000-8000-000000000001' and p.snapshot_id='66000000-0000-4000-8000-000000000001' and r->>'kind'='evidence' group by p.owner_id,p.page_number;
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest)
select m.owner_id,'76000000-0000-4000-8000-000000000001',31,jsonb_build_array(jsonb_build_object('kind','evidence','key',m.account_id,'value',jsonb_build_object('media_type','image','captured_day','2024-01-02'))),'synthetic' from history_private.identity_mapping m where m.owner_id='16000000-0000-4000-8000-000000000001' and m.source_id='46000000-0000-4000-8000-000000000002';
-- Add the large body only after fixture projection, outside the timed RPC.
update history_private.snapshot_page set records=records||jsonb_build_array(jsonb_build_object('kind','replay','key','1','value',jsonb_build_object('record_id',1,'revision',1,'updated_at_millis',1,'committed_overrides_json','{"orderedEvidenceIds":["'||repeat('x',24*1024*1024)||'"]}')))
where snapshot_id='66000000-0000-4000-8000-000000000001' and page_number=30;
-- Several RPCs and a 63 MiB retained-version setup share this anonymous block.
-- Bound each RPC separately, without treating cumulative setup as one request.
set local statement_timeout='30s';
do $$
declare subject uuid:='16000000-0000-4000-8000-000000000001'; sid uuid:='26000000-0000-4000-8000-000000000001'; operation uuid:='76000000-0000-4000-8000-000000000001';base jsonb;result jsonb;prior jsonb;actual_metadata jsonb;missing uuid;expected jsonb;mode integer;started timestamptz;
begin
 if has_function_privilege('authenticated','history_private.finalize_aggregate_metadata(uuid,jsonb,jsonb)','execute') or has_function_privilege('anon','history_private.finalize_aggregate_metadata(uuid,jsonb,jsonb)','execute') then raise exception 'METADATA_HELPER_ACCESS';end if;
 select t.base into base from metadata_test_input t;
 -- Each bad marker must reject before manufacturing provenance.
 for mode in 1..3 loop
  begin
   perform history_private.finalize_aggregate_metadata(subject,base->'sourcePlan',case mode when 1 then '{"metadataVersion":3,"sourceCopiesFromPlan":false}'::jsonb when 2 then '{"metadataVersion":2,"sourceCopiesFromPlan":true}'::jsonb else '{"metadataVersion":3,"sourceCopiesFromPlan":true,"sourceCopies":[]}'::jsonb end);
   raise exception 'METADATA_BAD_MARKER';
  exception when invalid_parameter_value then null;end;
 end loop;
 delete from history_private.identity_mapping where owner_id=subject and source_id='46000000-0000-4000-8000-000000000001' and local_id='local-0' returning account_id into missing;
 started:=clock_timestamp();
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}');
 if clock_timestamp()-started>interval '8 seconds' then raise exception 'METADATA_MISSING_RPC_BUDGET';end if;
 if result->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'METADATA_MISSING_MAPPING %',result;end if;
 if (select active_aggregate from history_private.account where owner_id=subject) is not null or not (select metadata ? 'sourceCopiesFromPlan' from history_private.aggregate where owner_id=subject and aggregate_id=operation) then raise exception 'METADATA_FAILED_CHANGED_AUTHORITY';end if;
 insert into history_private.identity_mapping(owner_id,source_id,kind,local_id,account_id) values(subject,'46000000-0000-4000-8000-000000000001','evidence','local-0',missing);
 -- A retained version consumes the same owner quota as the newly assembled body.
 insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,expected_pages,metadata,engine_version)
 values(subject,'76000000-0000-4000-8000-000000000002',1,0,'[]',1,jsonb_build_object('synthetic',repeat('q',63*1024*1024)),'reconstruction-v1/trip-detector-v1.1');
 started:=clock_timestamp();
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}');
 if clock_timestamp()-started>interval '8 seconds' then raise exception 'METADATA_QUOTA_RPC_BUDGET';end if;
 if result->>'error' is distinct from 'HISTORY_QUOTA' then raise exception 'METADATA_QUOTA %',result;end if;
 if (select active_aggregate from history_private.account where owner_id=subject) is not null or not (select metadata ? 'sourceCopiesFromPlan' from history_private.aggregate where owner_id=subject and aggregate_id=operation) then raise exception 'METADATA_QUOTA_CHANGED_AUTHORITY';end if;
 delete from history_private.aggregate where owner_id=subject and aggregate_id='76000000-0000-4000-8000-000000000002';
 started:=clock_timestamp();
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}');
 if clock_timestamp()-started>interval '8 seconds' then raise exception 'METADATA_COMMIT_RPC_BUDGET';end if;
 if result->>'status' is distinct from 'complete' then raise exception 'METADATA_COMMIT %',result;end if;
 select g.metadata into actual_metadata from history_private.aggregate g where owner_id=subject and aggregate_id=operation;
 if octet_length(actual_metadata::text)<=524288 or jsonb_array_length(actual_metadata->'sourceCopies')<>3001 or actual_metadata ? 'sourceCopiesFromPlan' then raise exception 'METADATA_SCALE';end if;
 select jsonb_agg(jsonb_build_object('sourceId',s.source_id,'localEvidenceId',r->>'key','localSourceRef',r->'value'->>'source_ref','evidenceId',m.account_id,'availability',r->'value'->>'availability') order by s.source_id,r->>'key') into expected
 from history_private.snapshot_page p join history_private.snapshot s on s.owner_id=p.owner_id and s.snapshot_id=p.snapshot_id cross join lateral jsonb_array_elements(p.records) r join history_private.identity_mapping m on m.owner_id=p.owner_id and m.source_id=s.source_id and m.local_id=r->>'key'
 where p.owner_id=subject;
 if actual_metadata->'sourceCopies' is distinct from expected then raise exception 'METADATA_SOURCE_PARITY';end if;
 started:=clock_timestamp();
 for mode in 1..30 loop
  if not history_private.readable_prior_aggregate(subject,base->'sourcePlan') then raise exception 'METADATA_IMMUTABLE_READ';end if;
 end loop;
 if clock_timestamp()-started>interval '8 seconds' then raise exception 'METADATA_READBACK_BUDGET';end if;
 prior:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));if prior is distinct from result then raise exception 'METADATA_RECEIPT';end if;
 perform set_config('request.jwt.claims','{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"26000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('source-media','{"installationId":"56000000-0000-4000-8000-000000000001","page":0}');
 if result->>'status' is distinct from 'complete' or result->>'total'<>'3000' or jsonb_array_length(result->'items')<>24 then raise exception 'METADATA_MEDIA_SELECTION %',result;end if;
 if not history_private.media_scope(subject,'46000000-0000-4000-8000-000000000001',jsonb_build_object('kind','evidence','id',missing)) then raise exception 'METADATA_MEDIA_SCOPE';end if;
 result:=public.travel_life_history('source-impact','{"sourceId":"46000000-0000-4000-8000-000000000001","page":0}');
 if result ? 'error' then raise exception 'METADATA_SOURCE_IMPACT %',result;end if;
end $$;
select 'PASS: large source-copy metadata parity, media selection, fences, missing mapping, quota rollback and receipt';
rollback;
