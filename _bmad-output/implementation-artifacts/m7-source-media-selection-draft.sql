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
