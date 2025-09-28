-- Ensure uuid generation and defaults for vocab_entries.id
-- This migration is idempotent and safe to run multiple times.

BEGIN;

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure the table exists before altering it (handles cases where a prior wipe removed it)
CREATE TABLE IF NOT EXISTS public.vocab_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  term text NOT NULL,
  lang text NOT NULL,
  native_lang text NOT NULL,
  source text NOT NULL,
  source_id uuid,
  context text,
  tags text[],
  status text DEFAULT 'new',
  explanation jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure id column is uuid type (convert from text if needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vocab_entries'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  ) THEN
    EXECUTE 'ALTER TABLE public.vocab_entries ALTER COLUMN id TYPE uuid USING id::uuid';
  END IF;
END $$;

-- Set default and not null
ALTER TABLE public.vocab_entries
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Ensure created_at/updated_at have sane defaults
ALTER TABLE public.vocab_entries
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Add primary key constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vocab_entries'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.vocab_entries ADD CONSTRAINT vocab_entries_pkey PRIMARY KEY (id);
  END IF;
END $$;

COMMIT;




