-- 场景标签表 + 主题-场景向量表
-- 场景标签（scene_tags）是稳定的“语义空间”维度
-- 每个 shadowing_theme 通过 theme_scene_vectors 映射到若干场景及权重

BEGIN;

-- 1) 场景标签表（固定维度）
CREATE TABLE IF NOT EXISTS public.scene_tags (
  scene_id text PRIMARY KEY,
  name_cn text NOT NULL,
  name_en text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.scene_tags IS
  'Stable scene/ability tags used as a shared semantic space for users and materials.';

COMMENT ON COLUMN public.scene_tags.scene_id IS
  'Stable identifier (e.g. daily_life, travel_and_directions).';

-- 简单的 updated_at 触发器
CREATE OR REPLACE FUNCTION public.update_scene_tags_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_scene_tags_updated_at ON public.scene_tags;

CREATE TRIGGER set_scene_tags_updated_at
  BEFORE UPDATE ON public.scene_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scene_tags_updated_at();

-- 初始化一批通用场景标签（如已存在则忽略）
INSERT INTO public.scene_tags (scene_id, name_cn, name_en, description)
VALUES
  (
    'daily_life',
    '日常生活',
    'Daily life',
    '作息、周末计划、日常活动，例如起床、通勤、休闲安排等'
  ),
  (
    'family_relationships',
    '家庭与人际关系',
    'Family & relationships',
    '家庭成员、室友、朋友、邻居等人际互动场景'
  ),
  (
    'food_and_restaurant',
    '饮食与餐厅',
    'Food & restaurant',
    '点餐、外卖、饮食习惯、评价菜品等相关场景'
  ),
  (
    'shopping',
    '购物与消费',
    'Shopping & consumption',
    '超市、商场、网购、比较价格、退换货等场景'
  ),
  (
    'travel_and_directions',
    '出行与问路',
    'Travel & directions',
    '问路、乘坐交通工具、旅游行程、酒店入住等'
  ),
  (
    'school_campus',
    '学校与校园生活',
    'School & campus',
    '课堂、作业、老师同学、社团活动等校园相关场景'
  ),
  (
    'work_parttime',
    '工作与打工',
    'Work & part-time jobs',
    '兼职、打工、正式工作、排班、职场沟通等'
  ),
  (
    'romance',
    '恋爱与感情交流',
    'Romance & relationships',
    '约会、表白、吵架与和好、情感表达等'
  ),
  (
    'hobbies',
    '兴趣爱好与娱乐',
    'Hobbies & entertainment',
    '运动、游戏、音乐、影视、社交活动等'
  ),
  (
    'exam_study',
    '考试与学习',
    'Exams & study',
    '备考、课堂学习、做作业、考试策略等'
  )
ON CONFLICT (scene_id) DO NOTHING;

-- 2) 主题-场景向量表
-- 一条 shadowing_theme 可以对应多个场景标签及权重
DO $$
BEGIN
  -- 确保 shadowing_themes.id 可以被引用（有唯一约束或主键）
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'shadowing_themes' AND relnamespace = 'public'::regnamespace)
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = 'public.shadowing_themes'::regclass
       AND a.attname = 'id'
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.shadowing_themes'::regclass
        AND c.contype IN ('p','u')
    ) THEN
      BEGIN
        ALTER TABLE public.shadowing_themes
          ADD CONSTRAINT shadowing_themes_id_unique_for_scene_vectors UNIQUE (id);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.theme_scene_vectors (
  theme_id uuid NOT NULL REFERENCES public.shadowing_themes(id) ON DELETE CASCADE,
  scene_id text NOT NULL REFERENCES public.scene_tags(scene_id) ON DELETE CASCADE,
  weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (theme_id, scene_id)
);

COMMENT ON TABLE public.theme_scene_vectors IS
  'Mapping from shadowing themes to scene tags with weights in [0,1].';

CREATE INDEX IF NOT EXISTS idx_theme_scene_vectors_theme
  ON public.theme_scene_vectors(theme_id);

CREATE INDEX IF NOT EXISTS idx_theme_scene_vectors_scene
  ON public.theme_scene_vectors(scene_id);

-- 启用 RLS（仅认证用户可见；管理员使用 service role 绕过）
ALTER TABLE public.scene_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_scene_vectors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scene_tags'
      AND policyname = 'scene_tags_select_all_authenticated'
  ) THEN
    CREATE POLICY scene_tags_select_all_authenticated
      ON public.scene_tags
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'theme_scene_vectors'
      AND policyname = 'theme_scene_vectors_select_all_authenticated'
  ) THEN
    CREATE POLICY theme_scene_vectors_select_all_authenticated
      ON public.theme_scene_vectors
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

COMMIT;

