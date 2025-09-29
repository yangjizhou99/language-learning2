-- Rename columns for shadowing_subtopics to unify naming across languages (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shadowing_subtopics' AND column_name = 'title_cn'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shadowing_subtopics' AND column_name = 'title'
  ) THEN
    EXECUTE 'ALTER TABLE public.shadowing_subtopics RENAME COLUMN title_cn TO title';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shadowing_subtopics' AND column_name = 'one_line_cn'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shadowing_subtopics' AND column_name = 'one_line'
  ) THEN
    EXECUTE 'ALTER TABLE public.shadowing_subtopics RENAME COLUMN one_line_cn TO one_line';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shadowing_subtopics' AND column_name = 'seed_en'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shadowing_subtopics' AND column_name = 'seed'
  ) THEN
    EXECUTE 'ALTER TABLE public.shadowing_subtopics RENAME COLUMN seed_en TO seed';
  END IF;
END $$;

-- Optional: update dependent views/materialized views if any (not present here)

