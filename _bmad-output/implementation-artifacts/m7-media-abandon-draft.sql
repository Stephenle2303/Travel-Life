-- Local review correction draft. Apply after the private-media and account-control drafts.
create table history_private.media_abandon_receipt (
 owner_id uuid not null references history_private.account(owner_id) on delete cascade,stage_mutation_id uuid not null,
 result jsonb not null,primary key(owner_id,stage_mutation_id)
);
alter table history_private.media_abandon_receipt enable row level security;
revoke all on history_private.media_abandon_receipt from public,anon,authenticated;
alter function history_private.private_media_action(uuid,uuid,text,jsonb) rename to private_media_action_before_abandon;
create function history_private.private_media_action(subject uuid,sid uuid,action text,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a history_private.account%rowtype;m history_private.media_artifact%rowtype;
 stage_id uuid;prior jsonb;result jsonb;artifact uuid;
begin
 if action not in ('stage','abandon') then return history_private.private_media_action_before_abandon(subject,sid,action,input);end if;
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION');end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>8192 then return jsonb_build_object('error','MEDIA_SCHEMA');end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION');end if;
 begin stage_id:=(input->>(case when action='abandon' then 'stageMutationId' else 'mutationId' end))::uuid;
 exception when invalid_text_representation then return jsonb_build_object('error','MEDIA_SCHEMA');end;
 if stage_id is null then return jsonb_build_object('error','MEDIA_SCHEMA');end if;
 if action='stage' then
  if exists(select 1 from history_private.media_abandon_receipt where owner_id=subject and stage_mutation_id=stage_id) then return jsonb_build_object('error','MEDIA_CONFLICT');end if;
  return history_private.private_media_action_before_abandon(subject,sid,action,input);
 end if;
 if input-array['stageMutationId']<>'{}'::jsonb then return jsonb_build_object('error','MEDIA_SCHEMA');end if;
 select receipt.result into result from history_private.media_abandon_receipt receipt where owner_id=subject and stage_mutation_id=stage_id;
 if found then return result;end if;
 select receipt.result into prior from history_private.media_receipt receipt where owner_id=subject and mutation_id=stage_id;
 if found then
  if prior->>'status' is distinct from 'staged' then return jsonb_build_object('error','MEDIA_CONFLICT');end if;
  artifact:=(prior->>'artifactId')::uuid;
  select * into m from history_private.media_artifact where owner_id=subject and artifact_id=artifact for update;
  if found and m.state='active' then
   result:=jsonb_build_object('status','active','artifactId',artifact);
  else
   if found then
    update history_private.media_artifact set state='fenced' where owner_id=subject and artifact_id=artifact;
    insert into history_private.media_cleanup(storage_path,owner_id,artifact_id) values(m.storage_path,subject,artifact) on conflict do nothing;
   end if;
   result:=jsonb_build_object('status','abandoned','artifactId',artifact);
  end if;
 else result:=jsonb_build_object('status','abandoned','artifactId',null);
 end if;
 insert into history_private.media_abandon_receipt(owner_id,stage_mutation_id,result) values(subject,stage_id,result);
 return result;
end $$;
revoke all on function history_private.private_media_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function history_private.private_media_action(uuid,uuid,text,jsonb) to service_role;
-- The fence is non-content idempotency state. Account deletion must purge it too.
create function history_private.clear_media_abandon_receipts() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.delete_fenced_at is not null then delete from history_private.media_abandon_receipt where owner_id=new.owner_id;end if;return new;end $$;
revoke all on function history_private.clear_media_abandon_receipts() from public,anon,authenticated;
create trigger media_abandon_delete after update of delete_fenced_at on history_private.account for each row execute function history_private.clear_media_abandon_receipts();
