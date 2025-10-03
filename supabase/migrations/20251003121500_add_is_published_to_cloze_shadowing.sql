BEGIN;

ALTER TABLE public.cloze_shadowing_items
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Optional index to filter by publication quickly
CREATE INDEX IF NOT EXISTS idx_cloze_shadowing_items_published
  ON public.cloze_shadowing_items (source_item_id, is_published);

COMMIT;


