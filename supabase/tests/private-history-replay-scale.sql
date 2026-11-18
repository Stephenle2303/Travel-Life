-- Synthetic 24 MiB Replay; no owner content. Setup is outside the RPC budget.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('15000000-0000-4000-8000-000000000001','scale@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001',now(),now());
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"25000000-0000-4000-8000-000000000001"}',true);
select public.travel_life_history('status','{}');
select public.travel_life_history('consent',jsonb_build_object('mutationId',gen_random_uuid(),'generation',1,'history',true,'media',false));
select public.travel_life_history('register-source','{"mutationId":"35000000-0000-4000-8000-000000000001","generation":1,"sourceId":"45000000-0000-4000-8000-000000000001","installationId":"55000000-0000-4000-8000-000000000001"}');
select public.travel_life_history('begin','{"mutationId":"35000000-0000-4000-8000-000000000002","generation":1,"sourceId":"45000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"65000000-0000-4000-8000-000000000001","pages":63,"schemaVersion":37,"sourceSnapshotRevision":0}');
create temporary table scale_composition as select '{"orderedEvidenceIds":["'||repeat('x',24*1024*1024)||'"],"direction":"oldest-first"}' as body;
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
select '15000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001',part/25,
 jsonb_agg(jsonb_build_object('kind','replay-fragment','key','1:'||part,'value',jsonb_build_object('record_id',1,'revision',2,'updated_at_millis',3,'codec_version',1,'part_index',part,'part_count',1537,'committed_fragment',case when part=0 then substr(body,1,16384) when part=1536 then substr(body,1536*16384+1) else repeat('x',16384) end)) order by part),'synthetic'
from scale_composition cross join lateral generate_series(0,1536) part group by part/25;
-- 1537 fragments packed into 62 pages; retain a normal continuation page.
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
values('15000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001',62,'[]','synthetic');
create temporary table scale_staged as select page_number,records from history_private.snapshot_page where snapshot_id='65000000-0000-4000-8000-000000000001';
create temporary table scale_metrics(stage text,seconds numeric);
set local statement_timeout='8s';
do $$
declare result jsonb; prior jsonb; base jsonb:='{"mutationId":"35000000-0000-4000-8000-000000000003","generation":1,"sourceId":"45000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"65000000-0000-4000-8000-000000000001"}'; started timestamptz:=clock_timestamp(); elapsed numeric;
begin
 result:=public.travel_life_history('activate',base);
 if result->>'status' is distinct from 'initial' then raise exception 'SCALE_ACTIVATE %',result;end if;
 elapsed:=extract(epoch from clock_timestamp()-started);
 insert into scale_metrics values('source',elapsed);
 prior:=public.travel_life_history('activate',base);
 if prior is distinct from result then raise exception 'SCALE_RECEIPT';end if;
 if (select records->0->'value'->>'committed_overrides_json' from history_private.snapshot_page where snapshot_id='65000000-0000-4000-8000-000000000001' and page_number=0) is distinct from (select body from scale_composition) then raise exception 'SCALE_LOSS';end if;
 if exists(select 1 from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.snapshot_id='65000000-0000-4000-8000-000000000001' and r->>'kind'='replay-fragment') then raise exception 'SCALE_FRAGMENT_REMAINS';end if;
 raise notice 'Synthetic activation seconds: %',round(elapsed,3);
end $$;
select 'PASS: 24 MiB Replay activation, exact composition and immutable retry under eight-second statement budget';
set local statement_timeout='0';
create temporary table scale_worker as
select public.travel_life_history_worker('15000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','plan','{"operationId":"75000000-0000-4000-8000-000000000001"}') as plan;
create temporary table scale_worker_input as select jsonb_build_object('operationId','75000000-0000-4000-8000-000000000001','accountGeneration',plan->'accountGeneration','expectedAccountRevision',plan->'expectedAccountRevision','sourcePlan',plan->'sourcePlan') as base from scale_worker;
select public.travel_life_history_worker('15000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','activate',base||'{"phase":"start","pages":63,"metadata":{},"engineVersion":"reconstruction-v1/trip-detector-v1.1"}'::jsonb) from scale_worker_input;
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest)
select '15000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',page_number,records,'synthetic' from scale_staged;
set local statement_timeout='8s';
do $$
declare result jsonb; prior jsonb; input jsonb; started timestamptz:=clock_timestamp();
begin
 select base||'{"phase":"commit"}'::jsonb into input from scale_worker_input;
 result:=public.travel_life_history_worker('15000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','activate',input);
 if result->>'status' is distinct from 'complete' then raise exception 'SCALE_AGGREGATE %',result;end if;
 insert into scale_metrics values('aggregate',extract(epoch from clock_timestamp()-started));
 prior:=public.travel_life_history_worker('15000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','plan',jsonb_build_object('operationId',input->'operationId'));
 if prior is distinct from result then raise exception 'SCALE_AGGREGATE_RETRY';end if;
 if (select records->0->'value'->>'committed_overrides_json' from history_private.aggregate_page where aggregate_id='75000000-0000-4000-8000-000000000001' and page_number=0) is distinct from (select body from scale_composition) then raise exception 'SCALE_AGGREGATE_LOSS';end if;
end $$;
select 'PASS: 24 MiB '||stage||' activation seconds='||round(seconds,3)::text from scale_metrics;
rollback;
