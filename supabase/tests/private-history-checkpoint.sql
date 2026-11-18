begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('19000000-0000-4000-8000-000000000001','checkpoint@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('29000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001',now(),now());
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"29000000-0000-4000-8000-000000000001"}',true);
select public.travel_life_history('status','{}');
select public.travel_life_history('consent','{"mutationId":"39000000-0000-4000-8000-000000000001","generation":1,"history":true,"media":false}');
select public.travel_life_history('register-source','{"mutationId":"39000000-0000-4000-8000-000000000002","generation":1,"sourceId":"49000000-0000-4000-8000-000000000001","installationId":"59000000-0000-4000-8000-000000000001"}');
select public.travel_life_history('begin','{"mutationId":"39000000-0000-4000-8000-000000000003","generation":1,"sourceId":"49000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"69000000-0000-4000-8000-000000000001","pages":1,"schemaVersion":37,"sourceSnapshotRevision":0}');
select public.travel_life_history('page','{"mutationId":"39000000-0000-4000-8000-000000000004","generation":1,"sourceId":"49000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"69000000-0000-4000-8000-000000000001","page":0,"records":[]}');
select public.travel_life_history_finalize('activate','{"mutationId":"39000000-0000-4000-8000-000000000005","generation":1,"sourceId":"49000000-0000-4000-8000-000000000001","sourceGeneration":1,"snapshotId":"69000000-0000-4000-8000-000000000001"}');

