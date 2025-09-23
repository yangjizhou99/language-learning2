#!/usr/bin/env node

// 统计 storage.objects 中音频文件大小分布：
// - 连接本地 Postgres（默认从 supabase status 的 54340 端口）
// - 通过扩展名或 metadata->>mimetype 匹配音频
// - 计算中位数，并将 [min, max] 等宽分成 5 个区间统计数量和占比
// - 可通过环境变量或参数覆盖连接串与桶过滤

const { Client } = require('pg');

function getArg(name, def) {
  const v = process.argv.find(a => a.startsWith(`--${name}=`));
  return v ? v.split('=')[1] : def;
}

const DSN = getArg('dsn', process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54340/postgres');
const BUCKET = getArg('bucket', process.env.BUCKET || '');

function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  const units = ['B','KB','MB','GB','TB'];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(2)} ${units[i]}`;
}

function median(sorted) {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid];
  return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
}

function buildFiveBins(minV, maxV) {
  if (maxV <= minV) return [minV, minV, minV, minV, minV, maxV];
  const width = (maxV - minV) / 5.0;
  const bins = [minV];
  for (let i = 1; i < 5; i++) bins.push(Math.floor(minV + width * i));
  bins.push(maxV);
  return bins;
}

function countInBins(values, bins) {
  // bins 长度为 6，表示 5 个区间：[b0,b1], (b1,b2], ..., (b4,b5]
  const counts = new Array(5).fill(0);
  for (const v of values) {
    for (let i = 0; i < 5; i++) {
      const left = bins[i];
      const right = bins[i + 1];
      // 左开右闭 except 第一段包含左边界
      const inRange = i === 0 ? (v >= left && v <= right) : (v > left && v <= right);
      if (inRange) { counts[i]++; break; }
      // 处理极端：v 可能略超出 max（防守）
      if (i === 4 && v > right) counts[i]++;
    }
  }
  return counts;
}

async function main() {
  const client = new Client({ connectionString: DSN });
  await client.connect();

  const bucketClause = BUCKET ? 'AND bucket_id = $1' : '';
  const params = BUCKET ? [BUCKET] : [];

  const sql = `
    SELECT
      COALESCE((metadata->>'size')::bigint, 0) AS size_bytes
    FROM storage.objects
    WHERE (
      lower(name) ~ '(\\.mp3|\\.wav|\\.webm|\\.ogg|\\.m4a|\\.aac|\\.flac|\\.opus|\\.amr)$'
      OR COALESCE(metadata->>'mimetype','') ILIKE 'audio/%'
    )
    ${bucketClause}
  `;

  const res = await client.query(sql, params);
  await client.end();

  const sizes = res.rows.map(r => Number(r.size_bytes || 0)).filter(v => Number.isFinite(v) && v >= 0);
  sizes.sort((a, b) => a - b);

  if (sizes.length === 0) {
    console.log('No audio files found.');
    return;
  }

  const minV = sizes[0];
  const maxV = sizes[sizes.length - 1];
  const med = median(sizes);
  const total = sizes.length;
  const sum = sizes.reduce((a, b) => a + b, 0);
  const avg = Math.floor(sum / total);

  const bins = buildFiveBins(minV, maxV);
  const counts = countInBins(sizes, bins);

  console.log('=== Audio Size Distribution (by bytes) ===');
  console.log(`Count: ${total}`);
  console.log(`Total: ${formatBytes(sum)}`);
  console.log(`Min  : ${formatBytes(minV)}`);
  console.log(`Median: ${formatBytes(med)}`);
  console.log(`Avg  : ${formatBytes(avg)}`);
  console.log(`Max  : ${formatBytes(maxV)}`);
  console.log('');

  for (let i = 0; i < 5; i++) {
    const left = bins[i];
    const right = bins[i + 1];
    const label = i === 0
      ? `[${formatBytes(left)}, ${formatBytes(right)}]`
      : `(${formatBytes(left)}, ${formatBytes(right)}]`;
    const c = counts[i];
    const pct = ((c / total) * 100).toFixed(1);
    console.log(`${i + 1}. ${label.padEnd(25)} -> ${String(c).padStart(6)} (${pct}%)`);
  }

  if (BUCKET) console.log(`\nBucket filter: ${BUCKET}`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});


