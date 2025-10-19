-- =====================================================
-- AI发音纠正系统 - 核心数据表 V2
-- 统一格式：拼音使用带空格格式（如 "guo 2"）
-- =====================================================

-- =====================================================
-- 清理旧数据（如果存在）
-- =====================================================

DROP TABLE IF EXISTS public.user_sentence_progress CASCADE;
DROP TABLE IF EXISTS public.user_unit_stats CASCADE;
DROP TABLE IF EXISTS public.user_pron_attempts CASCADE;
DROP TABLE IF EXISTS public.sentence_units CASCADE;
DROP TABLE IF EXISTS public.pron_sentences CASCADE;
DROP TABLE IF EXISTS public.unit_alias CASCADE;
DROP TABLE IF EXISTS public.zh_pinyin_units CASCADE;
DROP TABLE IF EXISTS public.unit_catalog CASCADE;

-- 删除 Storage 策略
DROP POLICY IF EXISTS "pronunciation_audio_select_own" ON storage.objects;
DROP POLICY IF EXISTS "pronunciation_audio_insert_service" ON storage.objects;

-- =====================================================
-- 1. 发音单元规范表（Unit Catalog）
-- =====================================================

CREATE TABLE public.unit_catalog (
  unit_id BIGSERIAL PRIMARY KEY,
  lang TEXT NOT NULL,
  symbol TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('phoneme', 'syllable', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lang, symbol)
);

CREATE INDEX idx_unit_catalog_lang ON public.unit_catalog(lang);
CREATE INDEX idx_unit_catalog_symbol ON public.unit_catalog(symbol);

COMMENT ON TABLE public.unit_catalog IS '发音单元规范表：存储各语言的音素/音节（统一用带空格格式）';

-- =====================================================
-- 2. 中文拼音辅助表（声母、韵母、声调）
-- =====================================================

