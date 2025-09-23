#!/usr/bin/env node
// 对齐所有 RLS 策略（兼容写法）：
// - 先 ENABLE ROW LEVEL SECURITY
// - 再用 DO $$ ... IF NOT EXISTS (pg_policies) THEN CREATE POLICY ... END $$

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// 定义策略（源自 migrations/20250918041810_remote_public_schema.sql）
const policies = [
  { table: 'api_limits', name: 'Admins can manage api limits', to: 'authenticated', using: 'public.is_admin()', check: 'public.is_admin()' },
  { table: 'api_usage_logs', name: 'Service role can insert api usage logs', action: 'INSERT', to: 'authenticated', check: 'true' },

  { table: 'vocab_entries', name: 'Users can delete own vocab entries', action: 'DELETE', to: 'authenticated', using: '(auth.uid() = user_id)' },
  { table: 'vocab_entries', name: 'Users can insert own vocab entries', action: 'INSERT', to: 'authenticated', check: '(auth.uid() = user_id)' },
  { table: 'vocab_entries', name: 'Users can update own vocab entries', action: 'UPDATE', to: 'authenticated', using: '(auth.uid() = user_id)', check: '(auth.uid() = user_id)' },
  { table: 'vocab_entries', name: 'Users can view own vocab entries', action: 'SELECT', to: 'authenticated', using: '(auth.uid() = user_id)' },

  { table: 'alignment_attempts', name: 'aa_owner_rw', to: 'authenticated', using: '(auth.uid() = user_id)', check: '(auth.uid() = user_id)' },
  { table: 'alignment_packs', name: 'alignment_packs_combined', action: 'SELECT', to: 'authenticated', using: 'true' },
  { table: 'api_usage_logs', name: 'api_usage_logs_combined_select', action: 'SELECT', to: 'authenticated', using: '(public.is_admin() OR (auth.uid() = user_id))' },

  { table: 'article_batch_items', name: 'article_batch_items_combined', to: 'authenticated', using: 'true', check: 'true' },
  { table: 'article_batches', name: 'article_batches_combined', to: 'authenticated', using: 'true', check: 'true' },
  { table: 'article_cloze', name: 'article_cloze_combined', to: 'authenticated', using: 'true', check: 'true' },
  { table: 'article_drafts', name: 'article_drafts_combined', to: 'authenticated', using: 'true', check: 'true' },
  { table: 'article_keys', name: 'article_keys_combined', to: 'authenticated', using: 'true', check: 'true' },
  { table: 'articles', name: 'articles_combined', to: 'authenticated', using: 'true', check: 'true' },

  { table: 'cloze_attempts', name: 'ca_owner_rw', to: 'authenticated', using: '(auth.uid() = user_id)', check: '(auth.uid() = user_id)' },
  { table: 'cloze_drafts', name: 'cd_admin', to: 'authenticated', using: 'public.is_admin()', check: 'public.is_admin()' },
  { table: 'cloze_items', name: 'ci_read', action: 'SELECT', to: 'authenticated', using: 'true' },

  { table: 'default_user_permissions', name: 'default_user_permissions_admin_all', to: 'authenticated', using: 'public.is_admin()', check: 'public.is_admin()' },

  { table: 'glossary', name: 'p_glossary_read', action: 'SELECT', to: 'authenticated', using: 'true' },
  { table: 'phrases', name: 'p_phrases_read', action: 'SELECT', to: 'authenticated', using: 'true' },
  { table: 'shadowing_subtopics', name: 'p_shadowing_subtopics_rw', to: 'authenticated', using: 'true', check: 'true' },
  { table: 'shadowing_themes', name: 'p_shadowing_themes_rw', to: 'authenticated', using: 'true', check: 'true' },

  { table: 'invitation_codes', name: 'invitation_codes_admin_delete', action: 'DELETE', to: 'authenticated', using: 'public.is_admin()' },
  { table: 'invitation_codes', name: 'invitation_codes_admin_update', action: 'UPDATE', to: 'authenticated', using: 'public.is_admin()', check: 'public.is_admin()' },
  { table: 'invitation_codes', name: 'invitation_codes_combined_insert', action: 'INSERT', to: 'authenticated', check: '(public.is_admin() OR (created_by = auth.uid()))' },
  { table: 'invitation_codes', name: 'invitation_codes_combined_select', action: 'SELECT', to: 'authenticated', using: '(public.is_admin() OR (created_by = auth.uid()))' },
  { table: 'invitation_uses', name: 'invitation_uses_combined_select', action: 'SELECT', to: 'authenticated', using: '(public.is_admin() OR (used_by = auth.uid()))' },
  { table: 'invitation_uses', name: 'invitation_uses_insert', action: 'INSERT', to: 'authenticated', check: 'true' },

  { table: 'profiles', name: 'profiles_insert_own', action: 'INSERT', to: 'authenticated', check: '(auth.uid() = id)' },
  { table: 'profiles', name: 'profiles_select_own', action: 'SELECT', to: 'authenticated', using: '(auth.uid() = id)' },
  { table: 'profiles', name: 'profiles_update_own', action: 'UPDATE', to: 'authenticated', using: '(auth.uid() = id)', check: '(auth.uid() = id)' },

  { table: 'registration_config', name: 'registration_config_combined', to: 'authenticated', using: 'true', check: 'true' },

  { table: 'shadowing_attempts', name: 'sa_owner_rw', to: 'authenticated', using: '(auth.uid() = user_id)', check: '(auth.uid() = user_id)' },
  { table: 'sessions', name: 'sessions_all_own', to: 'authenticated', using: '(auth.uid() = user_id)', check: '(auth.uid() = user_id)' },
  { table: 'shadowing_drafts', name: 'shadowing_drafts_combined', to: 'authenticated', using: "(public.is_admin() OR (status = ''approved''::text))", check: "(public.is_admin() OR (status = ''approved''::text))" },

  { table: 'shadowing_items', name: 'si_delete', action: 'DELETE', to: 'authenticated', using: 'true' },
  { table: 'shadowing_items', name: 'si_insert', action: 'INSERT', to: 'authenticated', check: 'true' },
  { table: 'shadowing_items', name: 'si_read', action: 'SELECT', to: 'authenticated', using: 'true' },
  { table: 'shadowing_items', name: 'si_update', action: 'UPDATE', to: 'authenticated', using: 'true', check: 'true' },

  { table: 'study_cards', name: 'study_cards_combined', to: 'authenticated', using: '(public.is_admin() OR (auth.uid() = user_id))', check: '(public.is_admin() OR (auth.uid() = user_id))' },
  { table: 'tts_assets', name: 'tts_assets_all_own', to: 'authenticated', using: '(auth.uid() = user_id)', check: '(auth.uid() = user_id)' },
  { table: 'user_api_limits', name: 'user_api_limits_combined', to: 'authenticated', using: '(public.is_admin() OR (auth.uid() = user_id))', check: '(public.is_admin() OR (auth.uid() = user_id))' },
  { table: 'user_permissions', name: 'user_permissions_combined', to: 'authenticated', using: '(public.is_admin() OR (auth.uid() = user_id))', check: '(public.is_admin() OR (auth.uid() = user_id))' },
  { table: 'voices', name: 'voices_select_all', action: 'SELECT', to: 'public', using: '(is_active = true)' },
];

