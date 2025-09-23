#!/usr/bin/env node

// 删除小文件音频：默认小于 70KB 的 audio 对象
// 步骤：
// 1) 连接 Postgres 查询 storage.objects 中满足条件的 (bucket_id, name)
// 2) 使用 Supabase Storage API (service_role) 批量删除

const { Client } = require('pg');

function getArg(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
}

function parseSizeToken(text, defaultBytes) {
  if (!text) return defaultBytes;
  const t = String(text).trim().toUpperCase();
  if (t.endsWith('KB') || t.endsWith('K')) return Math.floor(parseFloat(t) * 1024);
  if (t.endsWith('MB') || t.endsWith('M')) return Math.floor(parseFloat(t) * 1024 * 1024);
  if (t.endsWith('GB') || t.endsWith('G')) return Math.floor(parseFloat(t) * 1024 * 1024 * 1024);
  const n = Number(t);
  return Number.isFinite(n) ? Math.floor(n) : defaultBytes;
}

function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(2)} ${units[i]}`;
}

const DSN = getArg('dsn', process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54340/postgres');
const URL = getArg('url', process.env.SUPABASE_URL || 'http://127.0.0.1:54341');
const KEY = getArg('key', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const BUCKET = getArg('bucket', process.env.BUCKET || '');
const DRY = getArg('dry', 'false') === 'true';
const THRESHOLD = parseSizeToken(getArg('threshold', '70K'), 70 * 1024);

async function createSupabase(url, key) {
  if (!key) throw new Error('缺少 service role key。请通过 --key 或 SUPABASE_SERVICE_ROLE_KEY 提供');
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const client = new Client({ connectionString: DSN });
  await client.connect();

  const bucketClause = BUCKET ? 'AND bucket_id = $1' : '';
  const params = BUCKET ? [BUCKET, THRESHOLD] : [THRESHOLD];
  const sql = `
    SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint,0) AS size_bytes
    FROM storage.objects
    WHERE (
      lower(name) ~ '(\\.mp3|\\.wav|\\.webm|\\.ogg|\\.m4a|\\.aac|\\.flac|\\.opus|\\.amr)$'
      OR COALESCE(metadata->>'mimetype','') ILIKE 'audio/%'
    )
    ${bucketClause}
    AND COALESCE((metadata->>'size')::bigint,0) < $${BUCKET ? 2 : 1}
  `;

  const res = await client.query(sql, params);
  await client.end();

  if (res.rows.length === 0) {
    console.log(`未发现小于 ${formatBytes(THRESHOLD)} 的音频文件。`);
    return;
  }

  const byBucket = new Map();
  for (const r of res.rows) {
    const b = r.bucket_id;
    const arr = byBucket.get(b) || [];
    arr.push(r.name);
    byBucket.set(b, arr);
  }

  console.log(`即将删除（阈值 < ${formatBytes(THRESHOLD)}）：总计 ${res.rows.length} 个对象`);
  for (const [b, names] of byBucket) {
    console.log(`- bucket=${b}, count=${names.length}`);
  }

  if (DRY) {
    console.log('\nDRY RUN 模式：未执行实际删除');
    return;
  }

  const supabase = await createSupabase(URL, KEY);
  let deleted = 0;
  const errors = [];

  for (const [bucket, names] of byBucket) {
    // 分批删除，单批 100 个
    for (let i = 0; i < names.length; i += 100) {
      const batch = names.slice(i, i + 100);
      const { data, error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        errors.push({ bucket, error: error.message });
      } else {
        deleted += batch.length;
      }
    }
  }

  console.log(`\n删除完成：成功 ${deleted}，失败 ${errors.length}`);
  if (errors.length > 0) {
    console.log('部分错误（前5条）：');
    errors.slice(0, 5).forEach(e => console.log(`- [${e.bucket}] ${e.error}`));
  }
}

main().catch(err => {
  console.error('删除失败:', err.message);
  process.exit(1);
});


