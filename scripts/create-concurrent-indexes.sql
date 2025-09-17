-- 并发创建索引脚本
-- 此脚本需要在 Supabase 迁移之外手动执行
-- 用于创建外键的覆盖索引，避免锁表

-- 注意：这些命令需要在 psql 或 Supabase SQL 编辑器中直接执行
-- 不要在迁移文件中运行，因为 CREATE INDEX CONCURRENTLY 不能在事务中执行

-- alignment_attempts 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alignment_attempts_pack_id 
ON public.alignment_attempts (pack_id);

-- alignment_packs 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alignment_packs_created_by 
ON public.alignment_packs (created_by);

-- article_batch_items 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_batch_items_batch_id 
ON public.article_batch_items (batch_id);

-- article_batches 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_batches_created_by 
ON public.article_batches (created_by);

-- article_cloze 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_cloze_article_id 
ON public.article_cloze (article_id);

-- article_drafts 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_drafts_created_by 
ON public.article_drafts (created_by);

-- cloze_drafts 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cloze_drafts_created_by 
ON public.cloze_drafts (created_by);

-- profiles 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_invitation_code_id 
ON public.profiles (invitation_code_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_invited_by 
ON public.profiles (invited_by);

-- sessions 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id 
ON public.sessions (user_id);

-- shadowing_drafts 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_drafts_created_by 
ON public.shadowing_drafts (created_by);

-- shadowing_items 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_items_created_by 
ON public.shadowing_items (created_by);

-- shadowing_sessions 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_sessions_item_id 
ON public.shadowing_sessions (item_id);

-- shadowing_subtopics 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_subtopics_created_by 
ON public.shadowing_subtopics (created_by);

-- shadowing_themes 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shadowing_themes_created_by 
ON public.shadowing_themes (created_by);

-- study_cards 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_cards_user_id 
ON public.study_cards (user_id);

-- tts_assets 表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tts_assets_user_id 
ON public.tts_assets (user_id);

-- 添加注释
COMMENT ON INDEX public.idx_alignment_attempts_pack_id IS '优化 alignment_attempts 表 pack_id 外键查询性能';
COMMENT ON INDEX public.idx_alignment_packs_created_by IS '优化 alignment_packs 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_article_batch_items_batch_id IS '优化 article_batch_items 表 batch_id 外键查询性能';
COMMENT ON INDEX public.idx_article_batches_created_by IS '优化 article_batches 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_article_cloze_article_id IS '优化 article_cloze 表 article_id 外键查询性能';
COMMENT ON INDEX public.idx_article_drafts_created_by IS '优化 article_drafts 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_cloze_drafts_created_by IS '优化 cloze_drafts 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_profiles_invitation_code_id IS '优化 profiles 表 invitation_code_id 外键查询性能';
COMMENT ON INDEX public.idx_profiles_invited_by IS '优化 profiles 表 invited_by 外键查询性能';
COMMENT ON INDEX public.idx_sessions_user_id IS '优化 sessions 表 user_id 外键查询性能';
COMMENT ON INDEX public.idx_shadowing_drafts_created_by IS '优化 shadowing_drafts 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_shadowing_items_created_by IS '优化 shadowing_items 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_shadowing_sessions_item_id IS '优化 shadowing_sessions 表 item_id 外键查询性能';
COMMENT ON INDEX public.idx_shadowing_subtopics_created_by IS '优化 shadowing_subtopics 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_shadowing_themes_created_by IS '优化 shadowing_themes 表 created_by 外键查询性能';
COMMENT ON INDEX public.idx_study_cards_user_id IS '优化 study_cards 表 user_id 外键查询性能';
COMMENT ON INDEX public.idx_tts_assets_user_id IS '优化 tts_assets 表 user_id 外键查询性能';
