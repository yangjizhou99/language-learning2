-- =====================================================
-- 日语罗马音发音评测系统迁移
-- 将日语音素从IPA符号更新为训令式罗马字（Kunrei）
-- =====================================================

-- 1. 删除现有的日文IPA音素数据
DELETE FROM public.unit_catalog WHERE lang = 'ja-JP';

-- 2. 删除日语音素辅助表（不再需要）
DROP TABLE IF EXISTS public.ja_phoneme_units CASCADE;

-- 3. 删除日语音素视图（不再需要）
DROP VIEW IF EXISTS public.japanese_phonemes_view CASCADE;

-- 4. 插入训令式罗马字音节数据
INSERT INTO public.unit_catalog (lang, symbol, unit_type) VALUES
-- 基本音节（46个）
('ja-JP', 'a', 'phoneme'),
('ja-JP', 'i', 'phoneme'),
('ja-JP', 'u', 'phoneme'),
('ja-JP', 'e', 'phoneme'),
('ja-JP', 'o', 'phoneme'),

('ja-JP', 'ka', 'phoneme'),
('ja-JP', 'ki', 'phoneme'),
('ja-JP', 'ku', 'phoneme'),
('ja-JP', 'ke', 'phoneme'),
('ja-JP', 'ko', 'phoneme'),

('ja-JP', 'sa', 'phoneme'),
('ja-JP', 'si', 'phoneme'),
('ja-JP', 'su', 'phoneme'),
('ja-JP', 'se', 'phoneme'),
('ja-JP', 'so', 'phoneme'),

('ja-JP', 'ta', 'phoneme'),
('ja-JP', 'ti', 'phoneme'),
('ja-JP', 'tu', 'phoneme'),
('ja-JP', 'te', 'phoneme'),
('ja-JP', 'to', 'phoneme'),

('ja-JP', 'na', 'phoneme'),
('ja-JP', 'ni', 'phoneme'),
('ja-JP', 'nu', 'phoneme'),
('ja-JP', 'ne', 'phoneme'),
('ja-JP', 'no', 'phoneme'),

('ja-JP', 'ha', 'phoneme'),
('ja-JP', 'hi', 'phoneme'),
('ja-JP', 'hu', 'phoneme'),
('ja-JP', 'he', 'phoneme'),
('ja-JP', 'ho', 'phoneme'),

('ja-JP', 'ma', 'phoneme'),
('ja-JP', 'mi', 'phoneme'),
('ja-JP', 'mu', 'phoneme'),
('ja-JP', 'me', 'phoneme'),
('ja-JP', 'mo', 'phoneme'),

('ja-JP', 'ya', 'phoneme'),
('ja-JP', 'yu', 'phoneme'),
('ja-JP', 'yo', 'phoneme'),

('ja-JP', 'ra', 'phoneme'),
('ja-JP', 'ri', 'phoneme'),
('ja-JP', 'ru', 'phoneme'),
('ja-JP', 're', 'phoneme'),
('ja-JP', 'ro', 'phoneme'),

('ja-JP', 'wa', 'phoneme'),
('ja-JP', 'wo', 'phoneme'),
('ja-JP', 'n', 'phoneme'),

-- 浊音（20个）
('ja-JP', 'ga', 'phoneme'),
('ja-JP', 'gi', 'phoneme'),
('ja-JP', 'gu', 'phoneme'),
('ja-JP', 'ge', 'phoneme'),
('ja-JP', 'go', 'phoneme'),

('ja-JP', 'za', 'phoneme'),
('ja-JP', 'zi', 'phoneme'),
('ja-JP', 'zu', 'phoneme'),
('ja-JP', 'ze', 'phoneme'),
('ja-JP', 'zo', 'phoneme'),

('ja-JP', 'da', 'phoneme'),
('ja-JP', 'di', 'phoneme'),
('ja-JP', 'du', 'phoneme'),
('ja-JP', 'de', 'phoneme'),
('ja-JP', 'do', 'phoneme'),

('ja-JP', 'ba', 'phoneme'),
('ja-JP', 'bi', 'phoneme'),
('ja-JP', 'bu', 'phoneme'),
('ja-JP', 'be', 'phoneme'),
('ja-JP', 'bo', 'phoneme'),

-- 半浊音（5个）
('ja-JP', 'pa', 'phoneme'),
('ja-JP', 'pi', 'phoneme'),
('ja-JP', 'pu', 'phoneme'),
('ja-JP', 'pe', 'phoneme'),
('ja-JP', 'po', 'phoneme'),

-- 拗音（33个）
('ja-JP', 'kya', 'phoneme'),
('ja-JP', 'kyu', 'phoneme'),
('ja-JP', 'kyo', 'phoneme'),

