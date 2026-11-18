-- Consolidated, locally tested M6/M7 changes; not yet deployed.
-- Source: _bmad-output/implementation-artifacts/m7-source-media-selection-draft.sql
-- Local draft only. Generate the eventual migration with Supabase CLI after review.
-- Requires the M7 private media migration. Actual Postgres verification is open.
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_media_history;
revoke all on function history_private.pre_media_history(text,jsonb) from public,anon,authenticated;

create function public.travel_life_history(action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb;a history_private.account%rowtype;s history_private.source%rowtype;g history_private.aggregate%rowtype;
 items jsonb;total bigint;page_index integer;audio jsonb;
begin
 if action<>'source-media' then return history_private.pre_media_history(action,input); end if;
 base:=history_private.account_action('status','{}');
 if base ? 'error' then return base; end if;
 if input is null or jsonb_typeof(input)<>'object' or input-array['installationId','page']<>'{}'::jsonb
  or (select count(*) from jsonb_object_keys(input))<>2 or input->>'installationId' is null
  or input->>'page' is null or input->>'page'!~'^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 page_index:=(input->>'page')::integer;
 select * into a from history_private.account where owner_id=auth.uid() for share;
 if not found or a.delete_fenced_at is not null then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT'); end if;
 select * into s from history_private.source where owner_id=auth.uid() and installation_id=(input->>'installationId')::uuid;
 if not found or s.state<>'active' then return jsonb_build_object('error','HISTORY_FENCED'); end if;
 select * into g from history_private.aggregate where owner_id=auth.uid() and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
 if not found or not history_private.same_source_content(g.source_plan,history_private.current_source_plan(auth.uid())) then return jsonb_build_object('error','HISTORY_STALE'); end if;
 -- The active aggregate's exact source copies are authority. Local refs do not
 -- allocate identities or add membership; current media_scope enforces privacy.
 select count(*) into total from jsonb_array_elements(g.metadata->'sourceCopies') c
 join history_private.aggregate_page p on p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id
 cross join lateral jsonb_array_elements(p.records) r
 where c->>'sourceId'=s.source_id::text and r->>'kind'='evidence' and r->>'key'=c->>'evidenceId'
  and not coalesce(g.metadata->'privacy'->'hiddenEvidenceIds'?(c->>'evidenceId'),false)
  and not coalesce(g.metadata->'privacy'->'excludedEvidenceIds'?(c->>'evidenceId'),false);
 if page_index>=greatest(1,(total+23)/24) then return jsonb_build_object('error','HISTORY_SCHEMA'); end if;
 select coalesce(jsonb_agg(item order by item->>'id'),'[]'::jsonb) into items from (
  select jsonb_build_object('id',c->>'evidenceId','sourceRef',c->>'localSourceRef',
   'kind',case when r->'value'->>'media_type'='video' then 'video' else 'photo' end,
   'day',r->'value'->'captured_day','expectedRevision',coalesce(m.revision,0)) item
  from jsonb_array_elements(g.metadata->'sourceCopies') c
  join history_private.aggregate_page p on p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id
  cross join lateral jsonb_array_elements(p.records) r
  left join history_private.media_attachment m on m.owner_id=auth.uid() and m.target_key='evidence:'||(c->>'evidenceId')
  where c->>'sourceId'=s.source_id::text and r->>'kind'='evidence' and r->>'key'=c->>'evidenceId'
   and not coalesce(g.metadata->'privacy'->'hiddenEvidenceIds'?(c->>'evidenceId'),false)
   and not coalesce(g.metadata->'privacy'->'excludedEvidenceIds'?(c->>'evidenceId'),false)
  order by c->>'evidenceId' limit 24 offset page_index*24
 ) q;
 if a.preferred_replay_source=s.source_id then
  select jsonb_build_object('revision',((r->'value'->>'committed_overrides_json')::jsonb)->'soundtrack'->>'revision','expectedRevision',coalesce(m.revision,0)) into audio
  from history_private.aggregate_page p cross join lateral jsonb_array_elements(p.records) r
  left join history_private.media_attachment m on m.owner_id=auth.uid() and m.target_key='soundtrack:'||(((r->'value'->>'committed_overrides_json')::jsonb)->'soundtrack'->>'revision')
  where p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id and r->>'kind'='replay'
   and ((r->'value'->>'committed_overrides_json')::jsonb)->'soundtrack'->>'kind'='custom' limit 1;
 end if;
 return jsonb_build_object('status','complete','accountGeneration',a.generation,'sourceId',s.source_id,'sourceGeneration',s.generation,
  'aggregateId',g.aggregate_id,'sourceSnapshotRevision',s.snapshot_revision,'page',page_index,'pages',greatest(1,(total+23)/24),'total',total,'items',items,'soundtrack',audio);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

-- Source: _bmad-output/implementation-artifacts/m6-account-controls-draft.sql
-- Local draft; no hosted deployment or migration history is implied.
-- Apply after m7-source-media-selection-draft.sql in the local test harness.
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_account_controls;
revoke all on function history_private.pre_account_controls(text,jsonb) from public,anon,authenticated;

create function public.travel_life_history(action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid();sid uuid;target uuid;a history_private.account%rowtype;
 old history_private.receipt%rowtype;mutation uuid;digest text;result jsonb;page_index integer;total bigint;
begin
 if action not in ('sessions','revoke-session','consent') then return history_private.pre_account_controls(action,input);end if;
 -- account_action verifies exact live verified Auth identity, app revocation and lock.
 result:=history_private.account_action('status','{}');if result ? 'error' then return result;end if;
 sid:=(auth.jwt()->>'session_id')::uuid;
 select * into a from history_private.account where owner_id=subject for update;
 if a.delete_fenced_at is not null then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>4096 then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if action='sessions' then
  if input-array['page']<>'{}'::jsonb or input->>'page' is null or input->>'page'!~'^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  page_index:=(input->>'page')::integer;
  select count(*) into total from auth.sessions s where s.user_id=subject and (s.not_after is null or s.not_after>now())
   and not exists(select 1 from history_private.revoked_session r where r.owner_id=subject and r.session_id=s.id);
  if page_index>=greatest(1,ceil(total/20.0)::integer) then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select coalesce(jsonb_agg(x.item order by x.created_at,x.id),'[]'::jsonb) into result from (
   select s.id,s.created_at,jsonb_build_object('sessionId',s.id,'createdAt',s.created_at,'updatedAt',s.updated_at,'current',s.id=sid) item
   from auth.sessions s where s.user_id=subject and (s.not_after is null or s.not_after>now())
    and not exists(select 1 from history_private.revoked_session r where r.owner_id=subject and r.session_id=s.id)
   order by s.created_at,s.id limit 20 offset page_index*20) x;
  return jsonb_build_object('status','complete','page',page_index,'pages',greatest(1,ceil(total/20.0)::integer),'sessions',result);
 end if;
 mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 digest:=encode(extensions.digest(convert_to(action||input::text,'UTF8'),'sha256'),'hex');
 select * into old from history_private.receipt where owner_id=subject and mutation_id=mutation;
 if found then if old.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT');end if;return old.result;end if;
 if input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if action='consent' then
  if input-array['mutationId','generation','expectedRevision','history','media']<>'{}'::jsonb
   or jsonb_typeof(input->'history') is distinct from 'boolean' or jsonb_typeof(input->'media') is distinct from 'boolean'
   or input->>'media'='true' and input->>'history'<>'true' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  if input ? 'expectedRevision' then
   if input->>'expectedRevision' is distinct from a.revision::text then return jsonb_build_object('error','HISTORY_CONFLICT');end if;
  elsif a.revision<>0 then return jsonb_build_object('error','HISTORY_CONFLICT');end if;
  update history_private.account set history_consent=(input->>'history')::boolean,media_consent=(input->>'media')::boolean,revision=revision+1 where owner_id=subject;
  result:=jsonb_build_object('status','complete','revision',a.revision+1);
 else
  if input-array['mutationId','generation','sessionId']<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  target:=(input->>'sessionId')::uuid;
  if target is null or not exists(select 1 from auth.sessions s where s.user_id=subject and s.id=target) then return jsonb_build_object('error','HISTORY_STALE');end if;
  insert into history_private.revoked_session(owner_id,session_id) values(subject,target) on conflict do nothing;
  -- Auth's refresh CheckValidity evaluates NotAfter; existing app live checks do too.
  update auth.sessions set not_after=least(coalesce(not_after,now()),now()),updated_at=now() where user_id=subject and id=target;
  result:=jsonb_build_object('status','complete');
 end if;
 insert into history_private.receipt(owner_id,mutation_id,digest,result) values(subject,mutation,digest,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

-- Source: _bmad-output/implementation-artifacts/m7-aggregate-continuity-draft.sql
-- Local draft, apply after M6 account controls. No hosted migration implied.
create function history_private.readable_prior_aggregate(subject uuid,plan jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare old_source jsonb;live_source jsonb;old_rows jsonb;live_rows jsonb;
begin
 if jsonb_typeof(plan) is distinct from 'array' then return false;end if;
 for old_source in select * from jsonb_array_elements(plan) loop
  select p into live_source from jsonb_array_elements(history_private.current_source_plan(subject)) p where p->>'sourceId'=old_source->>'sourceId';
  if live_source is null or live_source->>'state'='removed' or live_source->>'snapshotId' is null then return false;end if;
  select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) into old_rows
   from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=subject and p.snapshot_id=(old_source->>'snapshotId')::uuid;
  select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) into live_rows
   from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=subject and p.snapshot_id=(live_source->>'snapshotId')::uuid;
  if not live_rows @> old_rows then return false;end if;
  if (select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) from jsonb_array_elements(old_rows) r where r->>'kind'<>'evidence')
    is distinct from (select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) from jsonb_array_elements(live_rows) r where r->>'kind'<>'evidence') then return false;end if;
 end loop;
 for live_source in select * from jsonb_array_elements(history_private.current_source_plan(subject)) loop
  if not exists(select 1 from jsonb_array_elements(plan) p where p->>'sourceId'=live_source->>'sourceId') and exists(
   select 1 from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r
   where p.owner_id=subject and p.snapshot_id=(live_source->>'snapshotId')::uuid and r->>'kind'<>'evidence') then return false;end if;
 end loop;
 return true;
