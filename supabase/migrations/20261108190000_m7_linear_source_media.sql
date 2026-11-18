-- Keep the existing outer Auth/control wrappers and read budgets unchanged.
-- Enumerate source media in linear compact passes instead of repeatedly detoasting metadata.
create or replace function history_private.pre_account_controls(action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb;a history_private.account%rowtype;s history_private.source%rowtype;g history_private.aggregate%rowtype;
 items jsonb;total bigint;page_index integer;audio jsonb;copies jsonb;privacy_data jsonb;
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
 -- Extract compact source/privacy values once per request, outside row loops.
 copies:=coalesce(g.metadata->'sourceCopies','[]'::jsonb);
 privacy_data:=coalesce(g.metadata->'privacy','{}'::jsonb);
 with source_copies as materialized (
  select c.value->>'evidenceId' as evidence_id,c.value->>'localSourceRef' as source_ref
  from jsonb_array_elements(copies) c(value) where c.value->>'sourceId'=s.source_id::text
 ), privacy_inputs as materialized (
  select v from (values(privacy_data->'hiddenEvidenceIds'),(privacy_data->'excludedEvidenceIds')) p(v)
 ), blocked as materialized (
  select x.value as id from privacy_inputs p cross join lateral jsonb_array_elements_text(case when jsonb_typeof(p.v)='array' then p.v else '[]'::jsonb end) x(value)
  union select x.value from privacy_inputs p cross join lateral jsonb_object_keys(case when jsonb_typeof(p.v)='object' then p.v else '{}'::jsonb end) x(value)
  union select p.v#>>'{}' from privacy_inputs p where jsonb_typeof(p.v)='string'
 ), evidence as materialized (
  select r.value->>'key' as evidence_id,r.value->'value'->>'media_type' as media_type,r.value->'value'->'captured_day' as captured_day
  from history_private.aggregate_page p cross join lateral jsonb_array_elements(p.records) r(value)
  where p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id and r.value->>'kind'='evidence'
 ), eligible as materialized (
  select c.evidence_id,c.source_ref,e.media_type,e.captured_day,coalesce(m.revision,0) as expected_revision
  from source_copies c join evidence e on e.evidence_id=c.evidence_id
  left join blocked b on b.id=c.evidence_id
  left join history_private.media_attachment m on m.owner_id=auth.uid() and m.target_key='evidence:'||c.evidence_id
  where b.id is null
 )
 select (select count(*) from eligible),
  (select coalesce(jsonb_agg(item order by item->>'id'),'[]'::jsonb) from (
   select jsonb_build_object('id',evidence_id,'sourceRef',source_ref,'kind',case when media_type='video' then 'video' else 'photo' end,'day',captured_day,'expectedRevision',expected_revision) as item
   from eligible order by evidence_id limit 24 offset page_index*24
  ) page_items) into total,items;
 if page_index>=greatest(1,(total+23)/24) then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if a.preferred_replay_source=s.source_id then
  with compositions as materialized (
   select (r.value->'value'->>'committed_overrides_json')::jsonb as composition
   from history_private.aggregate_page p cross join lateral jsonb_array_elements(p.records) r(value)
   where p.owner_id=auth.uid() and p.aggregate_id=g.aggregate_id and r.value->>'kind'='replay'
  ), tracks as materialized (
   select composition->'soundtrack' as track from compositions where composition->'soundtrack'->>'kind'='custom'
  )
  select jsonb_build_object('revision',track->>'revision','expectedRevision',coalesce(m.revision,0)) into audio
  from tracks left join history_private.media_attachment m on m.owner_id=auth.uid() and m.target_key='soundtrack:'||(track->>'revision') limit 1;
 end if;
 return jsonb_build_object('status','complete','accountGeneration',a.generation,'sourceId',s.source_id,'sourceGeneration',s.generation,
  'aggregateId',g.aggregate_id,'sourceSnapshotRevision',s.snapshot_revision,'page',page_index,'pages',greatest(1,(total+23)/24),'total',total,'items',items,'soundtrack',audio);
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
revoke all on function history_private.pre_account_controls(text,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
