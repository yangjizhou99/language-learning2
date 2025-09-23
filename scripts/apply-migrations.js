#!/usr/bin/env node
// 幂等对齐数据库结构：按迁移文件执行（支持 DO $$ ... $$、注释、引号、美元引号），跳过已存在/不存在类错误

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function splitSqlStatements(sql) {
  const statements = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null; // $tag$

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '--') {
      inLineComment = true; buf += next2; i++; continue;
    }
    if (inLineComment) { buf += ch; if (ch === '\n') inLineComment = false; continue; }

    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '/*') {
      inBlockComment = true; buf += next2; i++; continue;
    }
    if (inBlockComment) { buf += ch; if (next2 === '*/') { buf += '/'; i++; inBlockComment = false; } continue; }

    if (!inSingle && !inDouble) {
      const m = sql.slice(i).match(/^\$[a-zA-Z_]*\$/);
      if (m) { const tag = m[0]; if (!dollarTag) dollarTag = tag; else if (dollarTag === tag) dollarTag = null; buf += tag; i += tag.length - 1; continue; }
    }
    if (dollarTag) { buf += ch; continue; }

    if (!inDouble && ch === "'") { inSingle = !inSingle; buf += ch; if (inSingle && sql[i + 1] === "'") { buf += "'"; i++; } continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; buf += ch; continue; }
    if (inSingle || inDouble) { buf += ch; continue; }

    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt) statements.push(stmt);
      buf = '';
      continue;
    }

    buf += ch;
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function applyFile(supabase, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const stmts = splitSqlStatements(content);
  let ok = 0, skip = 0, fail = 0;
  for (const sql of stmts) {
    // 跳过事务控制语句，在 RPC exec_sql 中不支持
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|END)\b/i.test(sql)) { skip++; continue; }
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      const msg = error.message || '';
      if (/already exists|does not exist|duplicate key|must be owner of|multiple primary keys/i.test(msg)) { skip++; continue; }
      // 针对策略等语句可能需要先启用扩展/函数：此处直接报告
      console.log(JSON.stringify({ file: path.basename(filePath), error: msg, sql: sql.slice(0, 180) + (sql.length > 180 ? '...' : '') }, null, 2));
      fail++;
    } else {
      ok++;
    }
  }
  return { file: path.basename(filePath), ok, skip, fail, total: stmts.length };
}

async function main() {
  const supabase = getClient();
  // 按顺序执行核心迁移
  const files = [
    // 先确保 exec_sql 等函数存在
    'supabase/migrations/20250120000009_backup_restore_function.sql',
    // 清空 public 内的表/视图/序列/自定义类型（不删除函数与 schema）
    'supabase/migrations/20250923000300_wipe_public_objects.sql',
    // 重建完整远端 schema
    'supabase/migrations/20250918041810_remote_public_schema.sql',
    // 后续增量修复/对齐
    'supabase/migrations/20250918100000_add_vocab_srs.sql',
    'supabase/migrations/20250922000000_rename_subtopic_fields.sql',
    'supabase/migrations/20250922001000_audio_url_normalization.sql',
    'supabase/migrations/20250923000100_fix_shadowing_items_columns.sql',
    'supabase/migrations/20250923000200_align_shadowing_items_schema.sql',
  ].filter((p) => fs.existsSync(p));

  const results = [];
  for (const f of files) {
    const r = await applyFile(supabase, f);
    results.push(r);
  }

  console.log(JSON.stringify({ ok: results.every(r => r.fail === 0), results }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(99); });


