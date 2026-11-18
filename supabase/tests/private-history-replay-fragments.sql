begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('14000000-0000-4000-8000-000000000001','fragment@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('24000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001',now(),now());
select set_config('request.jwt.claims','{"sub":"14000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"24000000-0000-4000-8000-000000000001"}',true);
do $$
declare subject uuid:='14000000-0000-4000-8000-000000000001';sid uuid:='24000000-0000-4000-8000-000000000001';fixture_source uuid:='44000000-0000-4000-8000-000000000001'; snap uuid:='64000000-0000-4000-8000-000000000001';operation uuid:='74000000-0000-4000-8000-000000000001';
 result jsonb; prior jsonb; base jsonb; plan jsonb; f0 jsonb; f1 jsonb; composition text:='{"orderedEvidenceIds":["'||repeat('á😀',6000)||'"],"direction":"oldest-first"}'; maps jsonb; raw_id text:=repeat('a',64); bad jsonb; bad_snap uuid; bad_base jsonb; before_revision bigint; idx integer;
begin
 if has_function_privilege('authenticated','history_private.collapse_replay_fragments(uuid,uuid,boolean)','execute') then raise exception 'FRAGMENT_GRANT';end if;
 perform public.travel_life_history('status','{}');
 result:=public.travel_life_history('consent',jsonb_build_object('mutationId',gen_random_uuid(),'generation',1,'history',true,'media',false));if result->>'status'<>'complete' then raise exception 'CONSENT %',result;end if;
 result:=public.travel_life_history('register-source',jsonb_build_object('mutationId',gen_random_uuid(),'generation',1,'sourceId',fixture_source,'installationId','54000000-0000-4000-8000-000000000001'));if result->>'status'<>'complete' then raise exception 'SOURCE %',result;end if;
 base:=jsonb_build_object('generation',1,'sourceId',fixture_source,'sourceGeneration',1,'snapshotId',snap);
 result:=public.travel_life_history('begin',base||jsonb_build_object('mutationId',gen_random_uuid(),'pages',2,'schemaVersion',37,'sourceSnapshotRevision',0));if result->>'status'<>'staging' then raise exception 'BEGIN %',result;end if;
 f0:=jsonb_build_object('kind','replay-fragment','key','1:0','value',jsonb_build_object('record_id',1,'revision',2,'updated_at_millis',3,'codec_version',1,'part_index',0,'part_count',2,'committed_fragment',substr(composition,1,7000)));
 f1:=jsonb_build_object('kind','replay-fragment','key','1:1','value',jsonb_build_object('record_id',1,'revision',2,'updated_at_millis',3,'codec_version',1,'part_index',1,'part_count',2,'committed_fragment',substr(composition,7001)));
 result:=public.travel_life_history('page',base||jsonb_build_object('mutationId','34000000-0000-4000-8000-000000000001','page',0,'records',jsonb_build_array(f0)));prior:=result;if result->>'status'<>'complete' then raise exception 'PAGE0 %',result;end if;
 result:=public.travel_life_history('page',base||jsonb_build_object('mutationId','34000000-0000-4000-8000-000000000002','page',1,'records',jsonb_build_array(f1)));if result->>'status'<>'complete' then raise exception 'PAGE1 %',result;end if;
 result:=public.travel_life_history('activate',base||jsonb_build_object('mutationId',gen_random_uuid()));if result->>'status'<>'initial' then raise exception 'ACTIVATE %',result;end if;
 result:=public.travel_life_history('page',base||jsonb_build_object('mutationId','34000000-0000-4000-8000-000000000001','page',0,'records',jsonb_build_array(f0)));if result is distinct from prior then raise exception 'RECEIPT_RETRY %',result;end if;
 result:=public.travel_life_history('pull',jsonb_build_object('snapshotId',snap,'page',0));if result->'records'->0->'value'->>'committed_overrides_json' is distinct from composition then raise exception 'PULL';end if;
 result:=public.travel_life_history('pull',jsonb_build_object('snapshotId',snap,'page',1));if result->'records'<>'[]'::jsonb then raise exception 'EMPTY_CONTINUATION';end if;
 plan:=public.travel_life_history_worker(subject,sid,'plan',jsonb_build_object('operationId',operation));base:=jsonb_build_object('accountGeneration',plan->'accountGeneration','expectedAccountRevision',plan->'expectedAccountRevision','sourcePlan',plan->'sourcePlan');
 maps:=public.travel_life_history_worker(subject,sid,'map-identities',base||jsonb_build_object('keys',jsonb_build_array(jsonb_build_object('sourceId',fixture_source,'kind','journey','localId',raw_id),jsonb_build_object('sourceId',fixture_source,'kind','journey','localId',raw_id,'localIdCodec','sha256-v1'))));
 if jsonb_array_length(maps->'mappings')<>2 or maps->'mappings'->0->>'accountId'=maps->'mappings'->1->>'accountId' then raise exception 'CODEC_COLLISION %',maps;end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||jsonb_build_object('operationId',operation,'phase','start','pages',2,'metadata','{}'::jsonb,'engineVersion','reconstruction-v1/trip-detector-v1.1'));if result->>'status'<>'staging' then raise exception 'AGG_START %',result;end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||jsonb_build_object('operationId',operation,'phase','page','page',0,'records',jsonb_build_array(f0)));if result->>'status'<>'staged' then raise exception 'AGG_PAGE0 %',result;end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||jsonb_build_object('operationId',operation,'phase','page','page',1,'records',jsonb_build_array(f1)));if result->>'status'<>'staged' then raise exception 'AGG_PAGE1 %',result;end if;
 result:=public.travel_life_history_worker(subject,sid,'activate',base||jsonb_build_object('operationId',operation,'phase','commit'));if result->>'status'<>'complete' then raise exception 'AGG_COMMIT %',result;end if;
 select records into result from history_private.aggregate_page where owner_id=subject and aggregate_id=operation and page_number=0;if result->0->'value'->>'committed_overrides_json' is distinct from composition then raise exception 'AGG_PULL';end if;

 -- Bad groups must not change active authority, staged pages or source revision.
 for idx in 1..6 loop
  bad_snap:=gen_random_uuid();bad_base:=jsonb_build_object('generation',1,'sourceId',fixture_source,'sourceGeneration',1,'snapshotId',bad_snap);
  select snapshot_revision into before_revision from history_private.source where owner_id=subject and source_id=fixture_source;
  result:=public.travel_life_history('begin',bad_base||jsonb_build_object('mutationId',gen_random_uuid(),'pages',1,'schemaVersion',37,'sourceSnapshotRevision',before_revision));if result->>'status'<>'staging' then raise exception 'BAD_BEGIN %',result;end if;
  bad:=case idx when 1 then jsonb_build_array(f0) when 2 then jsonb_build_array(f0,f0) when 3 then jsonb_build_array(f1,f0) when 4 then jsonb_build_array(f0,jsonb_set(f1,'{value,revision}','4')) when 5 then jsonb_build_array(f0,f1,jsonb_build_object('kind','replay','key','1','value',jsonb_build_object('record_id',1,'revision',1,'updated_at_millis',1,'committed_overrides_json','{}'))) else jsonb_build_array(jsonb_set(f0,'{value,committed_fragment}',to_jsonb('{"direction":null}'::text))||jsonb_build_object('value',(f0->'value')||'{"part_count":1}'::jsonb)) end;
  result:=public.travel_life_history('page',bad_base||jsonb_build_object('mutationId',gen_random_uuid(),'page',0,'records',bad));if result->>'status'<>'complete' then raise exception 'BAD_PAGE % %',idx,result;end if;
  result:=public.travel_life_history('activate',bad_base||jsonb_build_object('mutationId',gen_random_uuid()));if result->>'error' is distinct from 'HISTORY_SCHEMA' then raise exception 'BAD_ACTIVATION % %',idx,result;end if;
  if (select active_snapshot from history_private.account where owner_id=subject) is distinct from snap or (select snapshot_revision from history_private.source where owner_id=subject and source_id=fixture_source)<>before_revision or (select records from history_private.snapshot_page where owner_id=subject and snapshot_id=bad_snap and page_number=0) is distinct from bad then raise exception 'BAD_CHANGED_AUTHORITY %',idx;end if;
 end loop;
 -- SQL UTF-16 count must agree with JavaScript for supplementary Unicode.
 if history_private.valid_record(jsonb_set(f0,'{value,committed_fragment}',to_jsonb(repeat('😀',8193)))) then raise exception 'FRAGMENT_UTF16_BOUND';end if;
end $$;
select 'PASS: fragment source/aggregate roundtrip, immutable receipt and typed identity codec';
rollback;
