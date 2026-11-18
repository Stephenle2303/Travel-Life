-- Avoid repeatedly expanding large Replay bodies for identical immutable snapshots.
create or replace function history_private.readable_prior_aggregate(subject uuid,plan jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare old_source jsonb;live_source jsonb;old_rows jsonb;live_rows jsonb;live_plan jsonb;
begin
 if jsonb_typeof(plan) is distinct from 'array' then return false;end if;
 live_plan:=history_private.current_source_plan(subject);
 for old_source in select * from jsonb_array_elements(plan) loop
  select p into live_source from jsonb_array_elements(live_plan) p where p->>'sourceId'=old_source->>'sourceId';
  if live_source is null or live_source->>'state'='removed' or live_source->>'snapshotId' is null then return false;end if;
  -- Activated snapshot pages are immutable; identical identities prove identical rows.
  -- Still check removed sources above and newly added owner facts below.
  if live_source->>'snapshotId'=old_source->>'snapshotId' then continue;end if;
  select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) into old_rows
   from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=subject and p.snapshot_id=(old_source->>'snapshotId')::uuid;
  select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) into live_rows
   from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r where p.owner_id=subject and p.snapshot_id=(live_source->>'snapshotId')::uuid;
  if not live_rows @> old_rows then return false;end if;
  if (select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) from jsonb_array_elements(old_rows) r where r->>'kind'<>'evidence')
    is distinct from (select coalesce(jsonb_agg(r order by r->>'kind',r->>'key'),'[]'::jsonb) from jsonb_array_elements(live_rows) r where r->>'kind'<>'evidence') then return false;end if;
 end loop;
 for live_source in select * from jsonb_array_elements(live_plan) loop
  if not exists(select 1 from jsonb_array_elements(plan) p where p->>'sourceId'=live_source->>'sourceId') and exists(
   select 1 from history_private.snapshot_page p cross join lateral jsonb_array_elements(p.records) r
   where p.owner_id=subject and p.snapshot_id=(live_source->>'snapshotId')::uuid and r->>'kind'<>'evidence') then return false;end if;
 end loop;
 return true;
exception when invalid_text_representation then return false;
end $$;
revoke all on function history_private.readable_prior_aggregate(uuid,jsonb) from public,anon,authenticated;
