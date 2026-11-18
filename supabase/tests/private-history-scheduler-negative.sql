begin;
do $$
declare actual text;function_name text;before_count bigint;role_name text;
begin
 foreach function_name in array array['run_media_cleanup','run_account_cleanup'] loop
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(role_name,'history_private.'||function_name||'()','execute') then raise exception 'scheduler client execution';end if;
  end loop;
  select count(*) into before_count from history_private.scheduler_mock_calls;
  execute format('alter function history_private.%I() set client_min_messages to debug2',function_name);
  execute format('select history_private.%I()',function_name) into actual;
  if actual<>'scheduler-logging-blocked' then raise exception 'scheduler client debug guard';end if;
  execute format('alter function history_private.%I() set client_min_messages to warning',function_name);
  perform set_config('log_min_messages','debug2',true);
  execute format('select history_private.%I()',function_name) into actual;
  if actual<>'scheduler-logging-blocked' then raise exception 'scheduler server debug guard';end if;
  perform set_config('log_min_messages','warning',true);
  if (select count(*) from history_private.scheduler_mock_calls)<>before_count then raise exception 'scheduler unsafe logger invoked HTTP';end if;
  perform set_config('synthetic.scheduler_mode','reset-fail',true);
  execute format('select history_private.%I()',function_name) into actual;
  if actual<>'scheduler-config-blocked' then raise exception 'scheduler failed reset admission';end if;
  perform set_config('synthetic.scheduler_mode','setter-fail',true);
  execute format('select history_private.%I()',function_name) into actual;
  if actual<>'scheduler-config-blocked' then raise exception 'scheduler failed setter admission';end if;
  if (select count(*) from history_private.scheduler_mock_calls)<>before_count then raise exception 'scheduler failed curl option invoked HTTP';end if;
  perform set_config('synthetic.scheduler_mode','throw',true);
  execute format('select history_private.%I()',function_name) into actual;
  if actual<>'scheduler-request-unknown' or actual like '%PRIVATE%' then raise exception 'scheduler exception redaction';end if;
  if current_setting('http.curlopt_timeout_ms',true)<>'' then raise exception 'scheduler exception curl reset';end if;
  perform set_config('synthetic.scheduler_mode','non2xx',true);
  execute format('select history_private.%I()',function_name) into actual;
  if actual<>'scheduler-request-unacknowledged' then raise exception 'scheduler status classification';end if;
  if current_setting('http.curlopt_timeout_ms',true)<>'' then raise exception 'scheduler success curl reset';end if;
  perform set_config('synthetic.scheduler_mode','',true);
 end loop;
 update vault.decrypted_secrets set decrypted_secret=repeat('m',64) where name='travel_life_account_cleanup_secret';
 if history_private.run_media_cleanup()<>'scheduler-config-blocked' or history_private.run_account_cleanup()<>'scheduler-config-blocked' then raise exception 'scheduler equal capabilities';end if;
 update vault.decrypted_secrets set decrypted_secret=repeat('a',64) where name='travel_life_account_cleanup_secret';
 insert into vault.decrypted_secrets values('travel_life_cleanup_gateway_jwt','PRIVATE_DUPLICATE_SENTINEL');
 if history_private.run_media_cleanup()<>'scheduler-config-blocked' or history_private.run_account_cleanup()<>'scheduler-config-blocked' then raise exception 'scheduler duplicate capability';end if;
 delete from vault.decrypted_secrets where decrypted_secret='PRIVATE_DUPLICATE_SENTINEL';
 update vault.decrypted_secrets set decrypted_secret='PRIVATE_INVALID'||chr(10)||repeat('x',64) where name='travel_life_cleanup_gateway_jwt';
 if history_private.run_media_cleanup()<>'scheduler-config-blocked' then raise exception 'scheduler header control characters';end if;
 delete from vault.decrypted_secrets where name='travel_life_cleanup_gateway_jwt';
 if history_private.run_account_cleanup()<>'scheduler-config-blocked' then raise exception 'scheduler missing capability';end if;
end $$;
rollback;
select 'PASS: scheduler denies caller scope, logging drift, malformed capabilities and redacts HTTP failures';
