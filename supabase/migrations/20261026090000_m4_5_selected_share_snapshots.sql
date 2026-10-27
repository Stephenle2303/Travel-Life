-- M4.5 share records are private operational state. The Data API and direct
-- Storage access are deliberately not reader surfaces; JWT-protected Edge
-- Functions call the service-role-only RPCs below after validating the owner.
create schema if not exists share_private;

create table share_private.owner_fence (
  owner_subject uuid primary key,
  delete_fenced_at timestamptz null,
  created_at timestamptz not null default now()
);

create table share_private.snapshot_share (
  share_id uuid primary key default gen_random_uuid(),
  owner_subject uuid not null,
  state text not null check (state in ('staged', 'active', 'revoked', 'removed')),
  capability_digest text not null check (capability_digest ~ '^[0-9a-f]{64}$'),
  active_version_id uuid null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  unique (owner_subject, capability_digest)
);

create table share_private.snapshot_version (
  version_id uuid primary key default gen_random_uuid(),
  share_id uuid not null references share_private.snapshot_share(share_id) on delete restrict,
  content_digest text not null check (content_digest ~ '^[A-Za-z0-9_-]+$' and length(content_digest) <= 256),
  manifest_json jsonb not null default '{}'::jsonb,
  verified_at timestamptz null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (share_id, content_digest)
);

alter table share_private.snapshot_share
  add constraint snapshot_share_active_version_fk
  foreign key (active_version_id) references share_private.snapshot_version(version_id) on delete restrict;

create table share_private.publish_operation (
  owner_subject uuid not null,
  request_id text not null check (request_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  content_digest text not null check (content_digest ~ '^[A-Za-z0-9_-]+$' and length(content_digest) <= 256),
  share_id uuid not null references share_private.snapshot_share(share_id) on delete restrict,
  version_id uuid not null references share_private.snapshot_version(version_id) on delete restrict,
  state text not null check (state in ('staged', 'activated', 'revoke_pending', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_subject, request_id)
);

alter table share_private.owner_fence enable row level security;
alter table share_private.snapshot_share enable row level security;
alter table share_private.snapshot_version enable row level security;
alter table share_private.publish_operation enable row level security;
revoke all on all tables in schema share_private from public, anon, authenticated;

create function public.begin_travel_life_share_publish(
  requested_owner uuid,
  requested_request_id text,
  requested_content_digest text,
  requested_capability text,
  requested_expires_in_days integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing share_private.publish_operation%rowtype;
declare created_share uuid;
declare created_version uuid;
begin
  if requested_owner is null
    or requested_request_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or requested_content_digest !~ '^[A-Za-z0-9_-]+$' or length(requested_content_digest) > 256
    or length(requested_capability) < 22
    or requested_expires_in_days not between 1 and 90 then
    raise exception 'TL_SHARE_INVALID_REQUEST';
  end if;

  select * into existing from share_private.publish_operation
    where owner_subject = requested_owner and request_id = requested_request_id
    for update;
  if found then
    if existing.content_digest <> requested_content_digest then raise exception 'TL_SHARE_RECEIPT_CONFLICT'; end if;
    return jsonb_build_object('status', existing.state, 'requestId', requested_request_id, 'contentDigest', requested_content_digest);
  end if;

  insert into share_private.owner_fence (owner_subject) values (requested_owner)
    on conflict (owner_subject) do nothing;
  if exists (select 1 from share_private.owner_fence where owner_subject = requested_owner and delete_fenced_at is not null) then
    return jsonb_build_object('status', 'fenced', 'requestId', requested_request_id, 'contentDigest', requested_content_digest);
  end if;

  insert into share_private.snapshot_share (owner_subject, state, capability_digest)
    values (requested_owner, 'staged', encode(extensions.digest(requested_capability, 'sha256'), 'hex'))
    returning share_id into created_share;
  insert into share_private.snapshot_version (share_id, content_digest, expires_at)
    values (created_share, requested_content_digest, now() + make_interval(days => requested_expires_in_days))
    returning version_id into created_version;
  insert into share_private.publish_operation (owner_subject, request_id, content_digest, share_id, version_id, state)
    values (requested_owner, requested_request_id, requested_content_digest, created_share, created_version, 'staged');
  return jsonb_build_object('status', 'staged', 'requestId', requested_request_id, 'contentDigest', requested_content_digest);
end;
$$;

create function public.activate_travel_life_share_publish(
  requested_owner uuid,
  requested_request_id text,
  requested_content_digest text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare operation share_private.publish_operation%rowtype;
begin
  select * into operation from share_private.publish_operation
    where owner_subject = requested_owner and request_id = requested_request_id
    for update;
  if not found or operation.content_digest <> requested_content_digest then raise exception 'TL_SHARE_RECEIPT_CONFLICT'; end if;
  if exists (select 1 from share_private.owner_fence where owner_subject = requested_owner and delete_fenced_at is not null) then
    update share_private.publish_operation set state = 'revoke_pending', updated_at = now()
      where owner_subject = requested_owner and request_id = requested_request_id;
    return jsonb_build_object('status', 'fenced', 'requestId', requested_request_id, 'contentDigest', requested_content_digest);
  end if;
  -- Edge code may call this only after private object membership and derivative
  -- verification are complete. The database still makes the active-pointer swap
  -- and receipt state atomic.
  update share_private.snapshot_version set verified_at = now() where version_id = operation.version_id;
  update share_private.snapshot_share set state = 'active', active_version_id = operation.version_id where share_id = operation.share_id;
  update share_private.publish_operation set state = 'activated', updated_at = now()
    where owner_subject = requested_owner and request_id = requested_request_id;
  return jsonb_build_object('status', 'activated', 'requestId', requested_request_id, 'contentDigest', requested_content_digest);
end;
$$;

create function public.fence_travel_life_share_owner(requested_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into share_private.owner_fence (owner_subject, delete_fenced_at) values (requested_owner, now())
    on conflict (owner_subject) do update set delete_fenced_at = excluded.delete_fenced_at;
  update share_private.publish_operation set state = 'revoke_pending', updated_at = now()
    where owner_subject = requested_owner and state in ('staged', 'activated');
  update share_private.snapshot_share set state = 'revoked', revoked_at = now()
    where owner_subject = requested_owner and state in ('staged', 'active');
end;
$$;

revoke all on function public.begin_travel_life_share_publish(uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.activate_travel_life_share_publish(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fence_travel_life_share_owner(uuid) from public, anon, authenticated;
grant execute on function public.begin_travel_life_share_publish(uuid, text, text, text, integer) to service_role;
grant execute on function public.activate_travel_life_share_publish(uuid, text, text) to service_role;
grant execute on function public.fence_travel_life_share_owner(uuid) to service_role;


