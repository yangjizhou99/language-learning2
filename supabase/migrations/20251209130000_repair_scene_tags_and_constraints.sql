-- 修复场景标签数据和约束
-- 1. 确保 scene_tags 有主键、默认值和数据
-- 2. 确保 shadowing_subtopics 有唯一约束
-- 3. 恢复 subtopic_scene_vectors 的外键约束
-- 4. 恢复 RLS 策略

BEGIN;

-- 0.1) 恢复 shadowing_subtopics 唯一约束（如果缺失）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_subtopics_id_unique'
  ) THEN
    -- 尝试添加唯一约束。如果 id 已经是主键，这可能是多余的，但为了满足外键引用要求，显式添加 unique 索引/约束是安全的
    ALTER TABLE public.shadowing_subtopics ADD CONSTRAINT shadowing_subtopics_id_unique UNIQUE (id);
  END IF;
END $$;

-- 0.2) 恢复 scene_tags 主键（如果缺失）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scene_tags_pkey'
  ) THEN
    ALTER TABLE public.scene_tags ADD CONSTRAINT scene_tags_pkey PRIMARY KEY (scene_id);
  END IF;
END $$;

-- 0.3) 恢复 scene_tags 时间戳默认值
ALTER TABLE public.scene_tags ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.scene_tags ALTER COLUMN updated_at SET DEFAULT now();

-- 1) 插入默认场景标签（如果不存在）
INSERT INTO public.scene_tags (scene_id, name_cn, name_en, description, created_at, updated_at)
VALUES
  ('daily_life', '日常生活', 'Daily life', '作息、周末计划、日常活动，例如起床、通勤、休闲安排等', now(), now()),
  ('family_relationships', '家庭与人际关系', 'Family & relationships', '家庭成员、室友、朋友、邻居等人际互动场景', now(), now()),
  ('food_and_restaurant', '饮食与餐厅', 'Food & restaurant', '点餐、外卖、饮食习惯、评价菜品等相关场景', now(), now()),
  ('shopping', '购物与消费', 'Shopping & consumption', '超市、商场、网购、比较价格、退换货等场景', now(), now()),
  ('travel_and_directions', '出行与问路', 'Travel & directions', '问路、乘坐交通工具、旅游行程、酒店入住等', now(), now()),
  ('school_campus', '学校与校园生活', 'School & campus', '课堂、作业、老师同学、社团活动等校园相关场景', now(), now()),
  ('work_parttime', '工作与打工', 'Work & part-time jobs', '兼职、打工、正式工作、排班、职场沟通等', now(), now()),
  ('romance', '恋爱与感情交流', 'Romance & relationships', '约会、表白、吵架与和好、情感表达等', now(), now()),
  ('hobbies', '兴趣爱好与娱乐', 'Hobbies & entertainment', '运动、游戏、音乐、影视、社交活动等', now(), now()),
  ('exam_study', '考试与学习', 'Exams & study', '备考、课堂学习、做作业、考试策略等', now(), now())
ON CONFLICT (scene_id) DO NOTHING;

-- 2) 清理无效的 subtopic_scene_vectors 数据
-- 删除那些指向不存在的 scene_id 的记录，防止添加外键失败
DELETE FROM public.subtopic_scene_vectors
WHERE scene_id NOT IN (SELECT scene_id FROM public.scene_tags);

-- 删除那些指向不存在的 subtopic_id 的记录
DELETE FROM public.subtopic_scene_vectors
WHERE subtopic_id NOT IN (SELECT id FROM public.shadowing_subtopics);

-- 3) 恢复外键约束
-- subtopic_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subtopic_scene_vectors_subtopic_id_fkey'
  ) THEN
    ALTER TABLE public.subtopic_scene_vectors
      ADD CONSTRAINT subtopic_scene_vectors_subtopic_id_fkey
      FOREIGN KEY (subtopic_id)
      REFERENCES public.shadowing_subtopics(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- scene_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subtopic_scene_vectors_scene_id_fkey'
  ) THEN
    ALTER TABLE public.subtopic_scene_vectors
      ADD CONSTRAINT subtopic_scene_vectors_scene_id_fkey
      FOREIGN KEY (scene_id)
      REFERENCES public.scene_tags(scene_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- weight check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subtopic_scene_vectors_weight_check'
  ) THEN
    ALTER TABLE public.subtopic_scene_vectors
      ADD CONSTRAINT subtopic_scene_vectors_weight_check
      CHECK (weight >= 0 AND weight <= 1);
  END IF;
END $$;

-- 4) 恢复 RLS
ALTER TABLE public.scene_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopic_scene_vectors ENABLE ROW LEVEL SECURITY;

-- 5) 恢复 RLS 策略
-- scene_tags: 认证用户可读
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
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
END $$;

-- subtopic_scene_vectors: 认证用户可读
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
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
END $$;

COMMIT;
