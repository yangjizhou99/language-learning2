-- Cloze-Shadowing sentence-level items and attempts
-- Only generate from shadowing_items that already have audio and translations

BEGIN;

-- Ensure referenced tables have a UNIQUE/PRIMARY KEY constraint on id (for FK)
DO $$
BEGIN
  -- shadowing_items.id unique/primary
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = 'public.shadowing_items'::regclass
     AND a.attname = 'id'
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.shadowing_items'::regclass
      AND c.contype IN ('p','u')
  ) THEN
    BEGIN
      ALTER TABLE public.shadowing_items
        ADD CONSTRAINT shadowing_items_id_unique UNIQUE (id);
    EXCEPTION WHEN others THEN
      -- ignore if cannot add (e.g., already exists under another name)
      NULL;
    END;
  END IF;

  -- shadowing_themes.id unique/primary
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'shadowing_themes' AND relnamespace = 'public'::regnamespace)
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = 'public.shadowing_themes'::regclass
       AND a.attname = 'id'
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.shadowing_themes'::regclass
        AND c.contype IN ('p','u')
    ) THEN
      BEGIN
        ALTER TABLE public.shadowing_themes
          ADD CONSTRAINT shadowing_themes_id_unique UNIQUE (id);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;
  END IF;

  -- shadowing_subtopics.id unique/primary
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'shadowing_subtopics' AND relnamespace = 'public'::regnamespace)
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = 'public.shadowing_subtopics'::regclass
       AND a.attname = 'id'
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.shadowing_subtopics'::regclass
        AND c.contype IN ('p','u')
    ) THEN
      BEGIN
        ALTER TABLE public.shadowing_subtopics
          ADD CONSTRAINT shadowing_subtopics_id_unique UNIQUE (id);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;
  END IF;
END
$$;

-- 1) Sentence-level cloze items derived from shadowing_items
CREATE TABLE IF NOT EXISTS public.cloze_shadowing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id uuid NOT NULL REFERENCES public.shadowing_items(id) ON DELETE CASCADE,
  theme_id uuid REFERENCES public.shadowing_themes(id),
  subtopic_id uuid REFERENCES public.shadowing_subtopics(id),
  lang text NOT NULL CHECK (lang IN ('en','ja','zh')),
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  sentence_index int NOT NULL,
  sentence_text text NOT NULL,
  blank_start int NOT NULL,
  blank_length int NOT NULL,
  correct_options text[] NOT NULL,
  distractor_options text[] NOT NULL,
  -- Deterministic generation seed for reproducibility (e.g., `${source_item_id}:${sentence_index}`)
  gen_seed text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (source_item_id, sentence_index)
);

-- 2) Per-sentence attempts (no partial score, correct/incorrect only)
CREATE TABLE IF NOT EXISTS public.cloze_shadowing_attempts_sentence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_item_id uuid NOT NULL REFERENCES public.shadowing_items(id) ON DELETE CASCADE,
  cloze_item_id uuid NOT NULL REFERENCES public.cloze_shadowing_items(id) ON DELETE CASCADE,
  sentence_index int NOT NULL,
  selected_options text[] NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3) Per-article summary attempts (accuracy only)
CREATE TABLE IF NOT EXISTS public.cloze_shadowing_attempts_article (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_item_id uuid NOT NULL REFERENCES public.shadowing_items(id) ON DELETE CASCADE,
  total_sentences int NOT NULL,
  correct_sentences int NOT NULL,
  accuracy numeric NOT NULL CHECK (accuracy >= 0 AND accuracy <= 1),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cloze_shadowing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloze_shadowing_attempts_sentence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloze_shadowing_attempts_article ENABLE ROW LEVEL SECURITY;

-- Policies: items are readable by all authenticated users; only service role can insert/update/delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cloze_shadowing_items' AND policyname = 'cloze_shadowing_items_select_all'
  ) THEN
    CREATE POLICY cloze_shadowing_items_select_all ON public.cloze_shadowing_items
      FOR SELECT USING (true);
  END IF;
END
$$;

-- Service-role write policy (defensive; typical supabase setups rely on service key bypassing RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cloze_shadowing_items' AND policyname = 'cloze_shadowing_items_service_write'
  ) THEN
    CREATE POLICY cloze_shadowing_items_service_write ON public.cloze_shadowing_items
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;

-- Attempts: users can insert/select their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cloze_shadowing_attempts_sentence' AND policyname = 'cloze_shadowing_attempts_sentence_own_select'
  ) THEN
    CREATE POLICY cloze_shadowing_attempts_sentence_own_select ON public.cloze_shadowing_attempts_sentence
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cloze_shadowing_attempts_sentence' AND policyname = 'cloze_shadowing_attempts_sentence_own_insert'
  ) THEN
    CREATE POLICY cloze_shadowing_attempts_sentence_own_insert ON public.cloze_shadowing_attempts_sentence
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cloze_shadowing_attempts_article' AND policyname = 'cloze_shadowing_attempts_article_own_select'
  ) THEN
    CREATE POLICY cloze_shadowing_attempts_article_own_select ON public.cloze_shadowing_attempts_article
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cloze_shadowing_attempts_article' AND policyname = 'cloze_shadowing_attempts_article_own_insert'
  ) THEN
    CREATE POLICY cloze_shadowing_attempts_article_own_insert ON public.cloze_shadowing_attempts_article
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

COMMIT;


