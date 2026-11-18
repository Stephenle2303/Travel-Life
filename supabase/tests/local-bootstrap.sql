-- Test harness only. Never apply to a hosted Supabase project.
-- Synthetic Auth/Storage contracts for disposable PostgreSQL SQL verification;
-- real Auth refresh, email, object storage and gateway acceptance are separate.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create table auth.users (
 id uuid primary key,email text,email_confirmed_at timestamptz,
 is_anonymous boolean not null default false,is_sso_user boolean not null default false
);
create table auth.sessions (
 id uuid primary key,user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 not_after timestamptz
);
create function auth.jwt() returns jsonb language sql stable as
 $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as
 $$select (auth.jwt()->>'sub')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role;
create schema storage;
create table storage.buckets (
 id text primary key,name text not null,public boolean not null default false,
 file_size_limit bigint,allowed_mime_types text[]
);
