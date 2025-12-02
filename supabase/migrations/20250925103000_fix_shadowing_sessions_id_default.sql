-- Ensure shadowing_sessions table exists
create table if not exists public.shadowing_sessions (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null,
  item_id uuid not null,
  status text default 'draft',
  recordings jsonb default '[]'::jsonb,
  vocab_entry_ids uuid[] default '{}'::uuid[],
  picked_preview jsonb default '[]'::jsonb,
  notes jsonb default '{}'::jsonb,
  imported_vocab_ids uuid[] default '{}'::uuid[],
  self_difficulty text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Set default for shadowing_sessions.id
alter table if exists public.shadowing_sessions
  alter column id set default gen_random_uuid();

-- Optional: re-assert not null (no-op if already set)
alter table if exists public.shadowing_sessions
  alter column id set not null;


