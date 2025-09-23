#!/usr/bin/env node
// 清空数据库与所有 Supabase 存储桶（仅在结构校验通过时执行）

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

function getClient(db) {
  let url, key;
  if (db === 'prod') {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
    key = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;
  } else {
    // 'supabase' 或 'local' 都用默认
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!url || !key) {
    throw new Error(`缺少环境变量: ${db === 'prod' ? 'NEXT_PUBLIC_SUPABASE_URL_PROD/SUPABASE_SERVICE_ROLE_KEY_PROD' : 'NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY'}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { db: 'supabase', confirm: '', dryRun: false, skipCheck: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--db') opts.db = args[++i] || 'supabase';
    else if (a === '--confirm') opts.confirm = args[++i] || '';
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--skip-check') opts.skipCheck = true;
  }
  return opts;
}

async function getRequiredSchemaStatus(supabase) {
  // 依据迁移文件要求的关键列集合
  const required = {
    user_permissions: ['api_keys', 'ai_enabled', 'model_permissions'],
    shadowing_items: ['audio_bucket', 'audio_path'],
    shadowing_subtopics: ['title', 'one_line', 'seed'],
    vocab_entries: ['srs_due', 'srs_interval', 'srs_ease', 'srs_reps', 'srs_lapses', 'srs_state'],
  };
  const details = [];
  let ok = true;

  for (const [table, cols] of Object.entries(required)) {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name_param: table });
    if (error) {
      ok = false;
      details.push({ table, missing: cols });
      continue;
    }
    const existing = Array.isArray(data) ? data.map((c) => c.column_name) : [];
    const missing = cols.filter((c) => !existing.includes(c));
    if (missing.length) ok = false;
    details.push({ table, missing });
  }
  return { ok, details };
}

async function listAllObjectsPaths(supabase, bucket) {
  const results = [];
  async function walk(prefix = '') {
    const { data: items, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!items || items.length === 0) return;
    for (const it of items) {
      const fullPath = prefix ? `${prefix}/${it.name}` : it.name;
      if (it?.metadata && typeof it.metadata.size === 'number') {
        results.push(fullPath);
      } else {
        await walk(fullPath);
      }
    }
  }
  await walk('');
  return results;
}

async function main() {
  const opts = parseArgs();
  if (opts.confirm !== 'ERASE-ALL') {
    console.log(JSON.stringify({ ok: false, error: '缺少确认口令。请传入 --confirm ERASE-ALL', hint: '可先使用 --dry-run 预览' }, null, 2));
    process.exit(1);
  }

  const supabase = getClient(opts.db);

  // 1) 结构校验（可跳过）
  if (!opts.skipCheck) {
    const schema = await getRequiredSchemaStatus(supabase);
    if (!schema.ok) {
      console.log(JSON.stringify({ ok: false, step: 'schema_check', message: '结构与迁移不一致', details: schema.details }, null, 2));
      process.exit(2);
    }
  }

  // 2) 列出所有表
  const { data: tableList, error: listErr } = await supabase.rpc('get_table_list');
  if (listErr) {
    console.log(JSON.stringify({ ok: false, step: 'list_tables', error: listErr.message }, null, 2));
    process.exit(3);
  }
  const tables = Array.isArray(tableList)
    ? tableList.map((t) => t.table_name || String(t))
    : [];

  // 3) 清空存储桶
  const storage = { buckets: 0, objectsDeleted: 0, previewObjects: 0 };
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) throw bErr;
    storage.buckets = (buckets?.length) || 0;
    for (const b of buckets || []) {
      const paths = await listAllObjectsPaths(supabase, b.name);
      if (opts.dryRun) {
        storage.previewObjects += paths.length;
      } else if (paths.length) {
        const chunkSize = 100;
        for (let i = 0; i < paths.length; i += chunkSize) {
          const chunk = paths.slice(i, i + chunkSize);
          const { error: delErr } = await supabase.storage.from(b.name).remove(chunk);
          if (delErr) throw delErr;
          storage.objectsDeleted += chunk.length;
        }
      }
    }
  } catch (e) {
    console.log(JSON.stringify({ ok: false, step: 'storage_cleanup', error: e instanceof Error ? e.message : String(e) }, null, 2));
    process.exit(4);
  }

  // 4) TRUNCATE 所有表
  const truncateSQL = tables.map((t) => `TRUNCATE TABLE "${t}" CASCADE;`).join('\n');
  if (!opts.dryRun) {
    const { error: execErr } = await supabase.rpc('exec_sql', { sql: truncateSQL });
    if (execErr) {
      console.log(JSON.stringify({ ok: false, step: 'truncate_tables', error: execErr.message }, null, 2));
      process.exit(5);
    }
  }

  const result = {
    ok: true,
    dryRun: opts.dryRun,
    db: opts.db,
    tables: tables.length,
    storage: opts.dryRun
      ? { buckets: storage.buckets, objectsToDelete: storage.previewObjects }
      : { buckets: storage.buckets, objectsDeleted: storage.objectsDeleted },
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(99);
});