('ja-JP', 'sya', 'phoneme'),
('ja-JP', 'syu', 'phoneme'),
('ja-JP', 'syo', 'phoneme'),

('ja-JP', 'tya', 'phoneme'),
('ja-JP', 'tyu', 'phoneme'),
('ja-JP', 'tyo', 'phoneme'),

('ja-JP', 'nya', 'phoneme'),
('ja-JP', 'nyu', 'phoneme'),
('ja-JP', 'nyo', 'phoneme'),

('ja-JP', 'hya', 'phoneme'),
('ja-JP', 'hyu', 'phoneme'),
('ja-JP', 'hyo', 'phoneme'),

('ja-JP', 'mya', 'phoneme'),
('ja-JP', 'myu', 'phoneme'),
('ja-JP', 'myo', 'phoneme'),

('ja-JP', 'rya', 'phoneme'),
('ja-JP', 'ryu', 'phoneme'),
('ja-JP', 'ryo', 'phoneme'),

('ja-JP', 'gya', 'phoneme'),
('ja-JP', 'gyu', 'phoneme'),
('ja-JP', 'gyo', 'phoneme'),

('ja-JP', 'zya', 'phoneme'),
('ja-JP', 'zyu', 'phoneme'),
('ja-JP', 'zyo', 'phoneme'),

('ja-JP', 'bya', 'phoneme'),
('ja-JP', 'byu', 'phoneme'),
('ja-JP', 'byo', 'phoneme'),

('ja-JP', 'pya', 'phoneme'),
('ja-JP', 'pyu', 'phoneme'),
('ja-JP', 'pyo', 'phoneme');

-- 5. 创建日语罗马字音节分类视图
CREATE OR REPLACE VIEW public.japanese_romaji_view AS
SELECT 
  uc.unit_id,
  uc.symbol,
  CASE 
    WHEN uc.symbol IN ('a', 'i', 'u', 'e', 'o') THEN 'あ行'
    WHEN uc.symbol LIKE 'k%' THEN 'か行'
    WHEN uc.symbol LIKE 'g%' THEN 'が行'
    WHEN uc.symbol LIKE 's%' THEN 'さ行'
    WHEN uc.symbol LIKE 'z%' THEN 'ざ行'
    WHEN uc.symbol LIKE 't%' THEN 'た行'
    WHEN uc.symbol LIKE 'd%' THEN 'だ行'
    WHEN uc.symbol LIKE 'n%' THEN 'な行'
    WHEN uc.symbol LIKE 'h%' THEN 'は行'
    WHEN uc.symbol LIKE 'b%' THEN 'ば行'
    WHEN uc.symbol LIKE 'p%' THEN 'ぱ行'
    WHEN uc.symbol LIKE 'm%' THEN 'ま行'
    WHEN uc.symbol LIKE 'y%' THEN 'や行'
    WHEN uc.symbol LIKE 'r%' THEN 'ら行'
    WHEN uc.symbol LIKE 'w%' THEN 'わ行'
    WHEN uc.symbol = 'n' THEN 'ん'
    ELSE '其他'
  END AS row_category,
  CASE 
    WHEN uc.symbol IN ('a', 'i', 'u', 'e', 'o') THEN 'vowel'
    WHEN uc.symbol LIKE 'k%' OR uc.symbol LIKE 'g%' THEN 'k_line'
    WHEN uc.symbol LIKE 's%' OR uc.symbol LIKE 'z%' THEN 's_line'
    WHEN uc.symbol LIKE 't%' OR uc.symbol LIKE 'd%' THEN 't_line'
    WHEN uc.symbol LIKE 'n%' THEN 'n_line'
    WHEN uc.symbol LIKE 'h%' OR uc.symbol LIKE 'b%' OR uc.symbol LIKE 'p%' THEN 'h_line'
    WHEN uc.symbol LIKE 'm%' THEN 'm_line'
    WHEN uc.symbol LIKE 'y%' THEN 'y_line'
    WHEN uc.symbol LIKE 'r%' THEN 'r_line'
    WHEN uc.symbol LIKE 'w%' THEN 'w_line'
    WHEN uc.symbol = 'n' THEN 'n_syllable'
    ELSE 'other'
  END AS line_category
