-- Project evidence scalars once before identity joins; never carry Replay bodies
-- through the mapping join. Admission and provenance share the same fenced scan.
create or replace function history_private.finalize_aggregate_metadata(subject uuid, source_plan jsonb, header jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare copies jsonb; missing bigint;
begin
 if not (header ? 'sourceCopiesFromPlan') then return header;end if;
 if header->'sourceCopiesFromPlan' is distinct from 'true'::jsonb or header->'metadataVersion' is distinct from '3'::jsonb or header ? 'sourceCopies' then raise exception using errcode='22023';end if;
 with evidence as materialized (
  select (plan->>'sourceId')::uuid as source_id,r->>'key' as local_id,
   r->'value'->>'source_ref' as source_ref,r->'value'->>'availability' as availability
  from jsonb_array_elements(source_plan) plan
  join history_private.snapshot_page p on p.owner_id=subject and p.snapshot_id=(plan->>'snapshotId')::uuid
  cross join lateral jsonb_array_elements(p.records) r
  where r->>'kind'='evidence'
 )
 select coalesce(jsonb_agg(jsonb_build_object('sourceId',e.source_id,'localEvidenceId',e.local_id,'localSourceRef',e.source_ref,'evidenceId',m.account_id,'availability',e.availability) order by e.source_id::text,e.local_id),'[]'::jsonb),count(*) filter(where m.account_id is null)
 into copies,missing
 from evidence e left join history_private.identity_mapping m on m.owner_id=subject and m.source_id=e.source_id and m.kind='evidence' and m.local_id_codec='literal' and m.local_id=e.local_id;
 if missing>0 then raise exception using errcode='22023';end if;
 return (header-'sourceCopiesFromPlan')||jsonb_build_object('sourceCopies',copies);
end $$;
revoke all on function history_private.finalize_aggregate_metadata(uuid,jsonb,jsonb) from public,anon,authenticated;
