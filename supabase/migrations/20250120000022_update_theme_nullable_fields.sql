-- 修改主题表，让lang、genre、register字段支持null值
-- 主题只关联难度等级，不关联语言、体裁、语域

-- 1. 先删除约束，再修改字段为可空
ALTER TABLE public.shadowing_themes 
DROP CONSTRAINT IF EXISTS shadowing_themes_lang_check;

ALTER TABLE public.shadowing_themes 
ALTER COLUMN lang DROP NOT NULL;

-- 2. 修改genre字段为可空
ALTER TABLE public.shadowing_themes 
DROP CONSTRAINT IF EXISTS shadowing_themes_genre_check;

ALTER TABLE public.shadowing_themes 
ALTER COLUMN genre DROP NOT NULL;

-- 3. 修改register字段为可空
ALTER TABLE public.shadowing_themes 
DROP CONSTRAINT IF EXISTS shadowing_themes_register_check;

ALTER TABLE public.shadowing_themes 
ALTER COLUMN register DROP NOT NULL;

-- 4. 重新添加约束，允许null值
ALTER TABLE public.shadowing_themes 
ADD CONSTRAINT shadowing_themes_lang_check CHECK (lang IS NULL OR lang IN ('en', 'ja', 'zh'));

ALTER TABLE public.shadowing_themes 
ADD CONSTRAINT shadowing_themes_genre_check CHECK (genre IS NULL OR genre IN ('dialogue', 'monologue', 'news', 'lecture'));

ALTER TABLE public.shadowing_themes 
ADD CONSTRAINT shadowing_themes_register_check CHECK (register IS NULL OR register IN ('casual', 'neutral', 'formal'));

-- 5. 更新索引，移除不再需要的复合索引
DROP INDEX IF EXISTS idx_shadowing_themes_lang_level_genre;

-- 6. 创建新的索引，只基于level和is_active
CREATE INDEX IF NOT EXISTS idx_shadowing_themes_level_active 
ON public.shadowing_themes(level) WHERE is_active = true;
