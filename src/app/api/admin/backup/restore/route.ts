import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { createDatabaseConnection, DatabaseType } from '@/lib/backup-db';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';

// removed: old repairArrayLiteralsInline (replaced by robustReplaceArrayLiterals)

function ensureJsonCastsInline(sql: string): string {
  // 1) INSERT ... VALUES (..., { ... }, ...)
  let out = sql.replace(/(VALUES\s*\([^\)]*?)(\{[\s\S]*?\})([^\)]*\))/gms, (_m, pre: string, obj: string, post: string) => {
    if (/['"]\s*$/.test(pre)) return `${pre}${obj}${post}`;
    const wrapped = `'${obj.replace(/'/g, "''")}'::jsonb`;
    return `${pre}${wrapped}${post}`;
  });
  // 2) UPDATE ... SET col = { ... }
  out = out.replace(/(SET\s+[^=]+?=\s*)(\{[\s\S]*?\})(\s*(,|WHERE|RETURNING|;))/gms, (_m, pre: string, obj: string, tail: string) => {
    if (/['"]\s*$/.test(pre)) return `${pre}${obj}${tail}`;
    const wrapped = `'${obj.replace(/'/g, "''")}'::jsonb`;
    return `${pre}${wrapped}${tail}`;
  });
  return out;
}

function wrapBareJsonObjectsGeneric(sql: string): string {
  // 扫描并将未加引号的 { ... } 包装为 '...'
  let out = '';
  let i = 0;
  const n = sql.length;
  let inSingle = false, inDouble = false, inLineComment = false, inBlockComment = false;
  let dollarTag: string | null = null;
  while (i < n) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '--') { inLineComment = true; out += next2; i += 2; continue; }
    if (inLineComment) { out += ch; if (ch === '\n') inLineComment = false; i++; continue; }
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '/*') { inBlockComment = true; out += next2; i += 2; continue; }
    if (inBlockComment) { out += ch; if (next2 === '*/') { out += '/'; i += 2; inBlockComment = false; continue; } i++; continue; }
    if (!inSingle && !inDouble) {
      const dm = sql.slice(i).match(/^\$[a-zA-Z_]*\$/);
      if (dm) { const tag = dm[0]; if (!dollarTag) dollarTag = tag; else if (dollarTag === tag) dollarTag = null; out += tag; i += tag.length; continue; }
    }
    if (dollarTag) { out += ch; i++; continue; }
    if (!inDouble && ch === "'") { inSingle = !inSingle; out += ch; if (inSingle && sql[i + 1] === "'") { out += "'"; i += 2; continue; } i++; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; out += ch; i++; continue; }
    if (inSingle || inDouble) { out += ch; i++; continue; }

    if (ch === '{') {
      // 捕获匹配的花括号块
      let j = i + 1, depth = 1, bInSingle = false;
      while (j < n && depth > 0) {
        const cj = sql[j];
        if (cj === "'") { if (bInSingle && sql[j + 1] === "'") { j += 2; continue; } bInSingle = !bInSingle; j++; continue; }
        if (!bInSingle) {
          if (cj === '{') depth++;
          else if (cj === '}') depth--;
        }
        j++;
      }
      const block = sql.slice(i, j); // 包含最外层 {}
      const wrapped = `'${block.replace(/'/g, "''")}'::jsonb`;
      out += wrapped;
      i = j;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

function replaceBareJsonWithToJsonbInStatement(stmt: string): string {
  // 对单条语句：把未加引号/未在注释内的 { ... } 替换为 to_jsonb('...')
  let out = '';
  let i = 0;
  const n = stmt.length;
  let inSingle = false, inDouble = false, inLineComment = false, inBlockComment = false;
  let dollarTag: string | null = null;
  while (i < n) {
    const ch = stmt[i];
    const next2 = stmt.slice(i, i + 2);
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '--') { inLineComment = true; out += next2; i += 2; continue; }
    if (inLineComment) { out += ch; if (ch === '\n') inLineComment = false; i++; continue; }
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '/*') { inBlockComment = true; out += next2; i += 2; continue; }
    if (inBlockComment) { out += ch; if (next2 === '*/') { out += '/'; i += 2; inBlockComment = false; continue; } i++; continue; }
    if (!inSingle && !inDouble) {
      const dm = stmt.slice(i).match(/^\$[a-zA-Z_]*\$/);
      if (dm) { const tag = dm[0]; if (!dollarTag) dollarTag = tag; else if (dollarTag === tag) dollarTag = null; out += tag; i += tag.length; continue; }
    }
    if (dollarTag) { out += ch; i++; continue; }
    if (!inDouble && ch === "'") { inSingle = !inSingle; out += ch; if (inSingle && stmt[i + 1] === "'") { out += "'"; i += 2; continue; } i++; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; out += ch; i++; continue; }
    if (inSingle || inDouble) { out += ch; i++; continue; }

    if (ch === '{') {
      let j = i + 1, depth = 1, bInSingle = false;
      while (j < n && depth > 0) {
        const cj = stmt[j];
        if (cj === "'") { if (bInSingle && stmt[j + 1] === "'") { j += 2; continue; } bInSingle = !bInSingle; j++; continue; }
        if (!bInSingle) { if (cj === '{') depth++; else if (cj === '}') depth--; }
        j++;
      }
      const block = stmt.slice(i, j);
      const wrapped = `to_jsonb('${block.replace(/'/g, "''")}')`;
      out += wrapped;
      i = j;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

function sanitizeLeakedConversation(sql: string): string {
  let out = sql;
  // 1) 移除疑似对话块 [ { "role":"system"|"user", ... } ]
  out = out.replace(/\[\s*\{\s*"role"\s*:\s*"(?:system|user)"[\s\S]*?\}\s*\]/gms, '');
  // 2) 修正被截断的 ::text 类型转换（如 ::te / ::tex）
  out = out.replace(/::t(?:e(?:x)?)?(?![a-z])/g, '::text');
  // 3) 若 ::text 后紧跟下一列定义（开头是双引号列名），补一个逗号
  out = out.replace(/::text\s*(?=\s*"[^"]+"\s)/g, '::text, ');
  return out;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null; // like $tag$

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    // line comment
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '--') {
      inLineComment = true;
      buf += next2;
      i++;
      continue;
    }
    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    // block comment
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '/*') {
      inBlockComment = true;
      buf += next2;
      i++;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (next2 === '*/') {
        buf += '/';
        i++;
        inBlockComment = false;
      }
      continue;
    }

    // dollar-quoted strings $tag$
    if (!inSingle && !inDouble) {
      const dollarMatch = sql.slice(i).match(/^\$[a-zA-Z_]*\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        if (!dollarTag) {
          dollarTag = tag; // start
        } else if (dollarTag === tag) {
          dollarTag = null; // end
        }
        buf += tag;
        i += tag.length - 1;
        continue;
      }
    }
    if (dollarTag) {
      buf += ch;
      continue;
    }

    // quotes
    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      buf += ch;
      // handle escaped '' inside single quotes
      if (inSingle && sql[i + 1] === "'") { buf += "'"; i++; }
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      buf += ch;
      continue;
    }
    if (inSingle || inDouble) {
      buf += ch;
      continue;
    }

    // split on ; when not in any quoted/comment context
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

function ensureArrayColumnDDLFixes(sql: string): string {
  let out = sql;
  // 1) 列类型中使用 ARRAY → 统一替换为 text[]（如 "tags" ARRAY → "tags" text[]）
  out = out.replace(/(\n\s*"[^"]+"\s+)ARRAY(\b)/g, (_m, pre: string, suf: string) => `${pre}text[]${suf}`);
  // 2) DEFAULT ARRAY[]::uuid[] → DEFAULT '{}'::uuid[]
  out = out.replace(/DEFAULT\s+ARRAY\[\]\s*::\s*([a-zA-Z_][\w]*)\s*\[\]/g, (_m, typ: string) => `DEFAULT '{}'::${typ}[]`);
  // 3) DEFAULT ARRAY[]（无类型）→ DEFAULT '{}'::text[]
  out = out.replace(/DEFAULT\s+ARRAY\[\]/g, `DEFAULT '{}'::text[]`);
  return out;
}

function robustReplaceArrayLiterals(sql: string): string {
  // 在不进入引号/注释/美元引用的情况下，查找关键字 ARRAY 后的 [] 内容并替换为 '{..}'::text[]
  let out = '';
  let i = 0;
  const n = sql.length;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;
  while (i < n) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '--') { inLineComment = true; out += next2; i += 2; continue; }
    if (inLineComment) { out += ch; if (ch === '\n') inLineComment = false; i++; continue; }
    if (!inSingle && !inDouble && !dollarTag && !inBlockComment && next2 === '/*') { inBlockComment = true; out += next2; i += 2; continue; }
    if (inBlockComment) { out += ch; if (next2 === '*/') { out += '/'; i += 2; inBlockComment = false; continue; } i++; continue; }

    if (!inSingle && !inDouble) {
      const dm = sql.slice(i).match(/^\$[a-zA-Z_]*\$/);
      if (dm) { const tag = dm[0]; if (!dollarTag) dollarTag = tag; else if (dollarTag === tag) dollarTag = null; out += tag; i += tag.length; continue; }
    }
    if (dollarTag) { out += ch; i++; continue; }

    if (!inDouble && ch === "'") { inSingle = !inSingle; out += ch; if (inSingle && sql[i + 1] === "'") { out += "'"; i += 2; continue; } i++; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; out += ch; i++; continue; }
    if (inSingle || inDouble) { out += ch; i++; continue; }

    // 尝试匹配关键字 ARRAY（大小写不敏感）
    const rest = sql.slice(i);
    const startsWithARRAY = /^array\s*\[/i.test(rest);
    if (startsWithARRAY) {
      // 跳过 'ARRAY' 和可能的空白，进入方括号解析
      const arrPrefixMatch = rest.match(/^([aA][rR][rR][aA][yY])\s*\[/)!;
      out += "'"; // 我们将替换为 '{...}'::text[]，先占位，后面再拼
      // 现在定位到 '[' 之后
      let j = i + arrPrefixMatch[0].length; // 位置在 '[' 后
      // 实际上上面把单引号加进 out 只是个占位，这里我们先回退：
      out = out.slice(0, -1); // 移除占位
      // 解析方括号内容，支持嵌套引号
      let depth = 1; // 当前在 '[' 之后
      let buf = '';
      let inS = false;
      while (j < n && depth > 0) {
        const c = sql[j];
        // no-op
        if (!inS && c === '[') { depth++; buf += c; j++; continue; }
        if (!inS && c === ']') { depth--; if (depth === 0) { j++; break; } buf += c; j++; continue; }
        if (c === "'") {
          if (inS && sql[j + 1] === "'") { buf += "''"; j += 2; continue; }
          inS = !inS; buf += c; j++; continue;
        }
        buf += c; j++;
      }
      // 现在 buf 是 ARRAY[...] 内部内容
      // 进行 token 化，复用 repair/route 的思路
      const tokens: string[] = (function tokenize(inner: string): string[] {
        const toks: string[] = []; let b = ''; let q = false; for (let k = 0; k < inner.length; k++) { const ch2 = inner[k]; if (ch2 === "'") { if (q && inner[k + 1] === "'") { b += "''"; k++; continue; } q = !q; b += ch2; continue; } if (ch2 === ',' && !q) { const t = b.trim(); if (t) toks.push(t); b = ''; continue; } b += ch2; } const last = b.trim(); if (last) toks.push(last); return toks; })(buf);
      const converted = tokens.map((t) => {
        if (t.startsWith("'") && t.endsWith("'")) { const unq = t.slice(1, -1).replace(/''/g, "'"); const esc = unq.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); return `"${esc}"`; }
        const esc = t.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); return `"${esc}"`;
      });
      out += `'{${converted.join(',')}}'::text[]`;
      i = j;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const contentType = req.headers.get('content-type');
    let restoreType: string;
    let file: File | null = null;
    let backupPath: string | null = null;
    let databaseType: DatabaseType = 'supabase';

    if (contentType?.includes('multipart/form-data')) {
      // 上传文件方式
      const formData = await req.formData();
      file = formData.get('file') as File;
      restoreType = (formData.get('restoreType') as string) || 'upload';
      const dt = formData.get('databaseType') as string | null;
      if (dt && (['local','prod','supabase'] as const).includes(dt as DatabaseType)) {
        databaseType = dt as DatabaseType;
      }
    } else {
      // JSON方式（历史备份或增量恢复）
      const body = await req.json();
      restoreType = body.restoreType || 'history';
      backupPath = body.backupPath;
      if (body.databaseType && (['local','prod','supabase'] as const).includes(body.databaseType)) {
        databaseType = body.databaseType as DatabaseType;
      }
    }
    // 校验数据库类型
    if (!(['local','prod','supabase'] as const).includes(databaseType)) {
      return NextResponse.json({ error: '无效的数据库类型' }, { status: 400 });
    }

    if (restoreType === 'upload' && !file) {
      return NextResponse.json({ error: '请选择要恢复的备份文件' }, { status: 400 });
    }

    if (restoreType === 'history' && !backupPath) {
      return NextResponse.json({ error: '请选择要恢复的历史备份' }, { status: 400 });
    }

    if (restoreType === 'incremental' && !backupPath) {
      return NextResponse.json({ error: '增量恢复需要选择备份文件' }, { status: 400 });
    }

    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp', 'restore', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    try {
      if (restoreType === 'upload') {
        // 上传文件方式
        const tempFilePath = path.join(tempDir, file!.name);
        const fileBuffer = await file!.arrayBuffer();
        await fs.writeFile(tempFilePath, Buffer.from(fileBuffer));

        // 解压ZIP文件
        await extractZip(tempFilePath, tempDir);
      } else if (restoreType === 'incremental') {
        // 增量恢复方式：直接使用单个备份文件
        await copyBackupFromHistory(backupPath!, tempDir);
      } else {
        // 历史备份方式
        await copyBackupFromHistory(backupPath!, tempDir);
      }

      // 检查是否是NDJSON格式的备份
      const manifestPath = path.join(tempDir, 'manifest.json');
      let isNdjsonBackup = false;
      let manifest = null;
      
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        manifest = JSON.parse(manifestContent);
        if (manifest.format === 'ndjson') {
          isNdjsonBackup = true;
          console.log('检测到NDJSON格式备份，版本:', manifest.version);
        }
      } catch {
        // 没有manifest文件，使用传统SQL恢复
      }

      let dbRestoreSummary: { total: number; success: number; skipped: number; failed: number; firstErrors?: Array<{ index: number; message: string }> } | null = null;
      
      if (isNdjsonBackup && manifest) {
        console.log('开始NDJSON格式数据库恢复...');
        dbRestoreSummary = await restoreNdjsonDatabase(tempDir, manifest, databaseType);
        console.log('NDJSON数据库恢复完成');
      } else {
        // 传统SQL恢复
        const sqlFiles = await findSqlFiles(tempDir);
        console.log('找到SQL文件:', sqlFiles);
        
        if (sqlFiles.length > 0) {
          console.log('开始恢复数据库...');
          dbRestoreSummary = await restoreDatabase(sqlFiles[0], databaseType);
          console.log('数据库恢复完成');
        } else {
          console.log('未找到SQL文件，跳过数据库恢复');
        }
      }

      // 恢复存储桶文件
      const storageDir = path.join(tempDir, 'storage');
      try {
        await fs.access(storageDir);
        console.log('开始恢复存储桶文件...');
        const isIncremental = restoreType === 'incremental';
        await restoreStorage(storageDir, isIncremental, databaseType);
        console.log(`存储桶恢复完成 (${isIncremental ? '增量' : '完整'}模式)`);
      } catch {
        console.log('存储目录不存在，跳过存储桶恢复');
      }

      return NextResponse.json({
        message: restoreType === 'incremental' ? '增量恢复完成（并行处理）' : '恢复完成（并行处理）',
        details: {
          databaseFiles: isNdjsonBackup ? (manifest?.tables?.length || 0) : 0,
          storageRestored: true,
          restoreType: restoreType,
          mode: restoreType === 'incremental' ? '增量模式（只恢复数据库中缺失的文件）' : '完整模式（恢复所有备份文件）',
          parallelProcessing: true,
          performance: '使用并行处理提高恢复速度',
          databaseType,
          databaseRestore: dbRestoreSummary
        },
      });
    } finally {
      // 清理临时文件
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('清理临时文件失败:', err);
      }
    }
  } catch (error) {
    console.error('恢复备份失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { 
        error: '恢复备份失败',
        details: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  console.log('开始解压ZIP文件:', zipPath);
  console.log('解压到目录:', extractDir);
  
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('打开ZIP文件失败:', err);
        reject(err);
        return;
      }

      if (!zipfile) {
        console.error('ZIP文件对象为空');
        reject(new Error('ZIP文件对象为空'));
        return;
      }

      console.log('ZIP文件打开成功，开始读取条目...');
      let entryCount = 0;
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        entryCount++;
        console.log(`处理条目 ${entryCount}: ${entry.fileName}`);
        
        if (/\/$/.test(entry.fileName)) {
          // 目录
          const dirPath = path.join(extractDir, entry.fileName);
          fs.mkdir(dirPath, { recursive: true })
            .then(() => {
              console.log(`创建目录: ${dirPath}`);
              zipfile.readEntry();
            })
            .catch((err) => {
              console.error(`创建目录失败: ${dirPath}`, err);
              reject(err);
            });
        } else {
          // 文件
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error(`打开文件流失败: ${entry.fileName}`, err);
              reject(err);
              return;
            }

            const filePath = path.join(extractDir, entry.fileName);
            const dirPath = path.dirname(filePath);
            
            // 确保目录存在
            fs.mkdir(dirPath, { recursive: true })
              .then(() => {
                const writeStream = createWriteStream(filePath);
                
                pipeline(readStream, writeStream)
                  .then(() => {
                    console.log(`解压文件完成: ${entry.fileName}`);
                    zipfile.readEntry();
                  })
                  .catch((err) => {
                    console.error(`解压文件失败: ${entry.fileName}`, err);
                    reject(err);
                  });
              })
              .catch((err) => {
                console.error(`创建文件目录失败: ${dirPath}`, err);
                reject(err);
              });
          });
        }
      });

      zipfile.on('end', () => {
        console.log(`ZIP解压完成，共处理 ${entryCount} 个条目`);
        resolve();
      });

      zipfile.on('error', (err) => {
        console.error('ZIP文件处理错误:', err);
        reject(err);
      });
    });
  });
}

