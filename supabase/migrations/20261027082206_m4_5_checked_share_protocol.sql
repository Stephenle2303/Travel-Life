-- Checked v1 publication. Every mutation takes the same owner fence lock first.
-- No exposed table/storage policy is created for anon or authenticated roles.
alter table share_private.snapshot_version add column snapshot_json jsonb;
alter table share_private.snapshot_version add column lease_until timestamptz not null default (now() + interval '24 hours');
alter table share_private.snapshot_share add column envelope_expires_at timestamptz;
create unique index snapshot_capability_unique on share_private.snapshot_share(capability_digest);
create table share_private.derivative (
  version_id uuid not null references share_private.snapshot_version(version_id),
  media_key text not null check (media_key ~ '^[A-Za-z0-9_-]{1,128}$'),
  object_path text not null unique,
  manifest jsonb not null,
  verified boolean not null default false,
  removed_at timestamptz,
  primary key(version_id, media_key)
);
alter table share_private.derivative enable row level security;
revoke all on share_private.derivative from public, anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('travel-life-share-private','travel-life-share-private',false,52428800,array['image/jpeg','video/mp4'])
 on conflict(id) do nothing;

create function public.travel_life_share_owner(requested_owner uuid, action text, input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare op share_private.publish_operation%rowtype;
declare link share_private.snapshot_share%rowtype;
declare ver share_private.snapshot_version%rowtype;
declare result jsonb;
declare item jsonb;
declare total_bytes bigint;
declare requested_bytes bigint;
declare created_share uuid;
declare created_version uuid;
declare request_key text := input->>'requestId';
declare fenced boolean;
begin
 if requested_owner is null then return jsonb_build_object('error','ACCESS'); end if;
 insert into share_private.owner_fence(owner_subject) values(requested_owner) on conflict do nothing;
 select delete_fenced_at is not null into fenced from share_private.owner_fence where owner_subject=requested_owner for update;
 if action='list' then
   select coalesce(jsonb_agg(jsonb_build_object('requestId',p.request_id,'shareId',s.share_id,'version',v.snapshot_json->>'version','title',v.snapshot_json->>'title','expiresAt',s.envelope_expires_at,'status',case when s.state='active' and s.envelope_expires_at<=now() then 'expired' else s.state end) order by p.created_at desc),'[]'::jsonb)
   into result from share_private.snapshot_share s join share_private.publish_operation p on p.share_id=s.share_id and p.version_id=s.active_version_id join share_private.snapshot_version v on v.version_id=p.version_id where s.owner_subject=requested_owner;
   return jsonb_build_object('status','complete','links',result,'fenced',fenced);
 end if;
 if action='delete-all' then
   update share_private.owner_fence set delete_fenced_at=coalesce(delete_fenced_at,now()) where owner_subject=requested_owner;
   update share_private.snapshot_share set state='revoked', revoked_at=coalesce(revoked_at,now()) where owner_subject=requested_owner and state in('active','staged');
   update share_private.publish_operation set state='revoke_pending',updated_at=now() where owner_subject=requested_owner and state in('activated','staged');
   return jsonb_build_object('status','removed'); -- Access removal acknowledged; storage cleanup remains queued.
 end if;
 if action='begin' then
   if fenced then return jsonb_build_object('error','FENCED'); end if;
   if request_key is null or request_key !~ '^[A-Za-z0-9_-]{1,128}$' or input->>'contentDigest' !~ '^[a-f0-9]{64}$' or input->>'capabilityDigest' !~ '^[a-f0-9]{64}$' or (input->>'expiresInDays')::integer not between 1 and 90 or jsonb_typeof(input->'snapshot')<>'object' then return jsonb_build_object('error','INVALID_REQUEST'); end if;
   select * into op from share_private.publish_operation where owner_subject=requested_owner and request_id=request_key;
   if found then
     select * into link from share_private.snapshot_share where share_id=op.share_id;
     if op.content_digest<>input->>'contentDigest' or link.capability_digest<>input->>'capabilityDigest' then return jsonb_build_object('error','CONFLICT'); end if;
     return jsonb_build_object('status',op.state,'requestId',op.request_id,'contentDigest',op.content_digest);
   end if;
   select coalesce(sum((d.manifest->>'byteLength')::bigint),0) into total_bytes from share_private.derivative d join share_private.snapshot_version v using(version_id) join share_private.snapshot_share s using(share_id) where s.owner_subject=requested_owner and d.removed_at is null;
   select coalesce(sum((m->>'byteLength')::bigint),0) into requested_bytes from jsonb_array_elements(input->'snapshot'->'media') m;
   if requested_bytes>262144000 or total_bytes+requested_bytes>1073741824 or (select count(*) from share_private.publish_operation where owner_subject=requested_owner and created_at>now()-interval '1 hour')>=10 then return jsonb_build_object('error','QUOTA'); end if;
   if input->>'replaceShareId' is not null then
     select * into link from share_private.snapshot_share where share_id=(input->>'replaceShareId')::uuid and owner_subject=requested_owner for update;
     if not found then return jsonb_build_object('error','ACCESS'); end if;
     if link.state<>'active' or link.envelope_expires_at<=now() then return jsonb_build_object('error','TERMINAL'); end if;
     if link.capability_digest<>input->>'capabilityDigest' then return jsonb_build_object('error','CONFLICT'); end if;
     created_share:=link.share_id;
   else
     if (select count(*) from share_private.snapshot_share where owner_subject=requested_owner and state in('active','staged') and (envelope_expires_at is null or envelope_expires_at>now()))>=20 then return jsonb_build_object('error','QUOTA'); end if;
     insert into share_private.snapshot_share(owner_subject,state,capability_digest) values(requested_owner,'staged',input->>'capabilityDigest') returning share_id into created_share;
   end if;
   insert into share_private.snapshot_version(share_id,content_digest,manifest_json,snapshot_json,expires_at) values(created_share,input->>'contentDigest',input->'snapshot',input->'snapshot',now()+make_interval(days=>(input->>'expiresInDays')::integer)) returning version_id into created_version;
   for item in select value from jsonb_array_elements(input->'snapshot'->'media') loop
     insert into share_private.derivative(version_id,media_key,object_path,manifest) values(created_version,item->>'key',gen_random_uuid()::text,item);
   end loop;
   insert into share_private.publish_operation(owner_subject,request_id,content_digest,share_id,version_id,state) values(requested_owner,request_key,input->>'contentDigest',created_share,created_version,'staged');
   return jsonb_build_object('status','staged','requestId',request_key,'contentDigest',input->>'contentDigest');
 end if;
 if action in('revoke','expiry') then
   select * into link from share_private.snapshot_share where share_id=(input->>'shareId')::uuid and owner_subject=requested_owner for update;
   if not found then return jsonb_build_object('error','ACCESS'); end if;
   if action='revoke' then
     update share_private.snapshot_share set state='revoked',revoked_at=coalesce(revoked_at,now()) where share_id=link.share_id;
     update share_private.publish_operation set state='revoke_pending',updated_at=now() where share_id=link.share_id and state in('staged','activated');
     return jsonb_build_object('status','revoked');
   end if;
   if fenced or link.state<>'active' or link.envelope_expires_at<=now() then return jsonb_build_object('error','TERMINAL'); end if;
   if input->>'expectedVersion'<>(select snapshot_json->>'version' from share_private.snapshot_version where version_id=link.active_version_id) then return jsonb_build_object('error','CONFLICT'); end if;
   if (input->>'expiresInDays')::integer not between 1 and 90 then return jsonb_build_object('error','INVALID_REQUEST'); end if;
   update share_private.snapshot_share set envelope_expires_at=now()+make_interval(days=>(input->>'expiresInDays')::integer) where share_id=link.share_id returning envelope_expires_at into ver.expires_at;
   return jsonb_build_object('status','complete','expiresAt',ver.expires_at);
 end if;
 select * into op from share_private.publish_operation where owner_subject=requested_owner and request_id=request_key for update;
 if not found then return jsonb_build_object('error','ACCESS'); end if;
 select * into link from share_private.snapshot_share where share_id=op.share_id for update;
 select * into ver from share_private.snapshot_version where version_id=op.version_id for update;
 if action='status' then return jsonb_build_object('status',op.state,'requestId',op.request_id,'contentDigest',op.content_digest,'shareId',op.share_id,'version',ver.snapshot_json->>'version','expiresAt',link.envelope_expires_at); end if;
 if fenced then return jsonb_build_object('error','FENCED'); end if;
 if link.state in('revoked','removed') or op.state in('revoke_pending','removed') then return jsonb_build_object('error','TERMINAL'); end if;
 if action='activate' then
   if op.content_digest<>input->>'contentDigest' then return jsonb_build_object('error','CONFLICT'); end if;
   if op.state='activated' then return jsonb_build_object('status','activated','requestId',op.request_id,'contentDigest',op.content_digest); end if;
   if ver.lease_until<=now() or ver.expires_at<=now() or exists(select 1 from share_private.derivative where version_id=op.version_id and not verified) then return jsonb_build_object('error','CONFLICT'); end if;
   update share_private.snapshot_version set verified_at=now() where version_id=op.version_id;
   update share_private.snapshot_share set state='active',active_version_id=op.version_id,envelope_expires_at=ver.expires_at where share_id=op.share_id;
   update share_private.publish_operation set state='activated',updated_at=now() where owner_subject=requested_owner and request_id=request_key;
   return jsonb_build_object('status','activated','requestId',op.request_id,'contentDigest',op.content_digest);
 end if;
 if action='cancel' then
   if op.state='activated' then return jsonb_build_object('status','activated'); end if;
   update share_private.publish_operation set state='revoke_pending',updated_at=now() where owner_subject=requested_owner and request_id=request_key;
   update share_private.snapshot_version set lease_until=now() where version_id=op.version_id;
   return jsonb_build_object('status','cancelled');
 end if;
 if action in('upload-target','verify') then
   if op.state<>'staged' or ver.lease_until<=now() then return jsonb_build_object('error','TERMINAL'); end if;
   if action='verify' then update share_private.derivative set verified=true where version_id=op.version_id and media_key=input->>'mediaKey'; end if;
   select jsonb_build_object('objectPath',object_path,'manifest',manifest,'verified',verified) into result from share_private.derivative where version_id=op.version_id and media_key=input->>'mediaKey';
   return coalesce(result,jsonb_build_object('error','ACCESS'));
 end if;
 return jsonb_build_object('error','INVALID_REQUEST');
end $$;
revoke all on function public.travel_life_share_owner(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.travel_life_share_owner(uuid,text,jsonb) to service_role;

create function public.travel_life_share_read(capability_hash text, requested_version text default null, requested_media text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare link share_private.snapshot_share%rowtype;
declare ver share_private.snapshot_version%rowtype;
declare media jsonb;
begin
 select * into link from share_private.snapshot_share where capability_digest=capability_hash and state='active' and envelope_expires_at>now();
 if not found then return null; end if;
 select * into ver from share_private.snapshot_version where version_id=link.active_version_id and verified_at is not null;
 if not found or (requested_version is not null and requested_version<>ver.snapshot_json->>'version') then return null; end if;
 if requested_media is not null then
   select jsonb_build_object('objectPath',object_path,'manifest',manifest) into media from share_private.derivative where version_id=ver.version_id and media_key=requested_media and verified and removed_at is null;
   return media;
 end if;
 return jsonb_build_object('snapshot',ver.snapshot_json,'expiresAt',link.envelope_expires_at);
end $$;
revoke all on function public.travel_life_share_read(text,text,text) from public,anon,authenticated;
grant execute on function public.travel_life_share_read(text,text,text) to service_role;

-- Bounded cleanup leases serialize with all owner mutations. Access denial does
-- not depend on cleanup. Quota releases only on acknowledged storage deletion.
alter table share_private.derivative add column cleanup_lease uuid;
alter table share_private.derivative add column cleanup_until timestamptz;
create function public.travel_life_share_cleanup(batch_limit integer default 25)
returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record;
declare lease uuid := gen_random_uuid();
declare output jsonb := '[]'::jsonb;
begin
 for candidate in select d.version_id,d.media_key,v.share_id,s.owner_subject from share_private.derivative d join share_private.snapshot_version v using(version_id) join share_private.snapshot_share s using(share_id)
   where d.removed_at is null and (d.cleanup_until is null or d.cleanup_until<now())
   and ((s.state in('revoked','removed') and s.revoked_at<now()-interval '7 days') or (s.envelope_expires_at<=now()-interval '7 days') or (s.active_version_id is distinct from v.version_id and v.lease_until<now()-interval '24 hours'))
   limit least(greatest(batch_limit,1),25)
 loop
   perform 1 from share_private.owner_fence where owner_subject=candidate.owner_subject for update;
   perform 1 from share_private.snapshot_share where share_id=candidate.share_id for update;
   if exists(select 1 from share_private.snapshot_share where share_id=candidate.share_id and state='active' and envelope_expires_at>now() and active_version_id=candidate.version_id) then continue; end if;
   update share_private.derivative set cleanup_lease=lease,cleanup_until=now()+interval '5 minutes' where version_id=candidate.version_id and media_key=candidate.media_key and removed_at is null and (cleanup_until is null or cleanup_until<now());
   if found then output:=output || (select jsonb_build_object('versionId',version_id,'mediaKey',media_key,'objectPath',object_path,'lease',cleanup_lease) from share_private.derivative where version_id=candidate.version_id and media_key=candidate.media_key); end if;
 end loop;
 return output;
end $$;
create function public.travel_life_share_cleanup_ack(requested_version uuid,requested_media text,requested_lease uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
declare target_share uuid;
begin
 select s.owner_subject,s.share_id into owner_id,target_share from share_private.snapshot_version v join share_private.snapshot_share s using(share_id) where v.version_id=requested_version;
 perform 1 from share_private.owner_fence where owner_subject=owner_id for update;
 perform 1 from share_private.snapshot_share where share_id=target_share for update;
 if exists(select 1 from share_private.snapshot_share where share_id=target_share and state='active' and envelope_expires_at>now() and active_version_id=requested_version) then return false; end if;
 update share_private.derivative set removed_at=now(),cleanup_lease=null,cleanup_until=null where version_id=requested_version and media_key=requested_media and cleanup_lease=requested_lease;
 return found;
end $$;
revoke all on function public.travel_life_share_cleanup(integer) from public,anon,authenticated;
revoke all on function public.travel_life_share_cleanup_ack(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.travel_life_share_cleanup(integer) to service_role;
grant execute on function public.travel_life_share_cleanup_ack(uuid,text,uuid) to service_role;
