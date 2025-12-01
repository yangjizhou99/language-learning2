export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const supabase = auth.supabase;

  const sp = new URL(req.url).searchParams;
  const status = sp.get('status'); // 可为空或 'draft' | 'approved'
  const lang = sp.get('lang') as 'en' | 'ja' | 'zh' | null;
  const level = sp.get('level');
  const genre = sp.get('genre');
  const dialogue_type = sp.get('dialogue_type');
  const q = sp.get('q')?.trim() || '';

  // 分页参数
  const page = parseInt(sp.get('page') || '1');
  const pageSize = parseInt(sp.get('pageSize') || '10');
  const offset = (page - 1) * pageSize;

  // 构建基础查询（避免依赖关系推断导致 400）
  let query = supabase
    .from('shadowing_drafts')
    .select(
      `
      id, lang, level, genre, dialogue_type, title, text, status, created_at, notes, translations, trans_updated_at,
      theme_id, subtopic_id
    `,
      { count: 'exact' },
    )
    .order('title', { ascending: true });

  // 状态筛选：仅当提供且不为 all 时生效
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (lang) query = query.eq('lang', lang);
  if (level) query = query.eq('level', Number(level));
  if (genre) query = query.eq('genre', genre);
  if (dialogue_type) query = query.eq('dialogue_type', dialogue_type);
  if (q) query = query.ilike('title', `%${q}%`);

  // 应用分页
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return NextResponse.json({
    ok: true,
    items: data || [],
    total,
    totalPages,
    currentPage: page,
    pageSize,
  });
}
