-- =====================================================
-- 日语音素体系建立
-- 创建ja_phoneme_units辅助表并插入日语音素数据
-- =====================================================

-- 创建日语音素辅助表
CREATE TABLE IF NOT EXISTS public.ja_phoneme_units (
  symbol TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT,
  examples TEXT[],
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ja_phoneme_units_category ON public.ja_phoneme_units(category);
CREATE INDEX IF NOT EXISTS idx_ja_phoneme_units_subcategory ON public.ja_phoneme_units(subcategory);

COMMENT ON TABLE public.ja_phoneme_units IS '日语音素辅助表：用于分类和描述';

-- 插入日语音素数据
INSERT INTO public.ja_phoneme_units (symbol, category, subcategory, examples, description) VALUES
-- 元音 (Vowels)
('a', 'vowel', 'basic', ARRAY['あ', 'か', 'さ'], '基本元音 /a/'),
('i', 'vowel', 'basic', ARRAY['い', 'き', 'し'], '基本元音 /i/'),
('ɯ', 'vowel', 'basic', ARRAY['う', 'く', 'す'], '基本元音 /ɯ/'),
('e', 'vowel', 'basic', ARRAY['え', 'け', 'せ'], '基本元音 /e/'),
('o', 'vowel', 'basic', ARRAY['お', 'こ', 'そ'], '基本元音 /o/'),

-- 辅音 (Consonants) - 爆破音
('k', 'consonant', 'stop', ARRAY['か', 'き', 'く'], '清音 /k/'),
('g', 'consonant', 'stop', ARRAY['が', 'ぎ', 'ぐ'], '浊音 /g/'),
('s', 'consonant', 'fricative', ARRAY['さ', 'す', 'せ'], '清音 /s/'),
('z', 'consonant', 'fricative', ARRAY['ざ', 'ず', 'ぜ'], '浊音 /z/'),
('t', 'consonant', 'stop', ARRAY['た', 'て', 'と'], '清音 /t/'),
('d', 'consonant', 'stop', ARRAY['だ', 'で', 'ど'], '浊音 /d/'),
('n', 'consonant', 'nasal', ARRAY['な', 'に', 'ぬ'], '鼻音 /n/'),
('h', 'consonant', 'fricative', ARRAY['は', 'ひ', 'ふ'], '清音 /h/'),
('b', 'consonant', 'stop', ARRAY['ば', 'び', 'ぶ'], '浊音 /b/'),
('p', 'consonant', 'stop', ARRAY['ぱ', 'ぴ', 'ぷ'], '清音 /p/'),
('m', 'consonant', 'nasal', ARRAY['ま', 'み', 'む'], '鼻音 /m/'),
('r', 'consonant', 'approximant', ARRAY['ら', 'り', 'る'], '近音 /r/'),
('j', 'consonant', 'approximant', ARRAY['や', 'ゆ', 'よ'], '近音 /j/'),
('w', 'consonant', 'approximant', ARRAY['わ', 'を'], '近音 /w/'),

-- 特殊音素
('ɕ', 'consonant', 'fricative', ARRAY['し', 'しゃ', 'しゅ'], '清音 /ɕ/ (shi音)'),
('t͡ɕ', 'consonant', 'affricate', ARRAY['ち', 'ちゃ', 'ちゅ'], '清音 /t͡ɕ/ (chi音)'),
('d͡ʑ', 'consonant', 'affricate', ARRAY['じ', 'じゃ', 'じゅ'], '浊音 /d͡ʑ/ (ji音)'),
('ts', 'consonant', 'affricate', ARRAY['つ', 'つぁ', 'つぃ'], '清音 /ts/ (tsu音)'),
('ɸ', 'consonant', 'fricative', ARRAY['ふ', 'ふぁ', 'ふぃ'], '清音 /ɸ/ (fu音)'),
('ɲ', 'consonant', 'nasal', ARRAY['にゃ', 'にゅ', 'にょ'], '鼻音 /ɲ/ (nya音)'),

-- 特殊符号
('Q', 'special', 'geminate', ARRAY['っ'], '促音 /Q/ (小っ)'),
(':', 'special', 'long_vowel', ARRAY['ー', 'おう', 'えい'], '长音 /:/ (ー)'),
('N', 'special', 'syllabic_n', ARRAY['ん'], '拨音 /N/ (ん)')

ON CONFLICT (symbol) DO NOTHING;

-- 将日语音素插入到unit_catalog
INSERT INTO public.unit_catalog (lang, symbol, unit_type)
SELECT 'ja-JP', symbol, 'phoneme'
FROM public.ja_phoneme_units
ON CONFLICT (lang, symbol) DO NOTHING;

-- 创建日语音素视图（用于验证）
CREATE OR REPLACE VIEW public.japanese_phonemes_view AS
SELECT 
  uc.unit_id,
  uc.symbol,
  jpu.category,
  jpu.subcategory,
  jpu.examples,
  jpu.description
FROM public.unit_catalog uc
JOIN public.ja_phoneme_units jpu ON uc.symbol = jpu.symbol
WHERE uc.lang = 'ja-JP'
ORDER BY jpu.category, jpu.subcategory, uc.symbol;

COMMENT ON VIEW public.japanese_phonemes_view IS '日语音素视图：用于验证和查询';

-- 验证插入结果
DO $$
DECLARE
  vowel_count INTEGER;
  consonant_count INTEGER;
  special_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO vowel_count FROM public.ja_phoneme_units WHERE category = 'vowel';
  SELECT COUNT(*) INTO consonant_count FROM public.ja_phoneme_units WHERE category = 'consonant';
  SELECT COUNT(*) INTO special_count FROM public.ja_phoneme_units WHERE category = 'special';
  SELECT COUNT(*) INTO total_count FROM public.unit_catalog WHERE lang = 'ja-JP';
  
  RAISE NOTICE '日语音素插入完成:';
  RAISE NOTICE '  元音: % 个', vowel_count;
  RAISE NOTICE '  辅音: % 个', consonant_count;
  RAISE NOTICE '  特殊音: % 个', special_count;
  RAISE NOTICE '  总计: % 个', total_count;
END $$;

