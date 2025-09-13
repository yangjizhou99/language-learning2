-- 为 shadowing_drafts 表添加主题关联字段
-- 20250120000023_add_theme_relations_to_shadowing_drafts.sql

-- 为 shadowing_drafts 表添加主题关联字段
ALTER TABLE public.shadowing_drafts
ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.shadowing_themes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES public.shadowing_subtopics(id) ON DELETE SET NULL;

-- 创建索引以优化主题查询
CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_theme_id 
ON public.shadowing_drafts(theme_id);

CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_subtopic_id 
ON public.shadowing_drafts(subtopic_id);

-- 添加注释说明字段用途
COMMENT ON COLUMN public.shadowing_drafts.theme_id IS '关联的大主题ID';
COMMENT ON COLUMN public.shadowing_drafts.subtopic_id IS '关联的小主题ID';


