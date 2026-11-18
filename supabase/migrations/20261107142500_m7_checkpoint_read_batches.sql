-- Bound RPC overhead without changing the immutable prepared content or authority.
alter function history_private.checkpoint_action(uuid,uuid,text,jsonb) rename to checkpoint_before_read_batches;
create function history_private.checkpoint_action(subject uuid,sid uuid,action text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare page_index integer; page_count integer; offset_index integer; result jsonb; records jsonb:='[]'; total bigint:=0;
begin
 if action is distinct from 'read-batch' then return history_private.checkpoint_before_read_batches(subject,sid,action,input);end if;
 if input is null or jsonb_typeof(input) is distinct from 'object' or octet_length(input::text)>524288
  or input-array['operationId','domainDigest','page','count']<>'{}'::jsonb
  or jsonb_typeof(input->'page') is distinct from 'number' or input->>'page' !~ '^[0-9]{1,5}$'
  or jsonb_typeof(input->'count') is distinct from 'number' or input->>'count' !~ '^[1-8]$'
 then return '{"error":"HISTORY_SCHEMA"}';end if;
 page_index:=(input->>'page')::integer;page_count:=(input->>'count')::integer;
 for offset_index in 0..page_count-1 loop
  result:=history_private.checkpoint_before_read_batches(subject,sid,'read',(input-'count')||jsonb_build_object('page',page_index+offset_index));
  if result ? 'error' or result->>'status'='complete' then return result;end if;
  if jsonb_typeof(result->'records') is distinct from 'array' or jsonb_array_length(result->'records')<>1 then return '{"error":"HISTORY_SCHEMA"}';end if;
  total:=total+octet_length((result->'records')::text);
  if total>3200000 then return '{"error":"HISTORY_QUOTA"}';end if;
  records:=records||(result->'records');
 end loop;
 return jsonb_build_object('records',records);
exception when invalid_text_representation or numeric_value_out_of_range then return '{"error":"HISTORY_SCHEMA"}';
end $$;
revoke all on function history_private.checkpoint_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function history_private.checkpoint_action(uuid,uuid,text,jsonb) to service_role;
-- Rebind the public invoker explicitly after the private rename.
create or replace function public.travel_life_history_checkpoint(verified_owner uuid,verified_session uuid,action text,input jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select history_private.checkpoint_action(verified_owner,verified_session,action,input)
$$;
revoke all on function public.travel_life_history_checkpoint(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.travel_life_history_checkpoint(uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
