-- Synthetic protocol fixture; no object or real media is uploaded. Always rollback.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user)
values('13000000-0000-4000-8000-000000000001','media-fixture@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at)
values('23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001',now(),now());
insert into history_private.account(owner_id,history_consent,media_consent)
values('13000000-0000-4000-8000-000000000001',true,true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision)
values('13000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision)
values('13000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001',1,'initial',1,37,1);
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest)
values('13000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001',0,'[]','synthetic');
insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,state,expected_pages,metadata,engine_version,aggregate_revision)
values('13000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',1,0,history_private.current_source_plan('13000000-0000-4000-8000-000000000001'),'active',1,
'{"sourceCopies":[{"sourceId":"43000000-0000-4000-8000-000000000001","evidenceId":"83000000-0000-4000-8000-000000000001"}],"privacy":{"hiddenEvidenceIds":[],"excludedEvidenceIds":[]}}','reconstruction-v1/trip-detector-v1.1',1);
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest)
values('13000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',0,'[{"kind":"evidence","key":"83000000-0000-4000-8000-000000000001","value":{}}]','synthetic');
update history_private.account set active_aggregate='73000000-0000-4000-8000-000000000001',aggregate_revision=1 where owner_id='13000000-0000-4000-8000-000000000001';
do $$
declare subject uuid:='13000000-0000-4000-8000-000000000001';sid uuid:='23000000-0000-4000-8000-000000000001';
 manifest jsonb;request jsonb;result jsonb;old jsonb;artifact uuid;replacement uuid;lease uuid;items jsonb;path text;
