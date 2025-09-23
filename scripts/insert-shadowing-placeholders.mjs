#!/usr/bin/env node
// Insert placeholder rows for shadowing_drafts and shadowing_items
// Usage: node scripts/insert-shadowing-placeholders.mjs [--per 2]

import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { per: 2 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--per') out.per = parseInt(args[++i] || '2', 10) || 2;
  }
  return out;
}

async function fetchColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [table]
  );
  return rows;
}

function placeholderFor(col) {
  const name = col.column_name;
  const dt = (col.data_type || '').toLowerCase();
  const udt = (col.udt_name || '').toLowerCase();
  const notnull = (col.is_nullable || '').toUpperCase() === 'NO';
  // Prefer explicit id we control
  if (name === 'id') return `'${randomUUID()}'::uuid`;
  if (dt.includes('json')) return `'{}'::jsonb`;
  if (udt.endsWith('[]')) {
    const base = udt.replace(/\[\]$/, '') || 'text';
    return `'{}'::${base}[]`;
  }
  if (dt.includes('uuid')) return `'${randomUUID()}'::uuid`;
  if (dt.includes('text') || dt.includes('character')) return `''`;
  if (dt.includes('timestamp') || dt.includes('date')) return `now()`;
  if (dt.includes('boolean')) return `false`;
  if (dt.includes('int') || dt.includes('numeric') || dt.includes('real') || dt.includes('double')) return `0`;
  return notnull ? `''` : `NULL`;
}

async function insertPlaceholders(client, table, per = 2) {
  const cols = await fetchColumns(client, table);
  const must = cols.filter(c => (String(c.is_nullable).toUpperCase() !== 'YES') && !c.column_default);
  const idCol = cols.find(c => c.column_name === 'id');
  const targetCols = [];
  if (idCol) targetCols.push(idCol);
  for (const c of must) if (!targetCols.find(x => x.column_name === c.column_name)) targetCols.push(c);

  if (targetCols.length === 0) {
    const ids = [];
    for (let i = 0; i < per; i++) {
      const { rows } = await client.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING id;`);
      ids.push(rows[0]?.id || null);
    }
    return ids;
  }

  const colNames = targetCols.map(c => c.column_name);
  const valuesRows = [];
  for (let i = 0; i < per; i++) {
    const rowVals = targetCols.map(c => placeholderFor(c));
    valuesRows.push(`(${rowVals.join(', ')})`);
  }
  const sql = `INSERT INTO "${table}" (${colNames.map(n => `"${n}"`).join(', ')}) VALUES ${valuesRows.join(', ')} RETURNING id;`;
  const { rows } = await client.query(sql);
  return rows.map(r => r.id || null);
}

async function main() {
  const args = parseArgs();
  const conn = process.env.LOCAL_DB_URL || process.env.DATABASE_URL || process.env.PG_DATABASE_URL || process.env.PG_URL || process.env.PGURI;
  if (!conn) { console.error('未找到本地数据库连接串（LOCAL_DB_URL / DATABASE_URL）'); process.exit(1); }
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    const tables = ['shadowing_drafts', 'shadowing_items'];
    for (const t of tables) {
      try {
        const ids = await insertPlaceholders(client, t, args.per);
        console.log(`表 ${t} 插入 ${ids.length} 条，占位ID:`, ids);
      } catch (e) {
        console.error(`表 ${t} 插入失败:`, e instanceof Error ? e.message : String(e));
      }
    }
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });


