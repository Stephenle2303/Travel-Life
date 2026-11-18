-- Draft only. Parent generates the migration with the installed Supabase CLI.
alter table history_private.account add column media_consent_generation bigint not null default 1;
create table history_private.media_artifact (
 owner_id uuid not null references history_private.account(owner_id),artifact_id uuid not null default gen_random_uuid(),
 account_generation bigint not null,source_id uuid not null,source_generation bigint not null,consent_generation bigint not null,
 target jsonb not null,target_key text not null,manifest jsonb not null,expected_revision bigint not null,
 state text not null default 'staged' check(state in ('staged','verified','active','fenced')),
 upload_lease uuid,upload_until timestamptz,
 storage_path text not null,byte_length bigint not null check(byte_length between 1 and 104857600),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 hour',
 primary key(owner_id,artifact_id),unique(storage_path)
);
create table history_private.media_attachment (
 owner_id uuid not null,target_key text not null,artifact_id uuid not null,revision bigint not null,
 primary key(owner_id,target_key),foreign key(owner_id,artifact_id) references history_private.media_artifact(owner_id,artifact_id)
);
create table history_private.media_receipt (
 owner_id uuid not null references history_private.account(owner_id),mutation_id uuid not null,digest text not null,result jsonb not null,
 primary key(owner_id,mutation_id)
);
create table history_private.media_cleanup (
 storage_path text primary key,owner_id uuid not null,artifact_id uuid not null,
 lease_id uuid,lease_until timestamptz,attempts integer not null default 0,
 requested_at timestamptz not null default now(),purge_after timestamptz not null default now()+interval '24 hours'
);
alter table history_private.media_artifact enable row level security;
alter table history_private.media_attachment enable row level security;
alter table history_private.media_receipt enable row level security;
alter table history_private.media_cleanup enable row level security;
revoke all on history_private.media_artifact,history_private.media_attachment,history_private.media_receipt,history_private.media_cleanup from public,anon,authenticated;
create index history_media_source_idx on history_private.media_artifact(owner_id,source_id);
create index history_media_attachment_artifact_idx on history_private.media_attachment(owner_id,artifact_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('travel-life-private-media','travel-life-private-media',false,104857600,array['image/jpeg','video/mp4','audio/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No client object policy: only the verified server adapter touches this bucket.

create function history_private.valid_media_manifest(m jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare n bigint;w integer;h integer;d bigint;
begin
 if m is null or jsonb_typeof(m)<>'object' then return false; end if;
 if m-array['contractVersion','kind','mimeType','byteLength','sha256','width','height','durationMillis']<>'{}'::jsonb
 or (select count(*) from jsonb_object_keys(m))<>8 or m->>'contractVersion' is distinct from 'travel-life-private-media-v1'
 or m->>'sha256' is null or m->>'sha256'!~'^[a-f0-9]{64}$' or m->>'byteLength' is null or m->>'byteLength'!~'^[0-9]{1,9}$'
 or jsonb_typeof(m->'byteLength') is distinct from 'number' then return false; end if;
 n:=(m->>'byteLength')::bigint;
 if n<1 or n>(case when m->>'kind'='photo' then 20971520 else 104857600 end) then return false; end if;
 if m->>'kind'='audio' then
  if m->>'mimeType' is distinct from 'audio/mp4' or m->'width' is distinct from 'null'::jsonb or m->'height' is distinct from 'null'::jsonb then return false; end if;
 elsif m->>'kind' in ('photo','video') then
  if jsonb_typeof(m->'width') is distinct from 'number' or jsonb_typeof(m->'height') is distinct from 'number'
   or m->>'width'!~'^[0-9]{1,5}$' or m->>'height'!~'^[0-9]{1,5}$' then return false; end if;
  w:=(m->>'width')::integer;h:=(m->>'height')::integer;
  if w<1 or h<1 then return false; end if;
  if m->>'kind'='photo' then return m->>'mimeType'='image/jpeg' and m->'durationMillis'='null'::jsonb and w<=8192 and h<=8192 and w::bigint*h<=16777216; end if;
  if m->>'mimeType' is distinct from 'video/mp4' or w>3840 or h>3840 or w::bigint*h>8294400 then return false; end if;
 else return false; end if;
 if jsonb_typeof(m->'durationMillis') is distinct from 'number' or m->>'durationMillis'!~'^[0-9]{1,9}$' then return false; end if;
 d:=(m->>'durationMillis')::bigint;return d between 1 and 3600000;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
revoke all on function history_private.valid_media_manifest(jsonb) from public,anon,authenticated;

create function history_private.media_target_key(target jsonb) returns text
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(target) is distinct from 'object' then return null; end if;
 if target->>'kind'='evidence' and target-array['kind','id']='{}'::jsonb and (select count(*) from jsonb_object_keys(target))=2
 and target->>'id'~'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then return 'evidence:'||(target->>'id'); end if;
 if target->>'kind'='soundtrack' and target-array['kind','revision']='{}'::jsonb and (select count(*) from jsonb_object_keys(target))=2
 and target->>'revision'~'^[A-Za-z0-9_-]{1,128}$' then return 'soundtrack:'||(target->>'revision'); end if;
 return null;
end $$;
revoke all on function history_private.media_target_key(jsonb) from public,anon,authenticated;

create function history_private.media_scope(subject uuid,source uuid,target jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare a history_private.account%rowtype;g history_private.aggregate%rowtype;
begin
 select * into a from history_private.account where owner_id=subject;
 select * into g from history_private.aggregate where owner_id=subject and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
 if not found or not history_private.same_source_content(g.source_plan,history_private.current_source_plan(subject)) then return false; end if;
 if target->>'kind'='evidence' then
  return not coalesce(g.metadata->'privacy'->'hiddenEvidenceIds'?(target->>'id'),false) and not coalesce(g.metadata->'privacy'->'excludedEvidenceIds'?(target->>'id'),false)
   and exists(select 1 from jsonb_array_elements(g.metadata->'sourceCopies') c where c->>'sourceId'=source::text and c->>'evidenceId'=target->>'id')
   and exists(select 1 from history_private.aggregate_page p cross join lateral jsonb_array_elements(p.records) r
    where p.owner_id=subject and p.aggregate_id=g.aggregate_id and r->>'kind'='evidence' and r->>'key'=target->>'id');
 elsif target->>'kind'='soundtrack' then
  return a.preferred_replay_source=source and exists(select 1 from history_private.aggregate_page p cross join lateral jsonb_array_elements(p.records) r
   where p.owner_id=subject and p.aggregate_id=g.aggregate_id and r->>'kind'='replay'
   and ((r->'value'->>'committed_overrides_json')::jsonb)->'soundtrack'->>'kind'='custom'
   and ((r->'value'->>'committed_overrides_json')::jsonb)->'soundtrack'->>'revision'=target->>'revision');
 end if;
 return false;
exception when invalid_text_representation then return false;
end $$;
revoke all on function history_private.media_scope(uuid,uuid,jsonb) from public,anon,authenticated;

create function history_private.private_media_action(subject uuid,sid uuid,action text,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a history_private.account%rowtype;s history_private.source%rowtype;m history_private.media_artifact%rowtype;
 old history_private.media_receipt%rowtype;attachment history_private.media_attachment%rowtype;
 mutation uuid;digest text;result jsonb;key text;total bigint;artifact uuid;
begin
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>8192 then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if not a.history_consent or not a.media_consent then return jsonb_build_object('error','MEDIA_CONSENT'); end if;
 if not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION'); end if;
 if action in ('stage','activate') then
  mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  digest:=encode(extensions.digest(convert_to(action||input::text,'UTF8'),'sha256'),'hex');
  select * into old from history_private.media_receipt where owner_id=subject and mutation_id=mutation;
  if found then
   if old.digest<>digest then return jsonb_build_object('error','MEDIA_CONFLICT'); end if;
   return old.result;
  end if;
 end if;
 if action='stage' then
  if input-array['mutationId','accountGeneration','sourceId','sourceGeneration','target','expectedRevision','manifest']<>'{}'::jsonb
   or not history_private.valid_media_manifest(input->'manifest') or input->>'expectedRevision' is null or input->>'expectedRevision'!~'^[0-9]{1,16}$' then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  key:=history_private.media_target_key(input->'target');
  if key is null or (input->'manifest'->>'kind'='audio') is distinct from (input->'target'->>'kind'='soundtrack') then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  if input->>'accountGeneration' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
  select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid;
  if not found or s.state<>'active' or input->>'sourceGeneration' is distinct from s.generation::text then return jsonb_build_object('error','HISTORY_FENCED'); end if;
  if not history_private.media_scope(subject,s.source_id,input->'target') then return jsonb_build_object('error','MEDIA_SCOPE'); end if;
  select * into attachment from history_private.media_attachment where owner_id=subject and target_key=key;
  if (input->>'expectedRevision')::bigint<>coalesce(attachment.revision,0) then return jsonb_build_object('error','MEDIA_CONFLICT'); end if;
  select coalesce(sum(byte_length),0) into total from history_private.media_artifact where owner_id=subject;
  if total+(input->'manifest'->>'byteLength')::bigint>2147483648 then return jsonb_build_object('error','MEDIA_QUOTA'); end if;
  artifact:=gen_random_uuid();
  insert into history_private.media_artifact(owner_id,artifact_id,account_generation,source_id,source_generation,consent_generation,target,target_key,manifest,expected_revision,storage_path,byte_length)
  values(subject,artifact,a.generation,s.source_id,s.generation,a.media_consent_generation,input->'target',key,input->'manifest',(input->>'expectedRevision')::bigint,subject::text||'/'||artifact::text,(input->'manifest'->>'byteLength')::bigint);
  result:=jsonb_build_object('status','staged','artifactId',artifact);
 elsif action='download' then
  if input-array['target']<>'{}'::jsonb then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  key:=history_private.media_target_key(input->'target');if key is null then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  select * into attachment from history_private.media_attachment where owner_id=subject and target_key=key;
  select * into m from history_private.media_artifact where owner_id=subject and artifact_id=attachment.artifact_id and state='active';
  if not found then return jsonb_build_object('error','MEDIA_UNAVAILABLE'); end if;
 else
  if action not in ('upload-context','verify','status','activate') then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  if input-array[case when action='activate' then 'mutationId' else 'artifactId' end,'artifactId',case when action='verify' then 'sha256' when action='activate' then 'expectedRevision' else 'artifactId' end,case when action='verify' then 'byteLength' else 'artifactId' end,case when action='verify' then 'uploadLease' else 'artifactId' end]<>'{}'::jsonb then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  select * into m from history_private.media_artifact where owner_id=subject and artifact_id=(input->>'artifactId')::uuid;
  if not found then return jsonb_build_object('error','MEDIA_UNAVAILABLE'); end if;
 end if;
 if action<>'stage' then
  select * into s from history_private.source where owner_id=subject and source_id=m.source_id;
  if not found or s.state='removed' or m.state='fenced' or m.account_generation<>a.generation or m.consent_generation<>a.media_consent_generation then return jsonb_build_object('error','HISTORY_FENCED'); end if;
  if not history_private.media_scope(subject,m.source_id,m.target) then return jsonb_build_object('error','MEDIA_SCOPE'); end if;
  if action in ('upload-context','verify','activate') and (s.state<>'active' or s.generation<>m.source_generation or m.expires_at<now() and m.state<>'active') then return jsonb_build_object('error','HISTORY_FENCED'); end if;
  if action='download' then return jsonb_build_object('status','complete','artifactId',m.artifact_id,'revision',attachment.revision,'manifest',m.manifest,'storagePath',m.storage_path); end if;
  if action='status' then return jsonb_build_object('status',m.state,'artifactId',m.artifact_id); end if;
  if action='upload-context' then
   if m.state='staged' then
    if m.upload_until>now() then return jsonb_build_object('error','MEDIA_BUSY'); end if;
    m.upload_lease:=gen_random_uuid();m.upload_until:=now()+interval '5 minutes';
    update history_private.media_artifact set upload_lease=m.upload_lease,upload_until=m.upload_until where owner_id=subject and artifact_id=m.artifact_id;
   end if;
   return jsonb_build_object('status',m.state,'artifactId',m.artifact_id,'manifest',m.manifest,'storagePath',m.storage_path,'uploadLease',m.upload_lease);
  end if;
  if action='verify' then
   if m.state='staged' and (input->>'uploadLease' is distinct from m.upload_lease::text or m.upload_until is null or m.upload_until<now()) then return jsonb_build_object('error','HISTORY_FENCED'); end if;
   if input->>'sha256' is distinct from m.manifest->>'sha256' or input->>'byteLength' is distinct from m.byte_length::text then return jsonb_build_object('error','MEDIA_VERIFY'); end if;
   if m.state='staged' then update history_private.media_artifact set state='verified',upload_lease=null,upload_until=null where owner_id=subject and artifact_id=m.artifact_id; end if;
   return jsonb_build_object('status',case when m.state='active' then 'active' else 'verified' end,'artifactId',m.artifact_id);
  end if;
  if m.state<>'verified' or input->>'expectedRevision' is distinct from m.expected_revision::text then return jsonb_build_object('error','MEDIA_CONFLICT'); end if;
  select * into attachment from history_private.media_attachment where owner_id=subject and target_key=m.target_key;
  if coalesce(attachment.revision,0)<>m.expected_revision then return jsonb_build_object('error','MEDIA_CONFLICT'); end if;
  insert into history_private.media_attachment(owner_id,target_key,artifact_id,revision) values(subject,m.target_key,m.artifact_id,m.expected_revision+1)
   on conflict(owner_id,target_key) do update set artifact_id=excluded.artifact_id,revision=excluded.revision;
  update history_private.media_artifact set state='active' where owner_id=subject and artifact_id=m.artifact_id;
  if attachment.artifact_id is not null then
   update history_private.media_artifact set state='fenced' where owner_id=subject and artifact_id=attachment.artifact_id;
   insert into history_private.media_cleanup(storage_path,owner_id,artifact_id) select storage_path,owner_id,artifact_id from history_private.media_artifact where owner_id=subject and artifact_id=attachment.artifact_id on conflict do nothing;
  end if;
  result:=jsonb_build_object('status','complete','artifactId',m.artifact_id,'revision',m.expected_revision+1);
 end if;
 insert into history_private.media_receipt(owner_id,mutation_id,digest,result) values(subject,mutation,digest,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('error','MEDIA_SCHEMA');
end $$;
revoke all on function history_private.private_media_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
create function public.travel_life_private_media(verified_owner uuid,verified_session uuid,action text,input jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select history_private.private_media_action(verified_owner,verified_session,action,input) $$;
revoke all on function public.travel_life_private_media(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function history_private.private_media_action(uuid,uuid,text,jsonb),public.travel_life_private_media(uuid,uuid,text,jsonb) to service_role;

create function history_private.fence_private_media_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.media_consent is distinct from old.media_consent then new.media_consent_generation:=old.media_consent_generation+1; end if;
 if new.delete_fenced_at is not null and old.delete_fenced_at is null or old.media_consent and not new.media_consent then
  insert into history_private.media_cleanup(storage_path,owner_id,artifact_id) select storage_path,owner_id,artifact_id from history_private.media_artifact where owner_id=new.owner_id on conflict do nothing;
  delete from history_private.media_attachment where owner_id=new.owner_id;
  update history_private.media_artifact set state='fenced' where owner_id=new.owner_id;
  delete from history_private.media_receipt where owner_id=new.owner_id;
 end if;return new;
end $$;
revoke all on function history_private.fence_private_media_account() from public,anon,authenticated;
create trigger history_private_media_account_fence before update of media_consent,delete_fenced_at on history_private.account for each row execute function history_private.fence_private_media_account();
create function history_private.fence_private_media_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='removed' and old.state<>'removed' then
  insert into history_private.media_cleanup(storage_path,owner_id,artifact_id) select storage_path,owner_id,artifact_id from history_private.media_artifact where owner_id=new.owner_id and source_id=new.source_id on conflict do nothing;
  delete from history_private.media_attachment where owner_id=new.owner_id and artifact_id in(select artifact_id from history_private.media_artifact where owner_id=new.owner_id and source_id=new.source_id);
  update history_private.media_artifact set state='fenced' where owner_id=new.owner_id and source_id=new.source_id;
 end if;return new;
end $$;
revoke all on function history_private.fence_private_media_source() from public,anon,authenticated;
create trigger history_private_media_source_fence before update of state on history_private.source for each row execute function history_private.fence_private_media_source();

create function public.travel_life_private_media_cleanup(action text,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;item history_private.media_cleanup%rowtype;token uuid;max_items integer;
begin
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>4096 then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
 if action='lease' then
  if input-array['limit']<>'{}'::jsonb or input->>'limit' is null or input->>'limit'!~'^[0-9]{1,2}$' then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  max_items:=(input->>'limit')::integer;if max_items not between 1 and 10 then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  -- Fence expired reservations first. Keep path tombstones through delayed uploads;
  -- repeated deletion remains idempotent even after an earlier remove succeeded.
  insert into history_private.media_cleanup(storage_path,owner_id,artifact_id)
   select m.storage_path,m.owner_id,m.artifact_id from history_private.media_artifact m
   where m.state in ('staged','verified') and m.expires_at<now() on conflict do nothing;
  update history_private.media_artifact m set state='fenced' where exists(select 1 from history_private.media_cleanup c where c.owner_id=m.owner_id and c.artifact_id=m.artifact_id);
  result:='[]'::jsonb;
  for item in select c.* from history_private.media_cleanup c where (c.lease_until is null or c.lease_until<now())
   and not exists(select 1 from history_private.media_artifact m where m.owner_id=c.owner_id and m.artifact_id=c.artifact_id and m.upload_until>now())
   order by c.requested_at,c.storage_path for update of c skip locked limit max_items loop
   token:=gen_random_uuid();
   update history_private.media_cleanup set lease_id=token,lease_until=now()+interval '5 minutes',attempts=attempts+1 where storage_path=item.storage_path;
   result:=result||jsonb_build_array(jsonb_build_object('storagePath',item.storage_path,'leaseId',token));
  end loop;
  return jsonb_build_object('status','complete','items',result);
 elsif action='ack' then
  if input-array['storagePath','leaseId']<>'{}'::jsonb or input->>'storagePath' is null then return jsonb_build_object('error','MEDIA_SCHEMA'); end if;
  select * into item from history_private.media_cleanup where storage_path=input->>'storagePath' and lease_id=(input->>'leaseId')::uuid for update;
  if not found then return jsonb_build_object('error','MEDIA_CONFLICT'); end if;
  if item.purge_after<=now() then
   delete from history_private.media_attachment where owner_id=item.owner_id and artifact_id=item.artifact_id;
   delete from history_private.media_artifact where owner_id=item.owner_id and artifact_id=item.artifact_id and state='fenced';
   delete from history_private.media_cleanup where storage_path=item.storage_path;
  else
   update history_private.media_cleanup set lease_id=null,lease_until=now()+interval '1 hour' where storage_path=item.storage_path;
  end if;
  return jsonb_build_object('status','complete');
 end if;
 return jsonb_build_object('error','MEDIA_SCHEMA');
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','MEDIA_SCHEMA');
end $$;
revoke all on function public.travel_life_private_media_cleanup(text,jsonb) from public,anon,authenticated;
grant execute on function public.travel_life_private_media_cleanup(text,jsonb) to service_role;