CREATE TABLE public.zh_pinyin_units (
  symbol TEXT PRIMARY KEY,  -- 带空格格式，如 "guo 2"
  shengmu TEXT,
  yunmu TEXT,
  tone INT CHECK (tone BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.zh_pinyin_units IS '中文拼音辅助表：声母、韵母、声调';

-- =====================================================
-- 3. 音素别名映射表（仅用于真正的别名，如 lü ↔ lv）
-- =====================================================

CREATE TABLE public.unit_alias (
  lang TEXT NOT NULL,
  alias TEXT NOT NULL,
  unit_id BIGINT NOT NULL REFERENCES public.unit_catalog(unit_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lang, alias)
);

CREATE INDEX idx_unit_alias_unit_id ON public.unit_alias(unit_id);

COMMENT ON TABLE public.unit_alias IS '音素别名映射表：仅用于真正的别名（如 lü ↔ lv）';

-- =====================================================
-- 4. 评测句子库
-- =====================================================

CREATE TABLE public.pron_sentences (
  sentence_id BIGSERIAL PRIMARY KEY,
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  level INT DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  domain_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pron_sentences_lang ON public.pron_sentences(lang);
CREATE INDEX idx_pron_sentences_level ON public.pron_sentences(level);

COMMENT ON TABLE public.pron_sentences IS '评测句子库';

-- =====================================================
-- 5. 句子与Unit关联表（自动生成）
-- =====================================================

CREATE TABLE public.sentence_units (
  sentence_id BIGINT NOT NULL REFERENCES public.pron_sentences(sentence_id) ON DELETE CASCADE,
  unit_id BIGINT NOT NULL REFERENCES public.unit_catalog(unit_id) ON DELETE CASCADE,
  count INT DEFAULT 1,
  PRIMARY KEY (sentence_id, unit_id)
);

CREATE INDEX idx_sentence_units_sentence ON public.sentence_units(sentence_id);
CREATE INDEX idx_sentence_units_unit ON public.sentence_units(unit_id);

COMMENT ON TABLE public.sentence_units IS '句子包含的Unit及出现次数（自动生成）';

-- =====================================================
-- 6. 用户评测记录
-- =====================================================

CREATE TABLE public.user_pron_attempts (
  attempt_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  sentence_id BIGINT REFERENCES public.pron_sentences(sentence_id) ON DELETE SET NULL,
  azure_raw_json JSONB,
  accuracy NUMERIC(5,2),
  fluency NUMERIC(5,2),
  completeness NUMERIC(5,2),
  prosody NUMERIC(5,2),
  pron_score NUMERIC(5,2),
  valid_flag BOOLEAN DEFAULT TRUE,
  audio_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_pron_attempts_user ON public.user_pron_attempts(user_id);
CREATE INDEX idx_user_pron_attempts_sentence ON public.user_pron_attempts(sentence_id);
CREATE INDEX idx_user_pron_attempts_user_sentence ON public.user_pron_attempts(user_id, sentence_id);
CREATE INDEX idx_user_pron_attempts_created ON public.user_pron_attempts(created_at);

COMMENT ON TABLE public.user_pron_attempts IS '用户评测记录';

-- =====================================================
-- 7. 用户Unit统计（Welford在线统计）
-- =====================================================

CREATE TABLE public.user_unit_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  unit_id BIGINT NOT NULL REFERENCES public.unit_catalog(unit_id) ON DELETE CASCADE,
  n INT DEFAULT 0,
  mean NUMERIC(5,2) DEFAULT 0,
  m2 NUMERIC(12,4) DEFAULT 0,
  ci_low NUMERIC(5,2),
  ci_high NUMERIC(5,2),
  difficulty NUMERIC(5,2),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, lang, unit_id)
);

CREATE INDEX idx_user_unit_stats_user_lang ON public.user_unit_stats(user_id, lang);
CREATE INDEX idx_user_unit_stats_mean ON public.user_unit_stats(mean);

COMMENT ON TABLE public.user_unit_stats IS '用户Unit统计（Welford在线统计）';

-- =====================================================
-- 8. 用户句子进度（新增使用）
-- =====================================================

CREATE TABLE public.user_sentence_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentence_id BIGINT NOT NULL REFERENCES public.pron_sentences(sentence_id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  attempts_count INT DEFAULT 0,
  best_score NUMERIC(5,2),
  latest_score NUMERIC(5,2),
  first_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, sentence_id)
);

CREATE INDEX idx_user_sentence_progress_user ON public.user_sentence_progress(user_id);
CREATE INDEX idx_user_sentence_progress_status ON public.user_sentence_progress(status);
CREATE INDEX idx_user_sentence_progress_user_status ON public.user_sentence_progress(user_id, status);

COMMENT ON TABLE public.user_sentence_progress IS '用户句子练习进度';

-- =====================================================
-- RLS 策略
-- =====================================================

ALTER TABLE public.unit_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zh_pinyin_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pron_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentence_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pron_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unit_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sentence_progress ENABLE ROW LEVEL SECURITY;

-- 公共资源：所有人可读
CREATE POLICY "unit_catalog_read" ON public.unit_catalog FOR SELECT USING (true);
CREATE POLICY "zh_pinyin_units_read" ON public.zh_pinyin_units FOR SELECT USING (true);
CREATE POLICY "unit_alias_read" ON public.unit_alias FOR SELECT USING (true);
CREATE POLICY "pron_sentences_read" ON public.pron_sentences FOR SELECT USING (true);
CREATE POLICY "sentence_units_read" ON public.sentence_units FOR SELECT USING (true);

-- 用户私有数据
CREATE POLICY "user_pron_attempts_own" ON public.user_pron_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_unit_stats_own" ON public.user_unit_stats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_sentence_progress_own" ON public.user_sentence_progress FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 中文拼音音节种子数据（带空格格式）
-- =====================================================

-- 插入拼音辅助数据
INSERT INTO public.zh_pinyin_units (symbol, shengmu, yunmu, tone) VALUES
-- 零声母
('a 1','','a',1),('a 2','','a',2),('a 3','','a',3),('a 4','','a',4),
('ai 1','','ai',1),('ai 2','','ai',2),('ai 3','','ai',3),('ai 4','','ai',4),
('an 1','','an',1),('an 2','','an',2),('an 3','','an',3),('an 4','','an',4),
('ang 1','','ang',1),('ang 2','','ang',2),('ang 3','','ang',3),('ang 4','','ang',4),
('ao 1','','ao',1),('ao 2','','ao',2),('ao 3','','ao',3),('ao 4','','ao',4),
('e 1','','e',1),('e 2','','e',2),('e 3','','e',3),('e 4','','e',4),('e 5','','e',5),
('ei 1','','ei',1),('ei 3','','ei',3),('ei 4','','ei',4),
('en 1','','en',1),('en 2','','en',2),('en 4','','en',4),
('er 2','','er',2),('er 3','','er',3),('er 4','','er',4),
('ou 1','','ou',1),('ou 3','','ou',3),('ou 4','','ou',4),
-- b组
('ba 1','b','a',1),('ba 2','b','a',2),('ba 3','b','a',3),('ba 4','b','a',4),('ba 5','b','a',5),
('bai 1','b','ai',1),('bai 2','b','ai',2),('bai 3','b','ai',3),('bai 4','b','ai',4),
('ban 1','b','an',1),('ban 2','b','an',2),('ban 3','b','an',3),('ban 4','b','an',4),
('bang 1','b','ang',1),('bang 2','b','ang',2),('bang 3','b','ang',3),('bang 4','b','ang',4),
('bao 1','b','ao',1),('bao 2','b','ao',2),('bao 3','b','ao',3),('bao 4','b','ao',4),
('bei 1','b','ei',1),('bei 2','b','ei',2),('bei 3','b','ei',3),('bei 4','b','ei',4),
('ben 1','b','en',1),('ben 2','b','en',2),('ben 3','b','en',3),('ben 4','b','en',4),
('beng 1','b','eng',1),('beng 2','b','eng',2),('beng 3','b','eng',3),('beng 4','b','eng',4),
('bi 1','b','i',1),('bi 2','b','i',2),('bi 3','b','i',3),('bi 4','b','i',4),
('bian 1','b','ian',1),('bian 2','b','ian',2),('bian 3','b','ian',3),('bian 4','b','ian',4),
('biao 1','b','iao',1),('biao 2','b','iao',2),('biao 3','b','iao',3),('biao 4','b','iao',4),
('bie 1','b','ie',1),('bie 2','b','ie',2),('bie 3','b','ie',3),('bie 4','b','ie',4),
('bin 1','b','in',1),('bin 2','b','in',2),('bin 3','b','in',3),('bin 4','b','in',4),
('bing 1','b','ing',1),('bing 2','b','ing',2),('bing 3','b','ing',3),('bing 4','b','ing',4),
('bo 1','b','o',1),('bo 2','b','o',2),('bo 3','b','o',3),('bo 4','b','o',4),('bo 5','b','o',5),
('bu 1','b','u',1),('bu 2','b','u',2),('bu 3','b','u',3),('bu 4','b','u',4),('bu 5','b','u',5);

-- 将拼音音节导入 unit_catalog
INSERT INTO public.unit_catalog (lang, symbol, unit_type)
SELECT 'zh-CN', symbol, 'syllable'
FROM public.zh_pinyin_units;

-- 继续插入其他常用拼音（简化版，实际应包含完整400+音节）
INSERT INTO public.zh_pinyin_units (symbol, shengmu, yunmu, tone) VALUES
-- p组
('pa 1','p','a',1),('pa 2','p','a',2),('pa 3','p','a',3),('pa 4','p','a',4),
('pai 1','p','ai',1),('pai 2','p','ai',2),('pai 3','p','ai',3),('pai 4','p','ai',4),
('pan 1','p','an',1),('pan 2','p','an',2),('pan 3','p','an',3),('pan 4','p','an',4),
('pang 1','p','ang',1),('pang 2','p','ang',2),('pang 3','p','ang',3),('pang 4','p','ang',4),
('pao 1','p','ao',1),('pao 2','p','ao',2),('pao 3','p','ao',3),('pao 4','p','ao',4),
('pei 1','p','ei',1),('pei 2','p','ei',2),('pei 3','p','ei',3),('pei 4','p','ei',4),
('pen 1','p','en',1),('pen 2','p','en',2),('pen 3','p','en',3),('pen 4','p','en',4),
('peng 1','p','eng',1),('peng 2','p','eng',2),('peng 3','p','eng',3),('peng 4','p','eng',4),
('pi 1','p','i',1),('pi 2','p','i',2),('pi 3','p','i',3),('pi 4','p','i',4),
('pian 1','p','ian',1),('pian 2','p','ian',2),('pian 3','p','ian',3),('pian 4','p','ian',4),
('piao 1','p','iao',1),('piao 2','p','iao',2),('piao 3','p','iao',3),('piao 4','p','iao',4),
('pie 1','p','ie',1),('pie 3','p','ie',3),('pie 4','p','ie',4),
('pin 1','p','in',1),('pin 2','p','in',2),('pin 3','p','in',3),('pin 4','p','in',4),
('ping 1','p','ing',1),('ping 2','p','ing',2),('ping 3','p','ing',3),('ping 4','p','ing',4),
('po 1','p','o',1),('po 2','p','o',2),('po 3','p','o',3),('po 4','p','o',4),
('pou 1','p','ou',1),('pou 2','p','ou',2),('pou 3','p','ou',3),
('pu 1','p','u',1),('pu 2','p','u',2),('pu 3','p','u',3),('pu 4','p','u',4),
-- m组
('ma 1','m','a',1),('ma 2','m','a',2),('ma 3','m','a',3),('ma 4','m','a',4),('ma 5','m','a',5),
('mai 1','m','ai',1),('mai 2','m','ai',2),('mai 3','m','ai',3),('mai 4','m','ai',4),
('man 1','m','an',1),('man 2','m','an',2),('man 3','m','an',3),('man 4','m','an',4),
('mang 1','m','ang',1),('mang 2','m','ang',2),('mang 3','m','ang',3),
('mao 1','m','ao',1),('mao 2','m','ao',2),('mao 3','m','ao',3),('mao 4','m','ao',4),
('me 1','m','e',1),('me 2','m','e',2),('me 5','m','e',5),
('mei 1','m','ei',1),('mei 2','m','ei',2),('mei 3','m','ei',3),('mei 4','m','ei',4),
('men 1','m','en',1),('men 2','m','en',2),('men 3','m','en',3),('men 4','m','en',4),('men 5','m','en',5),
('meng 1','m','eng',1),('meng 2','m','eng',2),('meng 3','m','eng',3),('meng 4','m','eng',4),
('mi 1','m','i',1),('mi 2','m','i',2),('mi 3','m','i',3),('mi 4','m','i',4),
('mian 1','m','ian',1),('mian 2','m','ian',2),('mian 3','m','ian',3),('mian 4','m','ian',4),
('miao 1','m','iao',1),('miao 2','m','iao',2),('miao 3','m','iao',3),('miao 4','m','iao',4),
('mie 1','m','ie',1),('mie 4','m','ie',4),
('min 1','m','in',1),('min 2','m','in',2),('min 3','m','in',3),('min 4','m','in',4),
('ming 1','m','ing',1),('ming 2','m','ing',2),('ming 3','m','ing',3),('ming 4','m','ing',4),
('mo 1','m','o',1),('mo 2','m','o',2),('mo 3','m','o',3),('mo 4','m','o',4),('mo 5','m','o',5),
('mou 1','m','ou',1),('mou 2','m','ou',2),('mou 3','m','ou',3),('mou 4','m','ou',4),
('mu 1','m','u',1),('mu 2','m','u',2),('mu 3','m','u',3),('mu 4','m','u',4),
-- f组
('fa 1','f','a',1),('fa 2','f','a',2),('fa 3','f','a',3),('fa 4','f','a',4),
('fan 1','f','an',1),('fan 2','f','an',2),('fan 3','f','an',3),('fan 4','f','an',4),
('fang 1','f','ang',1),('fang 2','f','ang',2),('fang 3','f','ang',3),('fang 4','f','ang',4),
('fei 1','f','ei',1),('fei 2','f','ei',2),('fei 3','f','ei',3),('fei 4','f','ei',4),
('fen 1','f','en',1),('fen 2','f','en',2),('fen 3','f','en',3),('fen 4','f','en',4),
('feng 1','f','eng',1),('feng 2','f','eng',2),('feng 3','f','eng',3),('feng 4','f','eng',4),
('fo 1','f','o',1),('fo 2','f','o',2),
('fou 1','f','ou',1),('fou 2','f','ou',2),('fou 3','f','ou',3),
('fu 1','f','u',1),('fu 2','f','u',2),('fu 3','f','u',3),('fu 4','f','u',4),
-- d,t,n,l 组（简化，实际应包含完整集合）
('da 1','d','a',1),('da 2','d','a',2),('da 3','d','a',3),('da 4','d','a',4),
('de 1','d','e',1),('de 2','d','e',2),('de 3','d','e',3),('de 5','d','e',5),
('di 1','d','i',1),('di 2','d','i',2),('di 3','d','i',3),('di 4','d','i',4),
('dian 1','d','ian',1),('dian 2','d','ian',2),('dian 3','d','ian',3),('dian 4','d','ian',4),
('dong 1','d','ong',1),('dong 3','d','ong',3),('dong 4','d','ong',4),
('du 1','d','u',1),('du 2','d','u',2),('du 3','d','u',3),('du 4','d','u',4),
('dui 1','d','ui',1),('dui 3','d','ui',3),('dui 4','d','ui',4),
('duo 1','d','uo',1),('duo 2','d','uo',2),('duo 3','d','uo',3),('duo 4','d','uo',4),
('ta 1','t','a',1),('ta 2','t','a',2),('ta 3','t','a',3),('ta 4','t','a',4),
('tai 1','t','ai',1),('tai 2','t','ai',2),('tai 3','t','ai',3),('tai 4','t','ai',4),
('tian 1','t','ian',1),('tian 2','t','ian',2),('tian 3','t','ian',3),('tian 4','t','ian',4),
('ting 1','t','ing',1),('ting 2','t','ing',2),('ting 3','t','ing',3),('ting 4','t','ing',4),
('tong 1','t','ong',1),('tong 2','t','ong',2),('tong 3','t','ong',3),('tong 4','t','ong',4),
('na 1','n','a',1),('na 2','n','a',2),('na 3','n','a',3),('na 4','n','a',4),('na 5','n','a',5),
('nai 1','n','ai',1),('nai 2','n','ai',2),('nai 3','n','ai',3),('nai 4','n','ai',4),
('nan 1','n','an',1),('nan 2','n','an',2),('nan 3','n','an',3),('nan 4','n','an',4),
('neng 2','n','eng',2),('neng 4','n','eng',4),
('ni 1','n','i',1),('ni 2','n','i',2),('ni 3','n','i',3),('ni 4','n','i',4),
('nian 1','n','ian',1),('nian 2','n','ian',2),('nian 3','n','ian',3),('nian 4','n','ian',4),
('niao 1','n','iao',1),('niao 2','n','iao',2),('niao 3','n','iao',3),('niao 4','n','iao',4),
('nin 2','n','in',2),
('ning 1','n','ing',1),('ning 2','n','ing',2),('ning 3','n','ing',3),('ning 4','n','ing',4),
('niu 1','n','iu',1),('niu 2','n','iu',2),('niu 3','n','iu',3),('niu 4','n','iu',4),
('nong 1','n','ong',1),('nong 2','n','ong',2),('nong 3','n','ong',3),('nong 4','n','ong',4),
('nu 1','n','u',1),('nu 2','n','u',2),('nu 3','n','u',3),('nu 4','n','u',4),
('nuan 1','n','uan',1),('nuan 3','n','uan',3),
('nv 3','n','v',3),('nv 4','n','v',4),
('la 1','l','a',1),('la 2','l','a',2),('la 3','l','a',3),('la 4','l','a',4),('la 5','l','a',5),
('lai 1','l','ai',1),('lai 2','l','ai',2),('lai 3','l','ai',3),('lai 4','l','ai',4),
('lan 1','l','an',1),('lan 2','l','an',2),('lan 3','l','an',3),('lan 4','l','an',4),
('lang 1','l','ang',1),('lang 2','l','ang',2),('lang 3','l','ang',3),('lang 4','l','ang',4),
('lao 1','l','ao',1),('lao 2','l','ao',2),('lao 3','l','ao',3),('lao 4','l','ao',4),
('le 1','l','e',1),('le 4','l','e',4),('le 5','l','e',5),
('lei 1','l','ei',1),('lei 2','l','ei',2),('lei 3','l','ei',3),('lei 4','l','ei',4),
('leng 1','l','eng',1),('leng 2','l','eng',2),('leng 3','l','eng',3),('leng 4','l','eng',4),
('li 1','l','i',1),('li 2','l','i',2),('li 3','l','i',3),('li 4','l','i',4),
('lian 1','l','ian',1),('lian 2','l','ian',2),('lian 3','l','ian',3),('lian 4','l','ian',4),
('liang 1','l','iang',1),('liang 2','l','iang',2),('liang 3','l','iang',3),('liang 4','l','iang',4),
('liao 1','l','iao',1),('liao 2','l','iao',2),('liao 3','l','iao',3),('liao 4','l','iao',4),
('lie 1','l','ie',1),('lie 3','l','ie',3),('lie 4','l','ie',4),
('lin 1','l','in',1),('lin 2','l','in',2),('lin 3','l','in',3),('lin 4','l','in',4),
('ling 1','l','ing',1),('ling 2','l','ing',2),('ling 3','l','ing',3),('ling 4','l','ing',4),
('liu 1','l','iu',1),('liu 2','l','iu',2),('liu 3','l','iu',3),('liu 4','l','iu',4),
('long 1','l','ong',1),('long 2','l','ong',2),('long 3','l','ong',3),('long 4','l','ong',4),
('lou 1','l','ou',1),('lou 2','l','ou',2),('lou 3','l','ou',3),('lou 4','l','ou',4),
('lu 1','l','u',1),('lu 2','l','u',2),('lu 3','l','u',3),('lu 4','l','u',4),
('luan 1','l','uan',1),('luan 2','l','uan',2),('luan 3','l','uan',3),('luan 4','l','uan',4),
('lun 1','l','un',1),('lun 2','l','un',2),('lun 3','l','un',3),('lun 4','l','un',4),
('luo 1','l','uo',1),('luo 2','l','uo',2),('luo 3','l','uo',3),('luo 4','l','uo',4),
('lv 1','l','v',1),('lv 2','l','v',2),('lv 3','l','v',3),('lv 4','l','v',4);

-- 将这批也导入 unit_catalog
INSERT INTO public.unit_catalog (lang, symbol, unit_type)
SELECT 'zh-CN', symbol, 'syllable'
FROM public.zh_pinyin_units
WHERE symbol NOT IN (SELECT symbol FROM public.unit_catalog WHERE lang='zh-CN')
ON CONFLICT (lang, symbol) DO NOTHING;

-- 注意：这里只展示部分拼音，完整版应包含所有400+音节
-- 如需完整版本，请参考《汉语拼音方案》或使用 pypinyin 生成

-- =====================================================
-- 示例评测句子（25句）
-- =====================================================

INSERT INTO public.pron_sentences (lang, text, level, domain_tags) VALUES
('zh-CN', '你好世界', 1, '{"greeting"}'),
('zh-CN', '今天天气很好', 1, '{"daily","weather"}'),
('zh-CN', '我喜欢学习中文', 1, '{"learning"}'),
('zh-CN', '这是一本书', 1, '{"object"}'),
('zh-CN', '你叫什么名字', 1, '{"greeting"}'),
('zh-CN', '我来自中国北京', 2, '{"location"}'),
('zh-CN', '昨天我去了超市', 2, '{"daily"}'),
('zh-CN', '春天的花开得很美', 2, '{"nature"}'),
('zh-CN', '他每天早上跑步', 2, '{"exercise"}'),
('zh-CN', '我们一起吃晚饭吧', 2, '{"food"}'),
('zh-CN', '图书馆在学校的东边', 3, '{"location"}'),
('zh-CN', '这个问题比较复杂', 3, '{"discussion"}'),
('zh-CN', '经济发展非常迅速', 3, '{"business"}'),
('zh-CN', '环境保护很重要', 3, '{"environment"}'),
('zh-CN', '科技改变了我们的生活', 3, '{"technology"}'),
('zh-CN', '中国历史悠久文化灿烂', 4, '{"culture"}'),
('zh-CN', '教育是国家发展的基础', 4, '{"education"}'),
('zh-CN', '人工智能正在改变世界', 4, '{"technology"}'),
('zh-CN', '全球化带来了机遇和挑战', 4, '{"economics"}'),
('zh-CN', '可持续发展是长期目标', 4, '{"environment"}'),
('zh-CN', '哲学思考帮助我们理解世界', 5, '{"philosophy"}'),
('zh-CN', '艺术创作需要灵感和技巧', 5, '{"art"}'),
('zh-CN', '科学研究推动社会进步', 5, '{"science"}'),
('zh-CN', '国际合作促进和平发展', 5, '{"international"}'),
('zh-CN', '创新是民族进步的灵魂', 5, '{"innovation"}');

-- =====================================================
-- 自动生成 sentence_units（使用简化规则）
-- =====================================================

-- 函数：从句子文本提取拼音（简化版，基于常用字映射）
-- 注意：这是临时方案，生产环境应使用 pypinyin 或完整 G2P
CREATE OR REPLACE FUNCTION generate_sentence_units_simple()
RETURNS void AS $$
DECLARE
  sentence_rec RECORD;
  char_mappings JSONB;
BEGIN
  -- 常用字的拼音映射（简化版）
  char_mappings := '{
    "你": "ni 3", "好": "hao 3", "世": "shi 4", "界": "jie 4",
    "今": "jin 1", "天": "tian 1", "气": "qi 4", "很": "hen 3",
    "我": "wo 3", "喜": "xi 3", "欢": "huan 1", "学": "xue 2", "习": "xi 2", "中": "zhong 1", "文": "wen 2",
    "这": "zhe 4", "是": "shi 4", "一": "yi 1", "本": "ben 3", "书": "shu 1",
    "叫": "jiao 4", "什": "shen 2", "么": "me 5", "名": "ming 2", "字": "zi 4",
    "来": "lai 2", "自": "zi 4", "国": "guo 2", "北": "bei 3", "京": "jing 1",
    "昨": "zuo 2", "去": "qu 4", "了": "le 5", "超": "chao 1", "市": "shi 4",
    "春": "chun 1", "的": "de 5", "花": "hua 1", "开": "kai 1", "得": "de 5", "美": "mei 3",
    "他": "ta 1", "每": "mei 3", "早": "zao 3", "上": "shang 5", "跑": "pao 3", "步": "bu 4",
    "们": "men 5", "起": "qi 3", "吃": "chi 1", "晚": "wan 3", "饭": "fan 4", "吧": "ba 5",
    "图": "tu 2", "馆": "guan 3", "在": "zai 4", "校": "xiao 4", "东": "dong 1", "边": "bian 1",
    "个": "ge 4", "问": "wen 4", "题": "ti 2", "比": "bi 3", "较": "jiao 4", "复": "fu 4", "杂": "za 2",
    "经": "jing 1", "济": "ji 4", "发": "fa 1", "展": "zhan 3", "非": "fei 1", "常": "chang 2", "迅": "xun 4", "速": "su 4",
    "环": "huan 2", "境": "jing 4", "保": "bao 3", "护": "hu 4", "重": "zhong 4", "要": "yao 4",
    "科": "ke 1", "技": "ji 4", "改": "gai 3", "变": "bian 4", "生": "sheng 1", "活": "huo 2",
    "历": "li 4", "史": "shi 3", "悠": "you 1", "久": "jiu 3", "化": "hua 4", "灿": "can 4", "烂": "lan 4",
    "教": "jiao 4", "育": "yu 4", "家": "jia 1", "基": "ji 1", "础": "chu 3",
    "人": "ren 2", "工": "gong 1", "智": "zhi 4", "能": "neng 2", "正": "zheng 4", "改": "gai 3",
    "全": "quan 2", "球": "qiu 2", "带": "dai 4", "机": "ji 1", "遇": "yu 4", "和": "he 2", "挑": "tiao 3", "战": "zhan 4",
    "可": "ke 3", "持": "chi 2", "续": "xu 4", "长": "chang 2", "期": "qi 1", "目": "mu 4", "标": "biao 1",
    "哲": "zhe 2", "思": "si 1", "考": "kao 3", "帮": "bang 1", "助": "zhu 4", "理": "li 3", "解": "jie 3",
    "艺": "yi 4", "术": "shu 4", "创": "chuang 4", "作": "zuo 4", "需": "xu 1", "灵": "ling 2", "感": "gan 3", "技": "ji 4", "巧": "qiao 3",
    "研": "yan 2", "究": "jiu 1", "推": "tui 1", "动": "dong 4", "社": "she 4", "会": "hui 4", "进": "jin 4",
    "际": "ji 4", "合": "he 2", "促": "cu 4", "和": "he 2", "平": "ping 2",
    "新": "xin 1", "民": "min 2", "族": "zu 2", "魂": "hun 2"
  }'::JSONB;
  
  -- 遍历所有句子
  FOR sentence_rec IN 
    SELECT sentence_id, text FROM public.pron_sentences WHERE lang = 'zh-CN'
  LOOP
    -- 遍历句子中的每个字
    FOR i IN 1..LENGTH(sentence_rec.text) LOOP
      DECLARE
        char TEXT := SUBSTRING(sentence_rec.text FROM i FOR 1);
        pinyin TEXT;
        unit_rec RECORD;
      BEGIN
        -- 查找拼音
        pinyin := char_mappings->>char;
        
        IF pinyin IS NOT NULL THEN
          -- 查找或创建 Unit
          SELECT unit_id INTO unit_rec
          FROM public.unit_catalog
          WHERE lang = 'zh-CN' AND symbol = pinyin;
          
          IF FOUND THEN
            -- 插入或更新关联
            INSERT INTO public.sentence_units (sentence_id, unit_id, count)
            VALUES (sentence_rec.sentence_id, unit_rec.unit_id, 1)
            ON CONFLICT (sentence_id, unit_id)
            DO UPDATE SET count = sentence_units.count + 1;
          END IF;
        END IF;
      END;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 执行生成
