-- =====================================================
-- AI发音纠正系统 - 英语支持扩展
-- 添加英语(en-US)音素数据和辅助表
-- =====================================================

-- =====================================================
-- 0. 确保发音单元规范表存在
-- =====================================================

CREATE TABLE IF NOT EXISTS public.unit_catalog (
  unit_id BIGSERIAL PRIMARY KEY,
  lang TEXT NOT NULL,
  symbol TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('phoneme', 'syllable', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lang, symbol)
);

COMMENT ON TABLE public.unit_catalog IS '发音单元规范表：存储各语言的音素/音节（统一用带空格格式）';

-- =====================================================
-- 1. 创建英语音素辅助表
-- =====================================================

CREATE TABLE IF NOT EXISTS public.en_phoneme_units (
  symbol TEXT PRIMARY KEY,  -- IPA音素符号，如 "ɪ", "tʃ"
  category TEXT NOT NULL,   -- vowel, diphthong, consonant
  subcategory TEXT,         -- short_vowel, stop, fricative 等
  examples TEXT[],          -- 示例词数组
  description TEXT,         -- 音素描述
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.en_phoneme_units IS '英语音素辅助表：存储英语IPA音素的分类和描述信息';

-- =====================================================
-- 2. 插入英语音素到 unit_catalog
-- =====================================================

-- 元音 (17个)
INSERT INTO public.unit_catalog (lang, symbol, unit_type) VALUES
-- 短元音 (7个)
('en-US', 'ɪ', 'phoneme'),
('en-US', 'ɛ', 'phoneme'),
('en-US', 'æ', 'phoneme'),
('en-US', 'ʌ', 'phoneme'),
('en-US', 'ʊ', 'phoneme'),
('en-US', 'ə', 'phoneme'),
('en-US', 'ɘ', 'phoneme'),  -- schwa变体

-- 长元音 (8个)
('en-US', 'i', 'phoneme'),
('en-US', 'e', 'phoneme'),  -- 长元音 e
('en-US', 'ɑ', 'phoneme'),
('en-US', 'a', 'phoneme'),  -- 如 father 中的 a
('en-US', 'ɔ', 'phoneme'),
('en-US', 'u', 'phoneme'),
('en-US', 'ɚ', 'phoneme'),  -- Azure实际返回的er音素
('en-US', 'ɜ', 'phoneme'),  -- 标准IPA的er音素

-- 双元音 (8个)
('en-US', 'aɪ', 'phoneme'),
('en-US', 'aʊ', 'phoneme'),
('en-US', 'ɔɪ', 'phoneme'),
('en-US', 'eɪ', 'phoneme'),
('en-US', 'oʊ', 'phoneme'),
('en-US', 'ɪə', 'phoneme'),
('en-US', 'ɛə', 'phoneme'),
('en-US', 'ʊə', 'phoneme'),

-- 组合音素 (2个)
('en-US', 'ɪɹ', 'phoneme'),  -- ear音
('en-US', 'ju', 'phoneme'),  -- you音

-- 辅音 (24个)
-- 爆破音 (6个)
('en-US', 'p', 'phoneme'),
('en-US', 'b', 'phoneme'),
('en-US', 't', 'phoneme'),
('en-US', 'd', 'phoneme'),
('en-US', 'k', 'phoneme'),
('en-US', 'g', 'phoneme'),

-- 摩擦音 (9个)
('en-US', 'f', 'phoneme'),
('en-US', 'v', 'phoneme'),
('en-US', 'θ', 'phoneme'),
('en-US', 'ð', 'phoneme'),
('en-US', 's', 'phoneme'),
('en-US', 'z', 'phoneme'),
('en-US', 'ʃ', 'phoneme'),
('en-US', 'ʒ', 'phoneme'),
('en-US', 'h', 'phoneme'),

-- 塞擦音 (2个)
('en-US', 'tʃ', 'phoneme'),
('en-US', 'dʒ', 'phoneme'),

-- 鼻音 (3个)
('en-US', 'm', 'phoneme'),
('en-US', 'n', 'phoneme'),
('en-US', 'ŋ', 'phoneme'),

-- 近音 (4个)
('en-US', 'l', 'phoneme'),
('en-US', 'ɹ', 'phoneme'),  -- Azure实际返回的r音素
('en-US', 'w', 'phoneme'),
('en-US', 'j', 'phoneme')

ON CONFLICT (lang, symbol) DO NOTHING;

-- =====================================================
-- 3. 创建英语音素辅助表
-- =====================================================

CREATE TABLE IF NOT EXISTS public.en_phoneme_units (
  symbol VARCHAR(10) PRIMARY KEY,
  category VARCHAR(20) NOT NULL,
  subcategory VARCHAR(20),
  examples TEXT[],
  description TEXT
);

-- =====================================================
-- 4. 插入英语音素辅助信息
-- =====================================================

INSERT INTO public.en_phoneme_units (symbol, category, subcategory, examples, description) VALUES
-- 短元音
('ɪ', 'vowel', 'short_vowel', ARRAY['bit', 'sit', 'hit'], '短元音，如 bit 中的 i'),
('ɛ', 'vowel', 'short_vowel', ARRAY['bed', 'red', 'get'], '短元音，如 bed 中的 e'),
('æ', 'vowel', 'short_vowel', ARRAY['cat', 'bat', 'hat'], '短元音，如 cat 中的 a'),
('ʌ', 'vowel', 'short_vowel', ARRAY['but', 'cut', 'run'], '短元音，如 but 中的 u'),
('ʊ', 'vowel', 'short_vowel', ARRAY['book', 'look', 'good'], '短元音，如 book 中的 oo'),
('ə', 'vowel', 'short_vowel', ARRAY['about', 'ago', 'the'], '中性元音，如 about 中的 a'),
('ɘ', 'vowel', 'short_vowel', ARRAY['about', 'ago', 'the'], 'schwa变体，如 about 中的 a'),

-- 长元音
('i', 'vowel', 'long_vowel', ARRAY['beat', 'seat', 'heat'], '长元音，如 beat 中的 ea'),
('e', 'vowel', 'long_vowel', ARRAY['bait', 'late', 'make'], '长元音，如 bait 中的 ai'),
('ɑ', 'vowel', 'long_vowel', ARRAY['father', 'calm', 'hot'], '长元音，如 father 中的 a'),
('a', 'vowel', 'long_vowel', ARRAY['father', 'calm', 'hot'], '长元音，如 father 中的 a'),
('ɔ', 'vowel', 'long_vowel', ARRAY['bought', 'caught', 'law'], '长元音，如 bought 中的 ou'),
('u', 'vowel', 'long_vowel', ARRAY['boot', 'food', 'soon'], '长元音，如 boot 中的 oo'),
('ɚ', 'vowel', 'long_vowel', ARRAY['her', 'bird', 'work'], '长元音，如 her 中的 er'),
('ɜ', 'vowel', 'long_vowel', ARRAY['her', 'bird', 'work'], '长元音，如 her 中的 er'),

-- 双元音
('aɪ', 'diphthong', 'diphthong', ARRAY['bite', 'time', 'my'], '双元音，如 bite 中的 i'),
('aʊ', 'diphthong', 'diphthong', ARRAY['bout', 'town', 'how'], '双元音，如 bout 中的 ou'),
('ɔɪ', 'diphthong', 'diphthong', ARRAY['boy', 'toy', 'enjoy'], '双元音，如 boy 中的 oy'),
('eɪ', 'diphthong', 'diphthong', ARRAY['bait', 'late', 'make'], '双元音，如 bait 中的 ai'),
('oʊ', 'diphthong', 'diphthong', ARRAY['boat', 'note', 'go'], '双元音，如 boat 中的 oa'),
('ɪə', 'diphthong', 'diphthong', ARRAY['near', 'hear', 'beer'], '双元音，如 near 中的 ear'),
('ɛə', 'diphthong', 'diphthong', ARRAY['bear', 'care', 'there'], '双元音，如 bear 中的 ear'),
('ʊə', 'diphthong', 'diphthong', ARRAY['poor', 'tour', 'sure'], '双元音，如 poor 中的 oor'),

-- 组合音素
('ɪɹ', 'combination', 'combination', ARRAY['ear', 'hear', 'clear'], '组合音素，如 ear 中的 ear'),
('ju', 'combination', 'combination', ARRAY['you', 'use', 'music'], '组合音素，如 you 中的 yu'),

-- 爆破音
('p', 'consonant', 'stop', ARRAY['pen', 'top', 'stop'], '清音爆破音，如 pen 中的 p'),
('b', 'consonant', 'stop', ARRAY['bed', 'rub', 'about'], '浊音爆破音，如 bed 中的 b'),
('t', 'consonant', 'stop', ARRAY['top', 'get', 'sit'], '清音爆破音，如 top 中的 t'),
('d', 'consonant', 'stop', ARRAY['dog', 'red', 'good'], '浊音爆破音，如 dog 中的 d'),
('k', 'consonant', 'stop', ARRAY['cat', 'back', 'like'], '清音爆破音，如 cat 中的 c'),
('g', 'consonant', 'stop', ARRAY['go', 'big', 'ago'], '浊音爆破音，如 go 中的 g'),

-- 摩擦音
('f', 'consonant', 'fricative', ARRAY['fan', 'off', 'if'], '清音摩擦音，如 fan 中的 f'),
('v', 'consonant', 'fricative', ARRAY['van', 'of', 'give'], '浊音摩擦音，如 van 中的 v'),
('θ', 'consonant', 'fricative', ARRAY['think', 'both', 'with'], '清音摩擦音，如 think 中的 th'),
('ð', 'consonant', 'fricative', ARRAY['this', 'other', 'with'], '浊音摩擦音，如 this 中的 th'),
('s', 'consonant', 'fricative', ARRAY['sun', 'yes', 'pass'], '清音摩擦音，如 sun 中的 s'),
('z', 'consonant', 'fricative', ARRAY['zoo', 'has', 'buzz'], '浊音摩擦音，如 zoo 中的 z'),
('ʃ', 'consonant', 'fricative', ARRAY['shoe', 'wash', 'wish'], '清音摩擦音，如 shoe 中的 sh'),
('ʒ', 'consonant', 'fricative', ARRAY['measure', 'pleasure'], '浊音摩擦音，如 measure 中的 s'),
('h', 'consonant', 'fricative', ARRAY['hat', 'who', 'ahead'], '清音摩擦音，如 hat 中的 h'),

-- 塞擦音
('tʃ', 'consonant', 'affricate', ARRAY['chair', 'watch', 'much'], '清音塞擦音，如 chair 中的 ch'),
('dʒ', 'consonant', 'affricate', ARRAY['jump', 'age', 'judge'], '浊音塞擦音，如 jump 中的 j'),

-- 鼻音
('m', 'consonant', 'nasal', ARRAY['man', 'come', 'him'], '双唇鼻音，如 man 中的 m'),
('n', 'consonant', 'nasal', ARRAY['no', 'sun', 'can'], '齿龈鼻音，如 no 中的 n'),
('ŋ', 'consonant', 'nasal', ARRAY['sing', 'long', 'thing'], '软腭鼻音，如 sing 中的 ng'),

-- 近音
('l', 'consonant', 'approximant', ARRAY['leg', 'ball', 'call'], '齿龈近音，如 leg 中的 l'),
('ɹ', 'consonant', 'approximant', ARRAY['red', 'car', 'more'], '齿龈近音，如 red 中的 r (Azure格式)'),
('r', 'consonant', 'approximant', ARRAY['red', 'car', 'more'], '齿龈近音，如 red 中的 r (标准格式)'),
('w', 'consonant', 'approximant', ARRAY['wet', 'one', 'away'], '双唇近音，如 wet 中的 w'),
('j', 'consonant', 'approximant', ARRAY['yes', 'you', 'use'], '硬腭近音，如 yes 中的 y')

ON CONFLICT (symbol) DO UPDATE SET
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  examples = EXCLUDED.examples,
  description = EXCLUDED.description;

-- =====================================================
-- 4. 创建索引
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_unit_catalog_en_us ON public.unit_catalog(lang) WHERE lang = 'en-US';
CREATE INDEX IF NOT EXISTS idx_en_phoneme_units_category ON public.en_phoneme_units(category);
CREATE INDEX IF NOT EXISTS idx_en_phoneme_units_subcategory ON public.en_phoneme_units(subcategory);

-- =====================================================
-- 5. 验证数据插入
-- =====================================================

-- 检查英语音素数量
DO $$
DECLARE
  phoneme_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO phoneme_count 
  FROM public.unit_catalog 
  WHERE lang = 'en-US' AND unit_type = 'phoneme';
  
  IF phoneme_count != 49 THEN
    RAISE EXCEPTION '英语音素数量不正确: % (期望: 49)', phoneme_count;
  ELSE
    RAISE NOTICE '英语音素插入成功: % 个音素', phoneme_count;
  END IF;
END $$;

-- 检查辅助表数据
DO $$
DECLARE
  aux_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO aux_count 
  FROM public.en_phoneme_units;
  
  IF aux_count != 50 THEN
    RAISE EXCEPTION '英语音素辅助表数据数量不正确: % (期望: 50)', aux_count;
  ELSE
    RAISE NOTICE '英语音素辅助表数据插入成功: % 条记录', aux_count;
  END IF;
END $$;

-- =====================================================
-- 6. 添加注释
-- =====================================================

COMMENT ON TABLE public.en_phoneme_units IS '英语音素辅助表：存储英语IPA音素的分类、示例和描述信息';
COMMENT ON COLUMN public.en_phoneme_units.symbol IS 'IPA音素符号';
COMMENT ON COLUMN public.en_phoneme_units.category IS '音素类别：vowel, diphthong, consonant';
COMMENT ON COLUMN public.en_phoneme_units.subcategory IS '音素子类别：如 short_vowel, stop, fricative 等';
COMMENT ON COLUMN public.en_phoneme_units.examples IS '包含该音素的示例词数组';
COMMENT ON COLUMN public.en_phoneme_units.description IS '音素描述信息';

-- =====================================================
-- 7. 创建视图便于查询
-- =====================================================

CREATE OR REPLACE VIEW public.english_phonemes_view AS
SELECT 
  uc.unit_id,
  uc.symbol,
  epu.category,
  epu.subcategory,
  epu.examples,
  epu.description,
  uc.created_at
FROM public.unit_catalog uc
LEFT JOIN public.en_phoneme_units epu ON uc.symbol = epu.symbol
WHERE uc.lang = 'en-US' AND uc.unit_type = 'phoneme'
ORDER BY 
  CASE epu.category 
    WHEN 'vowel' THEN 1
    WHEN 'diphthong' THEN 2
    WHEN 'consonant' THEN 3
    ELSE 4
  END,
  uc.unit_id;

COMMENT ON VIEW public.english_phonemes_view IS '英语音素视图：合并unit_catalog和en_phoneme_units的完整音素信息';

-- =====================================================
-- 迁移完成提示
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '英语支持扩展迁移完成';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '新增内容:';
  RAISE NOTICE '- 英语音素: 49个 (15元音 + 8双元音 + 2组合音素 + 24辅音)';
  RAISE NOTICE '- 辅助表: en_phoneme_units';
  RAISE NOTICE '- 视图: english_phonemes_view';
  RAISE NOTICE '=====================================================';
END $$;
