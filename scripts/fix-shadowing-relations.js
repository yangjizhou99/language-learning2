#!/usr/bin/env node
// 补充/确保 shadowing_themes 与 shadowing_subtopics 的 PK/FK，并刷新 PostgREST 缓存

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function execSQL(s, sql) {
  const r = await s.rpc('exec_sql', { sql });
  return { ok: !r.error, error: r.error?.message || null };
}

async function main() {
  const s = getClient();
  const stmts = [
    // PK（若不存在则添加）
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_themes_pkey'
      ) THEN
        ALTER TABLE ONLY public.shadowing_themes
          ADD CONSTRAINT shadowing_themes_pkey PRIMARY KEY (id);
      END IF;
    END$$;`,
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_subtopics_pkey'
      ) THEN
        ALTER TABLE ONLY public.shadowing_subtopics
          ADD CONSTRAINT shadowing_subtopics_pkey PRIMARY KEY (id);
      END IF;
    END$$;`,
    // FK（若不存在则添加）
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_subtopics_theme_id_fkey'
      ) THEN
        ALTER TABLE ONLY public.shadowing_subtopics
          ADD CONSTRAINT shadowing_subtopics_theme_id_fkey
          FOREIGN KEY (theme_id) REFERENCES public.shadowing_themes(id) ON DELETE CASCADE;
      END IF;
    END$$;`,
    // 刷新 PostgREST schema 缓存
    `NOTIFY pgrst, 'reload schema';`,
  ];

  const results = [];
  for (const sql of stmts) {
    // eslint-disable-next-line no-await-in-loop
    const r = await execSQL(s, sql);
    results.push({ sql: sql.slice(0, 80) + (sql.length > 80 ? '...' : ''), ...r });
  }

  // 验证：尝试做一次关系查询（仅取 1 条）
  const verify = await s
    .from('shadowing_themes')
    .select('id, subtopics:shadowing_subtopics(count)')
    .limit(1);

  console.log(
    JSON.stringify(
      {
        steps: results,
        verify: {
          ok: !verify.error,
          error: verify.error?.message || null,
          code: verify.error?.code || null,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