async function findSqlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        const subFiles = await findSqlFiles(itemPath);
        files.push(...subFiles);
      } else if (item.endsWith('.sql')) {
        files.push(itemPath);
      }
    }
  } catch (err) {
    console.error('查找SQL文件失败:', err);
  }
  
  return files;
}

async function restoreDatabase(sqlFilePath: string, databaseType: DatabaseType): Promise<{ total: number; success: number; skipped: number; failed: number; firstErrors?: Array<{ index: number; message: string }> }> {
  const supabase = databaseType === 'supabase' ? getServiceSupabase() : null;
  
  try {
    console.log('开始恢复数据库，SQL文件:', sqlFilePath);
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    console.log('SQL文件大小:', sqlContent.length, '字符');

    // 对于本地/生产直连：一次性执行整份 SQL，避免按分号拆分导致的字符串/数组内分隔问题
    if (databaseType !== 'supabase') {
      // 安全分句 + 内联修复后逐条执行（避免 ARRAY/JSON 在整包里残留语法问题）
      const repairedWhole = ensureArrayColumnDDLFixes(sanitizeLeakedConversation(wrapBareJsonObjectsGeneric(ensureJsonCastsInline(robustReplaceArrayLiterals(sqlContent)))));
      const stmts = splitSqlStatements(repairedWhole);
      const { client } = createDatabaseConnection(databaseType);
      await (client as import('pg').Client).connect();
      let ok = 0, skip = 0;
      try {
        for (const statement of stmts) {
          if (!statement.trim()) { skip++; continue; }
          try {
            await (client as import('pg').Client).query(statement);
            ok++;
          } catch (e) {
            // 对已存在/不存在/重复键等非致命错误跳过
            const msg = e instanceof Error ? e.message : String(e);
            if (/(already exists|does not exist|duplicate key)/i.test(msg)) { skip++; continue; }
            // JSON 无效：将整条语句的裸 JSON 全部包成 to_jsonb('...') 再试
            if (/invalid input syntax for type json/i.test(msg) || /JSON data/i.test(msg)) {
              const jsonStringified = replaceBareJsonWithToJsonbInStatement(statement);
              try {
                await (client as import('pg').Client).query(jsonStringified);
                ok++;
                continue;
              } catch {/* 继续后续回退 */}
            }
            // 针对 ARRAY/JSON 语法再做一次单语句级修复并重试
            if (/syntax error/i.test(msg)) {
              const retryStmt = ensureJsonCastsInline(robustReplaceArrayLiterals(statement));
              try {
                await (client as import('pg').Client).query(retryStmt);
                ok++;
                continue;
              } catch {
                // const msg2 = e2 instanceof Error ? e2.message : String(e2);
                // 最后兜底：更激进的 ARRAY 捕获
                const aggressive = retryStmt.replace(/ARRAY\s*\[([\s\S]*?)\]/gi, (_m, inner: string) => {
                  // 简化拆分（不感知引号），作为兜底
                  const parts = inner.split(',').map(s => `"${String(s).trim().replace(/"/g, '\\"')}"`).join(',');
                  return `'{${parts}}'::text[]`;
                });
                try {
                  await (client as import('pg').Client).query(aggressive);
                  ok++;
                  continue;
                } catch (e3) {
                  throw e3;
                }
              }
            }
            throw e;
          }
        }
      } finally {
        await (client as import('pg').Client).end();
      }
      console.log(`数据库分句恢复完成: 成功 ${ok} 跳过 ${skip}`);
      return { total: stmts.length, success: ok, skipped: skip, failed: stmts.length - ok - skip };
    }

    // Supabase 路径：需要逐条执行，保留原有批处理（存在语句内分号风险，但 exec_sql 仅支持单语句）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log('找到', statements.length, '个SQL语句');

    const BATCH_SIZE = 10;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const firstErrors: Array<{ index: number; message: string }> = [];

    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (statement, batchIndex) => {
        const globalIndex = i + batchIndex;
        if (!statement.trim()) return { success: true, index: globalIndex };
        try {
          const { error } = await (supabase as ReturnType<typeof getServiceSupabase>).rpc('exec_sql', { sql: statement });
          if (error) {
            if (
              !error.message.includes('already exists') &&
              !error.message.includes('does not exist') &&
              !error.message.includes('duplicate key')
            ) {
              throw error;
            } else {
              return { success: true, index: globalIndex, skipped: true };
            }
          } else {
            return { success: true, index: globalIndex };
          }
        } catch (err) {
          if (err instanceof Error) {
            if (firstErrors.length < 5) firstErrors.push({ index: globalIndex + 1, message: err.message });
            return { success: false, index: globalIndex, error: err.message };
          }
          return { success: false, index: globalIndex, error: '未知错误' };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => {
        if (result.success) {
          if ((result as { skipped?: boolean }).skipped) skippedCount++; else successCount++;
        } else {
          errorCount++;
        }
      });
    }

    console.log(`数据库恢复完成: 成功 ${successCount} 个，跳过 ${skippedCount} 个，失败 ${errorCount} 个语句`);
    return { total: statements.length, success: successCount, skipped: skippedCount, failed: errorCount, firstErrors };
  } catch (err) {
    console.error('恢复数据库失败:', err);
    throw err;
  }
}