create function pg_temp.checkpoint(action text,extra jsonb default '{}',operation uuid default '79000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
 select public.travel_life_history_checkpoint('19000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001',action,jsonb_build_object('operationId',operation,'domainDigest',repeat('a',64))||extra)
$$;
create function pg_temp.checkpoint_error(action text,extra jsonb,expected text,operation uuid default '79000000-0000-4000-8000-000000000001') returns void language plpgsql as $$
begin
 if pg_temp.checkpoint(action,extra,operation)->>'error' is distinct from expected then raise exception 'CHECKPOINT_ERROR action %, expected %',action,expected;end if;
 -- Negative cases are independent: roll back retirement caused by this call.
 -- Explicit retirement regressions below call the RPC directly and retain it.
 raise exception using errcode='ZX001';
exception when sqlstate 'ZX001' then null;
end $$;

do $$
declare role_name text;target text;result jsonb;base jsonb;operation uuid:='79000000-0000-4000-8000-000000000001';
begin
 foreach role_name in array array['anon','authenticated'] loop
  if has_function_privilege(role_name,'public.travel_life_history_checkpoint(uuid,uuid,text,jsonb)','execute')
   or has_function_privilege(role_name,'history_private.checkpoint_action(uuid,uuid,text,jsonb)','execute') then raise exception 'CHECKPOINT_PUBLIC_ACCESS';end if;
 end loop;
 foreach target in array array['merge_checkpoint','merge_checkpoint_page','expired_merge_checkpoint'] loop
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_table_privilege(role_name,'history_private.'||target,'select,insert,update,delete') then raise exception 'CHECKPOINT_TABLE_ACCESS';end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid=('history_private.'||target)::regclass) then raise exception 'CHECKPOINT_RLS';end if;
 end loop;
 if not has_function_privilege('service_role','public.travel_life_history_checkpoint(uuid,uuid,text,jsonb)','execute') then raise exception 'CHECKPOINT_SERVICE_ACCESS';end if;
 result:=pg_temp.checkpoint('status');base:=result->'base';
 if result->>'status' is distinct from 'prepare' or result->>'preparedPages' is distinct from '0' or base ? 'ownerChanges' or not(base ? 'ownerRevision') then raise exception 'CHECKPOINT_INITIAL_PLAN';end if;
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base||'{"ownerRevision":99}','pages',2),'HISTORY_STALE');
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',10001),'HISTORY_SCHEMA');
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',0),'HISTORY_SCHEMA');
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',1.5),'HISTORY_SCHEMA');
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages','2'),'HISTORY_SCHEMA');
 result:=pg_temp.checkpoint('start',jsonb_build_object('base',base,'pages',2));
 if result->>'status' is distinct from 'prepare' or result is distinct from pg_temp.checkpoint('start',jsonb_build_object('base',base,'pages',2)) then raise exception 'CHECKPOINT_START_RETRY';end if;
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',3),'HISTORY_CONFLICT');
 perform pg_temp.checkpoint_error('seal','{}','HISTORY_INCOMPLETE');
 perform pg_temp.checkpoint_error('read','{"page":0}','HISTORY_INCOMPLETE');
 perform pg_temp.checkpoint_error('page','{"page":2,"records":[]}','HISTORY_SCHEMA');
 perform pg_temp.checkpoint_error('page','{"page":-1,"records":[]}','HISTORY_SCHEMA');
 perform pg_temp.checkpoint_error('page','{"page":0,"records":{}}','HISTORY_SCHEMA');
 perform pg_temp.checkpoint_error('page',jsonb_build_object('page',0,'records',jsonb_build_array(repeat('é',200001))),'HISTORY_QUOTA');
 perform pg_temp.checkpoint_error('page',jsonb_build_object('page',0,'records',(select jsonb_agg(i) from generate_series(1,101)i)),'HISTORY_QUOTA');
 result:=pg_temp.checkpoint('page','{"page":0,"records":["Synthetic Unicode é and 😀"]}');
 if result is distinct from pg_temp.checkpoint('page','{"page":0,"records":["Synthetic Unicode é and 😀"]}') then raise exception 'CHECKPOINT_PAGE_LOST_ACK';end if;
 perform pg_temp.checkpoint_error('page','{"page":0,"records":["changed"]}','HISTORY_CONFLICT');
 perform pg_temp.checkpoint_error('seal','{}','HISTORY_INCOMPLETE');
 perform pg_temp.checkpoint('page','{"page":1,"records":[]}');
 result:=pg_temp.checkpoint('seal');
 if result->>'status' is distinct from 'build' or result is distinct from pg_temp.checkpoint('seal') then raise exception 'CHECKPOINT_SEAL_RETRY';end if;
 if pg_temp.checkpoint('read','{"page":0}')->'records' is distinct from '["Synthetic Unicode é and 😀"]'::jsonb then raise exception 'CHECKPOINT_READ';end if;
 if pg_temp.checkpoint('status')->>'status' is distinct from 'build' then raise exception 'CHECKPOINT_BUILD_RESTART';end if;
 perform pg_temp.checkpoint_error('ready','{"pages":1}','HISTORY_INCOMPLETE');
 perform pg_temp.checkpoint_error('page','{"page":1,"records":["changed"]}','HISTORY_CONFLICT');
end $$;