exception when invalid_text_representation then return false;
end $$;
revoke all on function history_private.readable_prior_aggregate(uuid,jsonb) from public,anon,authenticated;
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_aggregate_continuity;
revoke all on function history_private.pre_aggregate_continuity(text,jsonb) from public,anon,authenticated;
create function public.travel_life_history(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare base jsonb;a history_private.account%rowtype;g history_private.aggregate%rowtype;records jsonb;readable boolean;
begin
 if action<>'status' and not(action='pull' and input ? 'aggregateId') then return history_private.pre_aggregate_continuity(action,input);end if;
 base:=history_private.pre_aggregate_continuity('status','{}');if base ? 'error' then return base;end if;
 select * into a from history_private.account where owner_id=auth.uid();
 select * into g from history_private.aggregate where owner_id=auth.uid() and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
 if found then
  readable:=a.delete_fenced_at is null and history_private.readable_prior_aggregate(auth.uid(),g.source_plan);
  if action='status' then return base||jsonb_build_object('activeSnapshot',null,'activeAggregate',case when readable then g.aggregate_id else null end,'aggregateRevision',a.aggregate_revision,'aggregatePages',case when readable then g.expected_pages else null end,'pendingMerge',not history_private.same_source_content(g.source_plan,history_private.current_source_plan(auth.uid())));end if;
  if not readable or input->>'aggregateId' is distinct from g.aggregate_id::text then return jsonb_build_object('error','HISTORY_STALE');end if;
  if input-array['aggregateId','page']<>'{}'::jsonb or input->>'page' is null or input->>'page'!~'^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select p.records into records from history_private.aggregate_page p where p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id and p.page_number=(input->>'page')::integer;
  if records is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  return jsonb_build_object('status','complete','snapshotId',g.aggregate_id,'aggregateId',g.aggregate_id,'aggregateRevision',g.aggregate_revision,'page',(input->>'page')::integer,'pages',g.expected_pages,'schemaVersion',37,'records',records);
 end if;
 return history_private.pre_aggregate_continuity(action,input);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

-- Source: _bmad-output/implementation-artifacts/m7-source-impact-draft.sql
-- Local draft, apply after aggregate continuity. No hosted migration implied.
create table history_private.source_preview_receipt(owner_id uuid not null references history_private.account(owner_id),mutation_id uuid not null,digest text not null,result jsonb not null,primary key(owner_id,mutation_id));
alter table history_private.source_preview_receipt enable row level security;
revoke all on history_private.source_preview_receipt from public,anon,authenticated;
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_source_impact;
revoke all on function history_private.pre_source_impact(text,jsonb) from public,anon,authenticated;
create function public.travel_life_history(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare base jsonb;a history_private.account%rowtype;s history_private.source%rowtype;x history_private.snapshot%rowtype;g history_private.aggregate%rowtype;
 records jsonb;media jsonb;total bigint;page_index integer;mutation uuid;digest text;old history_private.source_preview_receipt%rowtype;
begin
 if action='source-control' and input->>'mode'<>'removed' then return history_private.pre_source_impact(action,input-array['expectedSourceRevision','expectedAccountRevision']);end if;
 if action not in ('source-impact','status') and not(action='source-control' and input->>'mode'='removed') then return history_private.pre_source_impact(action,input);end if;
 base:=history_private.pre_source_impact('status','{}');if base ? 'error' then return base;end if;
 select * into a from history_private.account where owner_id=auth.uid() for update;
 if action='status' then
  select coalesce(jsonb_agg(item order by item->>'sourceId'),'[]'::jsonb) into records from (
   select src||jsonb_build_object('coverage',jsonb_build_object('acceptedMetadata',count(r) filter(where r->>'kind'='evidence'),
    'observedStart',min(r->'value'->>'captured_day') filter(where r->>'kind'='evidence'),'observedEnd',max(r->'value'->>'captured_day') filter(where r->>'kind'='evidence'),
    'acknowledgedMedia',(select count(*) from history_private.media_attachment m join history_private.media_artifact art using(owner_id,artifact_id) where art.owner_id=a.owner_id and art.source_id=(src->>'sourceId')::uuid and art.state='active'),
    'pendingMedia',(select count(*) from history_private.media_artifact art where art.owner_id=a.owner_id and art.source_id=(src->>'sourceId')::uuid and art.state in ('staged','verified')))) item
   from jsonb_array_elements(base->'sources') src
   left join history_private.source source_row on source_row.owner_id=a.owner_id and source_row.source_id=(src->>'sourceId')::uuid
   left join history_private.snapshot snap on snap.owner_id=source_row.owner_id and snap.source_id=source_row.source_id and snap.source_revision=source_row.snapshot_revision and snap.state in ('initial','pending')
   left join history_private.snapshot_page p on p.owner_id=snap.owner_id and p.snapshot_id=snap.snapshot_id
   left join lateral jsonb_array_elements(p.records) r on true group by src
  ) q;
  return base||jsonb_build_object('sources',records);
 end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>8192 then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if action='source-control' then
  mutation:=(input->>'mutationId')::uuid;
  digest:=encode(extensions.digest(convert_to(action||input::text,'UTF8'),'sha256'),'hex');
  select * into old from history_private.source_preview_receipt where owner_id=a.owner_id and mutation_id=mutation;
  if found then if old.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT');end if;return old.result;end if;
 end if;
 select * into s from history_private.source where owner_id=a.owner_id and source_id=(input->>'sourceId')::uuid;
 if not found or s.state='removed' then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if action='source-control' then
  if input-array['mutationId','generation','sourceId','sourceGeneration','mode','expectedSourceRevision','expectedAccountRevision']<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  mutation:=(input->>'mutationId')::uuid;
  if input->>'expectedSourceRevision' is distinct from s.snapshot_revision::text or input->>'expectedAccountRevision' is distinct from a.revision::text then return jsonb_build_object('error','HISTORY_CONFLICT');end if;
  base:=history_private.pre_source_impact(action,input-array['expectedSourceRevision','expectedAccountRevision']);
  if base->>'status'='complete' then insert into history_private.source_preview_receipt(owner_id,mutation_id,digest,result) values(a.owner_id,mutation,digest,base);end if;
  return base;
 end if;
 if input-array['sourceId','page','expectedSourceRevision']<>'{}'::jsonb or input->>'page' is null or input->>'page'!~'^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if input ? 'expectedSourceRevision' and input->>'expectedSourceRevision' is distinct from s.snapshot_revision::text then return jsonb_build_object('error','HISTORY_CONFLICT');end if;
 select * into x from history_private.snapshot where owner_id=a.owner_id and source_id=s.source_id and source_revision=s.snapshot_revision and state in ('initial','pending') order by snapshot_id limit 1;
 if not found then return jsonb_build_object('error','HISTORY_INCOMPLETE');end if;
 page_index:=(input->>'page')::integer;
 select count(*) into total from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=a.owner_id and p.snapshot_id=x.snapshot_id;
 if page_index>=greatest(1,(total+23)/24) then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) into records from (
  select r from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=a.owner_id and p.snapshot_id=x.snapshot_id order by r->>'kind',r->>'key' limit 24 offset page_index*24
 ) q;
 select * into g from history_private.aggregate where owner_id=a.owner_id and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
 select coalesce(jsonb_agg(jsonb_build_object('localKey',r->>'key','evidenceId',c->>'evidenceId') order by r->>'key'),'[]'::jsonb) into media
  from jsonb_array_elements(records) r join lateral jsonb_array_elements(g.metadata->'sourceCopies') c on c->>'localEvidenceId'=r->>'key' and c->>'sourceId'=s.source_id::text where r->>'kind'='evidence';
 return jsonb_build_object('status','complete','sourceId',s.source_id,'sourceGeneration',s.generation,'sourceSnapshotRevision',s.snapshot_revision,'accountGeneration',a.generation,'accountRevision',a.revision,'aggregateId',g.aggregate_id,'page',page_index,'pages',greatest(1,(total+23)/24),'total',total,'records',records,'media',media);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

-- Source: _bmad-output/implementation-artifacts/m6-account-deletion-draft.sql
-- Local draft after source-impact. No hosted deployment is implied.
-- No FK to Auth: a minimal fence and receipt must survive identity deletion.
create table history_private.account_deletion (
 owner_id uuid primary key,mutation_id uuid not null,request_digest text not null,
 ticket_digest text not null unique,state text not null check(state in ('pending','metadata-purged','completed')),
 lease_id uuid,lease_until timestamptz,requested_at timestamptz not null default now(),completed_at timestamptz
);
alter table history_private.account_deletion enable row level security;
revoke all on history_private.account_deletion from public,anon,authenticated;
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_account_deletion;
revoke all on function history_private.pre_account_deletion(text,jsonb) from public,anon,authenticated;

create function public.travel_life_history(action text,input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid();a history_private.account%rowtype;old history_private.account_deletion%rowtype;
 base jsonb;mutation uuid;ticket_hash text;request_hash text;sid uuid;
begin
 if exists(select 1 from history_private.account_deletion where owner_id=subject) then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if action<>'delete-account' then return history_private.pre_account_deletion(action,input);end if;
 base:=history_private.account_action('status','{}');if base ? 'error' then return base;end if;
 sid:=(auth.jwt()->>'session_id')::uuid;
 if not exists(select 1 from auth.sessions where id=sid and user_id=subject and created_at>now()-interval '10 minutes') then return jsonb_build_object('error','ACCOUNT_REAUTH');end if;
 if input is null or jsonb_typeof(input)<>'object' or input-array['mutationId','generation','ticket']<>'{}'::jsonb
  or input->>'ticket' is null or input->>'ticket'!~'^[a-f0-9]{64}$' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 select * into a from history_private.account where owner_id=subject for update;
 -- Recheck after the account lock: concurrent requests cannot replace a receipt.
 if exists(select 1 from history_private.account_deletion where owner_id=subject) then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 ticket_hash:=encode(extensions.digest(convert_to(input->>'ticket','UTF8'),'sha256'),'hex');
 request_hash:=encode(extensions.digest(convert_to(input::text,'UTF8'),'sha256'),'hex');
 insert into history_private.account_deletion(owner_id,mutation_id,request_digest,ticket_digest,state) values(subject,mutation,request_hash,ticket_hash,'pending');
 -- Existing triggers fence aggregates and queue every private object for cleanup.
 update history_private.account set generation=generation+1,delete_fenced_at=now(),history_consent=false,media_consent=false,active_snapshot=null where owner_id=subject;
 update auth.sessions set not_after=least(coalesce(not_after,now()),now()) where user_id=subject;
 return jsonb_build_object('status','pending');
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
 when unique_violation then return jsonb_build_object('error','HISTORY_CONFLICT');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

-- A 256-bit capability exposes only one fixed state; no subject or content.
create function public.travel_life_deletion_status(ticket text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare deletion_state text;
begin
 if ticket is null or ticket!~'^[a-f0-9]{64}$' then return '{"status":"unavailable"}'::jsonb;end if;
 select state into deletion_state from history_private.account_deletion where ticket_digest=encode(extensions.digest(convert_to(ticket,'UTF8'),'sha256'),'hex');
 return jsonb_build_object('status',case when deletion_state='completed' then 'completed' when deletion_state is not null then 'pending' else 'unavailable' end);
end $$;
revoke all on function public.travel_life_deletion_status(text) from public;
grant execute on function public.travel_life_deletion_status(text) to anon,authenticated;

create function public.travel_life_account_deletion(action text,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job history_private.account_deletion%rowtype;items jsonb:='[]';token uuid;table_name text;
begin
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>4096 then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if action='lease' then
  if input<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  for job in select d.* from history_private.account_deletion d where d.state<>'completed' and (d.lease_until is null or d.lease_until<now())
   order by d.requested_at,d.owner_id for update of d skip locked limit 10 loop
   token:=gen_random_uuid();update history_private.account_deletion set lease_id=token,lease_until=now()+interval '5 minutes' where owner_id=job.owner_id;
   items:=items||jsonb_build_array(jsonb_build_object('owner',job.owner_id,'leaseId',token));
  end loop;
  return jsonb_build_object('status','complete','items',items);
 end if;
 if input-array['owner','leaseId']<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 select * into job from history_private.account_deletion where owner_id=(input->>'owner')::uuid and lease_id=(input->>'leaseId')::uuid and lease_until>now() for update;
 if not found then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if action='purge' then
  if exists(select 1 from history_private.media_cleanup where owner_id=job.owner_id) or exists(select 1 from history_private.media_artifact where owner_id=job.owner_id) then return jsonb_build_object('status','pending');end if;
  -- Fixed private tables only; identifiers never come from caller input.
  foreach table_name in array array['owner_proposal','owner_journal','source_preview_receipt','media_receipt','media_attachment','snapshot','aggregate','identity_mapping','source','receipt','revoked_session'] loop
   if to_regclass(format('history_private.%I',table_name)) is not null then execute format('delete from history_private.%I where owner_id=$1',table_name) using job.owner_id;end if;
  end loop;
  delete from history_private.account where owner_id=job.owner_id;
  update history_private.account_deletion set state='metadata-purged' where owner_id=job.owner_id;
  return jsonb_build_object('status','metadata-purged');
 elsif action='complete' then
  if job.state<>'metadata-purged' or exists(select 1 from auth.users where id=job.owner_id) then return jsonb_build_object('error','HISTORY_INCOMPLETE');end if;
  update history_private.account_deletion set state='completed',completed_at=now(),lease_id=null,lease_until=null where owner_id=job.owner_id;
  return jsonb_build_object('status','completed');
 end if;
 return jsonb_build_object('error','HISTORY_SCHEMA');
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_account_deletion(text,jsonb) from public,anon,authenticated;
grant execute on function public.travel_life_account_deletion(text,jsonb) to service_role;

-- Source: _bmad-output/implementation-artifacts/m7-correction-journal-draft.sql
-- Local draft after M6 deletion; no hosted migration or enablement implied.
create table history_private.owner_journal(owner_id uuid primary key references history_private.account(owner_id),revision bigint not null default 0,changes jsonb not null default '{"rows":[],"deleted":[]}');
create table history_private.owner_proposal(owner_id uuid not null references history_private.account(owner_id),mutation_id uuid not null,digest text not null,base_aggregate uuid not null,expected_revision bigint not null,source_plan jsonb not null,changes jsonb not null,accepted_before jsonb not null,state text not null check(state in ('accepted','conflict','resolved')),result jsonb not null,primary key(owner_id,mutation_id));
alter table history_private.owner_journal enable row level security;
alter table history_private.owner_proposal enable row level security;
revoke all on history_private.owner_journal,history_private.owner_proposal from public,anon,authenticated;

create function history_private.valid_owner_changes(changes jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare item jsonb;seen text[]:='{}';identity text;
begin
 if changes is null or jsonb_typeof(changes)<>'object' or changes-array['rows','deleted']<>'{}'::jsonb or jsonb_typeof(changes->'rows') is distinct from 'array' or jsonb_typeof(changes->'deleted') is distinct from 'array'
  or jsonb_array_length(changes->'rows')+jsonb_array_length(changes->'deleted')>100 or octet_length(changes::text)>450000 then return false;end if;
 for item in select * from jsonb_array_elements(changes->'rows') loop
  if item->>'kind' not in ('overlay','journey-correction','memory-correction','privacy','home','manual','replay') or not history_private.valid_record(item) then return false;end if;
  identity:=jsonb_build_array(item->>'kind',item->>'key')::text;if identity=any(seen) then return false;end if;seen:=array_append(seen,identity);
 end loop;
 for item in select * from jsonb_array_elements(changes->'deleted') loop
  if jsonb_typeof(item)<>'object' or item-array['kind','key']<>'{}'::jsonb or item->>'kind' not in ('manual','home','replay') or item->>'key' is null or length(item->>'key') not between 1 and 1024 then return false;end if;
  identity:=jsonb_build_array(item->>'kind',item->>'key')::text;if identity=any(seen) then return false;end if;seen:=array_append(seen,identity);
 end loop;return true;
end $$;
revoke all on function history_private.valid_owner_changes(jsonb) from public,anon,authenticated;
create function history_private.combine_owner_changes(previous jsonb,delta jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('rows',coalesce((select jsonb_agg(r order by r->>'kind',r->>'key') from (
  select r from jsonb_array_elements(previous->'rows') r where not exists(select 1 from jsonb_array_elements((delta->'rows')||(delta->'deleted')) d where d->>'kind'=r->>'kind' and d->>'key'=r->>'key')
  union all select r from jsonb_array_elements(delta->'rows') r) q),'[]'::jsonb),
 'deleted',coalesce((select jsonb_agg(r order by r->>'kind',r->>'key') from (
  select r from jsonb_array_elements(previous->'deleted') r where not exists(select 1 from jsonb_array_elements((delta->'rows')||(delta->'deleted')) d where d->>'kind'=r->>'kind' and d->>'key'=r->>'key')
  union all select r from jsonb_array_elements(delta->'deleted') r) q),'[]'::jsonb))
$$;
revoke all on function history_private.combine_owner_changes(jsonb,jsonb) from public,anon,authenticated;
alter function public.travel_life_history(text,jsonb) set schema history_private;
alter function history_private.travel_life_history(text,jsonb) rename to pre_owner_journal;
revoke all on function history_private.pre_owner_journal(text,jsonb) from public,anon,authenticated;
create function public.travel_life_history(action text,input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare a history_private.account%rowtype;g history_private.aggregate%rowtype;j history_private.owner_journal%rowtype;p history_private.owner_proposal%rowtype;
 base jsonb;mutation uuid;digest text;delta jsonb;combined jsonb;accepted_context jsonb;result jsonb;page_index integer;total bigint;accepted boolean;resolving boolean;privacy_max bigint;
begin
 if action='pull' and input ? 'aggregateId' and exists(select 1 from history_private.owner_journal journal join history_private.account account on account.owner_id=journal.owner_id join history_private.aggregate aggregate on aggregate.owner_id=account.owner_id and aggregate.aggregate_id=account.active_aggregate where account.owner_id=auth.uid() and journal.revision>coalesce((aggregate.metadata->>'ownerRevision')::bigint,0)) then
  base:=history_private.pre_owner_journal('status','{}');if base ? 'error' then return base;end if;return jsonb_build_object('error','HISTORY_STALE');
 end if;
 if action not in ('status','correction-propose','correction-conflicts','correction-resolve') then return history_private.pre_owner_journal(action,input);end if;
 base:=history_private.pre_owner_journal('status','{}');if base ? 'error' then return base;end if;
 select * into a from history_private.account where owner_id=auth.uid() for update;
 select * into j from history_private.owner_journal where owner_id=a.owner_id;
 if action='status' then
  select * into g from history_private.aggregate where owner_id=a.owner_id and aggregate_id=a.active_aggregate and state='active';
  if coalesce(j.revision,0)>coalesce((g.metadata->>'ownerRevision')::bigint,0) then base:=base||'{"activeAggregate":null,"activeSnapshot":null,"aggregatePages":null,"pendingMerge":true,"ownerPending":true}'::jsonb;end if;
  return base||jsonb_build_object('ownerRevision',coalesce(j.revision,0),'correctionConflicts',(select count(*) from history_private.owner_proposal where owner_id=a.owner_id and state='conflict'));
 end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>460000 then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if action='correction-conflicts' then
  if input-array['page']<>'{}'::jsonb or input->>'page' is null or input->>'page'!~'^[0-9]{1,5}$' then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  page_index:=(input->>'page')::integer;select count(*) into total from history_private.owner_proposal where owner_id=a.owner_id and state='conflict';
  if page_index>=greatest(1,total) then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select jsonb_build_object('mutationId',mutation_id,'proposed',changes,'accepted',accepted_before) into result from history_private.owner_proposal where owner_id=a.owner_id and state='conflict' order by mutation_id limit 1 offset page_index;
  return jsonb_build_object('status','complete','page',page_index,'pages',greatest(1,total),'ownerRevision',coalesce(j.revision,0),'accountGeneration',a.generation,'aggregateId',a.active_aggregate,'proposal',result);
 end if;
 mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 digest:=encode(extensions.digest(convert_to(action||input::text,'UTF8'),'sha256'),'hex');
 select * into p from history_private.owner_proposal where owner_id=a.owner_id and mutation_id=mutation;
 if found then if p.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT');end if;return p.result;end if;
 if not a.history_consent then return jsonb_build_object('error','HISTORY_CONSENT');end if;
 if input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 resolving:=action='correction-resolve';
 if resolving then
  if input-array['mutationId','generation','expectedOwnerRevision','proposalId','choice']<>'{}'::jsonb or input->>'choice' not in ('accepted','proposed') then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select * into p from history_private.owner_proposal where owner_id=a.owner_id and mutation_id=(input->>'proposalId')::uuid and state='conflict';
  if not found then return jsonb_build_object('error','HISTORY_STALE');end if;
  if p.source_plan is distinct from history_private.current_source_plan(a.owner_id) then return jsonb_build_object('error','HISTORY_FENCED');end if;
  if input->>'expectedOwnerRevision' is distinct from coalesce(j.revision,0)::text then return jsonb_build_object('error','HISTORY_CONFLICT');end if;
  delta:=case when input->>'choice'='proposed' then p.changes else '{"rows":[],"deleted":[]}'::jsonb end;
  -- Two offline privacy proposals can share a provisional append key. Resolution
  -- is a new fresh-CAS owner action: append its immutable policy actions after all
  -- accepted actions rather than replacing an unrelated policy by numeric row key.
  select greatest(1000000000,coalesce(max((r->'value'->>'revision')::bigint),0)) into privacy_max from (
   select r from history_private.aggregate_page pg cross join lateral jsonb_array_elements(pg.records) r where pg.owner_id=a.owner_id and pg.aggregate_id=a.active_aggregate
   union all select r from jsonb_array_elements(coalesce(j.changes->'rows','[]'::jsonb)) r
  ) policies where r->>'kind'='privacy';
  if privacy_max+(select count(*) from jsonb_array_elements(delta->'rows') r where r->>'kind'='privacy')>9007199254740991 then return '{"error":"HISTORY_QUOTA"}';end if;
  select jsonb_set(delta,'{rows}',coalesce(jsonb_agg(r order by ordinal),'[]'::jsonb)) into delta from (
   select r,ordinal from jsonb_array_elements(delta->'rows') with ordinality q(r,ordinal) where r->>'kind'<>'privacy'
   union all
   select jsonb_set(jsonb_set(r,'{key}',to_jsonb((privacy_max+row_number() over(order by (r->'value'->>'revision')::bigint))::text)),'{value,revision}',to_jsonb(privacy_max+row_number() over(order by (r->'value'->>'revision')::bigint))),ordinal
   from jsonb_array_elements(delta->'rows') with ordinality q(r,ordinal) where r->>'kind'='privacy'
  ) appended;
 else
  if input-array['mutationId','generation','baseAggregate','expectedOwnerRevision','changes']<>'{}'::jsonb or input->>'expectedOwnerRevision' is null or input->>'expectedOwnerRevision'!~'^[0-9]{1,16}$' or not history_private.valid_owner_changes(input->'changes') then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
  select * into g from history_private.aggregate where owner_id=a.owner_id and aggregate_id=(input->>'baseAggregate')::uuid and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
  if not found or not history_private.readable_prior_aggregate(a.owner_id,g.source_plan) then return jsonb_build_object('error','HISTORY_FENCED');end if;
  delta:=input->'changes';
 end if;
 accepted:=input->>'expectedOwnerRevision'=coalesce(j.revision,0)::text;
 select jsonb_build_object('rows',coalesce(jsonb_agg(row_value order by row_value->>'kind',row_value->>'key'),'[]'::jsonb),'deleted','[]'::jsonb) into accepted_context from (
  select coalesce((select r from jsonb_array_elements(j.changes->'rows') r where r->>'kind'=d->>'kind' and r->>'key'=d->>'key'),
   (select r from history_private.aggregate_page pg cross join lateral jsonb_array_elements(pg.records) r where pg.owner_id=a.owner_id and pg.aggregate_id=a.active_aggregate and r->>'kind'=d->>'kind' and r->>'key'=d->>'key')) row_value
  from jsonb_array_elements((delta->'rows')||(delta->'deleted')) d
  where not exists(select 1 from jsonb_array_elements(j.changes->'deleted') r where r->>'kind'=d->>'kind' and r->>'key'=d->>'key')
 ) current_target where row_value is not null;
 if accepted then
  combined:=history_private.combine_owner_changes(coalesce(j.changes,'{"rows":[],"deleted":[]}'::jsonb),delta);
  if octet_length(combined::text)>400000 or jsonb_array_length(combined->'rows')+jsonb_array_length(combined->'deleted')>10000 then return jsonb_build_object('error','HISTORY_QUOTA');end if;
  insert into history_private.owner_journal(owner_id,revision,changes) values(a.owner_id,coalesce(j.revision,0)+1,combined) on conflict(owner_id) do update set revision=excluded.revision,changes=excluded.changes;
  update history_private.account set revision=revision+1 where owner_id=a.owner_id;
  result:=jsonb_build_object('status','accepted','ownerRevision',coalesce(j.revision,0)+1);
  if resolving then update history_private.owner_proposal set state='resolved' where owner_id=a.owner_id and mutation_id=p.mutation_id;end if;
 else result:=jsonb_build_object('status','conflict','ownerRevision',coalesce(j.revision,0));end if;
 insert into history_private.owner_proposal(owner_id,mutation_id,digest,base_aggregate,expected_revision,source_plan,changes,accepted_before,state,result)
 values(a.owner_id,mutation,digest,coalesce(a.active_aggregate,g.aggregate_id),(input->>'expectedOwnerRevision')::bigint,history_private.current_source_plan(a.owner_id),delta,accepted_context,case when accepted then 'accepted' else 'conflict' end,result);
 return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function public.travel_life_history(text,jsonb) from public,anon;
grant execute on function public.travel_life_history(text,jsonb) to authenticated;

alter function history_private.worker_action(uuid,uuid,text,jsonb) rename to pre_owner_worker;
create function history_private.worker_action(subject uuid,sid uuid,action text,input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;j history_private.owner_journal%rowtype;
begin
 result:=history_private.pre_owner_worker(subject,sid,action,input);
 if action='plan' and result->>'status'='planned' then
  select * into j from history_private.owner_journal where owner_id=subject;
  return result||jsonb_build_object('ownerRevision',coalesce(j.revision,0),'ownerChanges',coalesce(j.changes,'{"rows":[],"deleted":[]}'::jsonb));
 end if;return result;
end $$;
revoke all on function history_private.worker_action(uuid,uuid,text,jsonb) from public,anon,authenticated;

alter function history_private.media_scope(uuid,uuid,jsonb) rename to pre_owner_media_scope;
create function history_private.media_scope(subject uuid,source uuid,target jsonb) returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from history_private.owner_journal journal join history_private.account account on account.owner_id=journal.owner_id join history_private.aggregate aggregate on aggregate.owner_id=account.owner_id and aggregate.aggregate_id=account.active_aggregate where account.owner_id=subject and journal.revision>coalesce((aggregate.metadata->>'ownerRevision')::bigint,0))
 and history_private.pre_owner_media_scope(subject,source,target)
$$;
revoke all on function history_private.media_scope(uuid,uuid,jsonb) from public,anon,authenticated;

-- Source: _bmad-output/implementation-artifacts/m7-media-abandon-draft.sql
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

-- Source: _bmad-output/implementation-artifacts/m7-legacy-owner-migration-draft.sql
-- Local draft only, after correction-journal and media-abandon. No deployment.
create table history_private.legacy_proposal(
 owner_id uuid not null references history_private.account(owner_id) on delete cascade,
 mutation_id uuid not null, request jsonb not null, request_digest text not null,
 account_generation bigint not null, source_plan jsonb not null, aggregate_id uuid not null,
 authority_kind text not null check(authority_kind in ('initial','aggregate')),
 baseline_id uuid not null, source_id uuid, baseline_pages integer not null, canonical_pages integer not null,
 translated jsonb, result jsonb, primary key(owner_id,mutation_id)
);
alter table history_private.legacy_proposal enable row level security;
revoke all on history_private.legacy_proposal from public,anon,authenticated;

alter function history_private.worker_action(uuid,uuid,text,jsonb) rename to pre_legacy_worker;
create function history_private.worker_action(subject uuid,sid uuid,action text,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a history_private.account%rowtype;g history_private.aggregate%rowtype;s history_private.snapshot%rowtype;
 p history_private.legacy_proposal%rowtype;mutation uuid;body jsonb;authority text;source uuid;pages integer;
 response jsonb;records jsonb;prior_claims text;request_hash text;page_index integer;
begin
 if action not in ('legacy-plan','legacy-page','legacy-map','legacy-translate','legacy-commit') then return history_private.pre_legacy_worker(subject,sid,action,input);end if;
 if not history_private.live_worker_owner(subject,sid) then return '{"error":"ACCOUNT_SESSION"}';end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>524288 then return '{"error":"HISTORY_SCHEMA"}';end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null or exists(select 1 from history_private.account_deletion where owner_id=subject) then return '{"error":"HISTORY_FENCED"}';end if;
 if not a.history_consent then return '{"error":"HISTORY_CONSENT"}';end if;
 mutation:=(input->>'operationId')::uuid;if mutation is null then return '{"error":"HISTORY_SCHEMA"}';end if;
 select * into p from history_private.legacy_proposal where owner_id=subject and mutation_id=mutation;
 if action='legacy-plan' then
  if input-array['operationId','legacy']<>'{}'::jsonb then return '{"error":"HISTORY_SCHEMA"}';end if;
  body:=input->'legacy';
  if body is null or jsonb_typeof(body)<>'object' or body-array['generation','baseSnapshot','expectedOwnerRevision','baselineDigest','editedDigest','changes']<>'{}'::jsonb
   or body->>'baselineDigest' is null or body->>'baselineDigest'!~'^[a-f0-9]{64}$' or body->>'editedDigest' is null or body->>'editedDigest'!~'^[a-f0-9]{64}$'
   or body->>'expectedOwnerRevision' is null or body->>'expectedOwnerRevision'!~'^[0-9]{1,16}$' or not history_private.valid_owner_changes(body->'changes') then return '{"error":"HISTORY_SCHEMA"}';end if;
  if body->>'generation' is distinct from a.generation::text then return '{"error":"HISTORY_FENCED"}';end if;
  request_hash:=encode(extensions.digest(convert_to(body::text,'UTF8'),'sha256'),'hex');
  if p.mutation_id is not null then
   if p.request_digest<>request_hash then return '{"error":"HISTORY_CONFLICT"}';end if;
   if p.result is not null then return p.result;end if;
  else
   if (select count(*) from history_private.legacy_proposal where owner_id=subject)>=20 then return '{"error":"HISTORY_QUOTA"}';end if;
   select * into g from history_private.aggregate where owner_id=subject and aggregate_id=(body->>'baseSnapshot')::uuid and state='active' and account_generation=a.generation;
   if found then
    if not history_private.readable_prior_aggregate(subject,g.source_plan) or body->>'expectedOwnerRevision' is distinct from coalesce(g.metadata->>'ownerRevision','0') then return '{"error":"HISTORY_REVIEW"}';end if;
    authority:='aggregate';pages:=g.expected_pages;source:=null;
   else
    select * into s from history_private.snapshot where owner_id=subject and snapshot_id=(body->>'baseSnapshot')::uuid and state='initial';
    if not found or body->>'expectedOwnerRevision'<>'0' then return '{"error":"HISTORY_REVIEW"}';end if;
    if not exists(select 1 from history_private.source where owner_id=subject and source_id=s.source_id and generation=s.source_generation and state<>'removed') then return '{"error":"HISTORY_FENCED"}';end if;
    authority:='initial';pages:=s.expected_pages;source:=s.source_id;
   end if;
   select * into g from history_private.aggregate where owner_id=subject and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
   if not found or not history_private.readable_prior_aggregate(subject,g.source_plan) then return '{"error":"HISTORY_INCOMPLETE"}';end if;
   if exists(select 1 from history_private.owner_journal where owner_id=subject and revision>coalesce((g.metadata->>'ownerRevision')::bigint,0)) then return '{"error":"HISTORY_STALE"}';end if;
   insert into history_private.legacy_proposal(owner_id,mutation_id,request,request_digest,account_generation,source_plan,aggregate_id,authority_kind,baseline_id,source_id,baseline_pages,canonical_pages)
    values(subject,mutation,body,request_hash,a.generation,history_private.current_source_plan(subject),g.aggregate_id,authority,(body->>'baseSnapshot')::uuid,source,pages,g.expected_pages) returning * into p;
  end if;
 end if;
 if p.mutation_id is null then return '{"error":"HISTORY_INCOMPLETE"}';end if;
 if p.account_generation<>a.generation then return '{"error":"HISTORY_FENCED"}';end if;
 -- Receipts remain reconcilable after a later source update, but never after account deletion.
 if p.result is not null then return p.result;end if;
 if p.source_plan is distinct from history_private.current_source_plan(subject) then return '{"error":"HISTORY_FENCED"}';end if;
 if action='legacy-plan' then return jsonb_build_object('status','planned','kind',p.authority_kind,'sourceId',p.source_id,'baselinePages',p.baseline_pages,'canonicalPages',p.canonical_pages,'translated',p.translated);end if;
 if action='legacy-page' then
  if input-array['operationId','scope','page']<>'{}'::jsonb or input->>'scope' not in ('baseline','canonical') or input->>'page' is null or input->>'page'!~'^[0-9]{1,5}$' then return '{"error":"HISTORY_SCHEMA"}';end if;
  page_index:=(input->>'page')::integer;
  if page_index>=(case when input->>'scope'='baseline' then p.baseline_pages else p.canonical_pages end) then return '{"error":"HISTORY_SCHEMA"}';end if;
  if input->>'scope'='baseline' and p.authority_kind='initial' then select pg.records into records from history_private.snapshot_page pg where owner_id=subject and snapshot_id=p.baseline_id and page_number=page_index;
  else select pg.records into records from history_private.aggregate_page pg where owner_id=subject and aggregate_id=case when input->>'scope'='baseline' then p.baseline_id else p.aggregate_id end and page_number=page_index;end if;
  if records is null then return '{"error":"HISTORY_INCOMPLETE"}';end if;return jsonb_build_object('records',records);
 elsif action='legacy-map' then
  if p.authority_kind<>'initial' or input-array['operationId','keys']<>'{}'::jsonb then return '{"error":"HISTORY_SCHEMA"}';end if;
  if exists(select 1 from jsonb_array_elements(input->'keys') k where k->>'sourceId' is distinct from p.source_id::text) then return '{"error":"HISTORY_SCHEMA"}';end if;
  return history_private.pre_legacy_worker(subject,sid,'map-identities',jsonb_build_object('accountGeneration',a.generation,'expectedAccountRevision',a.revision,'sourcePlan',p.source_plan,'keys',input->'keys'));
 elsif action='legacy-translate' then
  if input-array['operationId','changes']<>'{}'::jsonb or not history_private.valid_owner_changes(input->'changes') then return '{"error":"HISTORY_SCHEMA"}';end if;
  if p.translated is not null and p.translated is distinct from input->'changes' then return '{"error":"HISTORY_CONFLICT"}';end if;
  update history_private.legacy_proposal set translated=input->'changes' where owner_id=subject and mutation_id=mutation;return '{"status":"staged"}';
 elsif action='legacy-commit' then
  if input-array['operationId']<>'{}'::jsonb or p.translated is null then return '{"error":"HISTORY_INCOMPLETE"}';end if;
  select * into g from history_private.aggregate where owner_id=subject and aggregate_id=a.active_aggregate and state='active' and account_generation=a.generation;
  if not found or not history_private.readable_prior_aggregate(subject,g.source_plan) or g.source_plan is distinct from p.source_plan then return '{"error":"HISTORY_FENCED"}';end if;
  -- Delegate unchanged canonical CAS/conflict semantics under the verified worker identity.
  prior_claims:=current_setting('request.jwt.claims',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'session_id',sid,'role','authenticated','is_anonymous',false)::text,true);
  response:=public.travel_life_history('correction-propose',jsonb_build_object('mutationId',mutation,'generation',p.account_generation,'baseAggregate',g.aggregate_id,'expectedOwnerRevision',(p.request->>'expectedOwnerRevision')::bigint,'changes',p.translated));
  perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
  if response->>'status'='conflict' then
   -- Privacy append row keys differ; retain the latest accepted semantic policy
   -- as recognizable context alongside the unchanged canonical conflict branch.
   select jsonb_build_object('rows',coalesce(jsonb_agg(r),'[]'::jsonb),'deleted','[]'::jsonb) into records from (
    select distinct on (r->'value'->>'policy_id') r from (
     select r from history_private.aggregate_page pg cross join lateral jsonb_array_elements(pg.records) r where pg.owner_id=subject and pg.aggregate_id=p.aggregate_id
     union all select r from history_private.owner_journal j cross join lateral jsonb_array_elements(j.changes->'rows') r where j.owner_id=subject
    ) candidates where r->>'kind'='privacy' and exists(select 1 from jsonb_array_elements(p.translated->'rows') d where d->>'kind'='privacy' and d->'value'->>'policy_id'=r->'value'->>'policy_id')
    order by r->'value'->>'policy_id',(r->'value'->>'revision')::bigint desc
   ) accepted_policies;
   update history_private.owner_proposal set accepted_before=history_private.combine_owner_changes(accepted_before,records) where owner_id=subject and mutation_id=mutation;
  end if;
  if response->>'status' in ('accepted','conflict') then update history_private.legacy_proposal set result=response where owner_id=subject and mutation_id=mutation;end if;
  return response;
 end if;return '{"error":"HISTORY_SCHEMA"}';
exception when invalid_text_representation or numeric_value_out_of_range then return '{"error":"HISTORY_SCHEMA"}';
end $$;
revoke all on function history_private.worker_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
