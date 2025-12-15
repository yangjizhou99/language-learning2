-- Add comprehension_rate to profiles table for quiz-based ability tracking
-- This column stores an EMA (Exponential Moving Average) of the user's quiz correct rates

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS comprehension_rate numeric(5,4) DEFAULT 0.8;

COMMENT ON COLUMN public.profiles.comprehension_rate 
IS 'User comprehension rate from quiz results (0.0-1.0), EMA updated after each practice session';

-- Ensure quiz_result column exists in shadowing_sessions (should already exist from 20251211 migration)
-- This is a safety check in case the migration order differs in some environments
ALTER TABLE public.shadowing_sessions 
ADD COLUMN IF NOT EXISTS quiz_result jsonb;
