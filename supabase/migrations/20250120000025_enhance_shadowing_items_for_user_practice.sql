-- 增强 shadowing_items 表以支持用户练习功能
-- 20250120000025_enhance_shadowing_items_for_user_practice.sql

-- 为 shadowing_items 表添加缺失的字段以匹配 shadowing_drafts 的功能
ALTER TABLE public.shadowing_items 
ADD COLUMN IF NOT EXISTS topic text DEFAULT '',
ADD COLUMN IF NOT EXISTS genre text DEFAULT 'monologue',
ADD COLUMN IF NOT EXISTS register text DEFAULT 'neutral',
ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_provider text,
ADD COLUMN IF NOT EXISTS ai_model text,
ADD COLUMN IF NOT EXISTS ai_usage jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_shadowing_items_status ON public.shadowing_items(status);
CREATE INDEX IF NOT EXISTS idx_shadowing_items_topic ON public.shadowing_items(topic);
CREATE INDEX IF NOT EXISTS idx_shadowing_items_genre ON public.shadowing_items(genre);
CREATE INDEX IF NOT EXISTS idx_shadowing_items_created_by ON public.shadowing_items(created_by);

-- 添加注释说明字段用途
COMMENT ON COLUMN public.shadowing_items.topic IS '主题标签';
COMMENT ON COLUMN public.shadowing_items.genre IS '体裁：monologue/dialogue/news等';
COMMENT ON COLUMN public.shadowing_items.register IS '语域：formal/neutral/informal';
COMMENT ON COLUMN public.shadowing_items.notes IS '额外信息，如音频URL等';
COMMENT ON COLUMN public.shadowing_items.ai_provider IS 'AI提供者：openrouter/deepseek/openai';
COMMENT ON COLUMN public.shadowing_items.ai_model IS 'AI模型名称';
COMMENT ON COLUMN public.shadowing_items.ai_usage IS 'AI使用统计';
COMMENT ON COLUMN public.shadowing_items.status IS '状态：approved/pending/rejected';
COMMENT ON COLUMN public.shadowing_items.created_by IS '创建者ID';

-- 更新现有记录的默认值
UPDATE public.shadowing_items 
SET 
  status = 'approved',
  genre = COALESCE(genre, 'monologue'),
  register = COALESCE(register, 'neutral'),
  topic = COALESCE(topic, ''),
  notes = COALESCE(notes, '{}'::jsonb),
  ai_usage = COALESCE(ai_usage, '{}'::jsonb)
WHERE status IS NULL OR genre IS NULL OR register IS NULL;
