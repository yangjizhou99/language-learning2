-- Migration: add SRS columns to vocab_entries, initialize existing rows, and add indexes
-- Created at: 2025-10-01

BEGIN;

-- 1) Add SRS columns if not exists
ALTER TABLE public.vocab_entries
  ADD COLUMN IF NOT EXISTS srs_due timestamptz NULL,
  ADD COLUMN IF NOT EXISTS srs_interval integer NULL,
  ADD COLUMN IF NOT EXISTS srs_ease double precision NULL,
  ADD COLUMN IF NOT EXISTS srs_reps integer NULL,
  ADD COLUMN IF NOT EXISTS srs_lapses integer NULL,
  ADD COLUMN IF NOT EXISTS srs_last timestamptz NULL,
  ADD COLUMN IF NOT EXISTS srs_state text NULL;

-- 2) Initialize existing rows (set due to now so users can start reviewing immediately)
UPDATE public.vocab_entries
SET
  srs_due = COALESCE(srs_due, NOW()),
  srs_interval = COALESCE(srs_interval, 0),
  srs_ease = COALESCE(srs_ease, 2.5),
  srs_reps = COALESCE(srs_reps, 0),
  srs_lapses = COALESCE(srs_lapses, 0),
  srs_state = COALESCE(srs_state, 'new')
WHERE srs_due IS NULL
  OR srs_interval IS NULL
  OR srs_ease IS NULL
  OR srs_reps IS NULL
  OR srs_lapses IS NULL
  OR srs_state IS NULL;

-- 3) Performance indexes for due queries (partial index excluding archived)
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_due
  ON public.vocab_entries (user_id, srs_due)
  WHERE status <> 'archived';

COMMIT;

-- Down migration (manual):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_vocab_entries_user_due;
-- ALTER TABLE public.vocab_entries
--   DROP COLUMN IF EXISTS srs_state,
--   DROP COLUMN IF EXISTS srs_last,
--   DROP COLUMN IF EXISTS srs_lapses,
--   DROP COLUMN IF EXISTS srs_reps,
--   DROP COLUMN IF EXISTS srs_ease,
--   DROP COLUMN IF EXISTS srs_interval,
--   DROP COLUMN IF EXISTS srs_due;
-- COMMIT;


