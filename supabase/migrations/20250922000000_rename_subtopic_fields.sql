-- Ensure shadowing_themes table exists
CREATE TABLE IF NOT EXISTS public.shadowing_themes (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  lang text NOT NULL,
  level integer NOT NULL,
  genre text NOT NULL,
  dialogue_type text,
  title text NOT NULL,
  title_en text,
  "desc" text,
  coverage jsonb DEFAULT '[]'::jsonb,
  ai_provider text,
  ai_model text,
  ai_usage jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  created_by uuid
);

-- Ensure shadowing_subtopics table exists
CREATE TABLE IF NOT EXISTS public.shadowing_subtopics (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  theme_id uuid NOT NULL REFERENCES public.shadowing_themes(id) ON DELETE CASCADE,
  lang text NOT NULL,
  level integer NOT NULL,
  genre text NOT NULL,
  dialogue_type text,
  title text NOT NULL,
  seed text,
  one_line text,
  ai_provider text,
  ai_model text,
  ai_usage jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  created_by uuid
);

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

