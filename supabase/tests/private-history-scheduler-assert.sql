do $$
declare j record;actual text;f record;
begin
 if (select count(*) from cron.job)<>2 then raise exception 'scheduler job count';end if;
 if exists(select 1 from cron.job where schedule<>'*/15 * * * *' or command not in ('select history_private.run_media_cleanup();','select history_private.run_account_cleanup();')) then raise exception 'scheduler fixed command';end if;
 for j in select command from cron.job loop execute j.command into actual;if actual<>'scheduler-request-acknowledged' then raise exception 'scheduler acknowledgement';end if;end loop;
 if current_setting('http.curlopt_timeout_ms',true)<>'' or current_setting('http.curlopt_connecttimeout_ms',true)<>'' or current_setting('http.curlopt_ssl_verifypeer',true)<>'' or current_setting('http.curlopt_ssl_verifyhost',true)<>'' then raise exception 'scheduler resets curl defaults';end if;
 if (select count(*) from history_private.scheduler_mock_calls)<>2 or (select count(*) from net.http_request_queue)<>0 then raise exception 'scheduler no queued capability';end if;
 for f in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='history_private' and p.proname in ('run_media_cleanup','run_account_cleanup') loop
  if not f.prosecdef or f.pronargs<>0 or not ('search_path=""'=any(f.proconfig)) or not ('client_min_messages=warning'=any(f.proconfig)) then raise exception 'scheduler function authority';end if;
  if f.prosrc like '%net.http%' or f.prosrc like '%SQLERRM%' or f.prosrc like '%RAISE%' or f.prosrc like '%'||repeat('m',64)||'%' then raise exception 'scheduler source privacy';end if;
 end loop;
 -- Runtime Vault rotation is consumed directly, never copied into catalog/source.
 update vault.decrypted_secrets set decrypted_secret=repeat('r',64) where name='travel_life_media_cleanup_secret';
 if history_private.run_media_cleanup()<>'scheduler-request-acknowledged' then raise exception 'scheduler rotated capability';end if;
end $$;
select 'PASS: synchronous scheduler fixed envelopes, timeouts, log suppression, Vault rotation and no request queue';
