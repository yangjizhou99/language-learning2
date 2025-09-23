#!/usr/bin/env node
// Old backup repair-and-restore script (local Postgres)
// Usage:
//   node scripts/old-backup-repair-restore.mjs --zip "D:\\backups\\language-learning\\database-backup-supabase-2025-09-22_20-21-23-092Z.zip"
// Env:
//   LOCAL_DB_URL=postgres://user:pass@localhost:5432/dbname

import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import os from 'os';
import { Client } from 'pg';
import dotenv from 'dotenv';

// 加载环境变量（支持 .env、.env.local 等）
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--zip') out.zip = args[++i];
    if (a === '--shadowing-safe') out.shadowingSafe = true;
    if (a === '--force') out.force = true;
    if (a === '--ddl-only') out.ddlOnly = true;
  }
  return out;
}

async function extractZipPowershell(zipPath, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`], { stdio: 'inherit' });
    ps.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Expand-Archive failed: ${code}`))));
  });
}

async function findFirstSqlFile(dir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const ents = await fs.readdir(cur, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.sql')) return p;
    }
  }
  return null;
}

function ensureArrayColumnDDLFixes(sql) {
  let out = sql;
  out = out.replace(/(\n\s*"[^"]+"\s+)ARRAY(\b)/g, (_m, pre, suf) => `${pre}text[]${suf}`);
  out = out.replace(/DEFAULT\s+ARRAY\[\]\s*::\s*([a-zA-Z_][\w]*)\s*\[\]/g, (_m, typ) => `DEFAULT '{}'::${typ}[]`);
  out = out.replace(/DEFAULT\s+ARRAY\[\]/g, `DEFAULT '{}'::text[]`);
  return out;
}

function robustReplaceArrayLiterals(sql) {
  // Replace ARRAY[...] with '{...}'::text[] when outside quotes/comments/dollar-strings
  let out = '';
  let i = 0, n = sql.length;
  let inS = false, inD = false, inLC = false, inBC = false; let dollar = null;
  while (i < n) {
    const ch = sql[i];
    const n2 = sql.slice(i, i + 2);
    if (!inS && !inD && !dollar && !inBC && n2 === '--') { inLC = true; out += n2; i += 2; continue; }
    if (inLC) { out += ch; if (ch === '\n') inLC = false; i++; continue; }
    if (!inS && !inD && !dollar && !inBC && n2 === '/*') { inBC = true; out += n2; i += 2; continue; }
    if (inBC) { out += ch; if (n2 === '*/') { out += '/'; i += 2; inBC = false; continue; } i++; continue; }
    if (!inS && !inD) { const dm = sql.slice(i).match(/^\$[a-zA-Z_]*\$/); if (dm) { const tag = dm[0]; if (!dollar) dollar = tag; else if (dollar === tag) dollar = null; out += tag; i += tag.length; continue; } }
    if (dollar) { out += ch; i++; continue; }
    if (!inD && ch === "'") { inS = !inS; out += ch; if (inS && sql[i + 1] === "'") { out += "'"; i += 2; continue; } i++; continue; }
    if (!inS && ch === '"') { inD = !inD; out += ch; i++; continue; }
    if (inS || inD) { out += ch; i++; continue; }

    const rest = sql.slice(i);
    if (/^array\s*\[/i.test(rest)) {
      const m = rest.match(/^([aA][rR][rR][aA][yY])\s*\[/);
      let j = i + m[0].length; let depth = 1; let q = false;
      let inner = '';
      while (j < n && depth > 0) {
        const c = sql[j]; const n22 = sql.slice(j, j + 2);
        if (c === "'") { if (q && sql[j + 1] === "'") { inner += "''"; j += 2; continue; } q = !q; inner += c; j++; continue; }
        if (!q && c === '[') { depth++; inner += c; j++; continue; }
        if (!q && c === ']') { depth--; if (depth === 0) { j++; break; } inner += c; j++; continue; }
        inner += c; j++;
      }
      const parts = tokenizeCsvRespectingQuotes(inner).map(toTextArrayToken);
      out += `'{${parts.join(',')}}'::text[]`;
      i = j; continue;
    }
    out += ch; i++;
  }
  return out;
}

function tokenizeCsvRespectingQuotes(s) {
  const toks = []; let b = ''; let q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === "'") { if (q && s[i + 1] === "'") { b += "''"; i++; continue; } q = !q; b += ch; continue; } if (ch === ',' && !q) { const t = b.trim(); if (t) toks.push(t); b = ''; continue; } b += ch; }
  const last = b.trim(); if (last) toks.push(last); return toks;
}
function toTextArrayToken(t) {
  if (t.startsWith("'") && t.endsWith("'")) { const unq = t.slice(1, -1).replace(/''/g, "'"); const esc = unq.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); return `"${esc}"`; }
  const esc = t.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); return `"${esc}"`;
}

