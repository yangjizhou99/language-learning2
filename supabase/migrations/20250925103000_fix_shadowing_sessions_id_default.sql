-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Set default for shadowing_sessions.id
alter table if exists public.shadowing_sessions
  alter column id set default gen_random_uuid();

-- Optional: re-assert not null (no-op if already set)
alter table if exists public.shadowing_sessions
  alter column id set not null;


