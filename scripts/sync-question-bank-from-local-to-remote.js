#!/usr/bin/env node
// 将本地题库/跟读核心数据同步到云端（Supabase/Prod）
// 依赖环境变量：
//  - LOCAL_DB_URL 或 LOCAL_DB_URL_FORCE（优先）
//  - PROD_DB_URL 或 DATABASE_URL（目标）
// 注意：本脚本仅同步无用户依赖的题库相关表，避免 auth 依赖导致失败

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

function getLocalUrl() {
  return process.env.LOCAL_DB_URL_FORCE || process.env.LOCAL_DB_URL;
}

function getRemoteUrl() {
  return process.env.PROD_DB_URL || process.env.DATABASE_URL;
}

async function connectWithFallback(rawUrl) {
  // 针对本地 URL 做端口回退；远程则直接连接
  try {
    const u = new URL(rawUrl);
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
    if (isLocal) {
      const ports = u.port ? [u.port] : ['54340', '54322', '5432'];
      const normalizedHost = (u.hostname === 'localhost' || u.hostname === '::1') ? '127.0.0.1' : u.hostname;
      for (const port of ports) {
        try {
          const u2 = new URL(rawUrl);
          u2.hostname = normalizedHost;
          u2.port = port;
          u2.searchParams.delete('sslmode');
          const c = new Client({ connectionString: u2.toString(), ssl: false });
          await c.connect();
          return c;
        } catch (e) {}
      }
      // 最后尝试原始连接
    }
  } catch {}
  const client = new Client({ connectionString: rawUrl });
  await client.connect();
  return client;
}

async function getOrderedTables(client) {
  // 返回用于同步的表顺序（父表在前，子表在后）
  // 覆盖常见题库相关表；若表不存在则忽略
  const desiredOrder = [
    'shadowing_themes',
    'shadowing_subtopics',
    'shadowing_drafts',
    'shadowing_items',
    'cloze_items',
    'alignment_packs',
  ];
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  const existing = new Set(rows.map(r => r.table_name));
  return desiredOrder.filter(t => existing.has(t));
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table]
  );
  return rows.map(r => r.column_name);
}

async function fetchAllRows(client, table) {
  const { rows } = await client.query(`SELECT * FROM "${table}"`);
  return rows;
}

async function truncateRemoteTables(remote, tables) {
  // 先删除子表数据，再删除父表数据
  for (const table of [...tables].reverse()) {
    await remote.query(`DELETE FROM "${table}"`);
  }
}

async function insertRows(remote, table, columns, rows) {
  if (rows.length === 0) return 0;
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
  let ok = 0;
  await remote.query('BEGIN');
  try {
    try { await remote.query('SET CONSTRAINTS ALL DEFERRED'); } catch {}
    for (const row of rows) {
      const values = columns.map(c => (row[c] === undefined ? null : row[c]));
      try {
        await remote.query(sql, values);
        ok++;
      } catch (e) {
        // 宽松模式：记录错误但不中断
        console.warn(`[WARN] 插入 ${table} 失败，已跳过一行:`, e.message);
      }
    }
    await remote.query('COMMIT');
  } catch (e) {
    try { await remote.query('ROLLBACK'); } catch {}
    throw e;
  }
  return ok;
}

async function main() {
  const localUrl = getLocalUrl();
  const remoteUrl = getRemoteUrl();
  if (!localUrl) throw new Error('缺少 LOCAL_DB_URL 或 LOCAL_DB_URL_FORCE');
  if (!remoteUrl) throw new Error('缺少 PROD_DB_URL 或 DATABASE_URL');

  console.log('连接本地数据库...');
  const local = await connectWithFallback(localUrl);
  console.log('连接远端数据库...');
  const remote = await connectWithFallback(remoteUrl);

  try {
    const tables = await getOrderedTables(local);
    console.log('准备同步的表:', tables);
    console.log('清空远端对应表数据...');
    await truncateRemoteTables(remote, tables);

    let total = 0, inserted = 0;
    for (const table of tables) {
      const columns = await getColumns(local, table);
      const rows = await fetchAllRows(local, table);
      total += rows.length;
      console.log(`同步 ${table}: ${rows.length} 行`);
      const ok = await insertRows(remote, table, columns, rows);
      inserted += ok;
    }
    console.log(JSON.stringify({ ok: true, totalRows: total, insertedRows: inserted, tables }, null, 2));
  } finally {
    await local.end();
    await remote.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


