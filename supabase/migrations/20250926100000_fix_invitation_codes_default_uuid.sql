-- Ensure pgcrypto is available for gen_random_uuid()
create extension if not exists pgcrypto;

-- Set default for invitation_codes.id to gen_random_uuid()
alter table if exists public.invitation_codes
  alter column id set default gen_random_uuid();

-- Optional: backfill missing ids if any (shouldn't exist due to PK), kept as safety
-- update public.invitation_codes
--   set id = gen_random_uuid()
-- where id is null;


