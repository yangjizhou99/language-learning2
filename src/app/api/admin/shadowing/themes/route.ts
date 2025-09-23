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

  // 不依赖 PostgREST 的关系推断，避免因为缺少/未识别 FK 导致整查询失败
  let query = supabase.from('shadowing_themes').select('*').eq('status', 'active');

  if (lang) query = query.eq('lang', lang);
  if (level) query = query.eq('level', parseInt(level));
  if (genre) query = query.eq('genre', genre);

  const { data, error } = await query.order('created_at', { ascending: false });

  // 统一计算每个主题的小主题数量（避免依赖关系嵌套计数）
  if (data && data.length) {
    for (const theme of data) {
      const subtopicQuery = supabase
        .from('shadowing_subtopics')
        .select('*', { count: 'exact', head: true })
        .eq('theme_id', theme.id)
        .eq('status', 'active');

      if (lang) subtopicQuery.eq('lang', lang);
      if (genre) subtopicQuery.eq('genre', genre);
      if (level) subtopicQuery.eq('level', parseInt(level));

      const { count } = await subtopicQuery;
      (theme as any).subtopic_count = count || 0;
    }
  }

  if (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  return NextResponse.json({
    items:
      data?.map((item: any) => ({
        ...item,
        subtopic_count: typeof item.subtopic_count === 'number' ? item.subtopic_count : 0,
      })) || [],
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
      return NextResponse.json({ error: '主题标题不能为空' }, { status: 400 });
    }

    const user = (await supabase.auth.getUser()).data.user;
    const now = new Date().toISOString();

    const data = {
      ...item,
      updated_at: now,
      created_by: item.created_by || user?.id,
    };

    if (!item.id) {
      data.created_at = now;
    }

    const { data: result, error } = await supabase
      .from('shadowing_themes')
      .upsert(data, { onConflict: 'id' })
      .select()
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