SELECT generate_sentence_units_simple();

-- 删除临时函数
DROP FUNCTION generate_sentence_units_simple();

-- =====================================================
-- 触发器：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_pron_sentences
BEFORE UPDATE ON public.pron_sentences
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- =====================================================
-- Storage Bucket 和 RLS 策略
-- =====================================================

-- 创建 bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('pronunciation-audio', 'pronunciation-audio', false)
ON CONFLICT (id) DO NOTHING;

-- 用户只能读取自己前缀的音频
CREATE POLICY "pronunciation_audio_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pronunciation-audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- service role 可以插入
CREATE POLICY "pronunciation_audio_insert_service"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'pronunciation-audio');

-- =====================================================
-- 验证数据
-- =====================================================

DO $$
DECLARE
  unit_count INT;
  sentence_count INT;
  su_count INT;
BEGIN
  SELECT COUNT(*) INTO unit_count FROM public.unit_catalog WHERE lang='zh-CN';
  SELECT COUNT(*) INTO sentence_count FROM public.pron_sentences WHERE lang='zh-CN';
  SELECT COUNT(*) INTO su_count FROM public.sentence_units;
  
  RAISE NOTICE '✅ 数据统计：';
  RAISE NOTICE '   - unit_catalog (zh-CN): % 条', unit_count;
  RAISE NOTICE '   - pron_sentences (zh-CN): % 条', sentence_count;
  RAISE NOTICE '   - sentence_units: % 条关联', su_count;
  
  IF unit_count < 100 THEN
    RAISE WARNING '⚠️ 拼音音节数量较少，建议扩展';
  END IF;
  
  IF su_count = 0 THEN
    RAISE WARNING '⚠️ sentence_units 为空，智能推荐未激活';
  END IF;
END $$;

