-- Ensure vocab_entries table exists before altering
create table if not exists public.vocab_entries (
  id uuid default gen_random_uuid() not null primary key,
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

-- Add SRS fields to vocab_entries for spaced repetition
ALTER TABLE public.vocab_entries
  ADD COLUMN IF NOT EXISTS srs_due timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS srs_interval integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_ease numeric DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_reps integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_lapses integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_last timestamptz,
  ADD COLUMN IF NOT EXISTS srs_state text DEFAULT 'new';

-- Optional enum-like constraint (commented out by default)
-- ALTER TABLE public.vocab_entries
--   ADD CONSTRAINT vocab_entries_srs_state_check
--   CHECK (srs_state IN ('new', 'learning', 'review'));

-- Index to accelerate due queries
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_due
  ON public.vocab_entries (user_id, srs_due);



