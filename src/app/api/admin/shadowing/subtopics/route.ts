import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = auth.supabase;
  return await handleRequest(supabase, req);
}

async function handleRequest(supabase: any, req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang');
  const level = searchParams.get('level');
  const genre = searchParams.get('genre');
  const theme_id = searchParams.get('theme_id');
  const has_article = searchParams.get('has_article');
  const q = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('shadowing_subtopics')
    .select(
      `
      *,
      theme:shadowing_themes(title)
    `,
    )
    .eq('status', 'active');

  if (lang) query = query.eq('lang', lang);
  if (level) query = query.eq('level', parseInt(level));
  if (genre) query = query.eq('genre', genre);
  if (theme_id) query = query.eq('theme_id', theme_id);
  if (q) query = query.ilike('title', `%${q}%`);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await query.range(from, to).order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 400 });
  }

  let items = data || [];

  // 计算 has_article 集合并进行内存过滤，避免长URL问题
  if (has_article === 'yes' || has_article === 'no') {
    const [{ data: draftsData }, { data: itemsData }] = await Promise.all([
      supabase.from('shadowing_drafts').select('subtopic_id').not('subtopic_id', 'is', null),
      supabase.from('shadowing_items').select('subtopic_id').not('subtopic_id', 'is', null),
    ]);
    const hasArticleIds = new Set([
      ...(draftsData?.map((d: any) => d.subtopic_id) || []),
      ...(itemsData?.map((i: any) => i.subtopic_id) || []),
    ]);
    items = items
      .map((row: any) => ({ ...row, has_article: hasArticleIds.has(row.id) }))
      .filter((row: any) => (has_article === 'yes' ? row.has_article : !row.has_article));

    // 返回当前页的大小作为 total，避免昂贵的全量统计
    return NextResponse.json({
      items,
      total: items.length,
      page,
      limit,
      totalPages: 1,
    });
  }

  // 获取总数（不应用分页限制）
  const countQuery = supabase
    .from('shadowing_subtopics')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  if (lang) countQuery.eq('lang', lang);
  if (level) countQuery.eq('level', parseInt(level));
  if (genre) countQuery.eq('genre', genre);
  if (theme_id) countQuery.eq('theme_id', theme_id);
  if (q) countQuery.ilike('title', `%${q}%`);
  const { count, error: countError } = await countQuery;
  if (countError) {
    return NextResponse.json({ error: countError.message || String(countError) }, { status: 400 });
  }

  return NextResponse.json({
    items,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = auth.supabase;
  const body = await req.json();
  const { action, item } = body;

  if (action === 'upsert') {
    if (!item.title?.trim()) {
      return NextResponse.json({ error: '小主题标题不能为空' }, { status: 400 });
    }

    const user = (await supabase.auth.getUser()).data.user;
    const now = new Date().toISOString();

    const data = {
      ...item,
      updated_at: now,
      created_by: item.created_by || user?.id,
    } as any;

    if (!item.id) {
      data.created_at = now;
    }

    const { data: result, error } = await supabase
      .from('shadowing_subtopics')
      .upsert(data, { onConflict: 'id' })
      .select(
        `
        *,
        theme:shadowing_themes(title)
      `,
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }

    return NextResponse.json({ item: result });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
