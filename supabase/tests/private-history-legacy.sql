-- Synthetic legacy authority, immutable checkpoint, original CAS and lifecycle fences.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('19000000-0000-4000-8000-000000000001','legacy@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('29000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001',now(),now());
insert into history_private.account(owner_id,history_consent) values('19000000-0000-4000-8000-000000000001',true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision) values('19000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision) values('19000000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001',1,'initial',1,37,1);
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest) values('19000000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001',0,'[]','synthetic');
insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,state,expected_pages,metadata,engine_version,aggregate_revision) values('19000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001',1,0,history_private.current_source_plan('19000000-0000-4000-8000-000000000001'),'active',1,'{}','reconstruction-v1/trip-detector-v1.1',1);
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest) values('19000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001',0,'[]','synthetic');
update history_private.account set active_aggregate='79000000-0000-4000-8000-000000000001',aggregate_revision=1 where owner_id='19000000-0000-4000-8000-000000000001';
do $$
declare subject uuid:='19000000-0000-4000-8000-000000000001';sid uuid:='29000000-0000-4000-8000-000000000001';
 operation uuid:='89000000-0000-4000-8000-000000000001';request jsonb;result jsonb;old jsonb;delta jsonb;claims text;first_request jsonb;privacy_a jsonb;privacy_b jsonb;conflict_id uuid;
