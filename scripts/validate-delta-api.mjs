// 验证增量同步接口行为：对比不带 since 与带 since 的请求
import 'dotenv/config';
import fs from 'fs';
import dotenv from 'dotenv';
// 需要环境变量：
// - BASE_URL (默认 http://localhost:3000)
// - NEXT_PUBLIC_SUPABASE_URL
// - NEXT_PUBLIC_SUPABASE_ANON_KEY
// - ADMIN_EMAIL, ADMIN_PASSWORD （必须是 profiles.role='admin' 的账号）

import { createClient } from '@supabase/supabase-js';

// 依次加载本地环境文件（若存在）
for (const p of ['.env.local', '.env.development.local', '.env.development', '.env']) {
  try {
    if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
  } catch {}
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function ensureEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_ANON) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!ADMIN_EMAIL) missing.push('ADMIN_EMAIL');
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    throw new Error(`缺少环境变量: ${missing.join(', ')}`);
  }
}

async function getAdminToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) throw new Error(`登录失败: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error('未获取到 access_token');
  return token;
}

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { ok: res.ok, status: res.status, json, size: Buffer.byteLength(text, 'utf8') };
}

function toArrayResult(j) {
  // 兼容：数组或 { data, pagination }
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.data)) return j.data;
  return [];
}

function maxUpdated(items) {
  let m = null;
  for (const d of items) {
    const t = new Date(d.updated_at || d.created_at || 0).toISOString();
    if (!m || t > m) m = t;
  }
  return m;
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + 'KB';
}

async function testDrafts(token) {
  const status = 'pending';
  const urlFull = `${BASE_URL}/api/admin/drafts/list?status=${encodeURIComponent(status)}&limit=20`;
  const full = await fetchJson(urlFull, token);
  if (!full.ok) throw new Error(`drafts full 请求失败: HTTP ${full.status}`);
  const fullArr = toArrayResult(full.json);
  const since = maxUpdated(fullArr) || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const urlDelta = `${BASE_URL}/api/admin/drafts/list?status=${encodeURIComponent(status)}&since=${encodeURIComponent(since)}`;
  const delta = await fetchJson(urlDelta, token);
  if (!delta.ok) throw new Error(`drafts delta 请求失败: HTTP ${delta.status}`);
  const deltaArr = toArrayResult(delta.json);
  console.log('\n[Drafts]');
  console.log('  full  :', fullArr.length, '|', kb(full.size));
  console.log('  since :', deltaArr.length, '|', kb(delta.size), '| since =', since);
  return {
    fullCount: fullArr.length,
    deltaCount: deltaArr.length,
    fullSize: full.size,
    deltaSize: delta.size,
  };
}

async function testShadowing(token) {
  const lang = 'ja';
  const level = '2';
  const urlFull = `${BASE_URL}/api/shadowing/catalog?lang=${lang}&level=${level}`;
  const full = await fetchJson(urlFull, token);
  if (!full.ok) throw new Error(`shadowing full 请求失败: HTTP ${full.status}`);
  const fullArr = toArrayResult(full.json?.items ?? full.json);
  const since = maxUpdated(fullArr) || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const urlDelta = `${BASE_URL}/api/shadowing/catalog?lang=${lang}&level=${level}&since=${encodeURIComponent(since)}`;
  const delta = await fetchJson(urlDelta, token);
  if (!delta.ok) throw new Error(`shadowing delta 请求失败: HTTP ${delta.status}`);
  const deltaArr = toArrayResult(delta.json?.items ?? delta.json);
  console.log('\n[Shadowing Catalog]');
  console.log('  full  :', fullArr.length, '|', kb(full.size));
  console.log('  since :', deltaArr.length, '|', kb(delta.size), '| since =', since);
  return {
    fullCount: fullArr.length,
    deltaCount: deltaArr.length,
    fullSize: full.size,
    deltaSize: delta.size,
  };
}

async function main() {
  try {
    ensureEnv();
    console.log('BASE_URL =', BASE_URL);
    console.log('SUPABASE_URL =', SUPABASE_URL);
    const token = await getAdminToken();
    console.log('已获取管理员令牌');

    const r1 = await testDrafts(token);
    const r2 = await testShadowing(token);

    console.log('\n=== 结果摘要 ===');
    const ok1 = r1.deltaSize <= r1.fullSize;
    const ok2 = r2.deltaSize <= r2.fullSize;
    console.log(
      `Drafts   : delta(${kb(r1.deltaSize)}) <= full(${kb(r1.fullSize)}) -> ${ok1 ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `Shadowing : delta(${kb(r2.deltaSize)}) <= full(${kb(r2.fullSize)}) -> ${ok2 ? 'PASS' : 'FAIL'}`,
    );
    if (!ok1 || !ok2) process.exitCode = 1;
  } catch (e) {
    console.error('验证失败:', e?.message || e);
    process.exitCode = 1;
  }
}

main();
