-- Ensure table exists (in case a prior wipe removed it)
create extension if not exists pgcrypto;

create table if not exists public.invitation_codes (
  id uuid default gen_random_uuid() not null,
  code text not null,
  created_by uuid not null,
  max_uses integer default 1 not null,
  used_count integer default 0 not null,
  expires_at timestamptz,
  permissions jsonb default '{}'::jsonb,
  description text,
  is_active boolean default true not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id),
  unique (code)
);

-- Ensure used_count has a safe default and not-null constraint
alter table if exists public.invitation_codes
  alter column used_count set default 0;

update public.invitation_codes
  set used_count = 0
where used_count is null;

alter table if exists public.invitation_codes
  alter column used_count set not null;

-- Also ensure is_active defaults to true and is not null (safety)
alter table if exists public.invitation_codes
  alter column is_active set default true;

update public.invitation_codes
  set is_active = true
where is_active is null;

alter table if exists public.invitation_codes
  alter column is_active set not null;