-- Every checkpoint action rechecks domain, original plan, consent and session.
do $$
declare action text;args jsonb;base jsonb;result jsonb;
begin
 base:=pg_temp.checkpoint('status')->'base';
 foreach action in array array['status','start','page','seal','read','ready'] loop
  args:=case action when 'start' then jsonb_build_object('base',base,'pages',2) when 'page' then '{"page":0,"records":[]}'::jsonb when 'read' then '{"page":0}'::jsonb when 'ready' then '{"pages":1}'::jsonb else '{}'::jsonb end;
  perform pg_temp.checkpoint_error(action,args||jsonb_build_object('domainDigest',repeat('b',64)),'HISTORY_STALE');
  update history_private.account set history_consent=false where owner_id='19000000-0000-4000-8000-000000000001';
  perform pg_temp.checkpoint_error(action,args,'HISTORY_CONSENT');
  update history_private.account set history_consent=true,delete_fenced_at=now() where owner_id='19000000-0000-4000-8000-000000000001';
  perform pg_temp.checkpoint_error(action,args,'HISTORY_FENCED');
  update history_private.account set delete_fenced_at=null where owner_id='19000000-0000-4000-8000-000000000001';
  insert into history_private.revoked_session values('19000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001');
  perform pg_temp.checkpoint_error(action,args,'ACCOUNT_SESSION');
  delete from history_private.revoked_session where owner_id='19000000-0000-4000-8000-000000000001';
  update history_private.account set revision=revision+1 where owner_id='19000000-0000-4000-8000-000000000001';
  perform pg_temp.checkpoint_error(action,args,'HISTORY_STALE');
  update history_private.account set revision=revision-1 where owner_id='19000000-0000-4000-8000-000000000001';
  update history_private.account set generation=generation+1 where owner_id='19000000-0000-4000-8000-000000000001';
  perform pg_temp.checkpoint_error(action,args,'HISTORY_FENCED');
  update history_private.account set generation=generation-1 where owner_id='19000000-0000-4000-8000-000000000001';
  insert into history_private.owner_journal(owner_id,revision) values('19000000-0000-4000-8000-000000000001',1);
  perform pg_temp.checkpoint_error(action,args,'HISTORY_STALE');
  delete from history_private.owner_journal where owner_id='19000000-0000-4000-8000-000000000001';
  update history_private.source set state='paused' where owner_id='19000000-0000-4000-8000-000000000001';
  perform pg_temp.checkpoint_error(action,args,'HISTORY_STALE');
  update history_private.source set state='active' where owner_id='19000000-0000-4000-8000-000000000001';
 end loop;
 if public.travel_life_history_checkpoint('19000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000002','status',jsonb_build_object('operationId','79000000-0000-4000-8000-000000000001','domainDigest',repeat('a',64)))->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'CHECKPOINT_OTHER_SESSION';end if;
end $$;

-- Staged cardinality, source/owner/domain authority and final receipt precedence.
do $$
declare base jsonb;activation jsonb;result jsonb;receipt jsonb;
begin
 base:=pg_temp.checkpoint('status')->'base';activation:=(base-array['ownerRevision','preferredReplaySourceId'])||'{"operationId":"79000000-0000-4000-8000-000000000001"}';
 result:=public.travel_life_history_worker('19000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','activate',activation||jsonb_build_object('phase','start','pages',1,'metadata',jsonb_build_object('ownerRevision',0,'domainSourceDigest',repeat('a',64)),'engineVersion','reconstruction-v1/trip-detector-v1.1'));
 if result->>'status' is distinct from 'staging' then raise exception 'CHECKPOINT_AGGREGATE_START';end if;
 perform pg_temp.checkpoint_error('ready','{"pages":1}','HISTORY_INCOMPLETE');
 perform public.travel_life_history_worker('19000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','activate',activation||'{"phase":"page","page":0,"records":[]}');
 update history_private.aggregate set metadata=jsonb_set(metadata,'{domainSourceDigest}',to_jsonb(repeat('b',64))) where aggregate_id='79000000-0000-4000-8000-000000000001';
 perform pg_temp.checkpoint_error('ready','{"pages":1}','HISTORY_STALE');
 update history_private.aggregate set metadata=jsonb_set(metadata,'{domainSourceDigest}',to_jsonb(repeat('a',64))) where aggregate_id='79000000-0000-4000-8000-000000000001';
 update history_private.aggregate_page set page_number=1 where aggregate_id='79000000-0000-4000-8000-000000000001';
 perform pg_temp.checkpoint_error('ready','{"pages":1}','HISTORY_INCOMPLETE');
 update history_private.aggregate_page set page_number=0 where aggregate_id='79000000-0000-4000-8000-000000000001';
 result:=pg_temp.checkpoint('ready','{"pages":1}');
 if result->>'status' is distinct from 'finalize' or result->>'outputPages' is distinct from '1' or result is distinct from pg_temp.checkpoint('ready','{"pages":1}') then raise exception 'CHECKPOINT_READY_RETRY';end if;
 if pg_temp.checkpoint('status')->>'outputPages' is distinct from '1' then raise exception 'CHECKPOINT_FINALIZE_RESTART';end if;
 receipt:=public.travel_life_history_finalize_worker('19000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','activate',activation||'{"phase":"commit"}');
 if receipt->>'status' is distinct from 'complete' then raise exception 'CHECKPOINT_COMMIT';end if;
 if pg_temp.checkpoint('status') is distinct from receipt or pg_temp.checkpoint('status',jsonb_build_object('domainDigest',repeat('b',64))) is distinct from receipt then raise exception 'CHECKPOINT_COMMIT_LOST_ACK';end if;
 if exists(select 1 from history_private.merge_checkpoint where operation_id='79000000-0000-4000-8000-000000000001') or exists(select 1 from history_private.merge_checkpoint_page where operation_id='79000000-0000-4000-8000-000000000001') then raise exception 'CHECKPOINT_COMPLETE_CONTENT_PURGE';end if;
