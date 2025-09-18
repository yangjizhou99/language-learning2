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


