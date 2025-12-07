-- Add script and recommended_count columns to shadowing_themes table
-- for continuous story generation workflow

ALTER TABLE public.shadowing_themes 
ADD COLUMN IF NOT EXISTS script TEXT;

ALTER TABLE public.shadowing_themes 
ADD COLUMN IF NOT EXISTS recommended_count INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN public.shadowing_themes.script IS 'Detailed story/plot outline script for continuous story generation';
COMMENT ON COLUMN public.shadowing_themes.recommended_count IS 'Recommended number of subtopics/chapters calculated from script analysis';
