-- 为 Shadowing 体系增加 dialogue_type 细分字段，并为现有对话类内容提供安全的默认值
-- 设计：保留原有 genre（monologue/news/lecture/dialogue 等）作为粗体裁维度
--       新增 dialogue_type 用于细分「对话类型」，仅对 genre='dialogue' 的内容赋默认值

BEGIN;

-- 1) 为 theme / subtopic / draft / item 表增加 dialogue_type 列

ALTER TABLE IF EXISTS public.shadowing_themes
  ADD COLUMN IF NOT EXISTS dialogue_type text;

ALTER TABLE IF EXISTS public.shadowing_subtopics
  ADD COLUMN IF NOT EXISTS dialogue_type text;

ALTER TABLE IF EXISTS public.shadowing_drafts
  ADD COLUMN IF NOT EXISTS dialogue_type text;

ALTER TABLE IF EXISTS public.shadowing_items
  ADD COLUMN IF NOT EXISTS dialogue_type text;

-- 2) 为常用查询增加索引（主要用于筛选和统计）

CREATE INDEX IF NOT EXISTS idx_shadowing_themes_dialogue_type
  ON public.shadowing_themes (dialogue_type);

CREATE INDEX IF NOT EXISTS idx_shadowing_subtopics_dialogue_type
  ON public.shadowing_subtopics (dialogue_type);

CREATE INDEX IF NOT EXISTS idx_shadowing_items_dialogue_type
  ON public.shadowing_items (dialogue_type);

-- 3) 对既有的「对话类」数据设置一个保守的默认对话类型
--    这里统一归类为 'casual'（日常闲聊），后续可以在管理后台手动细分

UPDATE public.shadowing_themes
SET dialogue_type = 'casual'
WHERE dialogue_type IS NULL
  AND genre = 'dialogue';

UPDATE public.shadowing_subtopics
SET dialogue_type = 'casual'
WHERE dialogue_type IS NULL
  AND genre = 'dialogue';

-- UPDATE public.shadowing_drafts
-- SET dialogue_type = 'casual'
-- WHERE dialogue_type IS NULL
--   AND genre = 'dialogue';

UPDATE public.shadowing_items
SET dialogue_type = 'casual'
WHERE dialogue_type IS NULL
  AND genre = 'dialogue';

COMMIT;

