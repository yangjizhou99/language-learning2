// Sync all Storage buckets and objects from a remote Supabase project to local Supabase
// - Requires env vars:
//   REMOTE_SUPABASE_URL, REMOTE_SERVICE_ROLE_KEY
//   LOCAL_SUPABASE_URL (default: http://127.0.0.1:54321)
//   LOCAL_SERVICE_ROLE_KEY (read from .env.local if not provided)
// - Behavior: upsert/overwrite existing objects

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

// Try reading .env.local for local keys if not set
function loadEnvLocalIntoProcess() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}

loadEnvLocalIntoProcess();

const REMOTE_URL = 'https://yyfyieqfuwwyqrlewswu.supabase.co';
const REMOTE_SERVICE_KEY = 'sb_secret_tz-8xbr9v1f5jlne0-KK_g_MH7R5L21';
const LOCAL_URL = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY =
  process.env.LOCAL_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!LOCAL_SERVICE_KEY) {
  console.error('Missing env: LOCAL_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const remote = createClient(REMOTE_URL, REMOTE_SERVICE_KEY, { auth: { persistSession: false } });
const local = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, { auth: { persistSession: false } });

const MAX_CONCURRENCY = 16;

async function ensureLocalBucket(name, isPublic) {
  // Try create bucket; if exists, ignore
  await local.storage.createBucket(name, { public: isPublic }).catch(() => {});
}

async function listAllBucketsRemote() {
  const { data, error } = await remote.storage.listBuckets();
  if (error) throw error;
  return data || [];
}

async function listFolder(remoteClient, bucket, prefix) {
  const { data, error } = await remoteClient.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  return data || [];
}

async function forEachObject(remoteClient, bucket, onFile) {
  const stack = [''];
  const allFiles = [];

  // First pass: collect all files
  while (stack.length) {
    const dir = stack.pop();
    const items = await listFolder(remoteClient, bucket, dir);
    for (const item of items) {
      const isFile = !!(item.metadata && (item.metadata.mimetype || item.metadata.size));
      const fullPath = dir ? `${dir}/${item.name}`.replace(/\/+/g, '/') : item.name;
      if (isFile) {
        allFiles.push({ path: fullPath, item });
      } else {
        stack.push(fullPath);
      }
    }
  }

  // Second pass: process all files concurrently
  const limit = await pLimit(MAX_CONCURRENCY);
  const promises = allFiles.map(({ path, item }) => limit(() => onFile(path, item)));
  await Promise.all(promises);
}

async function downloadRemoteFile(remoteClient, bucket, filePath) {
  const { data, error } = await remoteClient.storage.from(bucket).download(filePath);
  if (error) throw error;
  // data is a Blob; convert to ArrayBuffer then Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadLocalFile(localClient, bucket, filePath, body, contentType) {
  const { error } = await localClient.storage
    .from(bucket)
    .upload(filePath, body, { upsert: true, contentType });
  if (error) throw error;
}

async function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    active--;
    if (queue.length) queue.shift()();
  };
  return async (fn) => {
    if (active >= concurrency) await new Promise((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

async function main() {
  console.log('Listing remote buckets...');
  const buckets = await listAllBucketsRemote();
  console.log(`Found ${buckets.length} buckets`);

  for (const b of buckets) {
    console.log(`\nSync bucket: ${b.name} (public=${b.public})`);
    await ensureLocalBucket(b.name, b.public);

    let filesCount = 0;
    let errorsCount = 0;
    const startTime = Date.now();

    await forEachObject(remote, b.name, async (filePath, item) => {
      try {
        const body = await downloadRemoteFile(remote, b.name, filePath);
        const contentType = item?.metadata?.mimetype || undefined;
        await uploadLocalFile(local, b.name, filePath, body, contentType);
        filesCount++;
        if (filesCount % 100 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = filesCount / elapsed;
          console.log(`  Uploaded ${filesCount} files... (${rate.toFixed(1)} files/sec)`);
        }
      } catch (e) {
        errorsCount++;
        console.error(`  Failed ${filePath}:`, e.message || e);
      }
    });

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = filesCount / elapsed;
    console.log(
      `Bucket ${b.name} done. Uploaded=${filesCount}, Errors=${errorsCount}, Rate=${rate.toFixed(1)} files/sec`,
    );
  }
  console.log('\nAll buckets synchronized.');
}

main().catch((e) => {
  console.error('Sync failed:', e?.message || e);
  process.exit(1);
});
