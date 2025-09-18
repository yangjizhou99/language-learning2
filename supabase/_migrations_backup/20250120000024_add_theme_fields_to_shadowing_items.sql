-- 为 shadowing_items 表添加主题关联字段
-- 20250120000024_add_theme_fields_to_shadowing_items.sql

-- 为 shadowing_items 表添加主题关联字段
ALTER TABLE public.shadowing_items
ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.shadowing_themes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES public.shadowing_subtopics(id) ON DELETE SET NULL;

-- 创建索引以优化主题查询
CREATE INDEX IF NOT EXISTS idx_shadowing_items_theme_id 
ON public.shadowing_items(theme_id);

CREATE INDEX IF NOT EXISTS idx_shadowing_items_subtopic_id 
ON public.shadowing_items(subtopic_id);

CREATE INDEX IF NOT EXISTS idx_shadowing_items_theme_subtopic 
ON public.shadowing_items(theme_id, subtopic_id);

-- 添加复合索引以支持主题筛选查询
CREATE INDEX IF NOT EXISTS idx_shadowing_items_lang_level_theme 
ON public.shadowing_items(lang, level, theme_id);

CREATE INDEX IF NOT EXISTS idx_shadowing_items_lang_level_subtopic 
ON public.shadowing_items(lang, level, subtopic_id);

-- 添加注释说明字段用途
COMMENT ON COLUMN public.shadowing_items.theme_id IS '关联的大主题ID';
COMMENT ON COLUMN public.shadowing_items.subtopic_id IS '关联的小主题ID';
