#!/usr/bin/env node
// 基于迁移文件为缺失核心表补齐：cloze_drafts、cloze_items、default_user_permissions、user_permissions、shadowing_drafts

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function existingTables(supabase) {
  const { data, error } = await supabase.rpc('get_table_list');
  if (error) throw error;
  return new Set((data || []).map((t) => t.table_name));
}

function buildStatements(missing) {
  const stmts = [];

  if (missing.has('cloze_drafts')) {
    // CREATE TABLE
    stmts.push(`CREATE TABLE IF NOT EXISTS public.cloze_drafts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lang text NOT NULL,
  level integer NOT NULL,
  topic text DEFAULT ''::text,
  title text NOT NULL,
  passage text NOT NULL,
  blanks jsonb NOT NULL,
  ai_provider text,
  ai_model text,
  ai_usage jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft'::text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT cloze_drafts_lang_check CHECK ((lang = ANY (ARRAY['en'::text,'ja'::text,'zh'::text]))),
  CONSTRAINT cloze_drafts_level_check CHECK (((level >= 1) AND (level <= 6)))
);`);
    stmts.push(`ALTER TABLE ONLY public.cloze_drafts ADD CONSTRAINT cloze_drafts_pkey PRIMARY KEY (id)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_cloze_drafts_created_by ON public.cloze_drafts USING btree (created_by)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_cloze_drafts_lang_level ON public.cloze_drafts USING btree (lang, level)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_cloze_drafts_status_lang_level ON public.cloze_drafts USING btree (status, lang, level)`);
    stmts.push(`ALTER TABLE ONLY public.cloze_drafts ADD CONSTRAINT cloze_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)`);
    stmts.push(`ALTER TABLE public.cloze_drafts ENABLE ROW LEVEL SECURITY`);
    stmts.push(`CREATE POLICY IF NOT EXISTS "cd_admin" ON public.cloze_drafts TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())`);
  }

  if (missing.has('cloze_items')) {
    stmts.push(`CREATE TABLE IF NOT EXISTS public.cloze_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lang text NOT NULL,
  level integer NOT NULL,
  topic text DEFAULT ''::text,
  title text NOT NULL,
  passage text NOT NULL,
  blanks jsonb NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT cloze_items_lang_check CHECK ((lang = ANY (ARRAY['en'::text,'ja'::text,'zh'::text]))),
  CONSTRAINT cloze_items_level_check CHECK (((level >= 1) AND (level <= 6)))
);`);
    stmts.push(`ALTER TABLE ONLY public.cloze_items ADD CONSTRAINT cloze_items_pkey PRIMARY KEY (id)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_cloze_items_lang_level ON public.cloze_items USING btree (lang, level)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_cloze_items_lang_level_created ON public.cloze_items USING btree (lang, level, created_at DESC)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_cloze_items_lang_level_title ON public.cloze_items USING btree (lang, level, title)`);
    stmts.push(`ALTER TABLE public.cloze_items ENABLE ROW LEVEL SECURITY`);
    stmts.push(`CREATE POLICY IF NOT EXISTS "ci_read" ON public.cloze_items FOR SELECT TO authenticated USING (true)`);
  }

  if (missing.has('default_user_permissions')) {
    stmts.push(`CREATE TABLE IF NOT EXISTS public.default_user_permissions (
  id text DEFAULT 'default'::text NOT NULL,
  can_access_shadowing boolean DEFAULT true NOT NULL,
  can_access_cloze boolean DEFAULT true NOT NULL,
  can_access_alignment boolean DEFAULT true NOT NULL,
  can_access_articles boolean DEFAULT true NOT NULL,
  allowed_languages text[] DEFAULT ARRAY['en'::text,'ja'::text,'zh'::text] NOT NULL,
  allowed_levels integer[] DEFAULT ARRAY[1,2,3,4,5] NOT NULL,
  max_daily_attempts integer DEFAULT 50 NOT NULL,
  ai_enabled boolean DEFAULT false NOT NULL,
  api_keys jsonb DEFAULT '{}'::jsonb,
  model_permissions jsonb DEFAULT '[]'::jsonb,
  custom_restrictions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);`);
    stmts.push(`ALTER TABLE ONLY public.default_user_permissions ADD CONSTRAINT default_user_permissions_pkey PRIMARY KEY (id)`);
    stmts.push(`ALTER TABLE public.default_user_permissions ENABLE ROW LEVEL SECURITY`);
    stmts.push(`CREATE POLICY IF NOT EXISTS "default_user_permissions_admin_all" ON public.default_user_permissions TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())`);
  }

  if (missing.has('user_permissions')) {
    stmts.push(`CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  can_access_shadowing boolean DEFAULT true NOT NULL,
  can_access_cloze boolean DEFAULT true NOT NULL,
  can_access_alignment boolean DEFAULT true NOT NULL,
  can_access_articles boolean DEFAULT true NOT NULL,
  allowed_languages text[] DEFAULT ARRAY['en'::text,'ja'::text,'zh'::text] NOT NULL,
  allowed_levels integer[] DEFAULT ARRAY[1,2,3,4,5] NOT NULL,
  max_daily_attempts integer DEFAULT 50 NOT NULL,
  custom_restrictions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  api_keys jsonb DEFAULT '{}'::jsonb,
  ai_enabled boolean DEFAULT false,
  model_permissions jsonb DEFAULT '[]'::jsonb
);`);
    stmts.push(`ALTER TABLE ONLY public.user_permissions ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id)`);
    stmts.push(`ALTER TABLE ONLY public.user_permissions ADD CONSTRAINT user_permissions_user_id_key UNIQUE (user_id)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions USING btree (user_id)`);
    stmts.push(`ALTER TABLE ONLY public.user_permissions ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`);
    stmts.push(`ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY`);
    stmts.push(`CREATE POLICY IF NOT EXISTS "user_permissions_combined" ON public.user_permissions TO authenticated USING ((public.is_admin()) OR ((auth.uid()) = user_id)) WITH CHECK ((public.is_admin()) OR ((auth.uid()) = user_id))`);
  }

  if (missing.has('shadowing_drafts')) {
    stmts.push(`CREATE TABLE IF NOT EXISTS public.shadowing_drafts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lang text NOT NULL,
  level integer NOT NULL,
  topic text DEFAULT ''::text,
  genre text DEFAULT 'monologue'::text,
  register text DEFAULT 'neutral'::text,
  title text NOT NULL,
  text text NOT NULL,
  notes jsonb DEFAULT '{}'::jsonb,
  ai_provider text,
  ai_model text,
  ai_usage jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft'::text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  translations jsonb DEFAULT '{}'::jsonb,
  trans_updated_at timestamptz,
  source jsonb,
  theme_id uuid,
  subtopic_id uuid,
  CONSTRAINT shadowing_drafts_lang_check CHECK ((lang = ANY (ARRAY['en'::text,'ja'::text,'zh'::text]))),
  CONSTRAINT shadowing_drafts_level_check CHECK (((level >= 1) AND (level <= 6)))
);`);
    stmts.push(`ALTER TABLE ONLY public.shadowing_drafts ADD CONSTRAINT shadowing_drafts_pkey PRIMARY KEY (id)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_created_by ON public.shadowing_drafts USING btree (created_by)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_lang_level ON public.shadowing_drafts USING btree (lang, level)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_status ON public.shadowing_drafts USING btree (status)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_status_lang_level ON public.shadowing_drafts USING btree (status, lang, level)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_subtopic_id ON public.shadowing_drafts USING btree (subtopic_id)`);
    stmts.push(`CREATE INDEX IF NOT EXISTS idx_shadowing_drafts_theme_id ON public.shadowing_drafts USING btree (theme_id)`);
    stmts.push(`ALTER TABLE ONLY public.shadowing_drafts ADD CONSTRAINT shadowing_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)`);
    stmts.push(`ALTER TABLE ONLY public.shadowing_drafts ADD CONSTRAINT shadowing_drafts_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.shadowing_subtopics(id) ON DELETE SET NULL`);
    stmts.push(`ALTER TABLE ONLY public.shadowing_drafts ADD CONSTRAINT shadowing_drafts_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.shadowing_themes(id) ON DELETE SET NULL`);
    stmts.push(`ALTER TABLE public.shadowing_drafts ENABLE ROW LEVEL SECURITY`);
    stmts.push(`CREATE POLICY IF NOT EXISTS "shadowing_drafts_combined" ON public.shadowing_drafts TO authenticated USING ((public.is_admin()) OR (status = 'approved'::text)) WITH CHECK ((public.is_admin()) OR (status = 'approved'::text))`);
  }

  return stmts;
}

async function main() {
  const supabase = getClient();
  const existing = await existingTables(supabase);
  const targets = ['cloze_drafts','cloze_items','default_user_permissions','user_permissions','shadowing_drafts'];
  const missing = new Set(targets.filter((t) => !existing.has(t)));

  if (missing.size === 0) {
    console.log(JSON.stringify({ ok: true, message: '无需创建，目标表已存在' }, null, 2));
    return;
  }

  const stmts = buildStatements(missing);
  let okCount = 0, skipCount = 0, failCount = 0;
  for (const sql of stmts) {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      const msg = error.message || '';
      if (/already exists|does not exist|duplicate key/i.test(msg)) { skipCount++; continue; }
      console.log(JSON.stringify({ ok: false, stage: 'exec', sql, error: msg }, null, 2));
      failCount++;
    } else {
      okCount++;
    }
  }
  console.log(JSON.stringify({ ok: failCount === 0, created: Array.from(missing), stats: { okCount, skipCount, failCount } }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(99); });


