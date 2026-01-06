-- Add bayesian_profile column to profiles table for caching
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bayesian_profile JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.bayesian_profile IS 'Cached Bayesian user profile for vocabulary prediction';
