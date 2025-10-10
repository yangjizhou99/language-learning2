-- Alignment materials schema refresh for scenario-driven dialogue
BEGIN;

ALTER TABLE public.alignment_materials
  ADD COLUMN IF NOT EXISTS practice_scenario jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS standard_dialogue jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure knowledge_points defaults reflect the new structure (words & sentences)
ALTER TABLE public.alignment_materials
  ALTER COLUMN knowledge_points SET DEFAULT '{"words": [], "sentences": []}'::jsonb;

COMMIT;
