-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Ensure id has default and not null
alter table if exists public.user_api_limits
  alter column id set default gen_random_uuid();

-- Backfill null ids just in case (should be none after alter default)
update public.user_api_limits
set id = gen_random_uuid()
where id is null;

-- Ensure not null
alter table if exists public.user_api_limits
  alter column id set not null;



