import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  await fs.mkdir(extractDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('无法打开ZIP文件'));

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const entryPath = path.join(extractDir, entry.fileName);
        if (/\/$/.test(entry.fileName)) {
          fs.mkdir(entryPath, { recursive: true })
            .then(() => zipfile.readEntry())
            .catch(reject);
        } else {
          zipfile.openReadStream(entry, (err2, readStream) => {
            if (err2 || !readStream) return reject(err2 || new Error('无法读取ZIP流'));
            fs.mkdir(path.dirname(entryPath), { recursive: true })
              .then(async () => {
                const writeStream = createWriteStream(entryPath);
                await pipeline(readStream, writeStream);
                zipfile.readEntry();
              })
              .catch(reject);
          });
        }
      });
      zipfile.on('end', () => resolve());
      zipfile.on('error', reject);
    });
  });
}

async function findSqlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const items = await fs.readdir(dir);
  for (const item of items) {
    const p = path.join(dir, item);
    const st = await fs.stat(p);
    if (st.isDirectory()) {
      const sub = await findSqlFiles(p);
      out.push(...sub);
    } else if (item.endsWith('.sql')) {
      out.push(p);
    }
  }
  return out;
}

function tokenizeArrayInner(inner: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'") {
      // 处理转义单引号
      if (inQuote && inner[i + 1] === "'") { buf += "''"; i++; continue; }
      inQuote = !inQuote;
      buf += ch;
      continue;
    }
    if (ch === ',' && !inQuote) {
      const t = buf.trim();
      if (t) tokens.push(t);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) tokens.push(last);
  return tokens;
}

function toTextArrayLiteralToken(token: string): string {
  // 去引号
  if (token.startsWith("'") && token.endsWith("'")) {
    const unq = token.slice(1, -1).replace(/''/g, "'");
    const esc = unq.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${esc}"`;
  }
  // 数字/布尔/NULL 也当作字符串存入 text[]
  const esc = token.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${esc}"`;
}

function repairArrayLiterals(sql: string): string {
  // 捕获任意 ARRAY[ ... ]
  return sql.replace(/ARRAY\s*\[([\s\S]*?)\]/g, (_m, inner: string) => {
    const items = tokenizeArrayInner(inner).map(toTextArrayLiteralToken);
    return `'{${items.join(',')}}'::text[]`;
  });
}

function ensureJsonCasts(sql: string): string {
  // 将 ::jsonb 丢失的常见场景进行补齐（仅当值看起来是JSON对象/数组且未被引号包裹）
  // INSERT ... VALUES (..., { ... }, ...)
  let out = sql.replace(/(VALUES\s*\([^\)]*?)(\{[\s\S]*?\})([^\)]*\))/gms, (_m, pre: string, obj: string, post: string) => {
    if (/['"]\s*$/.test(pre)) return `${pre}${obj}${post}`;
    const wrapped = `'${obj.replace(/'/g, "''")}'::jsonb`;
    return `${pre}${wrapped}${post}`;
  });
  // UPDATE ... SET col = { ... }
  out = out.replace(/(SET\s+[^=]+?=\s*)(\{[\s\S]*?\})(\s*(,|WHERE|RETURNING|;))/gms, (_m, pre: string, obj: string, tail: string) => {
    if (/['"]\s*$/.test(pre)) return `${pre}${obj}${tail}`;
    const wrapped = `'${obj.replace(/'/g, "''")}'::jsonb`;
    return `${pre}${wrapped}${tail}`;
  });
  return out;
}

async function createZipFile(files: { path: string; name: string }[], outputPath: string): Promise<void> {
  const archiver = await import('archiver');
  const { createWriteStream } = await import('fs');
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver.default('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);
    for (const f of files) archive.file(f.path, { name: f.name });
    archive.finalize();
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: '请使用表单上传ZIP文件' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '未选择文件' }, { status: 400 });

    const tempDir = path.join(process.cwd(), 'temp', 'repair', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });
    const uploadPath = path.join(tempDir, file.name);
    await fs.writeFile(uploadPath, Buffer.from(await file.arrayBuffer()));

    const extractDir = path.join(tempDir, 'extract');
    await extractZip(uploadPath, extractDir);

    const sqlFiles = await findSqlFiles(extractDir);
    if (sqlFiles.length === 0) {
      return NextResponse.json({ error: 'ZIP中未找到SQL文件' }, { status: 400 });
    }

    const originalSql = await fs.readFile(sqlFiles[0], 'utf8');
    // 依次应用修复
    let repaired = originalSql;
    repaired = repairArrayLiterals(repaired);
    repaired = ensureJsonCasts(repaired);

    const repairedSqlPath = path.join(tempDir, 'repaired.sql');
    await fs.writeFile(repairedSqlPath, repaired, 'utf8');

    // 打包为新ZIP（仅包含修复后的SQL；如需带存储，可把 extractDir/storage 一并加入）
    const outZip = path.join(tempDir, `repaired-backup-${Date.now()}.zip`);
    const files: { path: string; name: string }[] = [
      { path: repairedSqlPath, name: 'database-backup-repaired.sql' },
    ];
    // 附带原有 storage 目录（如果存在）
    const storageDir = path.join(extractDir, 'storage');
    try {
      const st = await fs.stat(storageDir);
      if (st.isDirectory()) {
        // 收集 storage 目录
        async function collect(dir: string, base: string = 'storage'): Promise<{ path: string; name: string }[]> {
          const acc: { path: string; name: string }[] = [];
          const entries = await fs.readdir(dir);
          for (const e of entries) {
            const p = path.join(dir, e);
            const s = await fs.stat(p);
            if (s.isDirectory()) {
              acc.push(...await collect(p, path.join(base, e)));
            } else {
              acc.push({ path: p, name: path.join(base, e) });
            }
          }
          return acc;
        }
        files.push(...await collect(storageDir));
      }
    } catch {}

    await createZipFile(files, outZip);
    const fileBuffer = await fs.readFile(outZip);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    ) as ArrayBuffer;
    const body = new Blob([arrayBuffer], { type: 'application/zip' });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="repaired-backup.zip"`,
      },
    });
  } catch (err) {
    console.error('修复旧包失败:', err);
    return NextResponse.json({ error: '修复失败', details: err instanceof Error ? err.message : '未知错误' }, { status: 500 });
  }
}