end $$;

-- Live-job, retained operation receipt and total prepared-byte quotas.
-- Valid owners may use identical operation/page numbers without sharing state.
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('19000000-0000-4000-8000-000000000002','checkpoint-other@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id) values('29000000-0000-4000-8000-000000000002','19000000-0000-4000-8000-000000000002');
insert into history_private.account(owner_id,history_consent) values('19000000-0000-4000-8000-000000000002',true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision) values('19000000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000002','59000000-0000-4000-8000-000000000002',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision) values('19000000-0000-4000-8000-000000000002','69000000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000002',1,'initial',1,37,1);
insert into history_private.snapshot_page values('19000000-0000-4000-8000-000000000002','69000000-0000-4000-8000-000000000002',0,'[]',repeat('a',64));
create function pg_temp.other_checkpoint(action text,extra jsonb default '{}') returns jsonb language sql as $$
 select public.travel_life_history_checkpoint('19000000-0000-4000-8000-000000000002','29000000-0000-4000-8000-000000000002',action,jsonb_build_object('operationId','79000000-0000-4000-8000-000000000009','domainDigest',repeat('a',64))||extra)
$$;
do $$
declare operation uuid:='79000000-0000-4000-8000-000000000009';base_a jsonb;base_b jsonb;result jsonb;
begin
 base_a:=pg_temp.checkpoint('status','{}',operation)->'base';base_b:=pg_temp.other_checkpoint('status')->'base';
 if base_a is not distinct from base_b then raise exception 'CHECKPOINT_OWNER_PLANS';end if;
 perform pg_temp.checkpoint('start',jsonb_build_object('base',base_a,'pages',1),operation);
 perform pg_temp.other_checkpoint('start',jsonb_build_object('base',base_b,'pages',2));
 result:=pg_temp.checkpoint('page','{"page":0,"records":["Synthetic owner A"]}',operation);
 if result is distinct from pg_temp.checkpoint('page','{"page":0,"records":["Synthetic owner A"]}',operation) then raise exception 'CHECKPOINT_OWNER_A_RETRY';end if;
 result:=pg_temp.other_checkpoint('page','{"page":0,"records":["Synthetic owner B"]}');
 if result is distinct from pg_temp.other_checkpoint('page','{"page":0,"records":["Synthetic owner B"]}') then raise exception 'CHECKPOINT_OWNER_B_RETRY';end if;
 if pg_temp.checkpoint('seal','{}',operation)->>'status' is distinct from 'build' then raise exception 'CHECKPOINT_OWNER_A_SEAL';end if;
 if pg_temp.other_checkpoint('seal')->>'error' is distinct from 'HISTORY_INCOMPLETE' then raise exception 'CHECKPOINT_OWNER_B_CARDINALITY';end if;
 perform pg_temp.other_checkpoint('page','{"page":1,"records":["Synthetic owner B second"]}');
 if pg_temp.other_checkpoint('seal')->>'status' is distinct from 'build' then raise exception 'CHECKPOINT_OWNER_B_SEAL';end if;
 if pg_temp.checkpoint('read','{"page":0}',operation)->'records' is distinct from '["Synthetic owner A"]'::jsonb or pg_temp.other_checkpoint('read','{"page":0}')->'records' is distinct from '["Synthetic owner B"]'::jsonb then raise exception 'CHECKPOINT_OWNER_PAYLOAD';end if;
 if pg_temp.checkpoint('read-batch','{"page":0,"count":1}',operation)->'records' is distinct from '["Synthetic owner A"]'::jsonb or pg_temp.other_checkpoint('read-batch','{"page":0,"count":2}')->'records' is distinct from '["Synthetic owner B","Synthetic owner B second"]'::jsonb then raise exception 'CHECKPOINT_BATCH_OWNER_ORDER';end if;
 perform pg_temp.checkpoint_error('read-batch','{"page":0,"count":0}','HISTORY_SCHEMA',operation);
 perform pg_temp.checkpoint_error('read-batch','{"page":0,"count":9}','HISTORY_SCHEMA',operation);
 perform pg_temp.checkpoint_error('read-batch','{"page":0,"count":2}','HISTORY_SCHEMA',operation);
 perform pg_temp.checkpoint_error('read-batch','{"page":0,"count":1,"extra":"Synthetic"}','HISTORY_SCHEMA',operation);
 if public.travel_life_history_checkpoint('19000000-0000-4000-8000-000000000002','29000000-0000-4000-8000-000000000001','read-batch',jsonb_build_object('operationId',operation,'domainDigest',repeat('a',64),'page',0,'count',1))->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'CHECKPOINT_BATCH_OWNER_SESSION';end if;
 if public.travel_life_history_checkpoint('19000000-0000-4000-8000-000000000002','29000000-0000-4000-8000-000000000001','read',jsonb_build_object('operationId',operation,'domainDigest',repeat('a',64),'page',0))->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'CHECKPOINT_OWNER_SESSION_PAIR';end if;
 if pg_temp.other_checkpoint('status',jsonb_build_object('domainDigest',repeat('b',64)))->>'error' is distinct from 'HISTORY_STALE' then raise exception 'CHECKPOINT_OWNER_B_RETIRE';end if;
 if exists(select 1 from history_private.merge_checkpoint_page where owner_id='19000000-0000-4000-8000-000000000002' and operation_id=operation) then raise exception 'CHECKPOINT_OWNER_B_RETIRED_CONTENT';end if;
 if pg_temp.checkpoint('read','{"page":0}',operation)->'records' is distinct from '["Synthetic owner A"]'::jsonb then raise exception 'CHECKPOINT_RETIRE_OTHER_OWNER';end if;
 delete from history_private.merge_checkpoint where owner_id='19000000-0000-4000-8000-000000000001' and operation_id=operation;
end $$;

-- A prior worker's uncommitted output has no trusted prepared checkpoint.
-- Retire only that derived output; never rebase it, touch source facts, or
-- remove the completed aggregate's immutable receipt.
do $$
declare base jsonb;operation uuid:='79000000-0000-4000-8000-000000000007';replacement uuid:='79000000-0000-4000-8000-000000000008';source_count bigint;receipt_count bigint;
begin
 base:=pg_temp.checkpoint('status','{}',operation)->'base';
 select count(*) into source_count from history_private.snapshot_page where owner_id='19000000-0000-4000-8000-000000000001';
 select count(*) into receipt_count from history_private.receipt where owner_id='19000000-0000-4000-8000-000000000001';
 insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,expected_pages,metadata,engine_version)
 values('19000000-0000-4000-8000-000000000001',operation,(base->>'accountGeneration')::bigint,(base->>'expectedAccountRevision')::bigint,base->'sourcePlan',1,'{"domainSourceDigest":"legacy"}','reconstruction-v1/trip-detector-v1.1');
 insert into history_private.aggregate_page values('19000000-0000-4000-8000-000000000001',operation,0,'[]',repeat('a',64));
 if pg_temp.checkpoint('status','{}',operation)->>'error' is distinct from 'HISTORY_STALE' then raise exception 'CHECKPOINT_LEGACY_STAGING';end if;
 if exists(select 1 from history_private.aggregate where owner_id='19000000-0000-4000-8000-000000000001' and aggregate_id=operation) or exists(select 1 from history_private.aggregate_page where owner_id='19000000-0000-4000-8000-000000000001' and aggregate_id=operation) then raise exception 'CHECKPOINT_LEGACY_DERIVED_PURGE';end if;
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',1),'HISTORY_STALE',operation);
 if pg_temp.checkpoint('start',jsonb_build_object('base',base,'pages',1),replacement)->>'status' is distinct from 'prepare' then raise exception 'CHECKPOINT_LEGACY_REPLACEMENT';end if;
 if (select count(*) from history_private.snapshot_page where owner_id='19000000-0000-4000-8000-000000000001')<>source_count or (select count(*) from history_private.receipt where owner_id='19000000-0000-4000-8000-000000000001')<>receipt_count then raise exception 'CHECKPOINT_LEGACY_SOURCE_FACTS';end if;
 if pg_temp.checkpoint('status')->>'status' is distinct from 'complete' then raise exception 'CHECKPOINT_LEGACY_ACTIVE_PRESERVED';end if;
 delete from history_private.merge_checkpoint where owner_id='19000000-0000-4000-8000-000000000001' and operation_id=replacement;
 -- Keep the quota fixture's initial retained-operation count independent.
 delete from history_private.expired_merge_checkpoint where owner_id='19000000-0000-4000-8000-000000000001' and operation_id=operation;
