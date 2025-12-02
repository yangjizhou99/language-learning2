-- Add ability_level, vocab_unknown_rate, explore_config to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ability_level float DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS vocab_unknown_rate jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS explore_config jsonb DEFAULT '{"mainRatio": 0.6, "downRatio": 0.2, "upRatio": 0.2}'::jsonb;

-- Add base_level, lex_profile to shadowing_items
ALTER TABLE shadowing_items
ADD COLUMN IF NOT EXISTS base_level float,
ADD COLUMN IF NOT EXISTS lex_profile jsonb DEFAULT '{}'::jsonb;

-- Add self_difficulty to shadowing_sessions
ALTER TABLE shadowing_sessions
ADD COLUMN IF NOT EXISTS self_difficulty text;

-- Add cefr_level to vocab_entries if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vocab_entries' AND column_name = 'cefr_level') THEN
        ALTER TABLE vocab_entries ADD COLUMN cefr_level text;
    END IF;
END $$;
