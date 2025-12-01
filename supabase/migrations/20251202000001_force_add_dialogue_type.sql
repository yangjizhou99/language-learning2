-- Force re-apply of dialogue_type column addition
-- This script handles cases where the column might be missing or partially applied

BEGIN;

-- 1. Ensure Enum exists
DO $$ BEGIN
    CREATE TYPE public.dialogue_type_enum AS ENUM ('casual', 'task', 'emotion', 'opinion', 'request', 'roleplay', 'pattern');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns if they don't exist (using safe checks)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shadowing_themes' AND column_name = 'dialogue_type') THEN
        ALTER TABLE public.shadowing_themes ADD COLUMN dialogue_type public.dialogue_type_enum;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shadowing_subtopics' AND column_name = 'dialogue_type') THEN
        ALTER TABLE public.shadowing_subtopics ADD COLUMN dialogue_type public.dialogue_type_enum;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shadowing_drafts' AND column_name = 'dialogue_type') THEN
        ALTER TABLE public.shadowing_drafts ADD COLUMN dialogue_type public.dialogue_type_enum;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shadowing_items' AND column_name = 'dialogue_type') THEN
        ALTER TABLE public.shadowing_items ADD COLUMN dialogue_type public.dialogue_type_enum;
    END IF;
END $$;

-- 3. Force schema cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
