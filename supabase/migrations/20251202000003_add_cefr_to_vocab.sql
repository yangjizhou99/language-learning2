-- Add CEFR column to vocab_entries
ALTER TABLE public.vocab_entries
  ADD COLUMN IF NOT EXISTS cefr text;

-- Optional: Add constraint to ensure valid CEFR levels (can be strict or loose)
-- ALTER TABLE public.vocab_entries
--   ADD CONSTRAINT vocab_entries_cefr_check
--   CHECK (cefr IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
