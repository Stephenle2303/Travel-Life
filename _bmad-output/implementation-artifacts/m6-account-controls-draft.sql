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
