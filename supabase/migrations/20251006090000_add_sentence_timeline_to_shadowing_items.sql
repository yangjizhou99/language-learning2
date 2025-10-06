BEGIN;

-- Add sentence-level timeline to shadowing_items for precise playback without storing per-sentence audio
ALTER TABLE public.shadowing_items
  ADD COLUMN IF NOT EXISTS sentence_timeline jsonb;

COMMIT;