// 需要确保启用 RLS 的表集合（去重）
const tablesNeedingRLS = Array.from(new Set(policies.map((p) => p.table)));

function buildEnableRls(table) {
  return `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`;
}

function buildCreatePolicy(p) {
  const action = p.action ? ` FOR ${p.action}` : '';
  const toRole = p.to ? ` TO ${p.to}` : ' TO authenticated';
  const usingExpr = p.using ? ` USING (${p.using})` : '';
  const checkExpr = p.check ? ` WITH CHECK (${p.check})` : '';
  return `CREATE POLICY "${p.name}" ON public.${p.table}${action}${toRole}${usingExpr}${checkExpr};`;
}

async function main() {
  const s = getClient();
  let enableOk = 0, enableFail = 0;
  for (const t of tablesNeedingRLS) {
    const { error } = await s.rpc('exec_sql', { sql: buildEnableRls(t) });
    if (error) enableFail++; else enableOk++;
  }

  let ok = 0, skipped = 0; const failures = [];
  for (const p of policies) {
    const sql = buildCreatePolicy(p);
    const { error } = await s.rpc('exec_sql', { sql });
    if (error) {
      const msg = error.message || '';
      if (/already exists/i.test(msg)) { skipped++; continue; }
      failures.push({ policy: p.name, table: p.table, error: msg });
    } else { ok++; }
  }

  console.log(JSON.stringify({
    rlsEnabled: { tables: tablesNeedingRLS.length, ok: enableOk, fail: enableFail },
    policies: { total: policies.length, created: ok, skipped, failures }
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(99); });