function sanitizeLeakedConversation(sql) {
  let out = sql;
  out = out.replace(/\[\s*\{\s*"role"\s*:\s*"(?:system|user)"[\s\S]*?\}\s*\]/gms, '');
  out = out.replace(/::t(?:e(?:x)?)?(?![a-z])/g, '::text');
  out = out.replace(/::text\s*(?=\s*"[^"]+"\s)/g, '::text, ');
  return out;
}

function wrapBareJsonObjectsGeneric(sql) {
  // Global pass: wrap bare {..} to '... '::jsonb
  let out = '';
  let i = 0, n = sql.length;
  let inS = false, inD = false, inLC = false, inBC = false; let dollar = null;
  while (i < n) {
    const ch = sql[i]; const n2 = sql.slice(i, i + 2);
    if (!inS && !inD && !dollar && !inBC && n2 === '--') { inLC = true; out += n2; i += 2; continue; }
    if (inLC) { out += ch; if (ch === '\n') inLC = false; i++; continue; }
    if (!inS && !inD && !dollar && !inBC && n2 === '/*') { inBC = true; out += n2; i += 2; continue; }
    if (inBC) { out += ch; if (n2 === '*/') { out += '/'; i += 2; inBC = false; continue; } i++; continue; }
    const dm = (!inS && !inD) ? sql.slice(i).match(/^\$[a-zA-Z_]*\$/) : null;
    if (dm) { const tag = dm[0]; if (!dollar) dollar = tag; else if (dollar === tag) dollar = null; out += tag; i += tag.length; continue; }
    if (dollar) { out += ch; i++; continue; }
    if (!inD && ch === "'") { inS = !inS; out += ch; if (inS && sql[i + 1] === "'") { out += "'"; i += 2; continue; } i++; continue; }
    if (!inS && ch === '"') { inD = !inD; out += ch; i++; continue; }
    if (inS || inD) { out += ch; i++; continue; }
    if (ch === '{') {
      let j = i + 1, depth = 1, q = false;
      while (j < n && depth > 0) { const cj = sql[j]; if (cj === "'") { if (q && sql[j + 1] === "'") { j += 2; continue; } q = !q; j++; continue; } if (!q) { if (cj === '{') depth++; else if (cj === '}') depth--; } j++; }
      const block = sql.slice(i, j);
      const wrapped = `'${block.replace(/'/g, "''")}'::jsonb`;
      out += wrapped; i = j; continue;
    }
    out += ch; i++;
  }
  return out;
}

function splitSqlStatements(sql) {
  const statements = [];
  let buf = '';
  let inSingle = false; let inDouble = false; let inLineComment = false; let inBlockComment = false; let dollarTag = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]; const next2 = sql.slice(i, i + 2);
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '--') { inLineComment = true; buf += next2; i++; continue; }
    if (inLineComment) { buf += ch; if (ch === '\n') inLineComment = false; continue; }
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '/*') { inBlockComment = true; buf += next2; i++; continue; }
    if (inBlockComment) { buf += ch; if (next2 === '*/') { buf += '/'; i++; inBlockComment = false; } continue; }
    if (!inSingle && !inDouble) { const dm = sql.slice(i).match(/^\$[a-zA-Z_]*\$/); if (dm) { const tag = dm[0]; if (!dollarTag) dollarTag = tag; else if (dollarTag === tag) dollarTag = null; buf += tag; i += tag.length - 1; continue; } }
    if (dollarTag) { buf += ch; continue; }
    if (!inDouble && ch === "'") { inSingle = !inSingle; buf += ch; if (inSingle && sql[i + 1] === "'") { buf += "'"; i++; } continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; buf += ch; continue; }
    if (inSingle || inDouble) { buf += ch; continue; }
    if (ch === ';') { const stmt = buf.trim(); if (stmt) statements.push(stmt); buf = ''; continue; }
    buf += ch;
  }
  const tail = buf.trim(); if (tail) statements.push(tail);
  return statements;
}

