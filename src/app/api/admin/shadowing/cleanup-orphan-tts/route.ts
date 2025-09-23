export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

type CleanupRequest = {
  dryRun?: boolean;
  maxDelete?: number;
};

type CleanupResult = {
  ok: true;
  dryRun: boolean;
  bucket: string;
  referencedCount: number;
  scannedCount: number;
  orphanCount: number;
  deletedCount?: number;
  sampleOrphans?: string[];
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as CleanupRequest;
  const dryRun = body?.dryRun !== false; // 默认 dry-run
  const maxDelete = Number.isFinite(body?.maxDelete) && (body!.maxDelete as number) > 0 ? (body!.maxDelete as number) : 1000;

  const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
  const supabase = getServiceSupabase();

  // 1) 收集数据库中的已引用路径（bucket/path）
  const referenced = new Set<string>();

  // shadowing_items: audio_path 优先
  {
    const { data } = await auth.supabase
      .from('shadowing_items')
      .select('audio_bucket, audio_path, audio_url, notes')
      .limit(200000);
    for (const row of (data as any[] | null) || []) {
      const b = row.audio_bucket || 'tts';
      if (row.audio_path) referenced.add(`${b}/${row.audio_path}`);

      // 兼容旧字段：解析 audio_url/notes.audio_url
      const urls = [row.audio_url, row?.notes?.audio_url].filter(Boolean) as string[];
      for (const u of urls) {
        const p = extractPathFromUrl(u, b);
        if (p) referenced.add(`${b}/${p}`);
      }
    }
  }

  // shadowing_drafts: notes.audio_url 兼容
  {
    const { data } = await auth.supabase
      .from('shadowing_drafts')
      .select('notes, audio_url')
      .limit(200000);
    for (const row of (data as any[] | null) || []) {
      const urls = [row?.audio_url, row?.notes?.audio_url].filter(Boolean) as string[];
      for (const u of urls) {
        const p = extractPathFromUrl(u, bucket);
        if (p) referenced.add(`${bucket}/${p}`);
      }
    }
  }

  // 2) 扫描存储：列出 bucket 中的所有对象（按语言子目录遍历）
  const allObjects = new Set<string>();
  const languages = await collectCandidatePrefixes(auth.supabase, bucket, referenced);
  for (const lang of languages) {
    const keys = await listAllInFolder(supabase, bucket, lang);
    for (const k of keys) allObjects.add(`${bucket}/${k}`);
  }

  // 3) 计算孤儿
  const orphans: string[] = [];
  for (const key of allObjects) {
    if (!referenced.has(key)) {
      // key 形如 tts/ja/xxx.mp3 => 去掉前缀 bucket/
      const path = key.substring(bucket.length + 1);
      orphans.push(path);
    }
  }

  let deletedCount = 0;
  if (!dryRun && orphans.length > 0) {
    const toDelete = orphans.slice(0, maxDelete);
    // 分批删除，避免一次请求过大
    const chunkSize = 100;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      if (error) {
        return NextResponse.json({ error: `删除失败: ${error.message}` }, { status: 500 });
      }
      deletedCount += chunk.length;
    }
  }

  const res: CleanupResult = {
    ok: true,
    dryRun,
    bucket,
    referencedCount: referenced.size,
    scannedCount: allObjects.size,
    orphanCount: orphans.length,
    deletedCount: dryRun ? undefined : deletedCount,
    sampleOrphans: orphans.slice(0, 50),
  };
  return NextResponse.json(res);
}

function extractPathFromUrl(url: string, defaultBucket: string): string | null {
  try {
    if (!url) return null;
    if (url.includes('/api/storage-proxy')) {
      const u = new URL(url, 'http://local');
      const p = u.searchParams.get('path');
      return p ? decodeURIComponent(p) : null;
    }
    if (url.includes('/storage/v1/object/')) {
      const m = url.match(/\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/([^?]+)/);
      return m && m[1] ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function collectCandidatePrefixes(supabase: any, bucket: string, referenced: Set<string>): Promise<string[]> {
  // 从引用集中提取一级前缀（语言），再补充常见列表
  const langs = new Set<string>(['ja', 'zh', 'en']);
  for (const key of referenced) {
    const [, path] = key.split(`${bucket}/`);
    if (!path) continue;
    const lang = path.split('/')[0];
    if (lang) langs.add(lang);
  }
  return Array.from(langs);
}

async function listAllInFolder(supabase: any, bucket: string, folder: string): Promise<string[]> {
  const results: string[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`列出存储失败: ${error.message}`);
    const items = (data as any[]) || [];
    for (const it of items) {
      if (it?.name && !it?.id) {
        // 目录（如果存在），递归进入
        const sub = await listAllInFolder(supabase, bucket, `${folder}/${it.name}`);
        for (const s of sub) results.push(s);
      } else if (it?.name) {
        results.push(`${folder}/${it.name}`);
      }
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return results;
}




