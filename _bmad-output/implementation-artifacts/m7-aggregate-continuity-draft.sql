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
