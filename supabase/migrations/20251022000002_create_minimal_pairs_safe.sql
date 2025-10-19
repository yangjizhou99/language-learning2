-- =====================================================
-- 最小对立词（Minimal Pairs）数据表 - 安全版本
-- 用于二次验证和针对性训练
-- 使用 SELECT 方式插入，避免 NULL 值问题
-- =====================================================

-- 如果表已存在，先删除
DROP TABLE IF EXISTS public.minimal_pairs CASCADE;
DROP TABLE IF EXISTS public.user_pron_verifications CASCADE;

-- 创建 minimal_pairs 表
CREATE TABLE IF NOT EXISTS public.minimal_pairs (
  pair_id BIGSERIAL PRIMARY KEY,
  lang TEXT NOT NULL,
  unit_id_1 BIGINT REFERENCES public.unit_catalog(unit_id) ON DELETE CASCADE,
  unit_id_2 BIGINT REFERENCES public.unit_catalog(unit_id) ON DELETE CASCADE,
  word_1 TEXT NOT NULL,
  word_2 TEXT NOT NULL,
  pinyin_1 TEXT,
  pinyin_2 TEXT,
  difficulty INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minimal_pairs_lang ON public.minimal_pairs(lang);
CREATE INDEX IF NOT EXISTS idx_minimal_pairs_unit1 ON public.minimal_pairs(unit_id_1);
CREATE INDEX IF NOT EXISTS idx_minimal_pairs_unit2 ON public.minimal_pairs(unit_id_2);
CREATE INDEX IF NOT EXISTS idx_minimal_pairs_category ON public.minimal_pairs(category);

COMMENT ON TABLE public.minimal_pairs IS '最小对立词表：用于二次验证和针对性训练';

-- 验证历史表
CREATE TABLE IF NOT EXISTS public.user_pron_verifications (
  verification_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  unit_id BIGINT NOT NULL REFERENCES public.unit_catalog(unit_id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  original_mean NUMERIC,
  original_count INT,
  verification_mean NUMERIC,
  verification_count INT,
  replaced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_pron_verifications_user ON public.user_pron_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pron_verifications_unit ON public.user_pron_verifications(unit_id);

COMMENT ON TABLE public.user_pron_verifications IS '二次验证历史记录';

-- RLS 策略
ALTER TABLE public.user_pron_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_pron_verifications_select_own" ON public.user_pron_verifications;
CREATE POLICY "user_pron_verifications_select_own"
  ON public.user_pron_verifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_pron_verifications_insert_service" ON public.user_pron_verifications;
CREATE POLICY "user_pron_verifications_insert_service"
  ON public.user_pron_verifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- 插入中文最小对立词（使用 SELECT 方式）
-- =====================================================

-- 1. 声调对立 (ma 系列) - 最容易找到的
INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '妈妈',
  '麻妈',
  'ma 1 ma 1',
  'ma 2 ma 1',
  2,
  '声调对立'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'ma 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'ma 2'
ON CONFLICT DO NOTHING;

INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '妈妈',
  '马妈',
  'ma 1 ma 1',
  'ma 3 ma 1',
  2,
  '声调对立'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'ma 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'ma 3'
ON CONFLICT DO NOTHING;

INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '妈妈',
  '骂妈',
  'ma 1 ma 1',
  'ma 4 ma 1',
  2,
  '声调对立'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'ma 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'ma 4'
ON CONFLICT DO NOTHING;

-- 2. j/q/x 系列（舌面音内部对立）
INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '机会',
  '期会',
  'ji 1 hui 4',
  'qi 1 hui 4',
  2,
  '声母对立-舌面音'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'ji 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'qi 1'
ON CONFLICT DO NOTHING;

INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '西方',
  '期方',
  'xi 1 fang 1',
  'qi 1 fang 1',
  2,
  '声母对立-舌面音'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'xi 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'qi 1'
ON CONFLICT DO NOTHING;

-- 3. zh/ch/sh 系列（翘舌音内部对立）
INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '知道',
  '吃道',
  'zhi 1 dao 4',
  'chi 1 dao 4',
  3,
  '声母对立-翘舌音'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'zhi 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'chi 1'
ON CONFLICT DO NOTHING;

INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '知道',
  '是道',
  'zhi 1 dao 4',
  'shi 4 dao 4',
  3,
  '声母对立-翘舌音'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'zhi 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'shi 4'
ON CONFLICT DO NOTHING;

INSERT INTO public.minimal_pairs (lang, unit_id_1, unit_id_2, word_1, word_2, pinyin_1, pinyin_2, difficulty, category)
SELECT 
  'zh-CN',
  uc1.unit_id,
  uc2.unit_id,
  '吃饭',
  '是饭',
  'chi 1 fan 4',
  'shi 4 fan 4',
  3,
  '声母对立-翘舌音'
FROM unit_catalog uc1
CROSS JOIN unit_catalog uc2
WHERE uc1.lang = 'zh-CN' AND uc1.symbol = 'chi 1'
  AND uc2.lang = 'zh-CN' AND uc2.symbol = 'shi 4'
ON CONFLICT DO NOTHING;

-- 验证数据
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.minimal_pairs;
  RAISE NOTICE '已插入 % 对最小对立词', v_count;
END $$;

