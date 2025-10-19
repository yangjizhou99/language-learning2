-- =====================================================
-- 训练内容表 (Training Content) - 安全版本
-- 用于存储发音要领、常见错误、练习材料等
-- 使用 SELECT 方式插入，避免 NULL 值问题
-- =====================================================

-- 如果表已存在，先删除
DROP TABLE IF EXISTS public.training_content CASCADE;

CREATE TABLE IF NOT EXISTS public.training_content (
  content_id BIGSERIAL PRIMARY KEY,
  unit_id BIGINT NOT NULL REFERENCES public.unit_catalog(unit_id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  
  -- 发音要领
  articulation_points TEXT,
  common_errors TEXT,
  tips TEXT,
  ipa_symbol TEXT,
  
  -- 练习材料
  practice_words TEXT[],
  practice_phrases TEXT[],
  
  -- 音频资源（后期扩展）
  audio_url TEXT,
  
  -- 元数据
  difficulty INT DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (unit_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_training_content_unit ON public.training_content(unit_id);
CREATE INDEX IF NOT EXISTS idx_training_content_lang ON public.training_content(lang);

COMMENT ON TABLE public.training_content IS '训练内容表：发音要领、常见错误、练习材料';

-- RLS 策略
ALTER TABLE public.training_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_content_select_all" ON public.training_content;
CREATE POLICY "training_content_select_all"
  ON public.training_content FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 插入中文训练内容（使用 SELECT 方式，确保 unit_id 存在）
-- =====================================================

-- 1. zh 系列
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '舌尖上翘，抵住硬腭前部（舌面前部），气流从舌尖和硬腭之间挤出。是不送气的翘舌音。',
  '中国南方学习者：容易发成平舌音 z（舌尖位置不对）；日语学习者：容易发成 chi（送气过强）',
  '先发"z"的舌位，然后舌尖上翘到硬腭。可以想象舌尖要碰到上颚的感觉。',
  'ʈʂ',
  ARRAY['知道', '支持', '智慧', '纸张', '指导', '直接', '职业', '值得', '制度', '治理'],
  ARRAY['他知道这件事', '支持你的决定', '用智慧解决问题', '这张纸很重要'],
  3
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'zhi 1'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 2. chi 系列
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '舌尖上翘，抵住硬腭前部，送气强烈。是送气的翘舌音，气流比 zh 强。',
  '南方学习者：容易发成 c（平舌）；外国学习者：送气不够。',
  '发音时可以在嘴前放一张纸，纸应该明显抖动。比 zh 多一股气。',
  'ʈʂʰ',
  ARRAY['吃饭', '迟到', '翅膀', '尺子', '赤字', '痴呆', '池塘'],
  ARRAY['吃完饭了', '不要迟到', '鸟的翅膀'],
  3
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'chi 1'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 3. shi 系列
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '舌尖上翘接近硬腭，气流从缝隙中持续流出，产生摩擦音。不送气。',
  '南方学习者：容易发成 s（平舌）；日语学习者：容易发成 shi（舌面音）。',
  '发音像"嘘"的声音，但舌头要翘起来。持续时间长。',
  'ʂ',
  ARRAY['是的', '时间', '十个', '事情', '实在', '师傅', '诗歌', '失败'],
  ARRAY['是的没错', '时间到了', '十个苹果', '这件事情'],
  2
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'shi 4'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 4. ji 系列
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '舌面前部抵住或接近硬腭，不送气的舌面塞擦音。',
  '日语学习者：容易发成 chi（舌尖音）；英语学习者：发音位置偏后。',
  '舌头要平，舌面接触硬腭。不是舌尖，是舌面。',
  't͡ɕi',
  ARRAY['机会', '基础', '积极', '几个', '激动', '技术'],
  ARRAY['好机会', '打基础', '很积极', '几个人'],
  2
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'ji 1'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 5. qi 系列
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '舌面前部抵住硬腭，送气强烈的舌面塞擦音。',
  '送气不够强，或者发成 chi（舌尖音）。',
  '要有明显的送气。纸张测试有效。',
  't͡ɕʰi',
  ARRAY['七个', '期待', '起来', '奇怪', '骑马', '企业'],
  ARRAY['七个苹果', '期待明天', '站起来', '很奇怪'],
  2
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'qi 1'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 6. xi 系列
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '舌面前部接近硬腭，气流从缝隙中摩擦而出。清擦音。',
  '容易发成 shi（舌尖音）。舌面要接触硬腭。',
  '发音像"嘻嘻"的笑声。舌面发音，不是舌尖。',
  'ɕi',
  ARRAY['西方', '希望', '习惯', '洗手', '系统', '稀少'],
  ARRAY['在西方', '有希望', '好习惯', '去洗手'],
  2
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'xi 1'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 7. ma1 (第一声)
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '第一声（阴平）：高平调，音高维持在 5 度（最高）。整个音节保持高平。',
  '音高不够高，或者有升降变化。第一声要"又高又平"。',
  '想象唱歌时的最高音，然后保持住不变。可以用"啊——"练习（拉长音）。',
  'ma˥',
  ARRAY['妈妈', '麻烦', '蚂蚁', '抹布'],
  ARRAY['我妈妈', '太麻烦', '蚂蚁很小'],
  2
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'ma 1'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 8. ma2 (第二声)
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '第二声（阳平）：中升调，从 3 度升到 5 度。音高从中等快速上升。',
  '升得不够高，或者起点太低/太高。',
  '像问问题时的"啊？"（疑问语气）。从中音快速往上升。',
  'ma˧˥',
  ARRAY['麻烦', '麻木', '马路', '码头'],
  ARRAY['走在马路上', '在码头'],
  2
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'ma 2'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 9. ma3 (第三声)
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '第三声（上声）：降升调，从 2 度降到 1 度再升到 4 度。音高先降后升。',
  '只降不升，或者降得不够低。',
  '发音像"诶..."（思考犹豫的语气）。要明显地先降下去，再升上来。',
  'ma˨˩˦',
  ARRAY['马上', '买东西', '满意'],
  ARRAY['马上来', '去买东西', '很满意'],
  3
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'ma 3'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 10. ma4 (第四声)
INSERT INTO public.training_content (unit_id, lang, articulation_points, common_errors, tips, ipa_symbol, practice_words, practice_phrases, difficulty)
SELECT 
  uc.unit_id,
  'zh-CN',
  '第四声（去声）：全降调，从 5 度快速降到 1 度。音高从高到低，短促有力。',
  '降得不够快或不够低，听起来无力。',
  '像军队口令"立正！"那样有力。从最高音快速降到最低音。',
  'ma˥˩',
  ARRAY['骂人', '卖东西', '迈步'],
  ARRAY['不要骂人', '卖很多东西', '迈开步子'],
  2
FROM unit_catalog uc
WHERE uc.lang = 'zh-CN' AND uc.symbol = 'ma 4'
ON CONFLICT (unit_id, lang) DO NOTHING;

-- 验证插入数据
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.training_content WHERE lang = 'zh-CN';
  RAISE NOTICE '已插入 % 条中文训练内容', v_count;
END $$;

