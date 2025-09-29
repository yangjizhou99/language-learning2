-- Restore essential audio storage columns on shadowing_items (idempotent)
-- Context: API routes depend on audio_bucket/audio_path/audio_url_proxy
BEGIN;

-- 1) Recreate columns if missing
ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS audio_bucket text,
  ADD COLUMN IF NOT EXISTS audio_path text;

-- 2) Backfill sensible defaults (avoid empty bucket)
UPDATE public.shadowing_items
SET audio_bucket = COALESCE(NULLIF(audio_bucket, ''), 'tts')
WHERE audio_bucket IS NULL OR audio_bucket = '';

-- 3) Recreate generated proxy URL column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shadowing_items'
      AND column_name = 'audio_url_proxy'
  ) THEN
    ALTER TABLE public.shadowing_items
      ADD COLUMN audio_url_proxy text GENERATED ALWAYS AS (
        '/api/storage-proxy?path=' || COALESCE(audio_path, '') || '&bucket=' || COALESCE(audio_bucket, 'tts')
      ) STORED;
  END IF;
END$$;

COMMIT;


