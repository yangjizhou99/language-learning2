-- Add lex_profile column to shadowing_drafts table
ALTER TABLE public.shadowing_drafts 
ADD COLUMN IF NOT EXISTS lex_profile jsonb;

COMMENT ON COLUMN public.shadowing_drafts.lex_profile IS 'Lexical profile analysis result';
