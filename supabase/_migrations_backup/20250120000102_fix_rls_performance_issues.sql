-- 修复 RLS 性能问题
-- 20250120000102_fix_rls_performance_issues.sql

-- 1. 修复 RLS 初始化计划问题 - 将 auth.uid() 替换为 (select auth.uid())
-- 这样可以避免每行都重新评估 auth.uid() 函数

-- 修复 profiles 表策略
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- 修复 sessions 表策略
DROP POLICY IF EXISTS sessions_all_own ON public.sessions;
CREATE POLICY sessions_all_own ON public.sessions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 修复 tts_assets 表策略
DROP POLICY IF EXISTS tts_assets_all_own ON public.tts_assets;
CREATE POLICY tts_assets_all_own ON public.tts_assets
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 修复 shadowing_attempts 表策略
DROP POLICY IF EXISTS sa_owner_rw ON public.shadowing_attempts;
CREATE POLICY sa_owner_rw ON public.shadowing_attempts
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 修复 shadowing_items 表策略
DROP POLICY IF EXISTS si_insert ON public.shadowing_items;
CREATE POLICY si_insert ON public.shadowing_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS si_update ON public.shadowing_items;
CREATE POLICY si_update ON public.shadowing_items
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS si_delete ON public.shadowing_items;
CREATE POLICY si_delete ON public.shadowing_items
  FOR DELETE TO authenticated
  USING (true);

-- 修复 alignment_attempts 表策略
DROP POLICY IF EXISTS aa_owner_rw ON public.alignment_attempts;
CREATE POLICY aa_owner_rw ON public.alignment_attempts
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 修复 cloze_attempts 表策略
DROP POLICY IF EXISTS ca_owner_rw ON public.cloze_attempts;
CREATE POLICY ca_owner_rw ON public.cloze_attempts
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 修复 vocab_entries 表策略
DROP POLICY IF EXISTS "Users can view own vocab entries" ON public.vocab_entries;
CREATE POLICY "Users can view own vocab entries" ON public.vocab_entries
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own vocab entries" ON public.vocab_entries;
CREATE POLICY "Users can insert own vocab entries" ON public.vocab_entries
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own vocab entries" ON public.vocab_entries;
CREATE POLICY "Users can update own vocab entries" ON public.vocab_entries
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own vocab entries" ON public.vocab_entries;
CREATE POLICY "Users can delete own vocab entries" ON public.vocab_entries
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- 修复 shadowing_sessions 表策略
DROP POLICY IF EXISTS ss_owner_select ON public.shadowing_sessions;
CREATE POLICY ss_owner_select ON public.shadowing_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS ss_owner_ins ON public.shadowing_sessions;
CREATE POLICY ss_owner_ins ON public.shadowing_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS ss_owner_upd ON public.shadowing_sessions;
CREATE POLICY ss_owner_upd ON public.shadowing_sessions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS ss_owner_del ON public.shadowing_sessions;
CREATE POLICY ss_owner_del ON public.shadowing_sessions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- 删除重复的策略（保留一个更通用的策略）
DROP POLICY IF EXISTS "Users can view their own shadowing sessions" ON public.shadowing_sessions;
DROP POLICY IF EXISTS "Users can insert their own shadowing sessions" ON public.shadowing_sessions;
DROP POLICY IF EXISTS "Users can update their own shadowing sessions" ON public.shadowing_sessions;
DROP POLICY IF EXISTS "Users can delete their own shadowing sessions" ON public.shadowing_sessions;

-- 修复 shadowing_themes 表策略
DROP POLICY IF EXISTS p_shadowing_themes_rw ON public.shadowing_themes;
CREATE POLICY p_shadowing_themes_rw ON public.shadowing_themes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 修复 shadowing_subtopics 表策略
DROP POLICY IF EXISTS p_shadowing_subtopics_rw ON public.shadowing_subtopics;
CREATE POLICY p_shadowing_subtopics_rw ON public.shadowing_subtopics
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 修复 user_permissions 表策略
DROP POLICY IF EXISTS user_permissions_own_read ON public.user_permissions;
CREATE POLICY user_permissions_own_read ON public.user_permissions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage user permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage user permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- 修复 api_usage_logs 表策略
DROP POLICY IF EXISTS "Admins can view all api usage logs" ON public.api_usage_logs;
CREATE POLICY "Admins can view all api usage logs" ON public.api_usage_logs
  FOR SELECT TO authenticated
  USING ((select public.is_admin()));

DROP POLICY IF EXISTS "Users can view own api usage logs" ON public.api_usage_logs;
CREATE POLICY "Users can view own api usage logs" ON public.api_usage_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can insert api usage logs" ON public.api_usage_logs;
CREATE POLICY "Service role can insert api usage logs" ON public.api_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 删除重复的策略
DROP POLICY IF EXISTS "Users can view own usage logs" ON public.api_usage_logs;
DROP POLICY IF EXISTS "System can insert usage logs" ON public.api_usage_logs;

-- 修复 user_api_limits 表策略
DROP POLICY IF EXISTS "Admins can manage user api limits" ON public.user_api_limits;
CREATE POLICY "Admins can manage user api limits" ON public.user_api_limits
  FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Users can view own limits" ON public.user_api_limits;
CREATE POLICY "Users can view own limits" ON public.user_api_limits
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- 修复 api_limits 表策略
DROP POLICY IF EXISTS "Admins can manage api limits" ON public.api_limits;
CREATE POLICY "Admins can manage api limits" ON public.api_limits
  FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));

-- 修复 invitation_codes 表策略
DROP POLICY IF EXISTS invitation_codes_creator_select ON public.invitation_codes;
CREATE POLICY invitation_codes_creator_select ON public.invitation_codes
  FOR SELECT TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS invitation_codes_creator_insert ON public.invitation_codes;
CREATE POLICY invitation_codes_creator_insert ON public.invitation_codes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- 修复 invitation_uses 表策略
DROP POLICY IF EXISTS invitation_uses_user_select ON public.invitation_uses;
CREATE POLICY invitation_uses_user_select ON public.invitation_uses
  FOR SELECT TO authenticated
  USING (used_by = (select auth.uid()));

-- 修复 study_cards 表策略
DROP POLICY IF EXISTS study_cards_owner_rw ON public.study_cards;
CREATE POLICY study_cards_owner_rw ON public.study_cards
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS study_cards_admin_all ON public.study_cards;
CREATE POLICY study_cards_admin_all ON public.study_cards
  FOR ALL TO authenticated
  USING ((select public.is_admin()))
  WITH CHECK ((select public.is_admin()));
