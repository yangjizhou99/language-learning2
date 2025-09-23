#!/usr/bin/env node
// 修复迁移关键列缺失：user_permissions 与 shadowing_items

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

function getClient(db) {
  let url, key;
  if (db === 'prod') {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
    key = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;
  } else {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!url || !key) throw new Error('缺少 Supabase 环境变量');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { db: 'supabase' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--db') opts.db = args[++i] || 'supabase';
  }
  return opts;
}

async function main() {
  const { db } = parseArgs();
  const supabase = getClient(db);

  const statements = [
    // user_permissions
    `ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;`,
    `ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS model_permissions JSONB DEFAULT '[]'::jsonb;`,
    // shadowing_items
    `ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS audio_bucket text;`,
    `ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS audio_path text;`,
  ];

  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log(JSON.stringify({ ok: false, sql, error: error.message }, null, 2));
      process.exit(1);
    }
  }
  console.log(JSON.stringify({ ok: true, fixed: statements.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});


