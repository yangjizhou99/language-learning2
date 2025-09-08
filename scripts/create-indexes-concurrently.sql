-- 并发创建索引脚本
-- 用于生产环境，避免长时间锁表
-- 注意：这些命令需要在事务外执行

-- Shadowing 相关索引优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_items_lang_level_created 
ON public.shadowing_items(lang, level, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_items_lang_level_title 
ON public.shadowing_items(lang, level, title);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_attempts_user_lang_created 
ON public.shadowing_attempts(user_id, lang, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_attempts_item_user 
ON public.shadowing_attempts(item_id, user_id);

-- Cloze 相关索引优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cloze_items_lang_level_created 
ON public.cloze_items(lang, level, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cloze_items_lang_level_title 
ON public.cloze_items(lang, level, title);

-- 词汇表索引优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vocab_entries_user_lang 
ON public.vocab_entries(user_id, lang);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vocab_entries_term_lang 
ON public.vocab_entries(term, lang);

-- 全文搜索索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vocab_entries_term_gin 
ON public.vocab_entries USING gin(to_tsvector('simple', term));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_drafts_text_gin 
ON public.article_drafts USING gin(to_tsvector('simple', text));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_items_text_gin 
ON public.shadowing_items USING gin(to_tsvector('simple', text));

-- Alignment 相关索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alignment_packs_lang_status 
ON public.alignment_packs(lang, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alignment_attempts_user_pack 
ON public.alignment_attempts(user_id, pack_id);

-- 会话相关索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_sessions_user_item 
ON public.shadowing_sessions(user_id, item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_sessions_created_at 
ON public.shadowing_sessions(created_at DESC);

-- 文章相关索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_lang_difficulty 
ON public.articles(lang, difficulty);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_drafts_status_created 
ON public.article_drafts(status, created_at DESC);

-- 复合查询优化索引
-- 注意：shadowing_items 和 cloze_items 表没有 status 列，所以移除相关索引
-- 如果需要状态过滤，应该使用对应的 drafts 表

-- 草稿表状态索引（这些表有 status 列）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cloze_drafts_status_lang_level 
ON public.cloze_drafts(status, lang, level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_drafts_status_lang_level 
ON public.shadowing_drafts(status, lang, level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alignment_packs_status_lang 
ON public.alignment_packs(status, lang);

-- 用户相关索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role 
ON public.profiles(role) 
WHERE role = 'admin';

-- 统计查询优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_attempts_stats 
ON public.shadowing_attempts(user_id, lang, level, created_at DESC);

-- 添加部分索引以减少存储空间
-- 注意：移除了使用 NOW() 的索引，因为 NOW() 不是 IMMUTABLE 函数
-- 如果需要时间相关的部分索引，应该使用固定的时间戳

-- 为常用查询模式添加覆盖索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_items_cover 
ON public.shadowing_items(lang, level) 
INCLUDE (id, title, text, audio_url, duration_ms, tokens, cefr);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cloze_items_cover 
ON public.cloze_items(lang, level) 
INCLUDE (id, title, passage, blanks, topic);
