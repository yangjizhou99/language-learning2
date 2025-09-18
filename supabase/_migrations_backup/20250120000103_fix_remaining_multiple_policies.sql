-- 修复剩余的多重宽松策略问题
-- 20250120000103_fix_remaining_multiple_policies.sql

-- 1. 修复 alignment_packs 表策略
-- 合并 ap_admin 和 ap_read 策略
DROP POLICY IF EXISTS ap_admin ON public.alignment_packs;
DROP POLICY IF EXISTS ap_read ON public.alignment_packs;
CREATE POLICY alignment_packs_combined ON public.alignment_packs
  FOR SELECT TO authenticated
  USING (true);

-- 2. 修复 api_usage_logs 表策略
-- 合并管理员和用户查看策略
DROP POLICY IF EXISTS "Admins can view all api usage logs" ON public.api_usage_logs;
DROP POLICY IF EXISTS "Users can view own api usage logs" ON public.api_usage_logs;
CREATE POLICY api_usage_logs_combined_select ON public.api_usage_logs
  FOR SELECT TO authenticated
  USING ((select public.is_admin()) OR ((select auth.uid()) = user_id));

-- 3. 修复 article_batch_items 表策略
-- 合并 batch_item_select 和 batch_item_write 策略
DROP POLICY IF EXISTS batch_item_select ON public.article_batch_items;
DROP POLICY IF EXISTS batch_item_write ON public.article_batch_items;
CREATE POLICY article_batch_items_combined ON public.article_batch_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. 修复 article_batches 表策略
-- 合并 batch_select 和 batch_write 策略
DROP POLICY IF EXISTS batch_select ON public.article_batches;
DROP POLICY IF EXISTS batch_write ON public.article_batches;
CREATE POLICY article_batches_combined ON public.article_batches
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. 修复 article_cloze 表策略
-- 合并 cloze_select 和 cloze_write 策略
DROP POLICY IF EXISTS cloze_select ON public.article_cloze;
DROP POLICY IF EXISTS cloze_write ON public.article_cloze;
CREATE POLICY article_cloze_combined ON public.article_cloze
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. 修复 article_drafts 表策略
-- 合并 draft_select 和 draft_write 策略
DROP POLICY IF EXISTS draft_select ON public.article_drafts;
DROP POLICY IF EXISTS draft_write ON public.article_drafts;
CREATE POLICY article_drafts_combined ON public.article_drafts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. 修复 article_keys 表策略
-- 合并 keys_select 和 keys_write 策略
DROP POLICY IF EXISTS keys_select ON public.article_keys;
DROP POLICY IF EXISTS keys_write ON public.article_keys;
CREATE POLICY article_keys_combined ON public.article_keys
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. 修复 articles 表策略
-- 合并 art_select 和 art_write 策略
DROP POLICY IF EXISTS art_select ON public.articles;
DROP POLICY IF EXISTS art_write ON public.articles;
CREATE POLICY articles_combined ON public.articles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 9. 修复 invitation_codes 表策略
-- 合并管理员和创建者策略
DROP POLICY IF EXISTS invitation_codes_admin_insert ON public.invitation_codes;
DROP POLICY IF EXISTS invitation_codes_creator_insert ON public.invitation_codes;
CREATE POLICY invitation_codes_combined_insert ON public.invitation_codes
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_admin()) OR (created_by = (select auth.uid())));

DROP POLICY IF EXISTS invitation_codes_admin_select ON public.invitation_codes;
DROP POLICY IF EXISTS invitation_codes_creator_select ON public.invitation_codes;
CREATE POLICY invitation_codes_combined_select ON public.invitation_codes
  FOR SELECT TO authenticated
  USING ((select public.is_admin()) OR (created_by = (select auth.uid())));

-- 10. 修复 invitation_uses 表策略
-- 合并管理员和用户查看策略
DROP POLICY IF EXISTS invitation_uses_admin_select ON public.invitation_uses;
DROP POLICY IF EXISTS invitation_uses_user_select ON public.invitation_uses;
CREATE POLICY invitation_uses_combined_select ON public.invitation_uses
  FOR SELECT TO authenticated
  USING ((select public.is_admin()) OR (used_by = (select auth.uid())));

-- 11. 修复 registration_config 表策略
-- 合并管理员和通用查看策略
DROP POLICY IF EXISTS registration_config_admin_all ON public.registration_config;
DROP POLICY IF EXISTS registration_config_select_all ON public.registration_config;
CREATE POLICY registration_config_combined ON public.registration_config
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 12. 修复 shadowing_drafts 表策略
-- 合并管理员和用户查看策略
DROP POLICY IF EXISTS sd_admin_all ON public.shadowing_drafts;
DROP POLICY IF EXISTS sd_user_read_approved ON public.shadowing_drafts;
CREATE POLICY shadowing_drafts_combined ON public.shadowing_drafts
  FOR ALL TO authenticated
  USING ((select public.is_admin()) OR (status = 'approved'))
  WITH CHECK ((select public.is_admin()) OR (status = 'approved'));

-- 13. 修复 study_cards 表策略
-- 合并管理员和用户策略
DROP POLICY IF EXISTS study_cards_admin_all ON public.study_cards;
DROP POLICY IF EXISTS study_cards_owner_rw ON public.study_cards;
CREATE POLICY study_cards_combined ON public.study_cards
  FOR ALL TO authenticated
  USING ((select public.is_admin()) OR ((select auth.uid()) = user_id))
  WITH CHECK ((select public.is_admin()) OR ((select auth.uid()) = user_id));

-- 14. 修复 user_api_limits 表策略
-- 合并管理员和用户查看策略
DROP POLICY IF EXISTS "Admins can manage user api limits" ON public.user_api_limits;
DROP POLICY IF EXISTS "Users can view own limits" ON public.user_api_limits;
CREATE POLICY user_api_limits_combined ON public.user_api_limits
  FOR ALL TO authenticated
  USING ((select public.is_admin()) OR ((select auth.uid()) = user_id))
  WITH CHECK ((select public.is_admin()) OR ((select auth.uid()) = user_id));

-- 15. 修复 user_permissions 表策略
-- 合并所有策略
DROP POLICY IF EXISTS "Admins can manage user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS user_permissions_admin_all ON public.user_permissions;
DROP POLICY IF EXISTS user_permissions_own_read ON public.user_permissions;
CREATE POLICY user_permissions_combined ON public.user_permissions
  FOR ALL TO authenticated
  USING ((select public.is_admin()) OR ((select auth.uid()) = user_id))
  WITH CHECK ((select public.is_admin()) OR ((select auth.uid()) = user_id));
