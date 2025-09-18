-- 简化的数据库性能优化迁移
-- 分步骤执行，避免事务问题

-- =============================================
-- 步骤 1: 删除未使用的索引（先执行这个）
-- =============================================

-- vocab_entries 表
DROP INDEX IF EXISTS public.idx_vocab_entries_term_gin;

-- article_drafts 表
DROP INDEX IF EXISTS public.idx_article_drafts_text_gin;

-- shadowing_items 表
DROP INDEX IF EXISTS public.idx_shadowing_items_text_gin;
DROP INDEX IF EXISTS public.idx_shadowing_items_trans_updated_at;
DROP INDEX IF EXISTS public.idx_shadowing_items_cover;

-- alignment_packs 表
DROP INDEX IF EXISTS public.idx_alignment_packs_lang_status;

-- cloze_drafts 表
DROP INDEX IF EXISTS public.idx_cloze_drafts_status;

-- shadowing_sessions 表
DROP INDEX IF EXISTS public.idx_shadowing_sessions_created_at;

-- profiles 表
DROP INDEX IF EXISTS public.idx_profiles_role;

-- cloze_items 表
DROP INDEX IF EXISTS public.idx_cloze_items_cover;

-- voices 表
DROP INDEX IF EXISTS public.idx_voices_is_active;
DROP INDEX IF EXISTS public.idx_voices_usecase;
DROP INDEX IF EXISTS public.idx_voices_provider_xunfei;
DROP INDEX IF EXISTS public.idx_voices_is_news_voice;

-- shadowing_drafts 表
DROP INDEX IF EXISTS public.idx_shadowing_drafts_trans_updated_at;
DROP INDEX IF EXISTS public.idx_shadowing_drafts_source;

-- user_permissions 表
DROP INDEX IF EXISTS public.idx_user_permissions_api_keys;
DROP INDEX IF EXISTS public.idx_user_permissions_created_at;
DROP INDEX IF EXISTS public.idx_user_permissions_ai_enabled;
DROP INDEX IF EXISTS public.idx_user_permissions_model_permissions;

-- api_usage_logs 表
DROP INDEX IF EXISTS public.idx_api_usage_logs_user_id;
DROP INDEX IF EXISTS public.idx_api_usage_logs_provider;
DROP INDEX IF EXISTS public.idx_api_usage_logs_user_created;

-- user_api_limits 表
DROP INDEX IF EXISTS public.idx_user_api_limits_enabled;
DROP INDEX IF EXISTS public.idx_user_api_limits_user_id;

-- shadowing_subtopics 表
DROP INDEX IF EXISTS public.idx_shadowing_subtopics_search;

-- invitation_codes 表
DROP INDEX IF EXISTS public.idx_invitation_codes_expires_at;
DROP INDEX IF EXISTS public.idx_invitation_codes_is_active;

-- invitation_uses 表
DROP INDEX IF EXISTS public.idx_invitation_uses_code_id;
DROP INDEX IF EXISTS public.idx_invitation_uses_used_at;

-- registration_config 表
DROP INDEX IF EXISTS public.idx_registration_config_id;
