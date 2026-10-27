do $test$
declare
 a uuid := '00000000-0000-4000-8000-000000000001';
 b uuid := '00000000-0000-4000-8000-000000000002';
 snap jsonb := '{"schemaVersion":"travel-life-share-v1","version":"synthetic_v1","kind":"journey","title":"Synthetic journey","destinations":[{"key":"place_a","name":"Synthetic place","country":"","centroid":null,"date":null,"status":"inferred"}],"chapters":[{"destinationKey":"place_a","mediaKeys":[]}],"media":[],"summary":{"destinationCount":1,"mediaCount":0}}'::jsonb;
 req jsonb;
 result jsonb;
 link_id uuid;
begin
 req := jsonb_build_object('requestId','synthetic_request_a','contentDigest',repeat('a',64),'capabilityDigest',repeat('c',64),'expiresInDays',30,'snapshot',snap);
 result := public.travel_life_share_owner(a,'begin',req);
 if result->>'status'<>'staged' then raise exception 'test_begin'; end if;
 result := public.travel_life_share_owner(a,'begin',req);
 if result->>'status'<>'staged' or (select count(*) from share_private.publish_operation where owner_subject=a)<>1 then raise exception 'test_idempotency'; end if;
 result := public.travel_life_share_owner(a,'begin',req || jsonb_build_object('contentDigest',repeat('b',64)));
 if result->>'error'<>'CONFLICT' then raise exception 'test_changed_retry'; end if;
 if public.travel_life_share_read(repeat('c',64)) is not null then raise exception 'test_staged_read'; end if;
 result := public.travel_life_share_owner(a,'activate',req);
 if result->>'status'<>'activated' then raise exception 'test_activate'; end if;
 if public.travel_life_share_read(repeat('c',64))->'snapshot'<>snap then raise exception 'test_exact_read'; end if;
 select share_id into link_id from share_private.publish_operation where owner_subject=a and request_id='synthetic_request_a';
 result := public.travel_life_share_owner(b,'status',req);
 if result->>'error'<>'ACCESS' then raise exception 'test_cross_owner_status'; end if;
 result := public.travel_life_share_owner(b,'revoke',jsonb_build_object('shareId',link_id));
 if result->>'error'<>'ACCESS' then raise exception 'test_cross_owner_revoke'; end if;
 if jsonb_array_length(public.travel_life_share_owner(b,'list','{}')->'links')<>0 then raise exception 'test_cross_owner_list'; end if;
 req := req || jsonb_build_object('requestId','synthetic_replace','contentDigest',repeat('b',64),'replaceShareId',link_id,'snapshot',snap || '{"version":"synthetic_v2"}'::jsonb);
 result := public.travel_life_share_owner(a,'begin',req);
 if result->>'status'<>'staged' or public.travel_life_share_read(repeat('c',64))->'snapshot'<>snap then raise exception 'test_replace_staging'; end if;
 result := public.travel_life_share_owner(a,'activate',req);
 if result->>'status'<>'activated' or public.travel_life_share_read(repeat('c',64),'synthetic_v1') is not null then raise exception 'test_old_version'; end if;
 result := public.travel_life_share_owner(a,'expiry',jsonb_build_object('shareId',link_id,'expectedVersion','synthetic_v1','expiresInDays',2));
 if result->>'error'<>'CONFLICT' then raise exception 'test_expiry_version'; end if;
 update share_private.snapshot_share set envelope_expires_at=now() where share_id=link_id;
 if public.travel_life_share_read(repeat('c',64)) is not null then raise exception 'test_exact_expiry'; end if;
 result := public.travel_life_share_owner(a,'expiry',jsonb_build_object('shareId',link_id,'expectedVersion','synthetic_v2','expiresInDays',2));
 if result->>'error'<>'TERMINAL' then raise exception 'test_expired_revival'; end if;
 update share_private.snapshot_share set envelope_expires_at=now()+interval '1 day' where share_id=link_id;
 req := req || jsonb_build_object('requestId','synthetic_revoke_race','contentDigest',repeat('d',64),'snapshot',snap || '{"version":"synthetic_v3"}'::jsonb);
 result := public.travel_life_share_owner(a,'begin',req);
 if result->>'status'<>'staged' then raise exception 'test_revoke_race_begin'; end if;
 result := public.travel_life_share_owner(a,'revoke',jsonb_build_object('shareId',link_id));
 if result->>'status'<>'revoked' then raise exception 'test_revoke'; end if;
 result := public.travel_life_share_owner(a,'activate',req);
 if result->>'error'<>'TERMINAL' or public.travel_life_share_read(repeat('c',64)) is not null then raise exception 'test_revoke_fence'; end if;
 result := public.travel_life_share_owner(a,'delete-all','{}');
 if result->>'status'<>'removed' then raise exception 'test_delete_all'; end if;
 result := public.travel_life_share_owner(a,'begin',req || '{"requestId":"synthetic_after_fence"}'::jsonb);
 if result->>'error'<>'FENCED' then raise exception 'test_delete_fence'; end if;
 if has_table_privilege('anon','share_private.snapshot_share','select') or has_table_privilege('authenticated','share_private.derivative','select') or has_function_privilege('anon','public.travel_life_share_read(text,text,text)','execute') or has_function_privilege('authenticated','public.travel_life_share_owner(uuid,text,jsonb)','execute') then raise exception 'test_privileges'; end if;
 if (select public from storage.buckets where id='travel-life-share-private') then raise exception 'test_private_bucket'; end if;
end $test$;
insert into storage.objects(bucket_id,name) values('travel-life-share-private','synthetic_rls_object');
set local role anon;
do $rls$
begin
 if exists(select 1 from storage.objects where bucket_id='travel-life-share-private') then raise exception 'test_anon_storage_read'; end if;
 begin
  perform 1 from share_private.snapshot_share;
  raise exception 'test_anon_private_table_was_readable';
 exception when insufficient_privilege then null;
 end;
end $rls$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',true);
do $rls$
begin
 if exists(select 1 from storage.objects where bucket_id='travel-life-share-private') then raise exception 'test_authenticated_storage_read'; end if;
 begin
  perform public.travel_life_share_owner('00000000-0000-4000-8000-000000000001','list','{}');
  raise exception 'test_authenticated_service_rpc_was_callable';
 exception when insufficient_privilege then null;
 end;
end $rls$;
reset role;
select 'passed: rollback-only synthetic SQL lifecycle, idempotency, ownership, expiry, replacement, revoke, fence and privilege assertions' as verification;
rollback;
