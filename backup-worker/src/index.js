import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mime from 'mime';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== ENV & Paths =====
const PORT = process.env.PORT || 7788;
const API_KEY = process.env.API_KEY || '';
const BACKUP_ROOT = process.env.BACKUP_ROOT || '/data/backups';
const ALLOW_PATHS = (process.env.ALLOW_PATHS || '').split(':').filter(Boolean);

await fsp.mkdir(BACKUP_ROOT, { recursive: true });
await fsp.mkdir(path.join(BACKUP_ROOT, 'db'), { recursive: true });
await fsp.mkdir(path.join(BACKUP_ROOT, 'files'), { recursive: true });
await fsp.mkdir(path.join(BACKUP_ROOT, 'tmp'), { recursive: true });
await fsp.mkdir(path.join(BACKUP_ROOT, 'logs'), { recursive: true });

// ===== App =====
const app = express();
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(morgan('tiny'));

// 鉴权中间件（健康检查不需要鉴权）
app.use((req, res, next) => {
  // 健康检查不需要鉴权
  if (req.path === '/healthz') return next();
  
  const k = req.header('x-api-key');
  if (!API_KEY || k === API_KEY) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

// 小工具
const randId = () => crypto.randomBytes(8).toString('hex');
const inAllowList = p => ALLOW_PATHS.some(ap => p === ap || p.startsWith(ap + '/'));
const writeLog = async (logFile, line) => {
  await fsp.appendFile(logFile, `[${new Date().toISOString()}] ${line}\n`);
};

const jobs = new Map();
const newJob = (type, filePath = null) => {
  const id = randId();
  const logFile = path.join(BACKUP_ROOT, 'logs', `${id}.log`);
  const j = { id, type, status: 'running', filePath, logFile, startAt: Date.now(), endAt: null };
  jobs.set(id, j);
  return j;
};

const finishJob = async (job, ok) => {
  job.status = ok ? 'succeeded' : 'failed';
  job.endAt = Date.now();
  await writeLog(job.logFile, `JOB ${ok ? 'OK' : 'FAILED'}`);
};

// 执行 shell，将 stdout/err 记录到日志
const runSh = (job, cmd) => new Promise(resolve => {
  writeLog(job.logFile, `RUN: ${cmd}`);
  const child = spawn('/bin/sh', ['-lc', cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => writeLog(job.logFile, d.toString().trim()));
  child.stderr.on('data', d => writeLog(job.logFile, d.toString().trim()));
  child.on('close', code => resolve(code === 0));
});

// ===== DB: 列出表 =====
app.get('/db/tables', async (req, res) => {
  const { conn } = req.query;
  if (!conn) return res.status(400).json({ error: 'missing conn' });
  const job = newJob('db.tables');
  const sql = "SELECT table_schema||'.'||table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1";
  const cmd = `psql "${conn}" -Atc "${sql}"`;
  const ok = await runSh(job, cmd);
  const text = await fsp.readFile(job.logFile, 'utf8');
  await finishJob(job, ok);
  if (!ok) return res.status(500).json({ error: 'psql failed', job });
  const lines = text.split('\n').filter(l => l && !l.includes('RUN:'));
  const tables = lines.filter(l => l.includes('.'));
  res.json({ tables, jobId: job.id });
});

// ===== DB: 备份 =====
app.post('/db/backup', async (req, res) => {
  const { conn, tables = [], format = 'custom', compress = 'zstd', target = 'nas', filename } = req.body || {};
  if (!conn) return res.status(400).json({ error: 'missing conn' });
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0,19);
  const base = filename || `db_${ts}.${format === 'custom' ? 'dump' : 'sql'}`;
  const outPath = path.join(BACKUP_ROOT, 'db', base + (compress === 'zstd' ? '.zst' : ''));
  const tmpPath = target === 'download' ? path.join(BACKUP_ROOT, 'tmp', path.basename(outPath)) : outPath;
  const job = newJob('db.backup', tmpPath);

  const tableFlags = Array.isArray(tables) && tables.length ? tables.map(t => `-t ${t}`).join(' ') : '';
  const fmtFlag = format === 'custom' ? '-F c' : '-F p';

  let cmd = `pg_dump "${conn}" ${fmtFlag} ${tableFlags}`.trim();
  if (compress === 'zstd') cmd += ` | zstd -19 -T0 > "${tmpPath}"`;
  else cmd += ` > "${tmpPath}"`;

  const ok = await runSh(job, cmd);
  await finishJob(job, ok);
  if (!ok) return res.status(500).json({ error: 'backup failed', job });

  // 可选上传百度网盘
  if (target === 'baidunetdisk') {
    const remote = `/apps/your-app/db/${path.basename(tmpPath)}`;
    const upOk = await runSh(job, `BaiduPCS-Go upload "${tmpPath}" "${remote}"`);
    await finishJob(job, ok && upOk);
    if (!upOk) return res.status(500).json({ error: 'baidunetdisk upload failed', job });
  }

  res.json({ jobId: job.id, file: path.basename(tmpPath), target });
});

// ===== DB: 恢复 =====
const upload = multer({ dest: path.join(BACKUP_ROOT, 'tmp') });
app.post('/db/restore', upload.single('file'), async (req, res) => {
  const { conn } = req.body || {};
  if (!conn) return res.status(400).json({ error: 'missing conn' });
  if (!req.file) return res.status(400).json({ error: 'missing file' });

  const src = req.file.path;
  const job = newJob('db.restore');
  const isZst = src.endsWith('.zst');
  const isCustom = req.file.originalname.endsWith('.dump') || req.file.originalname.endsWith('.dump.zst');

  let cmd;
  if (isCustom) {
    // 自定义格式 → pg_restore
    cmd = isZst
      ? `zstdcat "${src}" | pg_restore -d "${conn}" -j 4 --no-owner --no-privileges`
      : `pg_restore -d "${conn}" -j 4 --no-owner --no-privileges "${src}"`;
  } else {
    // 纯 SQL → psql
    cmd = isZst
      ? `zstdcat "${src}" | psql "${conn}"`
      : `psql "${conn}" -f "${src}"`;
  }

  const ok = await runSh(job, cmd);
  await finishJob(job, ok);
  res.status(ok ? 200 : 500).json({ jobId: job.id, ok });
});

// ===== Files: 打包/备份（tar + zstd） =====
app.post('/files/backup', async (req, res) => {
  const { srcPaths = [], name, target = 'nas' } = req.body || {};
  if (!Array.isArray(srcPaths) || srcPaths.length === 0) return res.status(400).json({ error: 'missing srcPaths' });
  for (const p of srcPaths) if (!inAllowList(p)) return res.status(403).json({ error: `path not allowed: ${p}` });

  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0,19);
  const base = name || `files_${ts}.tar.zst`;
  const outPath = path.join(BACKUP_ROOT, 'files', base);
  const job = newJob('files.backup', outPath);

  // tar → zstd，逐个 -C 加入，避免 tar 里存绝对路径
  const parts = srcPaths.map(p => {
    const dir = path.dirname(p);
    const bn = path.basename(p);
    return `-C "${dir}" "${bn}"`;
  }).join(' ');

  const cmd = `tar -cf - ${parts} | zstd -19 -T0 > "${outPath}"`;
  const ok = await runSh(job, cmd);
  await finishJob(job, ok);
  res.status(ok ? 200 : 500).json({ jobId: job.id, file: path.basename(outPath) });
});

// ===== Files: 解包/恢复 =====
app.post('/files/restore', upload.single('file'), async (req, res) => {
  const { destPath } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'missing file' });
  if (!destPath || !inAllowList(destPath)) return res.status(403).json({ error: 'destPath not allowed' });

  const src = req.file.path;
  const job = newJob('files.restore');
  const isZst = src.endsWith('.zst');
  const cmd = isZst
    ? `zstdcat "${src}" | tar -xf - -C "${destPath}"`
    : `tar -xf "${src}" -C "${destPath}"`;
  const ok = await runSh(job, cmd);
  await finishJob(job, ok);
  res.status(ok ? 200 : 500).json({ jobId: job.id, ok });
});

// ===== Jobs: 状态 / 下载 =====
app.get('/jobs/:id/status', async (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'not found' });
  let tail = '';
  try {
    const buf = await fsp.readFile(j.logFile);
    tail = buf.toString().split('\n').slice(-200).join('\n');
  } catch {}
  res.json({ id: j.id, type: j.type, status: j.status, file: j.filePath ? path.basename(j.filePath) : null, logTail: tail, startAt: j.startAt, endAt: j.endAt });
});

app.get('/jobs/:id/download', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j || !j.filePath) return res.status(404).json({ error: 'not found' });
  const bn = path.basename(j.filePath);
  const ct = mime.getType(bn) || 'application/octet-stream';
  res.setHeader('Content-Type', ct);
  res.setHeader('Content-Disposition', `attachment; filename="${bn}"`);
  fs.createReadStream(j.filePath).pipe(res);
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`backup-worker listening on :${PORT}`);
});
