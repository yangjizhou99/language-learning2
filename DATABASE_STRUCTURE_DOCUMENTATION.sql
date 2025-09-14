-- ===========================================
-- 数据库结构文档
-- 生成时间: 2025-09-14T09:15:12.719Z
-- ===========================================

-- 这是一个语言学习应用的数据库结构文档
-- 包含用户管理、练习记录、内容管理等功能模块

-- ===========================================
-- 表结构定义
-- ===========================================

-- 表: shadowing_themes
-- 类型: BASE TABLE
create table if not exists public.shadowing_themes (
  id text,
  lang text,
  level integer,
  genre text,
  title text,
  desc text,
  status text,
  created_by text,
  created_at text,
  updated_at text,
  ai_provider text,
  ai_model text,
  ai_usage jsonb,
  title_en text,
  coverage text[]
);

-- 表: shadowing_subtopics
-- 类型: BASE TABLE
create table if not exists public.shadowing_subtopics (
  id text,
  theme_id text,
  lang text,
  level integer,
  genre text,
  title_cn text,
  seed_en text,
  one_line_cn text,
  tags text,
  status text,
  created_by text,
  created_at text,
  updated_at text,
  ai_provider text,
  ai_model text,
  ai_usage jsonb
);

-- 表: article_drafts
-- 类型: BASE TABLE
create table if not exists public.article_drafts (
  id text,
  source text,
  lang text,
  genre text,
  difficulty integer,
  title text,
  text text,
  license text,
  ai_provider text,
  ai_model text,
  ai_params jsonb,
  ai_usage jsonb,
  keys jsonb,
  cloze_short text[],
  cloze_long text[],
  validator_report jsonb,
  status text,
  created_by text,
  created_at text,
  updated_at text,
  published_article_id text,
  ai_answer_provider text,
  ai_answer_model text,
  ai_answer_usage jsonb,
  ai_text_provider text,
  ai_text_model text,
  ai_text_usage jsonb,
  ai_text_suggestion jsonb
);

-- 表: shadowing_items
-- 类型: BASE TABLE
create table if not exists public.shadowing_items (
  id text,
  lang text,
  level integer,
  title text,
  text text,
  audio_url text,
  duration_ms text,
  tokens text,
  cefr text,
  meta jsonb,
  created_at text,
  translations jsonb,
  trans_updated_at text,
  theme_id text,
  subtopic_id text
);

-- 表: shadowing_attempts
-- 类型: BASE TABLE
create table if not exists public.shadowing_attempts (
);

-- 表: alignment_packs
-- 类型: BASE TABLE
create table if not exists public.alignment_packs (
);

-- 表: alignment_attempts
-- 类型: BASE TABLE
create table if not exists public.alignment_attempts (
);

-- 表: cloze_drafts
-- 类型: BASE TABLE
create table if not exists public.cloze_drafts (
  id text,
  lang text,
  level integer,
  topic text,
  title text,
  passage text,
  blanks text[],
  ai_provider text,
  ai_model text,
  ai_usage jsonb,
  status text,
  created_by text,
  created_at text
);

-- 表: cloze_items
-- 类型: BASE TABLE
create table if not exists public.cloze_items (
  id text,
  lang text,
  level integer,
  topic text,
  title text,
  passage text,
  blanks text[],
  meta jsonb,
  created_at text
);

-- 表: cloze_attempts
-- 类型: BASE TABLE
create table if not exists public.cloze_attempts (
  id text,
  user_id text,
  item_id text,
  lang text,
  level integer,
  answers jsonb,
  ai_result jsonb,
  created_at text
);

-- 表: vocab_entries
-- 类型: BASE TABLE
create table if not exists public.vocab_entries (
  id text,
  user_id text,
  term text,
  lang text,
  native_lang text,
  source text,
  source_id text,
  context text,
  tags text[],
  status text,
  explanation jsonb,
  created_at text,
  updated_at text
);

-- 表: shadowing_sessions
-- 类型: BASE TABLE
create table if not exists public.shadowing_sessions (
);

-- 表: user_permissions
-- 类型: BASE TABLE
create table if not exists public.user_permissions (
);

-- 表: voices
-- 类型: BASE TABLE
create table if not exists public.voices (
  id text,
  name text,
  language_code text,
  ssml_gender text,
  natural_sample_rate_hertz integer,
  pricing jsonb,
  characteristics jsonb,
  display_name text,
  category text,
  is_active boolean,
  created_at text,
  updated_at text,
  provider text,
  usecase text
);

-- 表: profiles
-- 类型: BASE TABLE
create table if not exists public.profiles (
  id text,
  username text,
  native_lang text,
  target_langs text[],
  created_at text,
  bio text,
  goals text,
  preferred_tone text,
  domains text[],
  role text
);

-- 表: articles
-- 类型: BASE TABLE
create table if not exists public.articles (
);

-- 表: article_keys
-- 类型: BASE TABLE
create table if not exists public.article_keys (
);

-- 表: article_cloze
-- 类型: BASE TABLE
create table if not exists public.article_cloze (
);

-- 表: study_cards
-- 类型: BASE TABLE
create table if not exists public.study_cards (
  id text,
  user_id text,
  lang text,
  type text,
  value jsonb,
  article_id text,
  created_at text
);

-- 表: article_batches
-- 类型: BASE TABLE
create table if not exists public.article_batches (
  id text,
  name text,
  provider text,
  model text,
  lang text,
  genre text,
  words integer,
  temperature numeric,
  status text,
  totals jsonb,
  created_by text,
  created_at text,
  updated_at text
);

-- 表: article_batch_items
-- 类型: BASE TABLE
create table if not exists public.article_batch_items (
  id text,
  batch_id text,
  topic text,
  difficulty integer,
  status text,
  result_draft_id text,
  error text,
  usage jsonb,
  created_at text,
  updated_at text
);

-- 表: shadowing_drafts
-- 类型: BASE TABLE
create table if not exists public.shadowing_drafts (
  id text,
  lang text,
  level integer,
  topic text,
  genre text,
  register text,
  title text,
  text text,
  notes jsonb,
  ai_provider text,
  ai_model text,
  ai_usage jsonb,
  status text,
  created_by text,
  created_at text,
  translations jsonb,
  trans_updated_at text,
  source text,
  theme_id text,
  subtopic_id text
);

-- ===========================================
-- 数据统计信息
-- ===========================================

-- 表 shadowing_themes 有 15 个列
-- 表 shadowing_subtopics 有 16 个列
-- 表 article_drafts 有 28 个列
-- 表 shadowing_items 有 15 个列
-- 表 shadowing_attempts 有 0 个列
-- 表 alignment_packs 有 0 个列
-- 表 alignment_attempts 有 0 个列
-- 表 cloze_drafts 有 13 个列
-- 表 cloze_items 有 9 个列
-- 表 cloze_attempts 有 8 个列
-- 表 vocab_entries 有 13 个列
-- 表 shadowing_sessions 有 0 个列
-- 表 user_permissions 有 0 个列
-- 表 voices 有 14 个列
-- 表 profiles 有 10 个列
-- 表 articles 有 0 个列
-- 表 article_keys 有 0 个列
-- 表 article_cloze 有 0 个列
-- 表 study_cards 有 7 个列
-- 表 article_batches 有 13 个列
-- 表 article_batch_items 有 10 个列
-- 表 shadowing_drafts 有 20 个列