begin
 if has_function_privilege('authenticated','public.travel_life_private_media(uuid,uuid,text,jsonb)','execute') or has_function_privilege('anon','public.travel_life_private_media_cleanup(text,jsonb)','execute') then raise exception 'TEST_SERVICE_ONLY_MEDIA_RPC'; end if;
 if has_table_privilege('authenticated','history_private.media_artifact','select') then raise exception 'TEST_PRIVATE_MEDIA_TABLE'; end if;
 if exists(select 1 from storage.buckets where id='travel-life-private-media' and public) then raise exception 'TEST_PRIVATE_BUCKET'; end if;
 manifest:='{"contractVersion":"travel-life-private-media-v1","kind":"photo","mimeType":"image/jpeg","byteLength":5,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","width":32,"height":24,"durationMillis":null}';
 if not history_private.valid_media_manifest(manifest) or history_private.valid_media_manifest(manifest||'{"PRIVATE_SENTINEL":true}') or history_private.valid_media_manifest('[]') then raise exception 'TEST_MANIFEST_VALIDATION'; end if;
 request:=jsonb_build_object('mutationId','93000000-0000-4000-8000-000000000001','accountGeneration',1,'sourceId','43000000-0000-4000-8000-000000000001','sourceGeneration',1,'target',jsonb_build_object('kind','evidence','id','83000000-0000-4000-8000-000000000001'),'expectedRevision',0,'manifest',manifest);
 result:=public.travel_life_private_media(subject,sid,'stage',request);old:=result;
 if result->>'status' is distinct from 'staged' then raise exception 'TEST_MEDIA_STAGE'; end if;artifact:=(result->>'artifactId')::uuid;
 result:=public.travel_life_private_media(subject,sid,'stage',request);if result is distinct from old then raise exception 'TEST_MEDIA_STAGE_RECEIPT'; end if;
 result:=public.travel_life_private_media(subject,sid,'stage',request||'{"expectedRevision":1}');if result->>'error' is distinct from 'MEDIA_CONFLICT' then raise exception 'TEST_MEDIA_IDEMPOTENCY'; end if;
 result:=public.travel_life_private_media(subject,sid,'activate',jsonb_build_object('mutationId','93000000-0000-4000-8000-000000000002','artifactId',artifact,'expectedRevision',0));
 if result->>'error' is distinct from 'MEDIA_CONFLICT' then raise exception 'TEST_UNVERIFIED_NOT_ACTIVE'; end if;
 result:=public.travel_life_private_media(subject,sid,'upload-context',jsonb_build_object('artifactId',artifact));lease:=(result->>'uploadLease')::uuid;path:=result->>'storagePath';
 if lease is null then raise exception 'TEST_UPLOAD_LEASE'; end if;
 result:=public.travel_life_private_media(subject,sid,'upload-context',jsonb_build_object('artifactId',artifact));if result->>'error' is distinct from 'MEDIA_BUSY' then raise exception 'TEST_PARALLEL_UPLOAD_FENCE'; end if;
 result:=public.travel_life_private_media(subject,sid,'verify',jsonb_build_object('artifactId',artifact,'uploadLease',lease,'sha256','PRIVATE_SENTINEL','byteLength',5));
 if result->>'error' is distinct from 'MEDIA_VERIFY' or result::text like '%PRIVATE_SENTINEL%' then raise exception 'TEST_VERIFY_BINDING_REDACTION'; end if;
 result:=public.travel_life_private_media(subject,sid,'verify',jsonb_build_object('artifactId',artifact,'uploadLease',lease,'sha256',manifest->>'sha256','byteLength',5));
 if result->>'status' is distinct from 'verified' then raise exception 'TEST_TRUSTED_VERIFY'; end if;
 result:=public.travel_life_private_media(subject,sid,'activate',jsonb_build_object('mutationId','93000000-0000-4000-8000-000000000002','artifactId',artifact,'expectedRevision',0));
 if result->>'revision' is distinct from '1' then raise exception 'TEST_MEDIA_ACTIVATE'; end if;
 update history_private.source set state='paused',generation=2 where owner_id=subject;
 result:=public.travel_life_private_media(subject,sid,'download',request-'mutationId'-'accountGeneration'-'sourceId'-'sourceGeneration'-'expectedRevision'-'manifest');
 if result->>'artifactId' is distinct from artifact::text then raise exception 'TEST_PAUSE_RETAINS_MEDIA'; end if;
 update history_private.source set state='active',generation=1 where owner_id=subject;
 request:=request||'{"mutationId":"93000000-0000-4000-8000-000000000003","expectedRevision":1}';
 result:=public.travel_life_private_media(subject,sid,'stage',request);replacement:=(result->>'artifactId')::uuid;
 if replacement is null then raise exception 'TEST_REPLACEMENT_STAGE'; end if;
 result:=public.travel_life_private_media(subject,sid,'activate',jsonb_build_object('mutationId','93000000-0000-4000-8000-000000000004','artifactId',replacement,'expectedRevision',1));
 if result->>'error' is distinct from 'MEDIA_CONFLICT' or not exists(select 1 from history_private.media_attachment where owner_id=subject and artifact_id=artifact) then raise exception 'TEST_BAD_REPLACEMENT_RETAINS_USABLE'; end if;
 result:=public.travel_life_private_media(subject,sid,'upload-context',jsonb_build_object('artifactId',replacement));lease:=(result->>'uploadLease')::uuid;
 update history_private.source set state='removed',generation=2 where owner_id=subject;
 if exists(select 1 from history_private.media_attachment where owner_id=subject) then raise exception 'TEST_REMOVAL_ACCESS_FENCE'; end if;
 result:=public.travel_life_private_media_cleanup('lease','{"limit":10}');items:=result->'items';
 if exists(select 1 from jsonb_array_elements(items) i where i->>'storagePath'=subject::text||'/'||replacement::text) then raise exception 'TEST_LIVE_UPLOAD_DELAYS_CLEANUP'; end if;
 update history_private.media_artifact set upload_until=now()-interval '1 minute' where owner_id=subject and artifact_id=replacement;
 result:=public.travel_life_private_media_cleanup('lease','{"limit":10}');items:=result->'items';
 select (i->>'leaseId')::uuid,i->>'storagePath' into lease,path from jsonb_array_elements(items) i where i->>'storagePath'=subject::text||'/'||replacement::text;
 if lease is null then raise exception 'TEST_STALE_UPLOAD_CLEANUP_LEASE'; end if;
 result:=public.travel_life_private_media_cleanup('ack',jsonb_build_object('storagePath',path,'leaseId',lease));
 if not exists(select 1 from history_private.media_cleanup where storage_path=path) or not exists(select 1 from history_private.media_artifact where owner_id=subject and artifact_id=replacement) then raise exception 'TEST_ABSENT_OBJECT_NOT_PERMANENT_SETTLEMENT'; end if;
 result:=public.travel_life_private_media(subject,sid,'verify',jsonb_build_object('artifactId',replacement,'uploadLease',lease,'sha256',manifest->>'sha256','byteLength',5));
 if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_LATE_VERIFY_FENCED'; end if;
 update history_private.account set delete_fenced_at=now(),generation=generation+1,history_consent=false,media_consent=false where owner_id=subject;
 delete from history_private.snapshot where owner_id=subject;delete from history_private.source where owner_id=subject;
 if not exists(select 1 from history_private.media_cleanup where owner_id=subject) then raise exception 'TEST_ACCOUNT_DELETE_PRESERVES_PURGE_WORK'; end if;
 result:=public.travel_life_private_media(subject,sid,'status',jsonb_build_object('artifactId',artifact));if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_ACCOUNT_DELETION_DENIES_MEDIA'; end if;
end $$;
select 'PASS: private media reservation, immutable receipts, trusted verification, activation CAS, source/account fences and late-upload cleanup' as result;
rollback;
