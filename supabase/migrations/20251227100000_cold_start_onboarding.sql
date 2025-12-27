-- Cold Start: Add self-reported JLPT level and onboarding status
-- Migration: 20251227100000_cold_start_onboarding.sql

-- Add self-reported JLPT level to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS self_reported_jlpt VARCHAR(5);

-- Add onboarding completion status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add quick test completion status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_test_completed BOOLEAN DEFAULT FALSE;

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON profiles(onboarding_completed);

-- Comment
COMMENT ON COLUMN profiles.self_reported_jlpt IS 'User self-reported JLPT level (N5, N4, N3, N2, N1)';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user has completed onboarding flow';
COMMENT ON COLUMN profiles.quick_test_completed IS 'Whether user completed the optional vocabulary quick test';