async function restoreStorage(storageDir: string, incrementalMode: boolean = false, databaseType: DatabaseType = 'supabase'): Promise<void> {
  const { getSupabaseFor } = await import('@/lib/supabaseEnv');
  const supabase = getSupabaseFor(databaseType);
  
  try {
    const items = await fs.readdir(storageDir);
    const bucketDirs = [];
    
    // 收集所有存储桶目录
    for (const item of items) {
      const itemPath = path.join(storageDir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        bucketDirs.push({
          name: item,
          path: itemPath
        });
      }
    }
    
    console.log(`找到 ${bucketDirs.length} 个存储桶目录，开始并行处理...`);
    
    // 并行处理所有存储桶
    const bucketPromises = bucketDirs.map(async (bucketDir) => {
      const bucketName = bucketDir.name;
      
      try {
        // 检查存储桶是否存在
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === bucketName);
        
        if (!bucketExists) {
          // 创建存储桶
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: false,
          });
          
          if (createError) {
            console.error(`创建存储桶 ${bucketName} 失败:`, createError);
            return { bucketName, success: false, error: createError.message };
          }
          console.log(`创建存储桶 ${bucketName} 成功`);
        }
        
        // 上传文件
        await uploadDirectoryToBucket(supabase, bucketDir.path, bucketName, '', incrementalMode);
        
        return { bucketName, success: true };
      } catch (err) {
        console.error(`处理存储桶 ${bucketName} 失败:`, err);
        return { bucketName, success: false, error: err instanceof Error ? err.message : '未知错误' };
      }
    });
    
    // 等待所有存储桶处理完成
    const results = await Promise.all(bucketPromises);
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`存储桶恢复完成: 成功 ${successCount} 个，失败 ${failureCount} 个`);
    
    if (failureCount > 0) {
      const failedBuckets = results.filter(r => !r.success).map(r => `${r.bucketName}(${r.error})`);
      console.warn(`失败的存储桶: ${failedBuckets.join(', ')}`);
    }
    
  } catch (err) {
    console.error('恢复存储桶失败:', err);
    throw err;
  }
}

