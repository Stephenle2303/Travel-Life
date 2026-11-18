create or replace function history_private.control_source(input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare subject uuid:=auth.uid();sid uuid; a history_private.account%rowtype;s history_private.source%rowtype;old history_private.receipt%rowtype;mutation uuid;digest text;result jsonb;
begin
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when invalid_text_representation then return jsonb_build_object('error','ACCOUNT_SESSION');end;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,true) or not history_private.live_worker_owner(subject,sid) then return jsonb_build_object('error','ACCOUNT_SESSION');end if;
 if input is null or jsonb_typeof(input)<>'object' or input-array['mutationId','generation','sourceId','sourceGeneration','mode']<>'{}'::jsonb then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 if input->>'mode' is null or input->>'mode' not in ('active','paused','disconnected','removed') then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 mutation:=(input->>'mutationId')::uuid;if mutation is null then return jsonb_build_object('error','HISTORY_SCHEMA');end if;
 select * into a from history_private.account where owner_id=subject for update;
 if not found or a.delete_fenced_at is not null or input->>'generation' is distinct from a.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 digest:=encode(extensions.digest(convert_to('source-control'||input::text,'UTF8'),'sha256'),'hex');
 select * into old from history_private.receipt where owner_id=subject and mutation_id=mutation;
 if found then if old.digest<>digest then return jsonb_build_object('error','HISTORY_CONFLICT');end if;return old.result;end if;
 select * into s from history_private.source where owner_id=subject and source_id=(input->>'sourceId')::uuid for update;
 if not found or s.state='removed' or input->>'sourceGeneration' is distinct from s.generation::text then return jsonb_build_object('error','HISTORY_FENCED');end if;
 if input->>'mode'='removed' then return jsonb_build_object('error','HISTORY_REVIEW'); end if;
 update history_private.source set generation=generation+1,state=input->>'mode' where owner_id=subject and source_id=s.source_id;
 update history_private.account set revision=revision+1,active_aggregate=null where owner_id=subject;
 if input->>'mode'='removed' then
  update history_private.account set active_snapshot=null,preferred_replay_source=case when preferred_replay_source=s.source_id then null else preferred_replay_source end where owner_id=subject and active_snapshot in(select snapshot_id from history_private.snapshot where owner_id=subject and source_id=s.source_id);
  delete from history_private.aggregate where owner_id=subject;
  delete from history_private.snapshot where owner_id=subject and source_id=s.source_id;
 end if;
 result:=jsonb_build_object('status','complete','sourceGeneration',s.generation+1);
 insert into history_private.receipt(owner_id,mutation_id,digest,result)values(subject,mutation,digest,result);return result;
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','HISTORY_SCHEMA');
end $$;
