-- Synthetic HTTP/Vault/Cron contracts. No network, production extension or secrets.
create schema vault;
set log_min_messages='warning';
create table vault.decrypted_secrets(name text,decrypted_secret text not null);
insert into vault.decrypted_secrets values
 ('travel_life_cleanup_gateway_jwt',repeat('j',64)),
 ('travel_life_media_cleanup_secret',repeat('m',64)),
 ('travel_life_account_cleanup_secret',repeat('a',64));
create schema cron;
create table cron.job(jobname text primary key,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language plpgsql as $$
begin insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=$2,command=$3; return 1;end $$;
create type extensions.http_header as (field varchar,value varchar);
create type extensions.http_request as (method text,uri varchar,headers extensions.http_header[],content_type varchar,content varchar);
create type extensions.http_response as (status integer,content_type varchar,headers extensions.http_header[],content varchar);
create table history_private.scheduler_mock_calls(endpoint text);
create function extensions.http_reset_curlopt() returns boolean language plpgsql as $$
begin
 if current_setting('synthetic.scheduler_mode',true)='reset-fail' then return false;end if;
 perform set_config('http.curlopt_connecttimeout_ms','',false);perform set_config('http.curlopt_timeout_ms','',false);
 perform set_config('http.curlopt_ssl_verifypeer','',false);perform set_config('http.curlopt_ssl_verifyhost','',false);
 return true;
end $$;
create function extensions.http_set_curlopt(curlopt varchar,value varchar) returns boolean language plpgsql as $$
begin
 if current_setting('synthetic.scheduler_mode',true)='setter-fail' then return false;end if;
 if curlopt not in ('CURLOPT_CONNECTTIMEOUT_MS','CURLOPT_TIMEOUT_MS','CURLOPT_SSL_VERIFYPEER','CURLOPT_SSL_VERIFYHOST') then return false;end if;
 perform set_config('http.'||lower(curlopt),value,false);return true;
end $$;
create function extensions.http(request extensions.http_request) returns extensions.http_response language plpgsql as $$
declare expected text;capability text;mode text:=current_setting('synthetic.scheduler_mode',true);
begin
 if current_setting('client_min_messages')<>'warning' or current_setting('log_min_messages')<>'warning'
  or current_setting('http.curlopt_connecttimeout_ms')<>'5000' or current_setting('http.curlopt_timeout_ms')<>'30000'
  or current_setting('http.curlopt_ssl_verifypeer')<>'1' or current_setting('http.curlopt_ssl_verifyhost')<>'2' then raise exception 'synthetic unsafe transport settings';end if;
 if request.uri='https://fgmcnzxhbrtvjhtafort.supabase.co/functions/v1/travel-life-private-media-cleanup' then expected:='x-private-media-cleanup';capability:='travel_life_media_cleanup_secret';
 elsif request.uri='https://fgmcnzxhbrtvjhtafort.supabase.co/functions/v1/travel-life-account-cleanup' then expected:='x-account-cleanup';capability:='travel_life_account_cleanup_secret';
 else raise exception 'synthetic unapproved endpoint';end if;
 if request.method<>'POST' or request.content_type<>'application/json' or request.content<>'{}' or cardinality(request.headers)<>2
  or request.headers[1].field<>'Authorization' or request.headers[1].value is distinct from 'Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='travel_life_cleanup_gateway_jwt')
  or request.headers[2].field<>expected or request.headers[2].value is distinct from (select decrypted_secret from vault.decrypted_secrets where name=capability) then raise exception 'synthetic invalid envelope';end if;
 if mode='throw' then raise exception 'PRIVATE_HTTP_HEADER_BODY_SENTINEL';end if;
 insert into history_private.scheduler_mock_calls values(expected);
 return row(case when mode='non2xx' then 503 else 200 end,'application/json',array[row('PRIVATE_HEADER','PRIVATE_CAPABILITY_SENTINEL')::extensions.http_header],'PRIVATE_RESPONSE_SENTINEL')::extensions.http_response;
end $$;
-- An unsafe PUBLIC pg_net queue is deliberately present; this alternate never uses it.
create schema net;
create table net.http_request_queue(headers jsonb);
grant select on net.http_request_queue to public;