async function main() {
  const args = parseArgs();
  const { zip } = args;
  if (!zip) { console.error('请使用 --zip 指定备份ZIP路径'); process.exit(1); }
  const candidates = [
    process.env.LOCAL_DB_URL,
    process.env.DATABASE_URL,
    process.env.PG_DATABASE_URL,
    process.env.PG_URL,
    process.env.PGURI,
  ].filter(Boolean);
  const conn = candidates[0];
  if (!conn) {
    console.error('未找到本地数据库连接串（优先读取 LOCAL_DB_URL / DATABASE_URL）。请在 .env.local/.env 设置或以环境变量提供。');
    process.exit(1);
  }

  const tempDir = path.join(os.tmpdir(), 'old-repair-' + Date.now());
  await fs.mkdir(tempDir, { recursive: true });

  console.log('解压:', zip, '->', tempDir);
  await extractZipPowershell(zip, tempDir);
  const sqlFile = await findFirstSqlFile(tempDir);
  if (!sqlFile) { console.error('ZIP中未找到SQL文件'); process.exit(1); }
  console.log('SQL文件:', sqlFile);

  let sql = await fss.promises.readFile(sqlFile, 'utf8');
  // 全量修复管线
  sql = ensureArrayColumnDDLFixes(sanitizeLeakedConversation(wrapBareJsonObjectsGeneric(robustReplaceArrayLiterals(sql))));

  let statements = splitSqlStatements(sql);

  // 可选：仅恢复 Shadowing 六表，过滤无关/污染语句
  if (args.shadowingSafe) {
    const allowed = new Set([
      'shadowing_themes',
      'shadowing_subtopics',
      'shadowing_drafts',
      'shadowing_items',
      'shadowing_sessions',
      'shadowing_attempts',
    ]);
    const keep = [];
    for (const s of statements) {
      const mDrop = s.match(/DROP\s+TABLE\s+IF\s+EXISTS\s+"([^"]+)"/i);
      const mCreate = s.match(/CREATE\s+TABLE\s+"([^"]+)"/i);
      const mInsert = s.match(/INSERT\s+INTO\s+"([^"]+)"/i);
      const tbl = (mDrop || mCreate || mInsert)?.[1];
      if (tbl && allowed.has(tbl)) {
        keep.push(s);
      }
    }
    statements = keep;
  }
  console.log('语句数量:', statements.length);

  // 可选：仅执行 DDL（DROP/CREATE/ALTER），跳过 DML
  if (args.ddlOnly) {
    const ddl = statements.filter(s => /^(DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+TABLE)/i.test(s.trim()))
    statements = ddl;
    console.log('DDL 语句数量:', statements.length);
  }

  const client = new Client({ connectionString: conn });
  await client.connect();
  let ok = 0, skip = 0, fail = 0;
  for (let idx = 0; idx < statements.length; idx++) {
    let stmt = statements[idx];
    if (!stmt.trim()) { skip++; continue; }
    try {
      await client.query(stmt);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/(already exists|does not exist|duplicate key)/i.test(msg)) { skip++; continue; }
      // JSON错误：语句级 to_jsonb 包装
      if (/invalid input syntax for type json/i.test(msg) || /JSON data/i.test(msg)) {
        try {
          const t = replaceBareJsonWithToJsonbInStatement(stmt);
          await client.query(t); ok++; continue;
        } catch {}
      }
      // 语法错误：ARRAY/JSON 再修复
      if (/syntax error/i.test(msg)) {
        try {
          const t = ensureArrayColumnDDLFixes(replaceBareJsonWithToJsonbInStatement(robustReplaceArrayLiterals(stmt)));
          await client.query(t); ok++; continue;
        } catch {}
      }
      // 兜底：将疑似 JSON 对象整体降级为空对象
      try {
        const t = stmt.replace(/\{[\s\S]*?\}/g, `'{}'::jsonb`);
        await client.query(t); ok++; continue;
      } catch {}
      if (args.force) {
        // 最终保底：强制降级该语句
        try {
          let t = stmt;
          // 1) 先包装/清空 JSON
          t = replaceBareJsonWithToJsonbInStatement(t);
          t = t.replace(/\{[\s\S]*?\}/g, `'{}'::jsonb`);
          // 2) 修复空数组和非法数组字符串
          t = t.replace(/"\[\]"/g, `'{}'::text[]`).replace(/\[\]/g, `'{}'::text[]`);
          // 3) 将 VALUES() 中未加引号的英文词降级为空字符串
          t = t.replace(/(VALUES\s*\()(.*?)(\)\s*;?)/gis, (_m, pre, inner, post) => {
            // 简单扫描：替换裸英文词为 ''（跳过引号内/大括号内）
            let outInner = '';
            let i2 = 0; let n2 = inner.length; let inS2 = false; let depthJson = 0;
            while (i2 < n2) {
              const ch2 = inner[i2];
              if (ch2 === "'") { inS2 = !inS2; outInner += ch2; i2++; continue; }
              if (!inS2 && inner[i2] === '{') { depthJson++; outInner += ch2; i2++; continue; }
              if (!inS2 && inner[i2] === '}') { depthJson = Math.max(0, depthJson - 1); outInner += ch2; i2++; continue; }
              if (!inS2 && depthJson === 0 && /[A-Za-z]/.test(ch2)) {
                // 吸收连续英文作为一个token
                let j2 = i2;
                while (j2 < n2 && /[A-Za-z_]/.test(inner[j2])) j2++;
                outInner += `''`;
                i2 = j2; continue;
              }
              outInner += ch2; i2++;
            }
            return pre + outInner + post;
          });
          await client.query(t);
          ok++;
          console.warn(`第 ${idx + 1} 条已降级修复(保底):`, msg);
          continue;
        } catch (eForce) {
          // 4) 仍失败：若是 INSERT 语句，改为强制占位空值重写
          try {
            const m = stmt.match(/INSERT\s+INTO\s+"([^"]+)"\s*(\(([^)]*)\))?\s+VALUES\s*/i);
            if (m) {
              const table = m[1];
              let cols = m[3] ? m[3].split(',').map(s => s.trim().replace(/"/g, '')) : null;
              const metaRes = await client.query(
                `SELECT column_name, data_type, udt_name, is_nullable, ordinal_position
                 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name=$1
                 ORDER BY ordinal_position`, [table]
              );
              const meta = metaRes.rows;
              if (!cols) cols = meta.map(r => r.column_name);
              const typeMap = new Map(meta.map(r => [r.column_name, r]));
              function valFor(col) {
                const r = typeMap.get(col) || {};
                const dt = (r.data_type || '').toLowerCase();
                const udt = (r.udt_name || '').toLowerCase();
                const notnull = (r.is_nullable || '').toUpperCase() === 'NO';
                let v = 'NULL';
                if (dt.includes('json')) v = `'{}'::jsonb`;
                else if (udt.endsWith('[]')) { const base = udt.replace(/\[\]$/, '') || 'text'; v = `'{}'::${base}[]`; }
                else if (dt.includes('uuid')) v = `gen_random_uuid()`;
                else if (dt.includes('text') || dt.includes('character')) v = `''`;
                else if (dt.includes('timestamp') || dt.includes('date')) v = `now()`;
                else if (dt.includes('boolean')) v = `false`;
                else if (dt.includes('int') || dt.includes('numeric') || dt.includes('real') || dt.includes('double')) v = `0`;
                if (notnull && v === 'NULL') v = `''`;
                return v;
              }
              const rowPlaceholder = `(${cols.map(c => valFor(c)).join(', ')})`;
              const rowsCount = (stmt.match(/\)\s*,\s*\(/g) || []).length + 1;
              const valuesBlock = Array.from({ length: rowsCount }).map(() => rowPlaceholder).join(', ');
              const fixed = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES ${valuesBlock};`;
              await client.query(fixed);
              ok++;
              console.warn(`第 ${idx + 1} 条已强制占位插入(保底)表 ${table}`);
              continue;
            }
          } catch {}
          // 仍失败则记为失败
        }
      }
      fail++;
      console.error(`第 ${idx + 1} 条执行失败:`, msg);
    }
  }
  await client.end();

  console.log(`完成: 成功 ${ok}, 跳过 ${skip}, 失败 ${fail}`);
  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });


