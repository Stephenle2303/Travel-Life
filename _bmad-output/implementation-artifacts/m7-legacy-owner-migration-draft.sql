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
