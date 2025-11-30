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
  const onlyNoSubtopics = searchParams.get('no_subtopics') === '1';
  const onlyNoPractice = searchParams.get('no_practice') === '1';

  const langFilter = lang && lang !== 'all' ? lang : null;
  const genreFilter = genre && genre !== 'all' ? genre : null;
  const levelNumber =
    level && !Number.isNaN(Number.parseInt(level, 10)) ? Number.parseInt(level, 10) : null;

  // 不依赖 PostgREST 的关系推断，避免因为缺少/未知的 FK 导致统计查询失败
  let query = supabase.from('shadowing_themes').select('*').eq('status', 'active');

  if (langFilter) query = query.eq('lang', langFilter);
  if (typeof levelNumber === 'number') query = query.eq('level', levelNumber);
  if (genreFilter) query = query.eq('genre', genreFilter);

  const { data, error } = await query.order('created_at', { ascending: false });

  // 统一计算每个主题的小主题数量与练习题数量，避免关系推断计数
  if (data && data.length) {
    await Promise.all(
      data.map(async (theme) => {
        const subtopicQuery = supabase
          .from('shadowing_subtopics')
          .select('*', { count: 'exact', head: true })
          .eq('theme_id', theme.id)
          .eq('status', 'active');

        if (langFilter) subtopicQuery.eq('lang', langFilter);
        if (genreFilter) subtopicQuery.eq('genre', genreFilter);
        if (typeof levelNumber === 'number') subtopicQuery.eq('level', levelNumber);

        const practiceQuery = supabase
          .from('shadowing_items')
          .select('*', { count: 'exact', head: true })
          .eq('theme_id', theme.id)
          .eq('status', 'approved');

        if (langFilter) practiceQuery.eq('lang', langFilter);
        if (genreFilter) practiceQuery.eq('genre', genreFilter);
        if (typeof levelNumber === 'number') practiceQuery.eq('level', levelNumber);

        const [{ count: subtopicCount }, { count: practiceCount }] = await Promise.all([
          subtopicQuery,
          practiceQuery,
        ]);

        (theme as any).subtopic_count = subtopicCount || 0;
        (theme as any).practice_count = practiceCount || 0;
      }),
    );
  }

  if (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  let items =
    data?.map((item: any) => ({
      ...item,
      subtopic_count: typeof item.subtopic_count === 'number' ? item.subtopic_count : 0,
      practice_count: typeof item.practice_count === 'number' ? item.practice_count : 0,
    })) || [];

  if (onlyNoSubtopics) {
    items = items.filter((item) => (item.subtopic_count || 0) === 0);
  }
  if (onlyNoPractice) {
    items = items.filter((item) => (item.practice_count || 0) === 0);
  }

  return NextResponse.json({ items });
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
