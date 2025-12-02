-- Create enum
DO $$ BEGIN
    CREATE TYPE public.dialogue_type_enum AS ENUM ('casual', 'task', 'emotion', 'opinion', 'request', 'roleplay', 'pattern');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alter themes
ALTER TABLE public.shadowing_themes 
    ALTER COLUMN dialogue_type TYPE public.dialogue_type_enum 
    USING dialogue_type::public.dialogue_type_enum;

-- Alter subtopics
ALTER TABLE public.shadowing_subtopics 
    ALTER COLUMN dialogue_type TYPE public.dialogue_type_enum 
    USING dialogue_type::public.dialogue_type_enum;

-- Alter drafts
-- ALTER TABLE public.shadowing_drafts 
--     ALTER COLUMN dialogue_type TYPE public.dialogue_type_enum 
--     USING dialogue_type::public.dialogue_type_enum;

-- Alter items
ALTER TABLE public.shadowing_items 
    ALTER COLUMN dialogue_type TYPE public.dialogue_type_enum 
    USING dialogue_type::public.dialogue_type_enum;
