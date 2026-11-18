-- Synthetic account deletion lifecycle, not actual provider/storage acceptance.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values('17000000-0000-4000-8000-000000000001','deletion@example.invalid',now(),false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('27000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000001',now(),now());
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000001","is_anonymous":false,"session_id":"27000000-0000-4000-8000-000000000001"}',true);
do $$
declare r jsonb;q jsonb;lease uuid;subject uuid:='17000000-0000-4000-8000-000000000001';ticket text:=repeat('a',64);owner_rows_remain boolean;
begin
 if has_table_privilege('authenticated','history_private.account_deletion','select') or has_function_privilege('authenticated','public.travel_life_account_deletion(text,jsonb)','execute') then raise exception 'TEST_DELETE_PRIVILEGE';end if;
 perform public.travel_life_history('status','{}');
 if to_regclass('history_private.owner_journal') is not null then
  execute 'insert into history_private.owner_journal(owner_id,revision,changes) values($1,1,$2)' using subject,'{"rows":[],"deleted":[]}'::jsonb;
  execute 'insert into history_private.owner_proposal(owner_id,mutation_id,digest,base_aggregate,expected_revision,source_plan,changes,accepted_before,state,result) values($1,$2,$3,$4,0,$5,$6,$6,$7,$8)' using subject,'47000000-0000-4000-8000-000000000001'::uuid,'synthetic','57000000-0000-4000-8000-000000000001'::uuid,'[]'::jsonb,'{"rows":[],"deleted":[]}'::jsonb,'accepted','{"status":"accepted","ownerRevision":1}'::jsonb;
 end if;
 q:=jsonb_build_object('mutationId','37000000-0000-4000-8000-000000000001','generation',1,'ticket',ticket);
 r:=public.travel_life_history('delete-account',q);
 if r->>'status' is distinct from 'pending' then raise exception 'TEST_DELETE_PENDING';end if;
 if not exists(select 1 from history_private.account where owner_id=subject and delete_fenced_at is not null) then raise exception 'TEST_FENCE_FIRST';end if;
 r:=public.travel_life_history('status','{}');if r->>'error' is distinct from 'HISTORY_FENCED' then raise exception 'TEST_TOMBSTONE_DENIES_READ';end if;
 r:=public.travel_life_deletion_status(ticket);if r->>'status' is distinct from 'pending' then raise exception 'TEST_TICKET_RECONCILES';end if;
 r:=public.travel_life_deletion_status(repeat('b',64));if r is distinct from '{"status":"unavailable"}'::jsonb then raise exception 'TEST_NO_RECEIPT_ORACLE';end if;
 r:=public.travel_life_account_deletion('lease','{}');lease:=(r->'items'->0->>'leaseId')::uuid;
 if lease is null then raise exception 'TEST_DELETE_LEASE';end if;
 r:=public.travel_life_account_deletion('purge',jsonb_build_object('owner',subject,'leaseId',lease));
 if r->>'status' is distinct from 'metadata-purged' or exists(select 1 from history_private.account where owner_id=subject) then raise exception 'TEST_METADATA_PURGE';end if;
 if to_regclass('history_private.owner_journal') is not null then
  execute 'select exists(select 1 from history_private.owner_journal where owner_id=$1) or exists(select 1 from history_private.owner_proposal where owner_id=$1)' into owner_rows_remain using subject;
  if owner_rows_remain then raise exception 'TEST_OWNER_JOURNAL_PURGED';end if;
 end if;
 -- Provider adapter must delete the Auth identity before the trusted ACK.
 r:=public.travel_life_account_deletion('complete',jsonb_build_object('owner',subject,'leaseId',lease));
 if r->>'error' is distinct from 'HISTORY_INCOMPLETE' then raise exception 'TEST_AUTH_ACK_REQUIRED';end if;
 delete from auth.sessions where user_id=subject;delete from auth.users where id=subject;
 r:=public.travel_life_account_deletion('complete',jsonb_build_object('owner',subject,'leaseId',lease));
 if r->>'status' is distinct from 'completed' then raise exception 'TEST_COMPLETE';end if;
 r:=public.travel_life_deletion_status(ticket);if r is distinct from '{"status":"completed"}'::jsonb then raise exception 'TEST_RECEIPT_AFTER_AUTH_PURGE';end if;
 if exists(select 1 from history_private.account_deletion where ticket_digest=ticket) then raise exception 'TEST_NO_RAW_TICKET';end if;
end $$;
select 'PASS: deletion fence, protected receipt, leased purge, Auth acknowledgement and durable tombstone';
rollback;