async function copyBackupFromHistory(backupPath: string, tempDir: string): Promise<void> {
  try {
    console.log('开始从历史备份复制:', backupPath);
    console.log('复制到临时目录:', tempDir);
    
    // 检查备份路径是否存在
    await fs.access(backupPath);
    console.log('备份路径存在，获取文件信息...');
    
    const stats = await fs.stat(backupPath);
    console.log('文件信息:', {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime
    });
    
    if (stats.isFile()) {
      // 如果是文件，直接复制
      const fileName = path.basename(backupPath);
      const destPath = path.join(tempDir, fileName);
      console.log(`复制文件: ${backupPath} -> ${destPath}`);
      
      await fs.copyFile(backupPath, destPath);
      console.log('文件复制完成');
      
      // 如果是ZIP文件，解压
      if (fileName.endsWith('.zip')) {
        console.log('检测到ZIP文件，开始解压...');
        await extractZip(destPath, tempDir);
        console.log('ZIP文件解压完成');
      } else {
        console.log('非ZIP文件，跳过解压');
      }
    } else if (stats.isDirectory()) {
      // 如果是目录，复制整个目录
      console.log('检测到目录，开始复制整个目录...');
      await copyDirectory(backupPath, tempDir);
      console.log('目录复制完成');
    } else {
      throw new Error('不支持的备份文件类型');
    }
    
    console.log('从历史备份复制完成');
  } catch (err) {
    console.error('从历史备份复制失败:', err);
    if (err instanceof Error) {
      console.error('错误详情:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
    }
    throw new Error(`从历史备份复制失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  try {
    await fs.mkdir(dest, { recursive: true });
    
    const items = await fs.readdir(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stats = await fs.stat(srcPath);
      
      if (stats.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    console.error('复制目录失败:', err);
    throw err;
  }
}

async function uploadDirectoryToBucket(
  supabase: ReturnType<(typeof import('@/lib/supabaseEnv'))['getSupabaseFor']>,
  dirPath: string,
  bucketName: string,
  prefix: string = '',
  incrementalMode: boolean = false
): Promise<void> {
  try {
    console.log(`开始批量检查存储桶 ${bucketName} 中的现有文件...`);
    
    // 先获取存储桶中所有现有文件的列表
    const existingFiles = await getAllFilesFromBucket(supabase, bucketName, prefix);
    const existingFileSet = new Set(existingFiles);
    
    console.log(`存储桶 ${bucketName} 中现有文件数量: ${existingFiles.length}`);
    
    // 收集所有需要上传的文件
    const filesToUpload = await collectFilesToUpload(dirPath, prefix, existingFileSet, incrementalMode);
    
    console.log(`存储桶 ${bucketName} 需要上传 ${filesToUpload.length} 个文件`);
    
    if (filesToUpload.length === 0) {
      console.log(`存储桶 ${bucketName} 没有需要上传的文件`);
      return;
    }
    
    // 高性能并行上传文件 - 优化
    const CONCURRENT_UPLOADS = 30; // 提高并发上传数量
    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`开始批量上传 ${filesToUpload.length} 个文件，并发数: ${CONCURRENT_UPLOADS}`);
    
    for (let i = 0; i < filesToUpload.length; i += CONCURRENT_UPLOADS) {
      const batch = filesToUpload.slice(i, i + CONCURRENT_UPLOADS);
      
      const uploadPromises = batch.map(async (fileInfo) => {
        const maxRetries = 3;
        let retries = 0;
        
        while (retries < maxRetries) {
          try {
            const fileBuffer = await fs.readFile(fileInfo.filePath);
            
            const { error } = await supabase.storage
              .from(bucketName)
              .upload(fileInfo.relativePath, fileBuffer, {
                upsert: !incrementalMode // 非增量模式覆盖现有文件
              });
            
            if (error) {
              if (retries < maxRetries - 1) {
                retries++;
                console.warn(`上传文件 ${fileInfo.relativePath} 失败，重试 ${retries}/${maxRetries}:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 200 * retries)); // 递增延迟
                continue;
              } else {
                console.error(`上传文件 ${fileInfo.relativePath} 最终失败:`, error);
                return { success: false, file: fileInfo.relativePath, error: error.message };
              }
            } else {
              return { success: true, file: fileInfo.relativePath, retries };
            }
          } catch (err) {
            if (retries < maxRetries - 1) {
              retries++;
              console.warn(`处理文件 ${fileInfo.relativePath} 失败，重试 ${retries}/${maxRetries}:`, err);
              await new Promise(resolve => setTimeout(resolve, 200 * retries));
              continue;
            } else {
              console.error(`处理文件 ${fileInfo.relativePath} 最终失败:`, err);
              return { success: false, file: fileInfo.relativePath, error: err instanceof Error ? err.message : '未知错误' };
            }
          }
        }
        
        return { success: false, file: fileInfo.relativePath, error: '达到最大重试次数' };
      });
      
      const results = await Promise.all(uploadPromises);
      
      // 统计结果
      results.forEach(result => {
        if (result.success) {
          uploadedCount++;
        } else {
          errorCount++;
        }
      });
      
      const batchSuccess = results.filter(r => r.success).length;
      const batchFailure = results.filter(r => !r.success).length;
      const progress = Math.round(((i + CONCURRENT_UPLOADS) / filesToUpload.length) * 100);
      console.log(`批次 ${Math.floor(i / CONCURRENT_UPLOADS) + 1} 完成: 成功 ${batchSuccess} 个，失败 ${batchFailure} 个，进度 ${Math.min(progress, 100)}%`);
    }
    
    skippedCount = filesToUpload.length - uploadedCount - errorCount;
    console.log(`存储桶 ${bucketName} 上传完成: 成功 ${uploadedCount} 个，跳过 ${skippedCount} 个，失败 ${errorCount} 个`);
  } catch (err) {
    console.error('上传目录到存储桶失败:', err);
    throw err;
  }
}

