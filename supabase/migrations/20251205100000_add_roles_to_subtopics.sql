-- Add roles column to shadowing_subtopics table
-- for storing character role definitions in continuous story generation

ALTER TABLE public.shadowing_subtopics 
ADD COLUMN IF NOT EXISTS roles JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.shadowing_subtopics.roles IS 'Character role definitions for dialogue scenarios, e.g. {"A": "Protagonist", "B": "Teacher"}';
