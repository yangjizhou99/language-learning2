-- 为 shadowing_themes 和 shadowing_subtopics 表添加 AI 相关字段
-- 20250120000021_add_ai_fields_to_shadowing_tables.sql

-- 为 shadowing_themes 表添加 AI 字段
ALTER TABLE public.shadowing_themes 
ADD COLUMN IF NOT EXISTS ai_provider text,
ADD COLUMN IF NOT EXISTS ai_model text,
ADD COLUMN IF NOT EXISTS ai_usage jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS title_en text,
ADD COLUMN IF NOT EXISTS coverage jsonb DEFAULT '[]'::jsonb;

-- 为 shadowing_subtopics 表添加 AI 字段
ALTER TABLE public.shadowing_subtopics 
ADD COLUMN IF NOT EXISTS ai_provider text,
ADD COLUMN IF NOT EXISTS ai_model text,
ADD COLUMN IF NOT EXISTS ai_usage jsonb DEFAULT '{}'::jsonb;

-- 添加注释说明字段用途
COMMENT ON COLUMN public.shadowing_themes.ai_provider IS 'AI 提供者：openrouter/deepseek/openai';
COMMENT ON COLUMN public.shadowing_themes.ai_model IS 'AI 模型名称';
COMMENT ON COLUMN public.shadowing_themes.ai_usage IS 'AI 使用统计：{prompt_tokens, completion_tokens, total_tokens}';
COMMENT ON COLUMN public.shadowing_themes.title_en IS '英文标题（用于多语言展示）';
COMMENT ON COLUMN public.shadowing_themes.coverage IS '主题覆盖的子话题面：["要点1","要点2","要点3"]';

COMMENT ON COLUMN public.shadowing_subtopics.ai_provider IS 'AI 提供者：openrouter/deepseek/openai';
COMMENT ON COLUMN public.shadowing_subtopics.ai_model IS 'AI 模型名称';
COMMENT ON COLUMN public.shadowing_subtopics.ai_usage IS 'AI 使用统计：{prompt_tokens, completion_tokens, total_tokens}';
