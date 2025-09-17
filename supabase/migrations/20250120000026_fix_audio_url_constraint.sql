-- 修复 shadowing_items 表中 audio_url 字段的 NOT NULL 约束
-- 20250120000026_fix_audio_url_constraint.sql

-- 修改 audio_url 字段，允许为空
ALTER TABLE public.shadowing_items 
ALTER COLUMN audio_url DROP NOT NULL;

-- 为现有记录设置默认值（如果有空值）
UPDATE public.shadowing_items 
SET audio_url = '' 
WHERE audio_url IS NULL;

-- 添加注释说明
COMMENT ON COLUMN public.shadowing_items.audio_url IS '音频文件URL，可以为空（草稿状态时）';
