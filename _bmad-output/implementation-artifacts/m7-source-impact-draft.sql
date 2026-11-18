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
