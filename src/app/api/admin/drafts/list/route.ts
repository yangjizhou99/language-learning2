import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') || 'pending';
  const since = sp.get('since');
  const page = parseInt(sp.get('page') || '1');
  const limit = parseInt(sp.get('limit') || '20');
  const offset = (page - 1) * limit;

  let query = auth.supabase
    .from('article_drafts')
    .select(
      'id,source,lang,genre,difficulty,title,created_at,updated_at,status,ai_provider,ai_model',
    )
    .eq('status', status);

  if (since) {
    query = query.gt('updated_at', since).order('updated_at', { ascending: true }).limit(limit);
  } else if (sp.get('page')) {
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  } else {
    // 兼容旧用法：未传 page 时返回最近一页数据数组
    query = query.order('created_at', { ascending: false }).limit(limit);
  }

  const { data, error } = await query;

  if (error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );

  // since 模式或未传 page：直接返回数组，兼容现有前端
  if (since || !sp.get('page')) {
    return NextResponse.json(data || []);
  }

  // 分页模式：返回带分页信息的对象
  const { count } = await auth.supabase
    .from('article_drafts')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);

  return NextResponse.json({
    data: data || [],
    pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
  });
}
