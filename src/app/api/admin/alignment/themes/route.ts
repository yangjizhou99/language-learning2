import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeTitle } from '@/lib/alignment/utils';
import type { AlignmentTheme } from '@/lib/alignment/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UpsertPayload = {
  action: 'upsert';
  item: Partial<AlignmentTheme> & { title: string; lang: string; level: number; genre: string };
};

type BulkStatusPayload = {
  action: 'bulk-status';
  ids: string[];
  status: 'draft' | 'active' | 'archived';
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }

  const supabase = auth.supabase;
  const { searchParams } = new URL(req.url);

  const lang = searchParams.get('lang');
  const level = searchParams.get('level');
  const genre = searchParams.get('genre');
  const status = searchParams.get('status');
  const q = searchParams.get('q');

  let query = supabase.from('alignment_themes').select('*').order('created_at', { ascending: false });

  if (lang && lang !== 'all') query = query.eq('lang', lang);
  if (level && level !== 'all') query = query.eq('level', parseInt(level, 10));
  if (genre && genre !== 'all') query = query.eq('genre', genre);
  if (status && status !== 'all') query = query.eq('status', status);
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  const items = (data || []) as AlignmentTheme[];
  if (items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const themeIds = items.map((item) => item.id);
  const { data: subtopicsData, error: subtopicError } = await supabase
    .from('alignment_subtopics')
    .select('id, theme_id')
    .eq('status', 'active')
    .in('theme_id', themeIds);

  if (subtopicError) {
    // Return themes even if subtopic counting fails
    console.error('Failed to fetch alignment subtopic counts', subtopicError);
    return NextResponse.json({ items });
  }

  const countMap = new Map<string, number>();
  for (const row of subtopicsData || []) {
    const themeId = (row as { theme_id: string }).theme_id;
    countMap.set(themeId, (countMap.get(themeId) ?? 0) + 1);
  }

  const enriched = items.map((item) => ({
    ...item,
    subtopic_count: countMap.get(item.id) ?? 0,
  }));

  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }
  const supabase = auth.supabase;
  const body = (await req.json()) as UpsertPayload | BulkStatusPayload;

  if (body.action === 'bulk-status') {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: '缺少ID列表' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('alignment_themes')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .in('id', body.ids)
      .select('id');

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
    return NextResponse.json({ updated: data?.map((d) => d.id) || [] });
  }

  if (body.action === 'upsert') {
    const { item } = body;
    if (!item.title?.trim()) {
      return NextResponse.json({ error: '主题标题不能为空' }, { status: 400 });
    }
    if (!item.lang || !item.level || !item.genre) {
      return NextResponse.json({ error: '缺少语言、等级或体裁' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const title_normalized = normalizeTitle(item.title);
    const payload = {
      id: item.id,
      lang: item.lang,
      level: item.level,
      genre: item.genre,
      title: item.title,
      title_translations: item.title_translations || {},
      title_normalized,
      summary: item.summary ?? null,
      summary_translations: item.summary_translations || {},
      status: item.status || 'draft',
      created_by: item.created_by || auth.user?.id || null,
      created_at: item.id ? item.created_at : now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('alignment_themes')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }
    return NextResponse.json({ item: data });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
