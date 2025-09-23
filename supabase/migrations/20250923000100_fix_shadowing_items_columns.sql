-- Ensure shadowing_items has required AI columns and refresh schema cache

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS ai_provider text;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS ai_model text;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS ai_usage jsonb DEFAULT '{}'::jsonb;

-- Optional: keep updated_at on update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'shadowing_items_set_updated_at'
  ) THEN
    CREATE TRIGGER shadowing_items_set_updated_at
    BEFORE UPDATE ON public.shadowing_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';


