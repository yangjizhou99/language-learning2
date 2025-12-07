-- Add sequence_order column to shadowing_subtopics table
-- for preserving the order of subtopics in continuous story generation

ALTER TABLE public.shadowing_subtopics 
ADD COLUMN IF NOT EXISTS sequence_order INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN public.shadowing_subtopics.sequence_order IS 'Order/sequence number of subtopic within a theme for continuous story flow (1-based)';

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_shadowing_subtopics_sequence 
ON public.shadowing_subtopics(theme_id, sequence_order);
