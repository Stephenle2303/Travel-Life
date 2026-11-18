-- Per-source immutable snapshot CAS; independent from account-journal revision.
alter table history_private.source add column snapshot_revision bigint not null default 0;
alter table history_private.snapshot add column base_source_revision bigint not null default 0;
alter table history_private.snapshot add column source_revision bigint;
with ranked as (select owner_id,snapshot_id,row_number() over(partition by owner_id,source_id order by created_at,snapshot_id) as revision from history_private.snapshot where state in ('initial','pending'))
update history_private.snapshot s set source_revision=r.revision from ranked r where r.owner_id=s.owner_id and r.snapshot_id=s.snapshot_id;
update history_private.source s set snapshot_revision=coalesce((select max(x.source_revision) from history_private.snapshot x where x.owner_id=s.owner_id and x.source_id=s.source_id),0);
create or replace function history_private.account_action(action text, input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 subject uuid := auth.uid();
 sid uuid;
 a history_private.account%rowtype;
 s history_private.source%rowtype;
 snap history_private.snapshot%rowtype;
 previous history_private.receipt%rowtype;
 mutation uuid;
 result jsonb;
 request_digest text;
 row_value jsonb;
 total bigint;
begin
 if subject is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 begin sid := (auth.jwt()->>'session_id')::uuid; exception when invalid_text_representation then return jsonb_build_object('error','ACCOUNT_SESSION'); end;
 if sid is null or not exists(select 1 from auth.sessions x join auth.users u on u.id=x.user_id where x.id=sid and x.user_id=subject and u.is_anonymous=false and u.email_confirmed_at is not null and (x.not_after is null or x.not_after>now())) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>524288 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 if input ? 'ownerId' or input ? 'owner_id' or input ? 'user_id' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 insert into history_private.account(owner_id) values(subject) on conflict do nothing;
 select * into a from history_private.account where owner_id=subject for update;
 if exists(select 1 from history_private.revoked_session where owner_id=subject and session_id=sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if action='status' or action='deletion-status' then
   if input<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   select coalesce(jsonb_agg(jsonb_build_object('sourceId',source_id,'generation',generation,'state',state,'lastUpdatedAt',last_updated_at,'sourceSnapshotRevision',snapshot_revision) order by source_id),'[]') into result from history_private.source where owner_id=subject;
   return jsonb_build_object('status',case when a.delete_fenced_at is null then 'active' else 'deleted' end,'generation',a.generation,'revision',a.revision,'historyConsent',a.history_consent,'mediaConsent',a.media_consent,'activeSnapshot',a.active_snapshot,'sources',result);
 end if;
 if a.delete_fenced_at is not null then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if action='pull' then
   if (input - array['snapshotId','page'])<>'{}'::jsonb or jsonb_typeof(input->'page')<>'number' or (input->>'page') !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   select * into snap from history_private.snapshot where owner_id=subject and snapshot_id=(input->>'snapshotId')::uuid and snapshot_id=a.active_snapshot and state='initial';
   if not found then return jsonb_build_object('error','HISTORY_STALE'); end if;
   select records into result from history_private.snapshot_page where owner_id=subject and snapshot_id=snap.snapshot_id and page_number=(input->>'page')::integer;
   if not found then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   return jsonb_build_object('status','complete','snapshotId',snap.snapshot_id,'page',(input->>'page')::integer,'pages',snap.expected_pages,'schemaVersion',snap.schema_version,'records',result);
 end if;
 if input->>'mutationId' is null or input->>'generation' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 begin mutation := (input->>'mutationId')::uuid; exception when invalid_text_representation then return jsonb_build_object('error','HISTORY_SCHEMA'); end;
 request_digest := encode(extensions.digest(convert_to(action || input::text,'UTF8'),'sha256'),'hex');
 select * into previous from history_private.receipt where owner_id=subject and mutation_id=mutation;
 if found then
   if previous.digest<>request_digest then return jsonb_build_object('error','HISTORY_CONFLICT'); end if;
   return previous.result;
 end if;
 if input->>'generation'<>a.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if action='consent' then
   if (input-array['mutationId','generation','history','media'])<>'{}'::jsonb or jsonb_typeof(input->'history')<>'boolean' or jsonb_typeof(input->'media')<>'boolean' or input->'history' is null or input->'media' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   update history_private.account set history_consent=(input->>'history')::boolean,media_consent=(input->>'media')::boolean,revision=revision+1 where owner_id=subject;
   result := jsonb_build_object('status','complete','revision',a.revision+1);
 elsif action='register-source' then
   if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT'); end if;
   if (input-array['mutationId','generation','installationId','sourceId'])<>'{}'::jsonb or input->>'installationId' is null or input->>'sourceId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   insert into history_private.source(owner_id,source_id,installation_id) values(subject,(input->>'sourceId')::uuid,(input->>'installationId')::uuid) on conflict(owner_id,installation_id) do nothing;
   select * into s from history_private.source where owner_id=subject and installation_id=(input->>'installationId')::uuid;
   if s.state<>'active' then return jsonb_build_object('error','HISTORY_FENCED'); end if;
   result:=jsonb_build_object('status','complete','sourceId',s.source_id,'sourceGeneration',s.generation,'sourceSnapshotRevision',s.snapshot_revision);
 elsif action in ('begin','page','activate','source-control') then
   if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT'); end if;
   select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid for update;
   if not found or s.state<>'active' or input->>'sourceGeneration' is null or input->>'sourceGeneration'<>s.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
   if action='begin' then
     if input->>'sourceSnapshotRevision' is null or input->>'sourceSnapshotRevision'<>s.snapshot_revision::text then return jsonb_build_object('error','HISTORY_STALE'); end if;
     if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId','pages','schemaVersion','sourceSnapshotRevision'])<>'{}'::jsonb or input->>'schemaVersion'<>'37' or input->>'pages' !~ '^[0-9]{1,5}$' or input->>'snapshotId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
     select count(*) into total from history_private.snapshot where owner_id=subject;
     if total>=20 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
     insert into history_private.snapshot(owner_id,snapshot_id,source_id,source_generation,state,expected_pages,schema_version,base_source_revision) values(subject,(input->>'snapshotId')::uuid,s.source_id,s.generation,'staging',(input->>'pages')::integer,37,s.snapshot_revision);
     result:=jsonb_build_object('status','staging','snapshotId',input->>'snapshotId');
   elsif action='source-control' then
     if (input-array['mutationId','generation','sourceId','sourceGeneration','mode'])<>'{}'::jsonb or input->>'mode' not in ('paused','disconnected','removed') then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
     update history_private.source set generation=generation+1,state=input->>'mode' where owner_id=subject and source_id=s.source_id;
     update history_private.account set revision=revision+1 where owner_id=subject;
     if input->>'mode'='removed' then
       update history_private.account set active_snapshot=null where owner_id=subject and active_snapshot in(select snapshot_id from history_private.snapshot where owner_id=subject and source_id=s.source_id);
       delete from history_private.snapshot where owner_id=subject and source_id=s.source_id;
     end if;
     result:=jsonb_build_object('status','complete','sourceGeneration',s.generation+1);
   else
     select * into snap from history_private.snapshot where owner_id=subject and snapshot_id=(input->>'snapshotId')::uuid and source_id=s.source_id and state='staging' for update;
     if not found then return jsonb_build_object('error','HISTORY_STALE'); end if;
     if action='page' then
       if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId','page','records'])<>'{}'::jsonb or jsonb_typeof(input->'records')<>'array' or input->>'page' !~ '^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       if (input->>'page')::integer>=snap.expected_pages or jsonb_array_length(input->'records')>100 then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       select coalesce(sum(octet_length(records::text)),0) into total from history_private.snapshot_page where owner_id=subject;
       if total + octet_length((input->'records')::text)>67108864 then return jsonb_build_object('error','HISTORY_QUOTA'); end if;
       for row_value in select * from jsonb_array_elements(input->'records') loop
         if not history_private.valid_record(row_value) then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
         if jsonb_typeof(row_value)<>'object' or (row_value-array['kind','key','value'])<>'{}'::jsonb or row_value->>'kind' is null or row_value->>'kind' not in ('evidence','overlay','journey-correction','memory-correction','privacy','home','manual','replay') or row_value->>'key' is null or length(row_value->>'key')>1024 or row_value->'value' is null or jsonb_typeof(row_value->'value')<>'object' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       end loop;
       insert into history_private.snapshot_page(owner_id,snapshot_id,page_number,records,content_digest) values(subject,snap.snapshot_id,(input->>'page')::integer,input->'records',request_digest);
       result:=jsonb_build_object('status','complete','page',(input->>'page')::integer);
     else
       if (input-array['mutationId','generation','sourceId','sourceGeneration','snapshotId'])<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
       select count(*) into total from history_private.snapshot_page where owner_id=subject and snapshot_id=snap.snapshot_id;
       if total<>snap.expected_pages then return jsonb_build_object('error','HISTORY_INCOMPLETE'); end if;
       if snap.base_source_revision<>s.snapshot_revision then return jsonb_build_object('error','HISTORY_STALE'); end if;
       update history_private.snapshot set source_revision=s.snapshot_revision+1 where owner_id=subject and snapshot_id=snap.snapshot_id;
       update history_private.source set snapshot_revision=snapshot_revision+1 where owner_id=subject and source_id=s.source_id;
       if a.active_snapshot is null then
         update history_private.account set active_snapshot=snap.snapshot_id,revision=revision+1 where owner_id=subject;
         update history_private.snapshot set state='initial' where owner_id=subject and snapshot_id=snap.snapshot_id;
         result:=jsonb_build_object('status','initial','snapshotId',snap.snapshot_id,'revision',a.revision+1);
       else
         update history_private.account set revision=revision+1 where owner_id=subject;
         update history_private.snapshot set state='pending' where owner_id=subject and snapshot_id=snap.snapshot_id;
         result:=jsonb_build_object('status','pending','snapshotId',snap.snapshot_id);
       end if;
       update history_private.source set last_updated_at=now() where owner_id=subject and source_id=s.source_id;
     end if;
   end if;
 elsif action='delete-account' then
   if not exists(select 1 from auth.sessions where id=sid and user_id=subject and created_at>now()-interval '10 minutes') then return jsonb_build_object('error','ACCOUNT_REAUTH'); end if;
   if (input-array['mutationId','generation'])<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   update history_private.account set generation=generation+1,delete_fenced_at=now(),history_consent=false,media_consent=false,active_snapshot=null where owner_id=subject;
   delete from history_private.snapshot where owner_id=subject;
   delete from history_private.source where owner_id=subject;
   delete from history_private.receipt where owner_id=subject;
   result:=jsonb_build_object('status','deleted','generation',a.generation+1);
 elsif action='revoke-session' then
   if (input-array['mutationId','generation','sessionId'])<>'{}'::jsonb or input->>'sessionId' is null then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
   if not exists(select 1 from auth.sessions where id=(input->>'sessionId')::uuid and user_id=subject) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
   insert into history_private.revoked_session(owner_id,session_id) values(subject,(input->>'sessionId')::uuid) on conflict do nothing;
   result:=jsonb_build_object('status','complete');
 else return jsonb_build_object('error','HISTORY_SCHEMA');
 end if;
 insert into history_private.receipt(owner_id,mutation_id,digest,result) values(subject,mutation,request_digest,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','HISTORY_SCHEMA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end;
$$;
revoke all on function history_private.account_action(text,jsonb) from public,anon;
grant execute on function history_private.account_action(text,jsonb) to authenticated;
