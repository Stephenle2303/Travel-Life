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
 request jsonb;result jsonb;prior jsonb;artifact uuid;stage_id uuid:='93000000-0000-4000-8000-000000000021';
begin
 request:=jsonb_build_object('mutationId',stage_id,'accountGeneration',1,'sourceId','43000000-0000-4000-8000-000000000001','sourceGeneration',1,'target',jsonb_build_object('kind','evidence','id','83000000-0000-4000-8000-000000000001'),'expectedRevision',0,'manifest','{"contractVersion":"travel-life-private-media-v1","kind":"photo","mimeType":"image/jpeg","byteLength":5,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","width":32,"height":24,"durationMillis":null}'::jsonb);
 result:=public.travel_life_private_media(subject,sid,'stage',request);artifact:=(result->>'artifactId')::uuid;
 if artifact is null then raise exception 'TEST_ABANDON_STAGE';end if;
 result:=public.travel_life_private_media(subject,sid,'abandon',jsonb_build_object('stageMutationId',stage_id));prior:=result;
 if result->>'status' is distinct from 'abandoned' or result->>'artifactId' is distinct from artifact::text or not exists(select 1 from history_private.media_cleanup where owner_id=subject and artifact_id=artifact) then raise exception 'TEST_ABANDON_FENCE_QUEUE';end if;
 if exists(select 1 from history_private.media_artifact where owner_id=subject and artifact_id=artifact and state<>'fenced') then raise exception 'TEST_ABANDON_FENCE';end if;
 result:=public.travel_life_private_media(subject,sid,'abandon',jsonb_build_object('stageMutationId',stage_id));if result is distinct from prior then raise exception 'TEST_ABANDON_EXACT_RETRY';end if;
 result:=public.travel_life_private_media(subject,sid,'stage',request);if result->>'error' is distinct from 'MEDIA_CONFLICT' then raise exception 'TEST_ABANDON_LATE_STAGE';end if;
 result:=public.travel_life_private_media(subject,sid,'upload-context',jsonb_build_object('artifactId',artifact));if result->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_ABANDON_LATE_UPLOAD';end if;
 stage_id:='93000000-0000-4000-8000-000000000022';request:=request||jsonb_build_object('mutationId',stage_id);
 result:=public.travel_life_private_media(subject,sid,'abandon',jsonb_build_object('stageMutationId',stage_id));if result->>'status' is distinct from 'abandoned' or result->'artifactId' is distinct from 'null'::jsonb then raise exception 'TEST_ABANDON_ABSENT_STAGE';end if;
 result:=public.travel_life_private_media(subject,sid,'stage',request);if result->>'error' is distinct from 'MEDIA_CONFLICT' then raise exception 'TEST_ABANDON_ABSENT_LATE_STAGE';end if;
 stage_id:='93000000-0000-4000-8000-000000000023';request:=request||jsonb_build_object('mutationId',stage_id);
 result:=public.travel_life_private_media(subject,sid,'stage',request);artifact:=(result->>'artifactId')::uuid;
 update history_private.media_artifact set state='active' where owner_id=subject and artifact_id=artifact;
 insert into history_private.media_attachment(owner_id,target_key,artifact_id,revision) select owner_id,target_key,artifact_id,1 from history_private.media_artifact where owner_id=subject and artifact_id=artifact;
 result:=public.travel_life_private_media(subject,sid,'abandon',jsonb_build_object('stageMutationId',stage_id));
 if result->>'status' is distinct from 'active' or not exists(select 1 from history_private.media_attachment where owner_id=subject and artifact_id=artifact) or not exists(select 1 from history_private.media_artifact where owner_id=subject and artifact_id=artifact and state='active') then raise exception 'TEST_ABANDON_ACTIVE_RETAINED';end if;
 stage_id:='93000000-0000-4000-8000-000000000024';request:=request||jsonb_build_object('mutationId',stage_id,'expectedRevision',1);
 result:=public.travel_life_private_media(subject,sid,'stage',request);
 if result->>'status' is distinct from 'staged' then raise exception 'TEST_ABANDON_REPREPARE';end if;
 update history_private.account set media_consent=false where owner_id=subject;
 result:=public.travel_life_private_media(subject,sid,'abandon',jsonb_build_object('stageMutationId',stage_id));
 -- Consent withdrawal itself fences active objects; abandonment must not restore them.
 if result->>'status' is distinct from 'abandoned' then raise exception 'TEST_ABANDON_WITHDRAWN';end if;
 result:=public.travel_life_private_media(subject,'23000000-0000-4000-8000-000000000099','abandon',jsonb_build_object('stageMutationId',stage_id));if result->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_ABANDON_SESSION';end if;
 result:=public.travel_life_private_media(subject,sid,'abandon','{"stageMutationId":"PRIVATE_SENTINEL"}');if result->>'error' is distinct from 'MEDIA_SCHEMA' or result::text like '%PRIVATE_SENTINEL%' then raise exception 'TEST_ABANDON_SCHEMA_REDACTION';end if;
end $$;
select 'PASS: private media abandonment fences immutable reservations and late stages, retains unknown retries and enforces live owner' as result;
rollback;
