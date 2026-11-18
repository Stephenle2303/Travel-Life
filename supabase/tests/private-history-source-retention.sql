-- Synthetic transaction rollback: removal preserves owner facts and actionable review.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user)
values('12000000-0000-4000-8000-000000000001','retention@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at)
values('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',now(),now());
insert into history_private.account(owner_id,history_consent)
values('12000000-0000-4000-8000-000000000001',true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision)
values('12000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision)
values('12000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001',1,'initial',1,37,1);
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
values('12000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001',0,'[
 {"kind":"evidence","key":"source-evidence","value":{"evidence_id":"source-evidence","source_ref":"PRIVATE_SOURCE_SENTINEL"}},
 {"kind":"manual","key":"manual","value":{"manual_id":"manual","owner_label":"PRIVATE_OWNER_FACT"}},
 {"kind":"home","key":"home","value":{"area_id":"home","owner_label":"PRIVATE_OWNER_HOME"}},
 {"kind":"privacy","key":"1","value":{"target_kind":"manual","action":"hide","manual_id":"manual"}},
 {"kind":"privacy","key":"2","value":{"target_kind":"inferred","action":"exclude","reviewed_evidence_json":"[\"source-evidence\"]"}},
 {"kind":"journey-correction","key":"correction","value":{"state":"effective","reviewed_snapshot_json":"{\"title\":\"PRIVATE_OWNER_CORRECTION\"}"}}
]'::jsonb,'synthetic');
do $$
declare subject uuid:='12000000-0000-4000-8000-000000000001'; result jsonb; previous jsonb; request jsonb; resolved jsonb; retained uuid;
begin
 perform set_config('request.jwt.claims','{"sub":"12000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"22000000-0000-4000-8000-000000000001"}',true);
 if has_function_privilege('authenticated','history_private.resolve_removed_source(jsonb)','execute') then raise exception 'TEST_PRIVATE_RESOLUTION_GRANT'; end if;
 request:='{"mutationId":"72000000-0000-4000-8000-000000000001","generation":1,"sourceId":"42000000-0000-4000-8000-000000000001","sourceGeneration":1,"mode":"removed"}';
 if to_regprocedure('history_private.pre_source_impact(text,jsonb)') is not null then request:=request||'{"expectedSourceRevision":1,"expectedAccountRevision":0}';end if;
 result:=public.travel_life_history('source-control',request); previous:=result;
 if result->>'status' is distinct from 'complete' or result->>'reviewRequired' is distinct from 'true' then raise exception 'TEST_REMOVAL_REVIEW'; end if;
 result:=public.travel_life_history('source-control',request);
 if result is distinct from previous then raise exception 'TEST_REMOVAL_RECEIPT'; end if;
 result:=public.travel_life_history('source-control',request||'{"mode":"active"}'::jsonb);
 if result->>'error' is distinct from 'HISTORY_CONFLICT' then raise exception 'TEST_REMOVAL_IDEMPOTENCY_CONFLICT'; end if;
 if exists(select 1 from history_private.snapshot_page where owner_id=subject and records::text like '%PRIVATE_SOURCE_SENTINEL%') then raise exception 'TEST_REMOVED_EVIDENCE_PURGED'; end if;
 select snapshot_id into retained from history_private.snapshot where owner_id=subject and state='pending';
 if not exists(select 1 from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=subject and r->>'kind'='manual' and r->'value'->>'owner_label'='PRIVATE_OWNER_FACT') then raise exception 'TEST_MANUAL_PRESERVED'; end if;
 if not exists(select 1 from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=subject and r->>'kind'='journey-correction' and r->'value'->>'state'='pending_remap') then raise exception 'TEST_PROPOSAL_RETAINED'; end if;
 if not exists(select 1 from jsonb_array_elements(history_private.current_source_plan(subject)) p where p->>'retainedOwnerFacts'='true' and p->>'state'='removed') then raise exception 'TEST_TRUSTED_RETAINED_PLAN'; end if;
 result:=public.travel_life_history('source-review','{"sourceId":"42000000-0000-4000-8000-000000000001","page":0}');
 if result->>'status' is distinct from 'complete' or jsonb_array_length(result->'records')<>5 then raise exception 'TEST_REVIEW_PAGE'; end if;
 request:='{"mutationId":"72000000-0000-4000-8000-000000000002","generation":1,"sourceId":"42000000-0000-4000-8000-000000000001","sourceGeneration":2,"expectedSourceRevision":1,"mode":"archive-source-proposals"}';
 result:=public.travel_life_history('resolve-conflict',request);
 if result->>'error' is distinct from 'HISTORY_CONFLICT' or result::text like '%PRIVATE_%' then raise exception 'TEST_RESOLUTION_CAS_REDACTED'; end if;
 request:=request||'{"expectedSourceRevision":2}'::jsonb;
 result:=public.travel_life_history('resolve-conflict',request); resolved:=result;
 if result->>'status' is distinct from 'complete' or result->>'sourceSnapshotRevision'<>'3' then raise exception 'TEST_RESOLUTION'; end if;
 result:=public.travel_life_history('resolve-conflict',request);
 if result is distinct from resolved then raise exception 'TEST_RESOLUTION_RECEIPT'; end if;
 if not exists(select 1 from history_private.snapshot where owner_id=subject and snapshot_id=retained and state='removed') then raise exception 'TEST_IMMUTABLE_PROPOSAL_ARCHIVE'; end if;
 result:=public.travel_life_history('source-review','{"sourceId":"42000000-0000-4000-8000-000000000001","page":0}');
 if jsonb_array_length(result->'records')<>3 or result->>'archived'<>'false' then raise exception 'TEST_INDEPENDENT_FACTS_AUTHORITY'; end if;
 result:=public.travel_life_history('source-review','{"sourceId":"42000000-0000-4000-8000-000000000001","page":0,"archived":true}');
 if jsonb_array_length(result->'records')<>5 or result->>'archived'<>'true' then raise exception 'TEST_ARCHIVE_INSPECTABLE'; end if;
 result:=public.travel_life_history('source-control','{"mutationId":"72000000-0000-4000-8000-000000000003","generation":1,"sourceId":"42000000-0000-4000-8000-000000000001","sourceGeneration":2,"mode":"active"}');
 if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_REMOVAL_CANNOT_RECONNECT'; end if;
 perform set_config('request.jwt.claims','{"sub":"12000000-0000-4000-8000-000000000099","role":"authenticated","is_anonymous":false,"session_id":"22000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('source-review','{"sourceId":"42000000-0000-4000-8000-000000000001","page":0,"archived":true}');
 if result->>'error' is distinct from 'ACCOUNT_SESSION' or result::text like '%PRIVATE_%' then raise exception 'TEST_REVIEW_OWNER_ISOLATION'; end if;
end $$;
select 'PASS: removal fences, independent owner facts, immutable proposals, versioned resolution and redaction' as result;
rollback;