end $$;

-- Live-job, retained operation receipt and total prepared-byte quotas.
do $$
declare base jsonb;bulk uuid:='79000000-0000-4000-8000-000000000002';new_job uuid:='79000000-0000-4000-8000-000000000003';
begin
 base:=pg_temp.checkpoint('status','{}',bulk)->'base';
 insert into history_private.merge_checkpoint(owner_id,operation_id,domain_digest,base,expected_pages)
 values('19000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000005',repeat('b',64),base,1);
 perform pg_temp.checkpoint('status','{}',new_job);
 if not exists(select 1 from history_private.merge_checkpoint where operation_id='79000000-0000-4000-8000-000000000005') then raise exception 'CHECKPOINT_OTHER_OPERATION_DOMAIN';end if;
 delete from history_private.merge_checkpoint where operation_id='79000000-0000-4000-8000-000000000005';
 insert into history_private.merge_checkpoint(owner_id,operation_id,domain_digest,base,expected_pages)
 select '19000000-0000-4000-8000-000000000001',gen_random_uuid(),repeat('a',64),base,1 from generate_series(1,20);
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',1),'HISTORY_QUOTA',new_job);
 delete from history_private.merge_checkpoint where operation_id<>'79000000-0000-4000-8000-000000000001';
 perform pg_temp.checkpoint('start',jsonb_build_object('base',base,'pages',200),bulk);
 insert into history_private.merge_checkpoint_page(owner_id,operation_id,page_number,records,content_digest)
 select '19000000-0000-4000-8000-000000000001',bulk,i,jsonb_build_array(repeat('x',399980)),repeat('c',64) from generate_series(0,166)i;
 perform pg_temp.checkpoint_error('page',jsonb_build_object('page',167,'records',jsonb_build_array(repeat('x',399980))),'HISTORY_QUOTA',bulk);
 insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,expected_pages,metadata,engine_version)
 values('19000000-0000-4000-8000-000000000001',bulk,(base->>'accountGeneration')::bigint,(base->>'expectedAccountRevision')::bigint,base->'sourcePlan',1,jsonb_build_object('domainSourceDigest',repeat('a',64),'ownerRevision',base->'ownerRevision'),'reconstruction-v1/trip-detector-v1.1');
 insert into history_private.aggregate_page values('19000000-0000-4000-8000-000000000001',bulk,0,'[]',repeat('a',64));
 -- Invalidate the nearly-full old plan, then request a different operation.
 -- Its scoped sweep must release both prepared bytes and the live slot now.
 update history_private.account set revision=revision+1 where owner_id='19000000-0000-4000-8000-000000000001';
 base:=pg_temp.checkpoint('status','{}',new_job)->'base';
 if exists(select 1 from history_private.merge_checkpoint_page where operation_id=bulk) or exists(select 1 from history_private.merge_checkpoint where operation_id=bulk) then raise exception 'CHECKPOINT_STALE_CONTENT';end if;
 if exists(select 1 from history_private.aggregate where owner_id='19000000-0000-4000-8000-000000000001' and aggregate_id=bulk) or exists(select 1 from history_private.aggregate_page where owner_id='19000000-0000-4000-8000-000000000001' and aggregate_id=bulk) then raise exception 'CHECKPOINT_STALE_DERIVED_OUTPUT';end if;
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',1),'HISTORY_STALE',bulk);
 if pg_temp.checkpoint('start',jsonb_build_object('base',base,'pages',1),new_job)->>'status' is distinct from 'prepare' then raise exception 'CHECKPOINT_REPLACEMENT';end if;
 if pg_temp.checkpoint('page',jsonb_build_object('page',0,'records',jsonb_build_array(repeat('x',399980))),new_job)->>'status' is distinct from 'prepare' then raise exception 'CHECKPOINT_REPLACEMENT_BYTES';end if;
 update history_private.merge_checkpoint set expires_at=now()-interval '1 second' where operation_id=new_job;
 if pg_temp.checkpoint('status','{}',new_job)->>'error' is distinct from 'HISTORY_STALE' then raise exception 'CHECKPOINT_EXPIRY';end if;
 if exists(select 1 from history_private.merge_checkpoint_page where operation_id=new_job) or exists(select 1 from history_private.merge_checkpoint where operation_id=new_job) then raise exception 'CHECKPOINT_EXPIRED_CONTENT';end if;
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',1),'HISTORY_STALE',new_job);
 if not exists(select 1 from history_private.aggregate where aggregate_id='79000000-0000-4000-8000-000000000001' and state='active') then raise exception 'CHECKPOINT_CLEANUP_ACTIVE_AGGREGATE';end if;
 insert into history_private.expired_merge_checkpoint select '19000000-0000-4000-8000-000000000001',gen_random_uuid() from generate_series(1,9998);
 perform pg_temp.checkpoint_error('start',jsonb_build_object('base',base,'pages',1),'HISTORY_QUOTA','79000000-0000-4000-8000-000000000006');
