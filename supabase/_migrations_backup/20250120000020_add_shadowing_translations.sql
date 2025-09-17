-- 为 Shadowing 草稿与正式题库增加 translations 字段
-- 20250120000020_add_shadowing_translations.sql

-- 为 shadowing_drafts 表添加翻译字段
ALTER TABLE public.shadowing_drafts 
ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS trans_updated_at timestamptz DEFAULT NULL;

-- 为 shadowing_items 表添加翻译字段
ALTER TABLE public.shadowing_items 
ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS trans_updated_at timestamptz DEFAULT NULL;

-- 创建索引以优化翻译查询
CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_trans_updated_at 
ON public.shadowing_drafts(trans_updated_at);

CREATE INDEX IF NOT EXISTS idx_shadowing_items_trans_updated_at 
ON public.shadowing_items(trans_updated_at);

-- 添加注释说明字段用途
COMMENT ON COLUMN public.shadowing_drafts.translations IS '存储翻译内容，格式：{"en": "英文翻译", "ja": "日文翻译", "zh": "中文翻译"}';
COMMENT ON COLUMN public.shadowing_drafts.trans_updated_at IS '翻译最后更新时间';
COMMENT ON COLUMN public.shadowing_items.translations IS '存储翻译内容，格式：{"en": "英文翻译", "ja": "日文翻译", "zh": "中文翻译"}';
COMMENT ON COLUMN public.shadowing_items.trans_updated_at IS '翻译最后更新时间';
