-- Synthetic append-only authority continuity; always rollback.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,is_sso_user) values('15000000-0000-4000-8000-000000000001','continuity@example.invalid',now(),false,false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001',now(),now());
insert into history_private.account(owner_id,history_consent) values('15000000-0000-4000-8000-000000000001',true);
insert into history_private.source(owner_id,source_id,installation_id,snapshot_revision) values('15000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001',1);
insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,source_revision) values
('15000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001',1,'initial',1,37,1),
('15000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000001',1,'pending',1,37,2);
insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest) values
('15000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001',0,'[{"kind":"evidence","key":"synthetic-one","value":{}}]','synthetic'),
('15000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000002',0,'[{"kind":"evidence","key":"synthetic-one","value":{}},{"kind":"evidence","key":"synthetic-two","value":{}}]','synthetic');
insert into history_private.aggregate(owner_id,aggregate_id,account_generation,expected_account_revision,source_plan,state,expected_pages,metadata,engine_version,aggregate_revision) values
('15000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',1,0,history_private.current_source_plan('15000000-0000-4000-8000-000000000001'),'active',1,'{}','reconstruction-v1/trip-detector-v1.1',1);
insert into history_private.aggregate_page(owner_id,aggregate_id,page_number,records,content_digest) values('15000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',0,'[]','synthetic');
update history_private.account set active_snapshot='65000000-0000-4000-8000-000000000001',active_aggregate='75000000-0000-4000-8000-000000000001',aggregate_revision=1 where owner_id='15000000-0000-4000-8000-000000000001';
do $$
declare result jsonb;subject uuid:='15000000-0000-4000-8000-000000000001';
begin
 perform set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"session_id":"25000000-0000-4000-8000-000000000001"}',true);
 update history_private.source set snapshot_revision=2 where owner_id=subject;
 result:=public.travel_life_history('status','{}');
 if result->>'activeAggregate' is distinct from '75000000-0000-4000-8000-000000000001' or result->>'pendingMerge'<>'true' or result->>'activeSnapshot' is not null then raise exception 'TEST_APPEND_CONTINUITY';end if;
 result:=public.travel_life_history_read('pull','{"aggregateId":"75000000-0000-4000-8000-000000000001","page":0}');
 if result->>'status' is distinct from 'complete' then raise exception 'TEST_PREVIOUS_PULL';end if;
 update history_private.source set state='paused',generation=2 where owner_id=subject;
 result:=public.travel_life_history('status','{}');if result->>'activeAggregate' is null then raise exception 'TEST_PAUSE_RETAINS';end if;
 update history_private.account set history_consent=false where owner_id=subject;
 result:=public.travel_life_history('status','{}');if result->>'activeAggregate' is null then raise exception 'TEST_WITHDRAW_RETAINS_HISTORY';end if;
 update history_private.account set history_consent=true where owner_id=subject;
 update history_private.snapshot_page set records=records||'[{"kind":"privacy","key":"1","value":{"action":"hide"}}]'::jsonb where owner_id=subject and snapshot_id='65000000-0000-4000-8000-000000000002';
 result:=public.travel_life_history('status','{}');if result->>'activeAggregate' is not null or result->>'activeSnapshot' is not null then raise exception 'TEST_PRIVACY_NO_FALLBACK';end if;
 result:=public.travel_life_history_read('pull','{"aggregateId":"75000000-0000-4000-8000-000000000001","page":0}');if result->>'error' is distinct from 'HISTORY_STALE' then raise exception 'TEST_PRIVACY_STALE_PULL';end if;
 update history_private.source set state='removed' where owner_id=subject;
 result:=public.travel_life_history('status','{}');if result->>'activeAggregate' is not null then raise exception 'TEST_REMOVED_FENCE';end if;
 perform set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000099","role":"authenticated","is_anonymous":false,"session_id":"25000000-0000-4000-8000-000000000001"}',true);
 result:=public.travel_life_history('status','{}');if result->>'error' is distinct from 'ACCOUNT_SESSION' then raise exception 'TEST_CROSS_OWNER';end if;
end $$;
rollback;
