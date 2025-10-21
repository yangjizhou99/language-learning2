-- =====================================================
-- 韩语（ko）学习支持 - 数据库迁移
-- 扩展语言约束，更新用户权限，支持韩语学习功能
-- =====================================================

-- =====================================================
-- 1. 扩展语言约束 - Cloze Shadowing
-- =====================================================

-- 检查并更新 cloze_shadowing_items 表的语言约束
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cloze_shadowing_items_lang_check'
  ) THEN
    ALTER TABLE public.cloze_shadowing_items
      DROP CONSTRAINT cloze_shadowing_items_lang_check;
  END IF;
  ALTER TABLE public.cloze_shadowing_items
    ADD CONSTRAINT cloze_shadowing_items_lang_check
    CHECK (lang = ANY (ARRAY['en','ja','zh','ko']::text[]));
END$$;

-- =====================================================
-- 2. 扩展语言约束 - Alignment 相关表
-- =====================================================

-- alignment_materials 表
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alignment_materials_lang_check') THEN
    ALTER TABLE public.alignment_materials DROP CONSTRAINT alignment_materials_lang_check;
    ALTER TABLE public.alignment_materials
      ADD CONSTRAINT alignment_materials_lang_check
      CHECK (lang = ANY (ARRAY['en','ja','zh','ko']::text[]));
  END IF;
END$$;

-- alignment_subtopics 表
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alignment_subtopics_lang_check') THEN
    ALTER TABLE public.alignment_subtopics DROP CONSTRAINT alignment_subtopics_lang_check;
    ALTER TABLE public.alignment_subtopics
      ADD CONSTRAINT alignment_subtopics_lang_check
      CHECK (lang = ANY (ARRAY['en','ja','zh','ko']::text[]));
  END IF;
END$$;

-- alignment_themes 表
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alignment_themes_lang_check') THEN
    ALTER TABLE public.alignment_themes DROP CONSTRAINT alignment_themes_lang_check;
    ALTER TABLE public.alignment_themes
      ADD CONSTRAINT alignment_themes_lang_check
      CHECK (lang = ANY (ARRAY['en','ja','zh','ko']::text[]));
  END IF;
END$$;

-- =====================================================
-- 3. 更新用户权限 - 默认权限
-- =====================================================

-- 更新 default_user_permissions 表，为 allowed_languages 添加 'ko'
UPDATE public.default_user_permissions
SET allowed_languages = (
  SELECT ARRAY(SELECT DISTINCT unnest(allowed_languages || ARRAY['ko']))
);

-- =====================================================
-- 4. 更新用户权限 - 现有用户权限
-- =====================================================

-- 更新 user_permissions 表的所有现有用户记录，为 allowed_languages 添加 'ko'
UPDATE public.user_permissions
SET allowed_languages = (
  SELECT ARRAY(SELECT DISTINCT unnest(allowed_languages || ARRAY['ko']))
);

-- =====================================================
-- 5. 刷新 PostgREST 缓存
-- =====================================================

-- 通知 PostgREST 重新加载 schema 缓存
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- 6. 验证迁移结果
-- =====================================================

-- 验证语言约束已正确更新
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count 
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' 
    AND t.relname IN ('cloze_shadowing_items', 'alignment_materials', 'alignment_subtopics', 'alignment_themes')
    AND c.conname LIKE '%_lang_check';
  
  IF constraint_count < 4 THEN
    RAISE WARNING '部分语言约束可能未正确更新，请检查表结构';
  ELSE
    RAISE NOTICE '语言约束更新成功: % 个约束已更新', constraint_count;
  END IF;
END$$;

-- 验证用户权限更新
DO $$
DECLARE
  default_perms_count INTEGER;
  user_perms_count INTEGER;
BEGIN
  -- 检查默认权限
  SELECT COUNT(*) INTO default_perms_count 
  FROM public.default_user_permissions 
  WHERE 'ko' = ANY(allowed_languages);
  
  -- 检查用户权限
  SELECT COUNT(*) INTO user_perms_count 
  FROM public.user_permissions 
  WHERE 'ko' = ANY(allowed_languages);
  
  RAISE NOTICE '权限更新结果:';
  RAISE NOTICE '- 默认权限包含韩语: % 条', default_perms_count;
  RAISE NOTICE '- 用户权限包含韩语: % 条', user_perms_count;
END$$;

-- =====================================================
-- 迁移完成提示
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '韩语学习支持迁移完成';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '更新内容:';
  RAISE NOTICE '- 扩展语言约束: 支持 ko 语言';
  RAISE NOTICE '- 更新用户权限: 默认和现有用户均可访问韩语';
  RAISE NOTICE '- 刷新缓存: PostgREST schema 已重新加载';
  RAISE NOTICE '=====================================================';
END$$;
