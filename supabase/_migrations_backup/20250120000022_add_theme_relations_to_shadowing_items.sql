-- 为 shadowing_items 表添加主题关联字段
-- 20250120000022_add_theme_relations_to_shadowing_items.sql

-- 添加主题关联字段
ALTER TABLE public.shadowing_items
ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.shadowing_themes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES public.shadowing_subtopics(id) ON DELETE SET NULL;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_shadowing_items_theme_id ON public.shadowing_items(theme_id);
CREATE INDEX IF NOT EXISTS idx_shadowing_items_subtopic_id ON public.shadowing_items(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_shadowing_items_theme_subtopic ON public.shadowing_items(theme_id, subtopic_id);

-- 添加复合索引以支持主题筛选查询
CREATE INDEX IF NOT EXISTS idx_shadowing_items_lang_level_theme ON public.shadowing_items(lang, level, theme_id);
CREATE INDEX IF NOT EXISTS idx_shadowing_items_lang_level_subtopic ON public.shadowing_items(lang, level, subtopic_id);


