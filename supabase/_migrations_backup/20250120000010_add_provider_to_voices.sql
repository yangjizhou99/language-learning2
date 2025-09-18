-- 为音色表添加provider字段，支持不同TTS提供商
-- 20250120000010_add_provider_to_voices.sql

-- 添加provider字段
alter table public.voices 
add column if not exists provider text default 'google' check (provider in ('google', 'gemini'));

-- 添加provider索引
create index if not exists idx_voices_provider on public.voices(provider);

-- 更新现有音色为google提供商
update public.voices 
set provider = 'google' 
where provider is null;

-- 添加Gemini TTS音色数据
insert into public.voices (
  name, 
  language_code, 
  ssml_gender, 
  natural_sample_rate_hertz, 
  pricing, 
  characteristics, 
  display_name, 
  category, 
  provider,
  is_active
) values 
-- 英语 Gemini TTS 音色
('Kore', 'en-US', 'FEMALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "女性", "tone": "女声", "pitch": "中高音"}', 'Kore (Gemini)', 'Gemini-Female', 'gemini', true),
('Orus', 'en-US', 'MALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "男性", "tone": "男声", "pitch": "中低音"}', 'Orus (Gemini)', 'Gemini-Male', 'gemini', true),
('Callirrhoe', 'en-US', 'FEMALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "女性", "tone": "女声", "pitch": "中高音"}', 'Callirrhoe (Gemini)', 'Gemini-Female', 'gemini', true),
('Puck', 'en-US', 'MALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "男性", "tone": "男声", "pitch": "中低音"}', 'Puck (Gemini)', 'Gemini-Male', 'gemini', true),

-- 中文 Gemini TTS 音色 (使用Chirp3-HD系列)
('cmn-CN-Chirp3-HD-Kore', 'cmn-CN', 'FEMALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "女性", "tone": "女声", "pitch": "中高音"}', 'Kore 中文 (Gemini)', 'Gemini-Female', 'gemini', true),
('cmn-CN-Chirp3-HD-Orus', 'cmn-CN', 'MALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "男性", "tone": "男声", "pitch": "中低音"}', 'Orus 中文 (Gemini)', 'Gemini-Male', 'gemini', true),
('cmn-CN-Chirp3-HD-Callirrhoe', 'cmn-CN', 'FEMALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "女性", "tone": "女声", "pitch": "中高音"}', 'Callirrhoe 中文 (Gemini)', 'Gemini-Female', 'gemini', true),
('cmn-CN-Chirp3-HD-Puck', 'cmn-CN', 'MALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "男性", "tone": "男声", "pitch": "中低音"}', 'Puck 中文 (Gemini)', 'Gemini-Male', 'gemini', true),

-- 日语 Gemini TTS 音色 (使用Neural2系列)
('ja-JP-Neural2-A', 'ja-JP', 'FEMALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "女性", "tone": "女声", "pitch": "中高音"}', 'A 日语 (Gemini)', 'Gemini-Female', 'gemini', true),
('ja-JP-Neural2-B', 'ja-JP', 'MALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "男性", "tone": "男声", "pitch": "中低音"}', 'B 日语 (Gemini)', 'Gemini-Male', 'gemini', true),
('ja-JP-Neural2-C', 'ja-JP', 'FEMALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "女性", "tone": "女声", "pitch": "中高音"}', 'C 日语 (Gemini)', 'Gemini-Female', 'gemini', true),
('ja-JP-Neural2-D', 'ja-JP', 'MALE', 24000, '{"pricePerMillionChars": 20, "examplePrice": "0.0200", "examplePrice10k": "2.00"}', '{"voiceType": "男性", "tone": "男声", "pitch": "中低音"}', 'D 日语 (Gemini)', 'Gemini-Male', 'gemini', true)

on conflict (name) do nothing;

-- 更新音色分类，添加Gemini分类
-- 注意：这里不需要修改现有分类，因为Gemini音色使用新的分类名称