FROM public.unit_catalog uc
WHERE uc.lang = 'ja-JP'
ORDER BY 
  CASE 
    WHEN uc.symbol IN ('a', 'i', 'u', 'e', 'o') THEN 1
    WHEN uc.symbol LIKE 'k%' THEN 2
    WHEN uc.symbol LIKE 'g%' THEN 3
    WHEN uc.symbol LIKE 's%' THEN 4
    WHEN uc.symbol LIKE 'z%' THEN 5
    WHEN uc.symbol LIKE 't%' THEN 6
    WHEN uc.symbol LIKE 'd%' THEN 7
    WHEN uc.symbol LIKE 'n%' THEN 8
    WHEN uc.symbol LIKE 'h%' THEN 9
    WHEN uc.symbol LIKE 'b%' THEN 10
    WHEN uc.symbol LIKE 'p%' THEN 11
    WHEN uc.symbol LIKE 'm%' THEN 12
    WHEN uc.symbol LIKE 'y%' THEN 13
    WHEN uc.symbol LIKE 'r%' THEN 14
    WHEN uc.symbol LIKE 'w%' THEN 15
    WHEN uc.symbol = 'n' THEN 16
    ELSE 17
  END,
  uc.symbol;

COMMENT ON VIEW public.japanese_romaji_view IS '日语罗马字音节视图：按行分类显示';

-- 6. 清理旧的日文用户统计数据（需要重新生成）
DO $$
BEGIN
  IF to_regclass('public.user_unit_stats') IS NOT NULL THEN
    DELETE FROM public.user_unit_stats WHERE lang = 'ja-JP';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sentence_units') IS NOT NULL THEN
    DELETE FROM public.sentence_units 
    WHERE sentence_id IN (
      SELECT sentence_id FROM public.pron_sentences WHERE lang = 'ja-JP'
    );
  END IF;
END $$;

-- 8. 验证迁移结果
DO $$
DECLARE
  basic_count INTEGER;
  voiced_count INTEGER;
  semi_voiced_count INTEGER;
  yoon_count INTEGER;
  total_count INTEGER;
BEGIN
  -- 统计基本音节
  SELECT COUNT(*) INTO basic_count 
  FROM public.unit_catalog 
  WHERE lang = 'ja-JP' 
  AND symbol IN ('a', 'i', 'u', 'e', 'o', 'ka', 'ki', 'ku', 'ke', 'ko', 'sa', 'si', 'su', 'se', 'so', 'ta', 'ti', 'tu', 'te', 'to', 'na', 'ni', 'nu', 'ne', 'no', 'ha', 'hi', 'hu', 'he', 'ho', 'ma', 'mi', 'mu', 'me', 'mo', 'ya', 'yu', 'yo', 'ra', 'ri', 'ru', 're', 'ro', 'wa', 'wo', 'n');
  
  -- 统计浊音
  SELECT COUNT(*) INTO voiced_count 
  FROM public.unit_catalog 
  WHERE lang = 'ja-JP' 
  AND symbol IN ('ga', 'gi', 'gu', 'ge', 'go', 'za', 'zi', 'zu', 'ze', 'zo', 'da', 'di', 'du', 'de', 'do', 'ba', 'bi', 'bu', 'be', 'bo');
  
  -- 统计半浊音
  SELECT COUNT(*) INTO semi_voiced_count 
  FROM public.unit_catalog 
  WHERE lang = 'ja-JP' 
  AND symbol IN ('pa', 'pi', 'pu', 'pe', 'po');
  
  -- 统计拗音
  SELECT COUNT(*) INTO yoon_count 
  FROM public.unit_catalog 
  WHERE lang = 'ja-JP' 
  AND symbol IN ('kya', 'kyu', 'kyo', 'sya', 'syu', 'syo', 'tya', 'tyu', 'tyo', 'nya', 'nyu', 'nyo', 'hya', 'hyu', 'hyo', 'mya', 'myu', 'myo', 'rya', 'ryu', 'ryo', 'gya', 'gyu', 'gyo', 'zya', 'zyu', 'zyo', 'bya', 'byu', 'byo', 'pya', 'pyu', 'pyo');
  
  -- 统计总数
  SELECT COUNT(*) INTO total_count FROM public.unit_catalog WHERE lang = 'ja-JP';
  
  RAISE NOTICE '日语罗马字迁移完成:';
  RAISE NOTICE '  基本音节: % 个', basic_count;
  RAISE NOTICE '  浊音: % 个', voiced_count;
  RAISE NOTICE '  半浊音: % 个', semi_voiced_count;
  RAISE NOTICE '  拗音: % 个', yoon_count;
  RAISE NOTICE '  总计: % 个罗马字音节', total_count;
  
  -- 验证数据完整性
  IF total_count != 104 THEN
    RAISE EXCEPTION '迁移失败：期望104个罗马字音节，实际%个', total_count;
  END IF;
  
  RAISE NOTICE '✅ 日语罗马音发音评测系统迁移成功！';
END $$;

