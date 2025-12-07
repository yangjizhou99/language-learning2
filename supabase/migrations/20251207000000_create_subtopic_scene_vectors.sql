-- 小主题场景向量表
-- 将场景标签映射从大主题（theme）改为小主题（subtopic）级别
-- 使小主题的具体内容可以更精准地匹配场景标签

BEGIN;

-- 1) 小主题-场景向量表
CREATE TABLE IF NOT EXISTS public.subtopic_scene_vectors (
  subtopic_id uuid NOT NULL REFERENCES public.shadowing_subtopics(id) ON DELETE CASCADE,
  scene_id text NOT NULL REFERENCES public.scene_tags(scene_id) ON DELETE CASCADE,
  weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subtopic_id, scene_id)
);

COMMENT ON TABLE public.subtopic_scene_vectors IS
  'Mapping from shadowing subtopics to scene tags with weights in [0,1]. More granular than theme-level mapping.';

CREATE INDEX IF NOT EXISTS idx_subtopic_scene_vectors_subtopic
  ON public.subtopic_scene_vectors(subtopic_id);

CREATE INDEX IF NOT EXISTS idx_subtopic_scene_vectors_scene
  ON public.subtopic_scene_vectors(scene_id);

-- 启用 RLS
ALTER TABLE public.subtopic_scene_vectors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subtopic_scene_vectors'
      AND policyname = 'subtopic_scene_vectors_select_all_authenticated'
  ) THEN
    CREATE POLICY subtopic_scene_vectors_select_all_authenticated
      ON public.subtopic_scene_vectors
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

COMMIT;
