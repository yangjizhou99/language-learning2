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

-- 2) Recreate voices updated_at trigger (idempotent)
drop trigger if exists update_voices_updated_at on public.voices;
create trigger update_voices_updated_at
before update on public.voices
for each row execute function public.update_updated_at_column();

-- 3) Ensure article_batch_items has expected columns
alter table if exists public.article_batch_items
  add column if not exists topic text,
  add column if not exists difficulty integer,
  add column if not exists status text default 'pending',
  add column if not exists result_draft_id uuid,
  add column if not exists error text,
  add column if not exists usage jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Optional strictness: backfill and enforce NOT NULL where required by baseline
-- update public.article_batch_items set difficulty = coalesce(difficulty, 1) where difficulty is null;
-- alter table public.article_batch_items alter column difficulty set not null;
-- alter table public.article_batch_items alter column status set not null;

-- 4) Example: ensure other tables commonly drifting have expected columns
-- (Add more sections here as drift reports surface)
-- alter table if exists public.article_drafts
--   add column if not exists status text default 'pending',
--   add column if not exists created_at timestamptz default now();
