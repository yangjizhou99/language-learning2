-- =============================================
-- 生词本性能优化 - Supabase 迁移版本
-- =============================================
-- 此文件不包含 psql 元命令，适用于 Supabase 迁移系统
-- =============================================

-- =============================================
-- 步骤 1: 创建高效的统计函数
-- =============================================

CREATE OR REPLACE FUNCTION get_vocab_stats(p_user_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'byLanguage', (
      SELECT COALESCE(json_object_agg(lang, count), '{}'::json)
      FROM (
        SELECT lang, COUNT(*) as count 
        FROM vocab_entries 
        WHERE user_id = p_user_id 
        GROUP BY lang
      ) t
    ),
    'byStatus', (
      SELECT COALESCE(json_object_agg(status, count), '{}'::json)
      FROM (
        SELECT status, COUNT(*) as count 
        FROM vocab_entries 
        WHERE user_id = p_user_id 
        GROUP BY status
      ) t
    ),
    'withExplanation', (
      SELECT COUNT(*) 
      FROM vocab_entries 
      WHERE user_id = p_user_id AND explanation IS NOT NULL
    ),
    'withoutExplanation', (
      SELECT COUNT(*) 
      FROM vocab_entries 
      WHERE user_id = p_user_id AND explanation IS NULL
    )
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_vocab_stats(UUID) IS '高效获取用户生词统计信息，使用SQL聚合避免内存统计';

-- =============================================
-- 步骤 2: 添加优化索引
-- =============================================

-- 优化带筛选条件的查询（user_id + status + created_at）
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_status_created 
ON vocab_entries(user_id, status, created_at DESC)
WHERE status IS NOT NULL;

-- 优化带语言和状态筛选的查询（user_id + lang + status + created_at）
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_lang_status 
ON vocab_entries(user_id, lang, status, created_at DESC)
WHERE lang IS NOT NULL AND status IS NOT NULL;

-- 优化SRS查询（user_id + srs_due）
-- 仅在srs_due列存在时创建
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vocab_entries' 
    AND column_name = 'srs_due'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_srs_due 
    ON vocab_entries(user_id, srs_due)
    WHERE status != 'archived' OR status IS NULL;
    RAISE NOTICE '索引 idx_vocab_entries_user_srs_due 创建成功';
  ELSE
    RAISE NOTICE '跳过 idx_vocab_entries_user_srs_due（srs_due列不存在）';
  END IF;
END $$;

-- 优化解释状态筛选（user_id + explanation 是否为空）
-- 部分索引：仅索引有解释的记录
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_has_explanation
ON vocab_entries(user_id, created_at DESC)
WHERE explanation IS NOT NULL;

-- 部分索引：仅索引无解释的记录
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_no_explanation
ON vocab_entries(user_id, created_at DESC)
WHERE explanation IS NULL;

-- =============================================
-- 步骤 3: 添加查询性能分析注释
-- =============================================

COMMENT ON INDEX idx_vocab_entries_user_status_created IS '优化按用户和状态筛选的查询';
COMMENT ON INDEX idx_vocab_entries_user_lang_status IS '优化按用户、语言和状态筛选的查询';
COMMENT ON INDEX idx_vocab_entries_user_has_explanation IS '优化查询有解释的生词';
COMMENT ON INDEX idx_vocab_entries_user_no_explanation IS '优化查询无解释的生词';

-- =============================================
-- 验证迁移
-- =============================================

-- 验证函数是否创建
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'get_vocab_stats'
  ) THEN
    RAISE NOTICE '函数 get_vocab_stats 已创建';
  ELSE
    RAISE EXCEPTION '函数 get_vocab_stats 创建失败';
  END IF;
END $$;

-- 验证索引是否创建
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE tablename = 'vocab_entries'
  AND indexname LIKE 'idx_vocab_entries_user%';
  
  RAISE NOTICE '已创建 % 个优化索引', idx_count;
  
  IF idx_count < 4 THEN
    RAISE WARNING '部分索引可能未创建，请检查';
  END IF;
END $$;