end $$;

-- Real service RPC execution is admitted, direct table access is never needed.
set local role service_role;
do $$begin
 if public.travel_life_history_checkpoint('19000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','status',jsonb_build_object('operationId','79000000-0000-4000-8000-000000000001','domainDigest',repeat('a',64)))->>'status' is distinct from 'complete' then raise exception 'CHECKPOINT_SERVICE_INVOKER';end if;
end $$;
reset role;
-- Account deletion's fixed-table cleanup deletes account last; cascading FKs
-- remove prepared content and operation receipts without changing that procedure.
-- Seed live prepared content explicitly: completed-operation cleanup above must
-- not make the header/page cascade assertion vacuous.
insert into history_private.merge_checkpoint(owner_id,operation_id,domain_digest,base,expected_pages)
 values('19000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000004',repeat('a',64),'{}',1);
insert into history_private.merge_checkpoint_page values('19000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000004',0,'["Synthetic deletion payload"]',repeat('a',64));
delete from history_private.aggregate where owner_id='19000000-0000-4000-8000-000000000001';
delete from history_private.snapshot where owner_id='19000000-0000-4000-8000-000000000001';
delete from history_private.source where owner_id='19000000-0000-4000-8000-000000000001';
delete from history_private.receipt where owner_id='19000000-0000-4000-8000-000000000001';
delete from history_private.account where owner_id='19000000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from history_private.merge_checkpoint where owner_id='19000000-0000-4000-8000-000000000001') or exists(select 1 from history_private.merge_checkpoint_page where owner_id='19000000-0000-4000-8000-000000000001') or exists(select 1 from history_private.expired_merge_checkpoint where owner_id='19000000-0000-4000-8000-000000000001') then raise exception 'CHECKPOINT_DELETION_CASCADE';end if;
end $$;
select 'PASS: durable checkpoint immutable retries, restart/receipt precedence, complete cardinality, authority/domain/session/consent/source fences, quotas, expiry, grants and deletion cascade';
rollback;