// 收集需要上传的文件
async function collectFilesToUpload(
  dirPath: string,
  prefix: string,
  existingFileSet: Set<string>,
  incrementalMode: boolean
): Promise<Array<{ filePath: string; relativePath: string }>> {
  const filesToUpload: Array<{ filePath: string; relativePath: string }> = [];
  
  const items = await fs.readdir(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = await fs.stat(itemPath);
    
    if (stats.isDirectory()) {
      // 递归处理子目录
      const subFiles = await collectFilesToUpload(itemPath, `${prefix}${item}/`, existingFileSet, incrementalMode);
      filesToUpload.push(...subFiles);
    } else {
      // 检查文件是否已存在
      const filePath = `${prefix}${item}`;
      
      if (incrementalMode) {
        // 增量模式：只上传数据库中不存在的文件
        if (existingFileSet.has(filePath)) {
          continue; // 跳过已存在的文件
        }
      } else {
        // 完整模式：检查文件是否已存在
        if (existingFileSet.has(filePath)) {
          continue; // 跳过已存在的文件
        }
      }
      
      // 添加到上传列表
      filesToUpload.push({
        filePath: itemPath,
        relativePath: filePath
      });
    }
  }
  
  return filesToUpload;
}

// 获取存储桶中所有文件的递归函数
async function getAllFilesFromBucket(
  supabase: ReturnType<(typeof import('@/lib/supabaseEnv'))['getSupabaseFor']>,
  bucketName: string,
  prefix: string = ''
): Promise<string[]> {
  const allFiles: string[] = [];
  
  try {
    const { data: files } = await supabase.storage
      .from(bucketName)
      .list(prefix, { 
        limit: 1000, 
        sortBy: { column: 'name', order: 'asc' },
        offset: 0
      });

    if (files) {
      for (const file of files as Array<{ name: string; metadata?: { size?: number } }>) {
        const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
        
        if (file.metadata && file.metadata.size !== undefined) {
          // 这是一个文件
          allFiles.push(fullPath);
        } else {
          // 这是一个目录，递归获取
          const subFiles = await getAllFilesFromBucket(supabase, bucketName, fullPath);
          allFiles.push(...subFiles);
        }
      }
    }
  } catch (err) {
    console.error(`获取存储桶 ${bucketName} 文件列表失败:`, err);
  }
  
  return allFiles;
}

