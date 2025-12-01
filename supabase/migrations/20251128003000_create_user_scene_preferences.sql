-- User-level preferences in unified scene space
-- Each user has weights over stable scene_tags.scene_id dimensions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_scene_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_id text NOT NULL REFERENCES public.scene_tags(scene_id) ON DELETE CASCADE,
  weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scene_id)
);

COMMENT ON TABLE public.user_scene_preferences IS
  'Per-user preference weights in unified scene space (scene_tags).';

CREATE INDEX IF NOT EXISTS idx_user_scene_preferences_user
  ON public.user_scene_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_scene_preferences_scene
  ON public.user_scene_preferences(scene_id);

ALTER TABLE public.user_scene_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_scene_preferences'
      AND policyname = 'user_scene_preferences_select_own'
  ) THEN
    CREATE POLICY user_scene_preferences_select_own
      ON public.user_scene_preferences
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_scene_preferences'
      AND policyname = 'user_scene_preferences_write_own'
  ) THEN
    CREATE POLICY user_scene_preferences_write_own
      ON public.user_scene_preferences
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

COMMIT;