begin
 perform set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"29000000-0000-4000-8000-000000000001"}',true);
 claims:=current_setting('request.jwt.claims');
 delta:='{"rows":[{"kind":"manual","key":"canonical-manual","value":{"manual_id":"canonical-manual","command_key":"canonical-command","owner_label":"Synthetic owner edit","owner_context":"Synthetic place","date_kind":"exact","date_start":"2024-01-01","date_end":"2024-01-02","latitude":0,"longitude":0,"created_at_millis":1}}],"deleted":[]}';
 request:=jsonb_build_object('operationId',operation,'legacy',jsonb_build_object('generation',1,'baseSnapshot','69000000-0000-4000-8000-000000000001','expectedOwnerRevision',0,'baselineDigest',repeat('a',64),'editedDigest',repeat('b',64),'changes',delta));
 first_request:=request;
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',request);
 if result->>'kind' is distinct from 'initial' or result->>'sourceId'<>'49000000-0000-4000-8000-000000000001' then raise exception 'TEST_INITIAL_AUTHORITY';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',jsonb_set(request,'{legacy,editedDigest}',to_jsonb(repeat('c',64))));
 if result->>'error' is distinct from 'HISTORY_CONFLICT' then raise exception 'TEST_IMMUTABLE_LEGACY_BRANCH';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-page',jsonb_build_object('operationId',operation,'scope','baseline','page',0));
 if result->'records' is distinct from '[]'::jsonb then raise exception 'TEST_BOUND_BASELINE_PAGE';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-translate',jsonb_build_object('operationId',operation,'changes',delta));
 if result->>'status' is distinct from 'staged' then raise exception 'TEST_TRANSLATION_STAGE';end if;
 -- Equivalent aggregate replacement between phases must not strand this immutable job.
 insert into history_private.aggregate select owner_id,'79000000-0000-4000-8000-000000000002'::uuid,account_generation,expected_account_revision,source_plan,state,expected_pages,metadata,engine_version,content_digest,aggregate_revision,created_at from history_private.aggregate where owner_id=subject;
 insert into history_private.aggregate_page select owner_id,'79000000-0000-4000-8000-000000000002'::uuid,page_number,records,content_digest from history_private.aggregate_page where owner_id=subject;
 update history_private.account set active_aggregate='79000000-0000-4000-8000-000000000002' where owner_id=subject;
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',request);if result->'translated' is distinct from delta then raise exception 'TEST_REPLACED_AGGREGATE_RETAINS_TRANSLATION';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-page',jsonb_build_object('operationId',operation,'scope','canonical','page',0));if result->'records' is distinct from '[]'::jsonb then raise exception 'TEST_REPLACED_AGGREGATE_IMMUTABLE_READ';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-commit',jsonb_build_object('operationId',operation));old:=result;
 if result->>'status' is distinct from 'accepted' or result->>'ownerRevision'<>'1' then raise exception 'TEST_LEGACY_CANONICAL_CAS';end if;
 if current_setting('request.jwt.claims') is distinct from claims then raise exception 'TEST_WORKER_CLAIMS_RESTORED';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',request);if result is distinct from old then raise exception 'TEST_LOST_ACK_RECEIPT';end if;
 -- Concurrent canonical change is projected before a second original-baseline proposal.
 update history_private.aggregate set metadata='{"ownerRevision":1}' where owner_id=subject;
 operation:='89000000-0000-4000-8000-000000000002';request:=jsonb_set(request,'{operationId}',to_jsonb(operation));
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',request);if result->>'status' is distinct from 'planned' then raise exception 'TEST_STALE_REVISION_PLAN';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-translate',jsonb_build_object('operationId',operation,'changes',delta));
 result:=public.travel_life_history_worker(subject,sid,'legacy-commit',jsonb_build_object('operationId',operation));
 if result->>'status' is distinct from 'conflict' or (select expected_revision from history_private.owner_proposal where owner_id=subject and mutation_id=operation)<>0 then raise exception 'TEST_ORIGINAL_REVISION_NOT_REBASED';end if;
 -- Persisted aggregate authority classifies an unknown native marker without normalization.
 operation:='89000000-0000-4000-8000-000000000003';request:=jsonb_set(jsonb_set(jsonb_set(request,'{operationId}',to_jsonb(operation)),'{legacy,baseSnapshot}','"79000000-0000-4000-8000-000000000001"'),'{legacy,expectedOwnerRevision}','1');
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',request);if result->>'kind' is distinct from 'aggregate' then raise exception 'TEST_PROVED_CANONICAL_KIND';end if;
 -- Two migrations can translate privacy against the same original append range.
 privacy_a:='{"rows":[{"kind":"privacy","key":"1000000001","value":{"revision":1000000001,"policy_id":"policy-a","command_key":"privacy-a","action":"hide","target_kind":"inferred","source_run_id":0,"reviewed_evidence_json":"[]","reviewed_family_json":"[]","reviewed_label":"Synthetic A","manual_id":null,"created_at_millis":1}}],"deleted":[]}';
 privacy_b:=jsonb_set(jsonb_set(privacy_a,'{rows,0,value,policy_id}','"policy-b"'),'{rows,0,value,command_key}','"privacy-b"');
 privacy_b:=jsonb_set(privacy_b,'{rows}',(privacy_b->'rows')||jsonb_build_array(
  jsonb_set(jsonb_set(jsonb_set(privacy_b->'rows'->0,'{key}','"1000000002"'),'{value,revision}','1000000002'),'{value,action}','"restore"'),
  jsonb_set(jsonb_set(privacy_b->'rows'->0,'{key}','"1000000003"'),'{value,revision}','1000000003')));
 result:=public.travel_life_history('correction-propose',jsonb_build_object('mutationId','99000000-0000-4000-8000-000000000001','generation',1,'baseAggregate','79000000-0000-4000-8000-000000000002','expectedOwnerRevision',1,'changes',privacy_a));if result->>'status' is distinct from 'accepted' then raise exception 'TEST_FIRST_MIGRATED_POLICY';end if;
 conflict_id:='99000000-0000-4000-8000-000000000002';
 result:=public.travel_life_history('correction-propose',jsonb_build_object('mutationId',conflict_id,'generation',1,'baseAggregate','79000000-0000-4000-8000-000000000002','expectedOwnerRevision',1,'changes',privacy_b));if result->>'status' is distinct from 'conflict' then raise exception 'TEST_SECOND_POLICY_CONFLICT';end if;
 result:=public.travel_life_history('correction-resolve',jsonb_build_object('mutationId','99000000-0000-4000-8000-000000000003','generation',1,'expectedOwnerRevision',2,'proposalId',conflict_id,'choice','proposed'));if result->>'status' is distinct from 'accepted' then raise exception 'TEST_POLICY_RESOLUTION';end if;
 if (select count(distinct r->'value'->>'policy_id') from history_private.owner_journal j cross join lateral jsonb_array_elements(j.changes->'rows') r where j.owner_id=subject and r->>'kind'='privacy')<>2 then raise exception 'TEST_UNRELATED_PRIVACY_SURVIVES';end if;
 if not exists(select 1 from history_private.owner_journal j cross join lateral jsonb_array_elements(j.changes->'rows') r where j.owner_id=subject and r->'value'->>'policy_id'='policy-b' and (r->>'key')::bigint>1000000001) then raise exception 'TEST_RESOLUTION_PRIVACY_APPENDS';end if;
 if (select jsonb_agg(r->'value'->>'action' order by (r->'value'->>'revision')::bigint) from history_private.owner_journal j cross join lateral jsonb_array_elements(j.changes->'rows') r where j.owner_id=subject and r->'value'->>'policy_id'='policy-b') is distinct from '["hide","restore","hide"]'::jsonb then raise exception 'TEST_RESOLUTION_PRIVACY_ACTION_ORDER';end if;
 result:=public.travel_life_history_worker(subject,sid,'plan','{"operationId":"99000000-0000-4000-8000-000000000004"}');
 if (select count(distinct r->'value'->>'policy_id') from jsonb_array_elements(result->'ownerChanges'->'rows') r where r->>'kind'='privacy')<>2 then raise exception 'TEST_REBUILD_RETAINS_BOTH_POLICIES';end if;
 -- The latest accepted policy is journal-only, at another numeric row key.
 update history_private.aggregate set metadata='{"ownerRevision":3}' where owner_id=subject;
 privacy_a:=jsonb_set(jsonb_set(jsonb_set(privacy_a,'{rows,0,key}','"1000000005"'),'{rows,0,value,revision}','1000000005'),'{rows,0,value,action}','"restore"');
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',jsonb_set(first_request,'{operationId}','"89000000-0000-4000-8000-000000000005"'));if result->>'status' is distinct from 'planned' then raise exception 'TEST_PRIVACY_CONTEXT_PLAN';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-translate',jsonb_build_object('operationId','89000000-0000-4000-8000-000000000005','changes',privacy_a));
 result:=public.travel_life_history_worker(subject,sid,'legacy-commit','{"operationId":"89000000-0000-4000-8000-000000000005"}');if result->>'status' is distinct from 'conflict' then raise exception 'TEST_PRIVACY_CONTEXT_CONFLICT';end if;
 result:=public.travel_life_history('correction-conflicts','{"page":1}');
 if result->'proposal'->>'mutationId'<>'89000000-0000-4000-8000-000000000005' or not exists(select 1 from jsonb_array_elements(result->'proposal'->'accepted'->'rows') r where r->'value'->>'policy_id'='policy-a' and r->'value'->>'action'='hide') then raise exception 'TEST_JOURNAL_ONLY_PRIVACY_ACCEPTED_CONTEXT';end if;
 update history_private.source set generation=generation+1,state='removed' where owner_id=subject;
 result:=public.travel_life_history_worker(subject,sid,'legacy-translate',jsonb_build_object('operationId',operation,'changes',delta));if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_SOURCE_REMOVAL_FENCE';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',jsonb_set(request,'{operationId}','"89000000-0000-4000-8000-000000000004"'));if result->>'error' not in ('HISTORY_REVIEW','HISTORY_FENCED') then raise exception 'TEST_REMOVED_AUTHORITY_UNAVAILABLE';end if;
 insert into history_private.legacy_proposal select lp.owner_id,('aaaaaaaa-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,lp.request,lp.request_digest,lp.account_generation,lp.source_plan,lp.aggregate_id,lp.authority_kind,lp.baseline_id,lp.source_id,lp.baseline_pages,lp.canonical_pages,lp.translated,lp.result from history_private.legacy_proposal lp cross join generate_series(1,20-(select count(*)::integer from history_private.legacy_proposal where owner_id=subject)) n where lp.owner_id=subject and lp.mutation_id='89000000-0000-4000-8000-000000000001';
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',jsonb_set(first_request,'{operationId}','"89000000-0000-4000-8000-000000000099"'));if result->>'error' is distinct from 'HISTORY_QUOTA' then raise exception 'TEST_LEGACY_OWNER_QUOTA';end if;
 result:=public.travel_life_history_worker(subject,sid,'legacy-plan',first_request);if result is distinct from old then raise exception 'TEST_QUOTA_PRESERVES_EXISTING_RECEIPT';end if;
 update history_private.account set delete_fenced_at=now(),generation=generation+1 where owner_id=subject;
 result:=public.travel_life_history_worker(subject,sid,'legacy-commit','{"operationId":"89000000-0000-4000-8000-000000000001"}');if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_DELETE_FENCES_RECEIPT';end if;
 result:=public.travel_life_history_worker('19000000-0000-4000-8000-000000000099',sid,'legacy-plan',request);if result->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_LEGACY_OWNER_ISOLATION';end if;
end $$;
rollback;
-- Exercise the same invoker role as the real Edge worker, not only postgres.
do $$ begin
 if not has_function_privilege('service_role','history_private.worker_action(uuid,uuid,text,jsonb)','execute') then raise exception 'worker service role grant';end if;
end $$;
