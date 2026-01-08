-- Restore imported_vocab_ids column to shadowing_sessions
ALTER TABLE public.shadowing_sessions
ADD COLUMN IF NOT EXISTS imported_vocab_ids uuid[] DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.shadowing_sessions.imported_vocab_ids IS 'List of vocabulary IDs imported from this session';
