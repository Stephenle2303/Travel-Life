-- Local alternate draft. Parent provisions/smokes; never auto-deploy.
-- Supersedes rejected pg_net version: PUBLIC queue ACL could not be secured by
-- postgres because supabase_admin owns it. Never queue capabilities.
-- Requires http in extensions, Vault and pg_cron. No response retention.
do $preflight$
begin
 if to_regprocedure('cron.schedule(text,text,text)') is null
  or to_regprocedure('extensions.http(extensions.http_request)') is null
  or to_regprocedure('extensions.http_set_curlopt(character varying,character varying)') is null
  or to_regprocedure('extensions.http_reset_curlopt()') is null
  or to_regclass('vault.decrypted_secrets') is null then
  raise exception 'cleanup scheduler dependencies unavailable';
 end if;
end $preflight$;

create or replace function history_private.run_media_cleanup() returns text
language plpgsql security definer set search_path=''
set client_min_messages='warning'
as $$
declare gateway text;capability text;status integer;
begin
 -- pgsql-http emits header values at DEBUG2. Suppress both destinations before
 -- secret lookup and fail closed if the function-local settings are altered.
 if current_setting('client_min_messages') not in ('warning','error')
  or current_setting('log_min_messages') not in ('warning','error','log','fatal','panic') then
  return 'scheduler-logging-blocked';
 end if;
 if extensions.http_reset_curlopt() is distinct from true then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 if extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000') is distinct from true
  or extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','30000') is distinct from true
  or extensions.http_set_curlopt('CURLOPT_SSL_VERIFYPEER','1') is distinct from true
  or extensions.http_set_curlopt('CURLOPT_SSL_VERIFYHOST','2') is distinct from true then
  perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';
 end if;
 if (select count(distinct decrypted_secret) from vault.decrypted_secrets where name in ('travel_life_media_cleanup_secret','travel_life_account_cleanup_secret'))<>2 then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 if (select count(*) from vault.decrypted_secrets where name in ('travel_life_cleanup_gateway_jwt','travel_life_media_cleanup_secret'))<>2
  or (select count(distinct name) from vault.decrypted_secrets where name in ('travel_life_cleanup_gateway_jwt','travel_life_media_cleanup_secret'))<>2 then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 select decrypted_secret into gateway from vault.decrypted_secrets where name='travel_life_cleanup_gateway_jwt';
 select decrypted_secret into capability from vault.decrypted_secrets where name='travel_life_media_cleanup_secret';
 if gateway is null or capability is null or length(gateway) not between 43 and 16384 or length(capability) not between 43 and 1024
  or gateway~'[[:cntrl:]]' or capability~'[[:cntrl:]]' or gateway=capability then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 select response.status into status from extensions.http((
  'POST','https://fgmcnzxhbrtvjhtafort.supabase.co/functions/v1/travel-life-private-media-cleanup',
  array[row('Authorization','Bearer '||gateway)::extensions.http_header,row('x-private-media-cleanup',capability)::extensions.http_header],
  'application/json','{}')::extensions.http_request) response;
 if extensions.http_reset_curlopt() is distinct from true then return 'scheduler-request-unknown';end if;
 if status between 200 and 299 then return 'scheduler-request-acknowledged';end if;
 return 'scheduler-request-unacknowledged';
exception when others then
 begin perform extensions.http_reset_curlopt();exception when others then null;end;
 return 'scheduler-request-unknown';
end $$;
revoke all on function history_private.run_media_cleanup() from public,anon,authenticated,service_role;

create or replace function history_private.run_account_cleanup() returns text
language plpgsql security definer set search_path=''
set client_min_messages='warning'
as $$
declare gateway text;capability text;status integer;
begin
 if current_setting('client_min_messages') not in ('warning','error')
  or current_setting('log_min_messages') not in ('warning','error','log','fatal','panic') then return 'scheduler-logging-blocked';end if;
 if extensions.http_reset_curlopt() is distinct from true then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 if extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000') is distinct from true
  or extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','30000') is distinct from true
  or extensions.http_set_curlopt('CURLOPT_SSL_VERIFYPEER','1') is distinct from true
  or extensions.http_set_curlopt('CURLOPT_SSL_VERIFYHOST','2') is distinct from true then
  perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';
 end if;
 if (select count(distinct decrypted_secret) from vault.decrypted_secrets where name in ('travel_life_media_cleanup_secret','travel_life_account_cleanup_secret'))<>2 then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 if (select count(*) from vault.decrypted_secrets where name in ('travel_life_cleanup_gateway_jwt','travel_life_account_cleanup_secret'))<>2
  or (select count(distinct name) from vault.decrypted_secrets where name in ('travel_life_cleanup_gateway_jwt','travel_life_account_cleanup_secret'))<>2 then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 select decrypted_secret into gateway from vault.decrypted_secrets where name='travel_life_cleanup_gateway_jwt';
 select decrypted_secret into capability from vault.decrypted_secrets where name='travel_life_account_cleanup_secret';
 if gateway is null or capability is null or length(gateway) not between 43 and 16384 or length(capability) not between 43 and 1024
  or gateway~'[[:cntrl:]]' or capability~'[[:cntrl:]]' or gateway=capability then perform extensions.http_reset_curlopt();return 'scheduler-config-blocked';end if;
 select response.status into status from extensions.http((
  'POST','https://fgmcnzxhbrtvjhtafort.supabase.co/functions/v1/travel-life-account-cleanup',
  array[row('Authorization','Bearer '||gateway)::extensions.http_header,row('x-account-cleanup',capability)::extensions.http_header],
  'application/json','{}')::extensions.http_request) response;
 if extensions.http_reset_curlopt() is distinct from true then return 'scheduler-request-unknown';end if;
 if status between 200 and 299 then return 'scheduler-request-acknowledged';end if;
 return 'scheduler-request-unacknowledged';
exception when others then
 begin perform extensions.http_reset_curlopt();exception when others then null;end;
 return 'scheduler-request-unknown';
end $$;
revoke all on function history_private.run_account_cleanup() from public,anon,authenticated,service_role;

-- Catalog/run history contains no capability or response content.
select cron.schedule('travel-life-media-cleanup','*/15 * * * *','select history_private.run_media_cleanup();');
select cron.schedule('travel-life-account-cleanup','*/15 * * * *','select history_private.run_account_cleanup();');
