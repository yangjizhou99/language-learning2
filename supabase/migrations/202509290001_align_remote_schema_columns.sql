-- Align local schema with remote_public_schema definitions (idempotent)
-- Date: 2025-09-29

-- 1) Ensure update_updated_at_column exists
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2) Ensure voices table exists before trigger operations (in case it was wiped)
create table if not exists public.voices (
  id uuid default gen_random_uuid() not null,
  name text not null,
  language_code text not null,
  ssml_gender text,
  natural_sample_rate_hertz integer,
  pricing jsonb default '{}'::jsonb not null,
  characteristics jsonb default '{}'::jsonb not null,
  display_name text,
  category text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  provider text default 'google',
  usecase text,
  is_news_voice boolean default false,
  use_case text,
  constraint voices_provider_check check (provider = any (array['google','gemini','xunfei']))
);

-- Ensure primary key and unique(name)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'voices_pkey' and conrelid = 'public.voices'::regclass
  ) then
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relname = 'voices_id_unique_idx' and n.nspname = 'public'
    ) then
      create unique index voices_id_unique_idx on public.voices (id);
    end if;
    alter table public.voices add constraint voices_pkey primary key using index voices_id_unique_idx;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'voices_name_key' and conrelid = 'public.voices'::regclass
  ) then
    alter table public.voices add constraint voices_name_key unique (name);
  end if;
end $$;

-- Recreate voices updated_at trigger (idempotent)
drop trigger if exists update_voices_updated_at on public.voices;
create trigger update_voices_updated_at
before update on public.voices
for each row execute function public.update_updated_at_column();

-- 3) Ensure article_batch_items table exists before altering columns
create table if not exists public.article_batch_items (
  id uuid default gen_random_uuid() not null,
  batch_id uuid not null,
  topic text,
  difficulty integer not null,
  status text default 'pending' not null,
  result_draft_id uuid,
  error text,
  usage jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure primary key exists
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'article_batch_items_pkey' and conrelid = 'public.article_batch_items'::regclass
  ) then
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relname = 'article_batch_items_id_unique_idx' and n.nspname = 'public'
    ) then
      create unique index article_batch_items_id_unique_idx on public.article_batch_items (id);
    end if;
    alter table public.article_batch_items add constraint article_batch_items_pkey primary key using index article_batch_items_id_unique_idx;
  end if;
end $$;

-- Ensure article_batch_items has expected columns
alter table if exists public.article_batch_items
  add column if not exists topic text,
  add column if not exists difficulty integer,
  add column if not exists status text default 'pending',
  add column if not exists result_draft_id uuid,
  add column if not exists error text,
  add column if not exists usage jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Backfill and enforce NOT NULL where required by baseline
update public.article_batch_items set difficulty = coalesce(difficulty, 1) where difficulty is null;
update public.article_batch_items set status = coalesce(status, 'pending') where status is null;
alter table public.article_batch_items alter column difficulty set not null;
alter table public.article_batch_items alter column status set not null;

-- Ensure difficulty check constraint exists (1..5)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'article_batch_items_difficulty_check'
      and conrelid = 'public.article_batch_items'::regclass
  ) then
    alter table public.article_batch_items
      add constraint article_batch_items_difficulty_check
      check ((difficulty >= 1 and difficulty <= 5));
  end if;
end $$;

-- 4) Ensure vocab_entries trigger exists (in case it was wiped)
--    Also guard table existence for safety
create table if not exists public.vocab_entries (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  term text not null,
  lang text not null,
  native_lang text not null,
  source text not null,
  source_id uuid,
  context text,
  tags text[],
  status text default 'new',
  explanation jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists update_vocab_entries_updated_at on public.vocab_entries;
create trigger update_vocab_entries_updated_at
before update on public.vocab_entries
for each row execute function public.update_updated_at_column();

-- 5) Ensure user_permissions trigger exists and is idempotent
create or replace function public.update_user_permissions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_permissions'
  ) then
    execute 'drop trigger if exists update_user_permissions_updated_at on public.user_permissions';
    execute 'create trigger update_user_permissions_updated_at before update on public.user_permissions for each row execute function public.update_user_permissions_updated_at()';
  end if;
end $$;

-- 6) Example: ensure other tables commonly drifting have expected columns
-- (Add more sections here as drift reports surface)
-- alter table if exists public.article_drafts
--   add column if not exists status text default 'pending',
--   add column if not exists created_at timestamptz default now();