// NDJSON格式数据库恢复函数
async function restoreNdjsonDatabase(
  backupDir: string, 
  manifest: { version: string; tables: Array<{ name: string; data_file: string; rows: number; columns: number }> }, 
  databaseType: DatabaseType
): Promise<{ total: number; success: number; skipped: number; failed: number; firstErrors?: Array<{ index: number; message: string }> }> {
  const summary = { total: 0, success: 0, skipped: 0, failed: 0, firstErrors: [] as Array<{ index: number; message: string }> };
  
  try {
    console.log('开始NDJSON数据库恢复，格式版本:', manifest.version);
    
    // 1. 首先执行schema.clean.sql创建表结构
    const schemaPath = path.join(backupDir, 'schema.clean.sql');
    try {
      await fs.readFile(schemaPath, 'utf8');
      console.log('开始执行schema.clean.sql创建表结构...');
      
      const schemaResult = await restoreDatabase(schemaPath, databaseType);
      console.log('Schema创建完成:', schemaResult);
      
      if (schemaResult.failed > 0) {
        console.warn('Schema创建有部分失败，但继续数据恢复');
      }
    } catch (err) {
      console.error('Schema文件读取或执行失败:', err);
      summary.failed++;
      return summary;
    }
    
    // 2. 遍历每个表的NDJSON文件并插入数据
    
    for (const tableInfo of manifest.tables) {
      const tableName = tableInfo.name;
      const ndjsonPath = path.join(backupDir, tableInfo.data_file);
      
      console.log(`开始恢复表 ${tableName}...`);
      summary.total++;
      
      try {
        // 检查NDJSON文件是否存在
        const ndjsonContent = await fs.readFile(ndjsonPath, 'utf8');
        const lines = ndjsonContent.trim().split('\n');
        
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
          console.log(`表 ${tableName} 无数据，跳过`);
          summary.skipped++;
          continue;
        }
        
        console.log(`表 ${tableName} 有 ${lines.length} 行数据`);
        
        // 解析每行JSON并构建INSERT语句
        const rows = [];
        for (const line of lines) {
          if (line.trim()) {
            try {
              rows.push(JSON.parse(line));
            } catch (parseErr) {
              console.warn(`解析JSON行失败: ${line.substring(0, 100)}...`, parseErr);
            }
          }
        }
        
        if (rows.length === 0) {
          console.log(`表 ${tableName} 解析后无有效数据，跳过`);
          summary.skipped++;
          continue;
        }
        
        // 获取列名
        const firstRow = rows[0];
        const columns = Object.keys(firstRow);
        
        // 分批插入数据（宽松模式）
        const BATCH_SIZE = 500;
        let insertedRows = 0;
        
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          
          try {
            const result = await insertNdjsonBatch(tableName, columns, batch, databaseType);
            insertedRows += result.success;
            if (result.failed > 0) {
              console.warn(`表 ${tableName} 批次 ${Math.floor(i / BATCH_SIZE) + 1} 有 ${result.failed} 行插入失败`);
            }
          } catch (batchErr) {
            console.error(`表 ${tableName} 批次 ${Math.floor(i / BATCH_SIZE) + 1} 插入失败:`, batchErr);
          }
        }
        
        console.log(`表 ${tableName} 恢复完成: ${insertedRows}/${rows.length} 行`);
        summary.success++;
        
      } catch (err) {
        console.error(`恢复表 ${tableName} 失败:`, err);
        summary.failed++;
        summary.firstErrors.push({
          index: summary.total - 1,
          message: `表 ${tableName}: ${err instanceof Error ? err.message : '未知错误'}`
        });
      }
    }
    
    console.log('NDJSON数据库恢复完成:', summary);
    return summary;
    
  } catch (error) {
    console.error('NDJSON数据库恢复失败:', error);
    summary.failed++;
    summary.firstErrors.push({
      index: 0,
      message: error instanceof Error ? error.message : '未知错误'
    });
    return summary;
  }
}

