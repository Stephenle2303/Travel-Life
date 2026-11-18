-- Synthetic fixtures only; run after M6 account, transfer guards and M7 aggregate migration.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values
 ('11000000-0000-4000-8000-000000000001','aggregate-a@example.invalid',now(),false,false),
 ('11000000-0000-4000-8000-000000000002','aggregate-b@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',now(),now()),
 ('21000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002',now(),now());
insert into history_private.account(owner_id,history_consent) values
 ('11000000-0000-4000-8000-000000000001',true),('11000000-0000-4000-8000-000000000002',true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision) values
 ('11000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1),
 ('11000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision) values
 ('11000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001',1,'initial',1,37,1),
 ('11000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002',1,'pending',1,37,1);
insert into history_private.snapshot_page values
 ('11000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',0,'[]','synthetic'),
 ('11000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002',0,'[]','synthetic');
update history_private.account set active_snapshot='61000000-0000-4000-8000-000000000001' where owner_id='11000000-0000-4000-8000-000000000001';
do $$
declare subject uuid:='11000000-0000-4000-8000-000000000001'; sid uuid:='21000000-0000-4000-8000-000000000001';
 operation uuid:='71000000-0000-4000-8000-000000000001'; plan jsonb; base jsonb; result jsonb; previous jsonb; mapped jsonb; key_input jsonb;
begin
 if has_function_privilege('authenticated','public.travel_life_history_worker(uuid,uuid,text,jsonb)','execute') or has_function_privilege('anon','public.travel_life_history_worker(uuid,uuid,text,jsonb)','execute') then raise exception 'TEST_WORKER_GRANT'; end if;
 if has_table_privilege('authenticated','history_private.aggregate_page','select') or has_table_privilege('authenticated','history_private.identity_mapping','insert') then raise exception 'TEST_TABLE_GRANT'; end if;
 result:=public.travel_life_history_worker(subject,'21000000-0000-4000-8000-000000000002','plan',jsonb_build_object('operationId',operation));
 if result->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_FOREIGN_SESSION'; end if;
 update auth.users set is_anonymous=true where id=subject;
 result:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if result->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_ANONYMOUS_DENIED'; end if;
 update auth.users set is_anonymous=false where id=subject;
 update auth.sessions set not_after=now()-interval '1 minute' where id=sid;
 result:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if result->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_EXPIRED_SESSION'; end if;
 update auth.sessions set not_after=null where id=sid;
 plan:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if plan->>'status' is distinct from 'planned' or jsonb_array_length(plan->'sourcePlan')<>2 then raise exception 'TEST_PLAN'; end if;
 update history_private.source set generation=generation+1,state='disconnected' where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002';
 result:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if jsonb_array_length(result->'sourcePlan')<>2 or result->'sourcePlan'->1->>'snapshotId' is distinct from '61000000-0000-4000-8000-000000000002' then raise exception 'TEST_DISCONNECT_RETAINS_CONTRIBUTION'; end if;
 update history_private.source set generation=generation-1,state='active' where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002';
 base:=jsonb_build_object('accountGeneration',plan->'accountGeneration','expectedAccountRevision',plan->'expectedAccountRevision','sourcePlan',plan->'sourcePlan');
 insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision)
 values(subject,'61000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000001',1,'pending',1,37,2);
 update history_private.source set snapshot_revision=2 where owner_id=subject and source_id='41000000-0000-4000-8000-000000000001';
 result:=public.travel_life_history_worker(subject,sid,'page',base||'{"snapshotId":"61000000-0000-4000-8000-000000000001","page":0}');
 if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_CHANGED_SOURCE_WATERMARK'; end if;
 delete from history_private.snapshot where owner_id=subject and snapshot_id='61000000-0000-4000-8000-000000000003';
 update history_private.source set snapshot_revision=1 where owner_id=subject and source_id='41000000-0000-4000-8000-000000000001';
 result:=public.travel_life_history_worker(subject,sid,'page',base||'{"snapshotId":"61000000-0000-4000-8000-000000000001","page":0}');
 if result->'records' is distinct from '[]'::jsonb then raise exception 'TEST_SOURCE_PAGE'; end if;
 result:=public.travel_life_history_worker(subject,sid,'page',base||'{"snapshotId":"61000000-0000-4000-8000-000000000099","page":0}');
 if result->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'TEST_NONMEMBER_PAGE'; end if;
 key_input:=base||'{"keys":[{"sourceId":"41000000-0000-4000-8000-000000000001","kind":"evidence","localId":"synthetic-private-source-key"}]}';
 mapped:=public.travel_life_history_worker(subject,sid,'map-identities',key_input);
 result:=public.travel_life_history_worker(subject,sid,'map-identities',key_input);
 if result is distinct from mapped or jsonb_array_length(mapped->'mappings')<>1 then raise exception 'TEST_STABLE_MAPPING'; end if;
 result:=public.travel_life_history_worker(subject,sid,'map-identities',base||'{"keys":[{"sourceId":"41000000-0000-4000-8000-000000000099","kind":"evidence","localId":"PRIVATE_SENTINEL"}]}');
 if result->>'error' is distinct from 'HISTORY_SCHEMA' or result::text like '%PRIVATE_SENTINEL%' then raise exception 'TEST_MAPPING_SCOPE_REDACTION'; end if;
 base:=base||jsonb_build_object('operationId',operation);
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"start","pages":1,"metadata":{"synthetic":true},"engineVersion":"reconstruction-v1/trip-detector-v1.1"}');
 if result->>'status' is distinct from 'staging' then raise exception 'TEST_STAGE_START'; end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}');
 if result->>'error' is distinct from 'HISTORY_INCOMPLETE' then raise exception 'TEST_INCOMPLETE'; end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"page","page":0,"records":[]}');
 if result->>'status' is distinct from 'staged' then raise exception 'TEST_AGGREGATE_PAGE'; end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"page","page":0,"records":[]}');
 if result->>'status' is distinct from 'staged' then raise exception 'TEST_PAGE_RETRY'; end if;
 update history_private.account set revision=revision+1 where owner_id=subject;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}');
 if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_ACCOUNT_CAS'; end if;
 update history_private.account set revision=revision-1 where owner_id=subject;
 update history_private.source set generation=generation+1 where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002';
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}');
 if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_SOURCE_FENCE'; end if;
 update history_private.source set generation=generation-1 where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002';
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}'); previous:=result;
 if result->>'status' is distinct from 'complete' or result->>'aggregateRevision'<>'1' then raise exception 'TEST_ACTIVATE'; end if;
 result:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if result is distinct from previous then raise exception 'TEST_UNKNOWN_ACK_RECONCILE'; end if;
 perform set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"21000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('source-control',jsonb_build_object('mutationId','71000000-0000-4000-8000-000000000003','generation',1,'sourceId','41000000-0000-4000-8000-000000000002','sourceGeneration',1,'mode','paused'));
 if result->>'status' is distinct from 'complete' then raise exception 'TEST_PAUSE'; end if;
 result:=public.travel_life_history('pull',jsonb_build_object('aggregateId',operation,'page',0));
 if result->'records' is distinct from '[]'::jsonb then raise exception 'TEST_PAUSE_RETAINS_READABLE_AUTHORITY'; end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||'{"phase":"commit"}');
 if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_PAUSE_FENCES_OLD_WORKER'; end if;
 update history_private.source set generation=1,state='active' where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002';
 result:=public.travel_life_history('status','{}');
 if result->>'activeAggregate' is distinct from operation::text or result->>'aggregateRevision'<>'1' then raise exception 'TEST_AGGREGATE_STATUS'; end if;
 result:=public.travel_life_history('pull',jsonb_build_object('aggregateId',operation,'page',0));
 if result->'records' is distinct from '[]'::jsonb or result->>'schemaVersion'<>'37' then raise exception 'TEST_AGGREGATE_PULL'; end if;
 perform set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"session_id":"21000000-0000-4000-8000-000000000002"}',true);
 result:=public.travel_life_history('pull',jsonb_build_object('aggregateId',operation,'page',0));
 if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_CROSS_OWNER_PULL'; end if;
 perform set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"21000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('source-control',jsonb_build_object('mutationId','71000000-0000-4000-8000-000000000001','generation',(select generation from history_private.account where owner_id=subject),'sourceId','41000000-0000-4000-8000-000000000002','sourceGeneration',(select generation from history_private.source where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002'),'mode','removed')||case when to_regprocedure('history_private.pre_source_impact(text,jsonb)') is not null then jsonb_build_object('expectedAccountRevision',(select revision from history_private.account where owner_id=subject),'expectedSourceRevision',(select snapshot_revision from history_private.source where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002')) else '{}'::jsonb end);
 if result->>'status' is distinct from 'complete' or exists(select 1 from history_private.aggregate where owner_id=subject and aggregate_id=operation) then raise exception 'TEST_REMOVAL_FENCES_OLD_AUTHORITY'; end if;
 update history_private.source set generation=generation+1,state='removed' where owner_id=subject and source_id='41000000-0000-4000-8000-000000000002';
 result:=public.travel_life_history('pull',jsonb_build_object('aggregateId',operation,'page',0));
 if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_REMOVED_SOURCE_READ_FENCE'; end if;
 update history_private.account set delete_fenced_at=now(),generation=generation+1 where owner_id=subject;
 if exists(select 1 from history_private.aggregate where owner_id=subject) or exists(select 1 from history_private.identity_mapping where owner_id=subject) then raise exception 'TEST_PURGE_ON_ACCOUNT_DELETE'; end if;
 result:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_DELETION_RESURRECTION'; end if;
 delete from auth.sessions where id=sid;
 result:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));
 if result->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_LIVE_SESSION'; end if;
end $$;
select 'PASS: mappings, owner/session isolation, exact plan/CAS, immutable pages, receipt reconciliation and deletion fences' as result;
rollback;
