-- Ensure extension for UUID if needed
create extension if not exists pgcrypto;

-- Ensure user_api_limits table exists
create table if not exists public.user_api_limits (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null,
  limit_type text not null,
  count integer default 0,
  max_limit integer default 50,
  reset_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 1) De-duplicate existing rows by user_id, keep the latest (highest updated_at, then created_at)
with ranked as (
  select id, user_id, row_number() over (
    partition by user_id order by coalesce(updated_at, created_at) desc, created_at desc, id desc
  ) as rn
  from public.user_api_limits
)
delete from public.user_api_limits u
using ranked r
where u.id = r.id and r.rn > 1;

-- 2) Add unique index on user_id to support upsert onConflict: 'user_id'
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'user_api_limits_user_id_key'
  ) then
    -- prefer a constraint-like name for compatibility
    execute 'create unique index user_api_limits_user_id_key on public.user_api_limits(user_id)';
  end if;
end $$;

-- 3) Optional: add a trigger to keep updated_at fresh on update
create or replace function public.update_user_api_limits_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_api_limits_updated_at on public.user_api_limits;
create trigger update_user_api_limits_updated_at
before update on public.user_api_limits
for each row execute function public.update_user_api_limits_updated_at();