// 宽松模式批量插入NDJSON数据
async function insertNdjsonBatch(
  tableName: string, 
  columns: string[], 
  rows: Record<string, unknown>[], 
  databaseType: DatabaseType
): Promise<{ success: number; failed: number }> {
  const result = { success: 0, failed: 0 };
  
  try {
    // 构建INSERT语句
    const quotedColumns = columns.map(col => `"${col}"`).join(', ');
    const values = rows.map(row => {
      const rowValues = columns.map(col => {
        const value = row[col];
        return convertValueForInsert(value);
      });
      return `(${rowValues.join(', ')})`;
    });
    
    const insertSql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES ${values.join(', ')};`;
    
    // 执行插入
    if (databaseType === 'local' || databaseType === 'prod') {
      const { Pool } = await import('pg');
      const connectionString = databaseType === 'local' 
        ? process.env.LOCAL_DB_URL 
        : process.env.DATABASE_URL;
      
      if (!connectionString) {
        throw new Error(`缺少${databaseType === 'local' ? 'LOCAL_DB_URL' : 'DATABASE_URL'}环境变量`);
      }
      
      const pool = new Pool({ connectionString });
      try {
        await pool.query(insertSql);
        result.success = rows.length;
      } catch (err) {
        console.error(`PostgreSQL插入失败，尝试逐行插入:`, err);
        // 逐行插入（宽松模式）
        for (const row of rows) {
          try {
            const singleValues = columns.map(col => convertValueForInsert(row[col]));
            const singleSql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${singleValues.join(', ')});`;
            await pool.query(singleSql);
            result.success++;
          } catch (rowErr) {
            console.warn(`行插入失败:`, row, rowErr);
            result.failed++;
          }
        }
      } finally {
        await pool.end();
      }
    } else {
      // Supabase
      const supabase = getServiceSupabase();
      try {
        const { error } = await supabase.rpc('exec_sql', { query: insertSql });
        if (error) throw error;
        result.success = rows.length;
      } catch (err) {
        console.error(`Supabase插入失败，尝试逐行插入:`, err);
        // 逐行插入（宽松模式）
        for (const row of rows) {
          try {
            const singleValues = columns.map(col => convertValueForInsert(row[col]));
            const singleSql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${singleValues.join(', ')});`;
            const { error: rowError } = await supabase.rpc('exec_sql', { query: singleSql });
            if (rowError) throw rowError;
            result.success++;
          } catch (rowErr) {
            console.warn(`行插入失败:`, row, rowErr);
            result.failed++;
          }
        }
      }
    }
    
  } catch (error) {
    console.error('批量插入失败:', error);
    result.failed = rows.length;
  }
  
  return result;
}

// 将值转换为SQL插入格式（宽松模式）
function convertValueForInsert(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  
  if (typeof value === 'number') {
    return isFinite(value) ? String(value) : 'NULL';
  }
  
  if (Array.isArray(value)) {
    try {
      // 尝试将数组转换为PostgreSQL数组格式
      const items = value.map(item => {
        if (item === null || item === undefined) return 'NULL';
        const str = String(item).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `"${str}"`;
      });
      return `'{${items.join(',')}}'::text[]`;
    } catch (err) {
      console.warn('数组转换失败，使用空数组:', err);
      return "'{}'::text[]";
    }
  }
  
  if (typeof value === 'object') {
    try {
      // JSON对象
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    } catch (err) {
      console.warn('JSON转换失败，使用空对象:', err);
      return "'{}'::jsonb";
    }
  }
  
  // 字符串和其他类型
  return `'${String(value).replace(/'/g, "''")}'`;
}

