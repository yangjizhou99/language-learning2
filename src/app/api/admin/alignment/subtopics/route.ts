import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { normalizeTitle } from '@/lib/alignment/utils';
import type { AlignmentMaterial, AlignmentSubtopic } from '@/lib/alignment/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubtopicUpsertPayload = {
  action: 'upsert';
  item: Partial<AlignmentSubtopic> & {
    title: string;
    theme_id: string;
    lang: string;
    level: number;
    genre: string;
  };
};

type SubtopicBulkStatusPayload = {
  action: 'bulk-status';
  ids: string[];
  status: 'draft' | 'needs_review' | 'active' | 'archived';
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
  const themeId = searchParams.get('theme_id');
  const q = searchParams.get('q');
  const includeMaterial = (searchParams.get('include_material') || 'true').toLowerCase() !== 'false';

  let query = supabase.from('alignment_subtopics').select('*').order('created_at', { ascending: false });
  if (lang && lang !== 'all') query = query.eq('lang', lang);
  if (level && level !== 'all') query = query.eq('level', parseInt(level, 10));
  if (genre && genre !== 'all') query = query.eq('genre', genre);
  if (status && status !== 'all') query = query.eq('status', status);
  if (themeId) query = query.eq('theme_id', themeId);
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  const items = (data || []) as AlignmentSubtopic[];
  if (!includeMaterial || items.length === 0) {
    return NextResponse.json({ items });
  }

  const subtopicIds = items.map((item) => item.id);
  const { data: materialRows, error: materialError } = await supabase
    .from('alignment_materials')
    .select('*')
    .in('subtopic_id', subtopicIds)
    .eq('is_current', true);

  if (materialError) {
    console.error('Failed to load alignment materials', materialError);
    return NextResponse.json({ items });
  }

  const materialMap = new Map<string, AlignmentMaterial>();
  for (const row of materialRows || []) {
    materialMap.set(row.subtopic_id, row as AlignmentMaterial);
  }

  const enriched = items.map((item) => ({
    ...item,
    material: materialMap.get(item.id) || null,
  }));

  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }
  const supabase = auth.supabase;
  const body = (await req.json()) as SubtopicUpsertPayload | SubtopicBulkStatusPayload;

  if (body.action === 'bulk-status') {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: '缺少ID列表' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('alignment_subtopics')
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
      return NextResponse.json({ error: '小主题标题不能为空' }, { status: 400 });
    }
    if (!item.theme_id) {
      return NextResponse.json({ error: '缺少主题ID' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const title_normalized = normalizeTitle(item.title);
    const payload = {
      id: item.id,
      theme_id: item.theme_id,
      lang: item.lang,
      level: item.level,
      genre: item.genre,
      title: item.title,
      title_translations: item.title_translations || {},
      title_normalized,
      one_line: item.one_line ?? null,
      one_line_translations: item.one_line_translations || {},
      objectives: item.objectives || [],
      status: item.status || 'draft',
      created_by: item.created_by || auth.user?.id || null,
      created_at: item.id ? item.created_at : now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('alignment_subtopics')
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
