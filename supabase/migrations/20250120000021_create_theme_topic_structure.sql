-- 创建主题和题目关系的新数据库结构
-- 支持大主题由管理员添加，小题目通过AI生成

-- 1. 创建主题表 (大主题)
CREATE TABLE IF NOT EXISTS public.shadowing_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_cn text NOT NULL,                    -- 主题中文名称
  title_en text NOT NULL,                    -- 主题英文名称
  description text,                          -- 主题描述
  lang text NOT NULL CHECK (lang IN ('en', 'ja', 'zh')), -- 目标语言
  level int NOT NULL CHECK (level BETWEEN 1 AND 6),      -- 难度等级
  genre text NOT NULL CHECK (genre IN ('dialogue', 'monologue', 'news', 'lecture')), -- 体裁
  register text DEFAULT 'neutral' CHECK (register IN ('casual', 'neutral', 'formal')), -- 语域
  is_active boolean DEFAULT true,            -- 是否启用
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 创建题目表 (小题目)
CREATE TABLE IF NOT EXISTS public.shadowing_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.shadowing_themes(id) ON DELETE CASCADE,
  title_cn text NOT NULL,                    -- 题目中文标题
  seed_en text,                              -- 英文关键词/种子
  one_line_cn text,                          -- 一句话描述
  is_generated boolean DEFAULT false,        -- 是否为AI生成
  ai_provider text,                          -- AI提供商
  ai_model text,                             -- AI模型
  ai_usage jsonb,                            -- AI使用情况
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 3. 更新shadowing_drafts表，添加theme_id和topic_id关联
ALTER TABLE public.shadowing_drafts 
ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.shadowing_themes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.shadowing_topics(id) ON DELETE SET NULL;

-- 4. 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS idx_shadowing_themes_lang_level_genre 
ON public.shadowing_themes(lang, level, genre) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_shadowing_topics_theme_id 
ON public.shadowing_topics(theme_id);

CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_theme_topic 
ON public.shadowing_drafts(theme_id, topic_id);

-- 5. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shadowing_themes_updated_at 
BEFORE UPDATE ON public.shadowing_themes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. 示例数据将通过UI创建，不在此处插入
