-- ===========================================
-- 删除未使用的数据库表迁移
-- 生成时间: 2025-01-27
-- ===========================================
-- 
-- 此迁移删除以下12个表（功能已删除）：
-- 1. article_cloze - 空表结构
-- 2. article_keys - 空表结构  
-- 3. articles - 空表结构
-- 4. registration_config - 有结构但未使用
-- 5. sessions - 有结构但未使用
-- 6. study_cards - 有结构但未使用
-- 7. tts_assets - 有结构但未使用
-- 8. cloze_drafts - cloze题型已删除
-- 9. cloze_items - cloze题型已删除
-- 10. article_drafts - article题库已删除
-- 11. glossary - RAG功能已删除
-- 12. phrases - RAG功能已删除
--
-- 注意：这些表已经过全面检查，确认在应用代码和脚本中都没有被使用
-- ===========================================

-- 删除表之前，先删除相关的RLS策略（如果存在）
DROP POLICY IF EXISTS "article_cloze_combined" ON public.article_cloze;
DROP POLICY IF EXISTS "article_keys_combined" ON public.article_keys;
DROP POLICY IF EXISTS "articles_combined" ON public.articles;
DROP POLICY IF EXISTS "registration_config_combined" ON public.registration_config;
DROP POLICY IF EXISTS "sessions_all_own" ON public.sessions;
DROP POLICY IF EXISTS "study_cards_combined" ON public.study_cards;
DROP POLICY IF EXISTS "tts_assets_all_own" ON public.tts_assets;
DROP POLICY IF EXISTS "cd_admin" ON public.cloze_drafts;
DROP POLICY IF EXISTS "ci_read" ON public.cloze_items;
DROP POLICY IF EXISTS "draft_select" ON public.article_drafts;
DROP POLICY IF EXISTS "draft_write" ON public.article_drafts;
DROP POLICY IF EXISTS "p_glossary_read" ON public.glossary;
DROP POLICY IF EXISTS "p_phrases_read" ON public.phrases;

-- 删除表之前，先删除相关的索引（如果存在）
DROP INDEX IF EXISTS public.idx_article_cloze_article_id;
DROP INDEX IF EXISTS public.idx_article_drafts_created_by;
DROP INDEX IF EXISTS public.idx_sessions_user_id;
DROP INDEX IF EXISTS public.idx_study_cards_user_id;
DROP INDEX IF EXISTS public.idx_tts_assets_user_id;
DROP INDEX IF EXISTS public.idx_cloze_drafts_created_by;
DROP INDEX IF EXISTS public.idx_cloze_drafts_lang_level;
DROP INDEX IF EXISTS public.idx_cloze_drafts_status_lang_level;
DROP INDEX IF EXISTS public.idx_cloze_items_lang_level;
DROP INDEX IF EXISTS public.idx_cloze_items_lang_level_created;
DROP INDEX IF EXISTS public.idx_cloze_items_lang_level_title;

-- 删除表（按依赖关系顺序删除）
-- 1. 删除 article_cloze 表
DROP TABLE IF EXISTS public.article_cloze CASCADE;

-- 2. 删除 article_keys 表
DROP TABLE IF EXISTS public.article_keys CASCADE;

-- 3. 删除 articles 表
DROP TABLE IF EXISTS public.articles CASCADE;

-- 4. 删除 cloze_drafts 表（cloze-shadowing有专门表）
DROP TABLE IF EXISTS public.cloze_drafts CASCADE;

-- 5. 删除 cloze_items 表（cloze-shadowing有专门表）
DROP TABLE IF EXISTS public.cloze_items CASCADE;

-- 6. 删除 article_drafts 表（Article题库界面已删除）
DROP TABLE IF EXISTS public.article_drafts CASCADE;

-- 7. 删除 glossary 表（RAG功能已删除）
DROP TABLE IF EXISTS public.glossary CASCADE;

-- 8. 删除 phrases 表（RAG功能已删除）
DROP TABLE IF EXISTS public.phrases CASCADE;

-- 9. 删除 registration_config 表
DROP TABLE IF EXISTS public.registration_config CASCADE;

-- 10. 删除 sessions 表
DROP TABLE IF EXISTS public.sessions CASCADE;

-- 11. 删除 study_cards 表
DROP TABLE IF EXISTS public.study_cards CASCADE;

-- 12. 删除 tts_assets 表
DROP TABLE IF EXISTS public.tts_assets CASCADE;

-- 添加注释说明删除的表
COMMENT ON SCHEMA public IS '已删除未使用的表: article_cloze, article_keys, articles, registration_config, sessions, study_cards, tts_assets';
