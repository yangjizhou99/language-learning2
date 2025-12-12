-- Add quiz columns to existing tables

-- 1. shadowing_items - store generated quiz questions
ALTER TABLE public.shadowing_items 
ADD COLUMN IF NOT EXISTS quiz_questions jsonb;

-- 2. shadowing_drafts - store quiz questions in draft stage
ALTER TABLE public.shadowing_drafts 
ADD COLUMN IF NOT EXISTS quiz_questions jsonb;

-- 3. shadowing_sessions - store user quiz results
ALTER TABLE public.shadowing_sessions 
ADD COLUMN IF NOT EXISTS quiz_result jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.shadowing_items.quiz_questions IS 'Array of quiz questions: [{question, options: {A,B,C,D}, answer}]';
COMMENT ON COLUMN public.shadowing_drafts.quiz_questions IS 'Quiz questions in draft stage';
COMMENT ON COLUMN public.shadowing_sessions.quiz_result IS 'User quiz result: {answers: [{index, selected, correct}], correct_count, total}';
