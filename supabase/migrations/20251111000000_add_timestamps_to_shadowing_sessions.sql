-- Add updated_at column to shadowing_sessions table
ALTER TABLE IF EXISTS public.shadowing_sessions
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Set default value for created_at if it doesn't already have one
ALTER TABLE IF EXISTS public.shadowing_sessions
  ALTER COLUMN created_at SET DEFAULT now();

-- Update existing records with null created_at to current timestamp
UPDATE public.shadowing_sessions
SET created_at = now()
WHERE created_at IS NULL;

-- Update existing records with null updated_at to created_at or current timestamp
UPDATE public.shadowing_sessions
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

-- Create or replace trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_shadowing_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_updated_at ON public.shadowing_sessions;

-- Create trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.shadowing_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shadowing_sessions_updated_at();

-- Add comment
COMMENT ON COLUMN public.shadowing_sessions.updated_at IS 'Timestamp when the session was last updated';
COMMENT ON COLUMN public.shadowing_sessions.created_at IS 'Timestamp when the session was created';

