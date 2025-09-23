-- Align shadowing_items schema to expected columns/types and refresh schema cache

-- Add missing columns
ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved';

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS topic text DEFAULT ''::text;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS genre text DEFAULT 'monologue'::text;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS register text DEFAULT 'neutral'::text;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS duration_ms integer;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '{}'::jsonb;

-- Ensure created_at has default now()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='shadowing_items' AND column_name='created_at'
      AND (column_default IS NULL OR column_default = '')
  ) THEN
    EXECUTE 'ALTER TABLE public.shadowing_items ALTER COLUMN created_at SET DEFAULT now()';
  END IF;
END$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Ensure id has default and primary key
ALTER TABLE IF EXISTS public.shadowing_items
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_items_pkey'
  ) THEN
    ALTER TABLE ONLY public.shadowing_items
      ADD CONSTRAINT shadowing_items_pkey PRIMARY KEY (id);
  END IF;
END$$;


