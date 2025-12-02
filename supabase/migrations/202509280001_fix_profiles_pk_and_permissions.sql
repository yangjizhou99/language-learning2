-- Ensure is_admin function exists
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Fix core constraints and policies to resolve profile save/load and permissions errors
-- Date: 2025-09-28

-- 1) Ensure pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1.1) Ensure required core tables exist (in case they were wiped earlier)
-- profiles
create table if not exists public.profiles (
  id uuid not null,
  username text,
  native_lang text,
  target_langs text[] default '{}'::text[],
  created_at timestamptz default now(),
  bio text,
  goals text,
  preferred_tone text,
  domains text[] default '{}'::text[],
  role text default 'user',
  invited_by uuid,
  invitation_code_id uuid,
  invitation_used_at timestamptz
);

-- default_user_permissions
create table if not exists public.default_user_permissions (
  id text default 'default'::text not null,
  can_access_shadowing boolean default true not null,
  can_access_cloze boolean default true not null,
  can_access_alignment boolean default true not null,
  can_access_articles boolean default true not null,
  allowed_languages text[] default array['en','ja','zh']::text[] not null,
  allowed_levels integer[] default array[1,2,3,4,5] not null,
  max_daily_attempts integer default 50 not null,
  ai_enabled boolean default false not null,
  api_keys jsonb default '{}'::jsonb,
  model_permissions jsonb default '[]'::jsonb,
  custom_restrictions jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- user_permissions
create table if not exists public.user_permissions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  can_access_shadowing boolean default true not null,
  can_access_cloze boolean default true not null,
  can_access_alignment boolean default true not null,
  can_access_articles boolean default true not null,
  allowed_languages text[] default array['en','ja','zh']::text[] not null,
  allowed_levels integer[] default array[1,2,3,4,5] not null,
  max_daily_attempts integer default 50 not null,
  custom_restrictions jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  api_keys jsonb default '{}'::jsonb,
  ai_enabled boolean default false,
  model_permissions jsonb default '[]'::jsonb
);

-- 2) Ensure profiles.id has a primary key (required for future upserts and integrity)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'profiles_pkey' and conrelid = 'public.profiles'::regclass
  ) then
    -- Create a unique index if it doesn't exist
    if not exists (
      select 1 
      from pg_class c 
      join pg_namespace n on n.oid = c.relnamespace 
      where c.relname = 'profiles_id_unique_idx' and n.nspname = 'public'
    ) then
      create unique index profiles_id_unique_idx on public.profiles (id);
    end if;
    -- Promote the unique index to primary key
    alter table public.profiles add constraint profiles_pkey primary key using index profiles_id_unique_idx;
  end if;
end $$;

-- 3) Ensure user_permissions.id default and unique(user_id)
alter table public.user_permissions alter column id set default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'user_permissions_user_id_key' and conrelid = 'public.user_permissions'::regclass
  ) then
    alter table public.user_permissions add constraint user_permissions_user_id_key unique (user_id);
  end if;
end $$;

-- 4) RLS: allow owner or admin to operate on user_permissions
alter table public.user_permissions enable row level security;
drop policy if exists user_permissions_combined on public.user_permissions;
create policy user_permissions_combined on public.user_permissions
  for all to authenticated
  using (public.is_admin() or auth.uid() = user_id)
  with check (public.is_admin() or auth.uid() = user_id);

-- 5) default_user_permissions: allow authenticated to read and ensure default row exists
alter table public.default_user_permissions enable row level security;
drop policy if exists default_user_permissions_select_all on public.default_user_permissions;
create policy default_user_permissions_select_all on public.default_user_permissions
  for select to authenticated
  using (true);

-- Ensure default_user_permissions has primary key on id to support ON CONFLICT (id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'default_user_permissions_pkey'
      AND conrelid = 'public.default_user_permissions'::regclass
  ) THEN
    -- Create unique index first if needed
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'default_user_permissions_id_unique_idx' AND n.nspname = 'public'
    ) THEN
      CREATE UNIQUE INDEX default_user_permissions_id_unique_idx ON public.default_user_permissions (id);
    END IF;
    ALTER TABLE public.default_user_permissions
      ADD CONSTRAINT default_user_permissions_pkey PRIMARY KEY USING INDEX default_user_permissions_id_unique_idx;
  END IF;
END $$;

-- Ensure column types are correct
alter table public.default_user_permissions
  alter column allowed_languages type text[] using allowed_languages::text[];
alter table public.default_user_permissions
  alter column allowed_levels type integer[] using allowed_levels::integer[];

-- Ensure NOT NULL columns have sane defaults (in case table exists without defaults)
alter table public.default_user_permissions alter column can_access_shadowing set default true;
alter table public.default_user_permissions alter column can_access_cloze set default true;
alter table public.default_user_permissions alter column can_access_alignment set default true;
alter table public.default_user_permissions alter column can_access_articles set default true;
alter table public.default_user_permissions alter column allowed_languages set default array['en','ja','zh']::text[];
alter table public.default_user_permissions alter column allowed_levels set default array[1,2,3,4,5]::integer[];
alter table public.default_user_permissions alter column max_daily_attempts set default 50;
alter table public.default_user_permissions alter column ai_enabled set default false;
alter table public.default_user_permissions alter column api_keys set default '{}'::jsonb;
alter table public.default_user_permissions alter column model_permissions set default '[]'::jsonb;
alter table public.default_user_permissions alter column custom_restrictions set default '{}'::jsonb;

-- Fix existing NULLs if any
update public.default_user_permissions set
  can_access_shadowing = coalesce(can_access_shadowing, true),
  can_access_cloze = coalesce(can_access_cloze, true),
  can_access_alignment = coalesce(can_access_alignment, true),
  can_access_articles = coalesce(can_access_articles, true),
  allowed_languages = coalesce(allowed_languages, array['en','ja','zh']::text[]),
  allowed_levels = coalesce(allowed_levels, array[1,2,3,4,5]::integer[]),
  max_daily_attempts = coalesce(max_daily_attempts, 50),
  ai_enabled = coalesce(ai_enabled, false),
  api_keys = coalesce(api_keys, '{}'::jsonb),
  model_permissions = coalesce(model_permissions, '[]'::jsonb),
  custom_restrictions = coalesce(custom_restrictions, '{}'::jsonb)
where id = 'default';

-- Upsert default row with full columns to satisfy NOT NULL
insert into public.default_user_permissions (
  id,
  can_access_shadowing,
  can_access_cloze,
  can_access_alignment,
  can_access_articles,
  allowed_languages,
  allowed_levels,
  max_daily_attempts,
  ai_enabled,
  api_keys,
  model_permissions,
  custom_restrictions
) values (
  'default',
  true,
  true,
  true,
  true,
  array['en','ja','zh']::text[],
  array[1,2,3,4,5]::integer[],
  50,
  false,
  '{}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb
)
on conflict (id) do update set
  can_access_shadowing = excluded.can_access_shadowing,
  can_access_cloze = excluded.can_access_cloze,
  can_access_alignment = excluded.can_access_alignment,
  can_access_articles = excluded.can_access_articles,
  allowed_languages = excluded.allowed_languages,
  allowed_levels = excluded.allowed_levels,
  max_daily_attempts = excluded.max_daily_attempts,
  ai_enabled = excluded.ai_enabled,
  api_keys = excluded.api_keys,
  model_permissions = excluded.model_permissions,
  custom_restrictions = excluded.custom_restrictions;


