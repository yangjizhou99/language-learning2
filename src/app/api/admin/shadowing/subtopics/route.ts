import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
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

type DraftOrItemRef = { subtopic_id: string | null };
type SubtopicIdRow = { id: string; created_at: string };
type SubtopicRow = {
  id: string;
  created_at: string;
  [key: string]: unknown;
};

async function handleRequest(supabase: SupabaseClient, req: NextRequest) {
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

  const items = data || [];

  // 计算 has_article 集合并进行正确的分页与总数统计
  if (has_article === 'yes' || has_article === 'no') {
    const [
      { data: draftsData, error: draftsError },
      { data: itemsData, error: itemsError },
      { data: baseListData, error: baseListError },
    ] = await Promise.all([
      supabase
        .from('shadowing_drafts')
        .select('subtopic_id')
        .not('subtopic_id', 'is', null),
      supabase
        .from('shadowing_items')
        .select('subtopic_id')
        .not('subtopic_id', 'is', null),
      // 获取满足基础过滤条件的所有子主题的 id 和 created_at，并按时间倒序排序
      (() => {
        let q = supabase
          .from('shadowing_subtopics')
          .select('id, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (lang) q = q.eq('lang', lang);
        if (level) q = q.eq('level', parseInt(level));
        if (genre) q = q.eq('genre', genre);
        if (theme_id) q = q.eq('theme_id', theme_id);
        if (q) q = q.ilike('title', `%${q}%`);
        return q;
      })(),
    ]);

    if (draftsError || itemsError || baseListError) {
      const err = draftsError || itemsError || baseListError;
      return NextResponse.json({ error: err?.message || String(err) }, { status: 400 });
    }

    const hasArticleIds = new Set([
      ...((draftsData as DraftOrItemRef[] | null)?.map((d: DraftOrItemRef) => d.subtopic_id) || []),
      ...((itemsData as DraftOrItemRef[] | null)?.map((i: DraftOrItemRef) => i.subtopic_id) || []),
    ]);

    const allRows = (baseListData as SubtopicIdRow[] | null) || [];
    const filteredRows = allRows.filter((row: SubtopicIdRow) =>
      has_article === 'yes' ? hasArticleIds.has(row.id) : !hasArticleIds.has(row.id),
    );

    const totalFiltered = filteredRows.length;
    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit; // slice 终止索引为开区间
    const pageRows = filteredRows.slice(fromIdx, toIdx);
    const pageIds = pageRows.map((r: SubtopicIdRow) => r.id);

    if (pageIds.length === 0) {
      return NextResponse.json({
        items: [],
        total: totalFiltered,
        page,
        limit,
        totalPages: Math.ceil(totalFiltered / limit) || 1,
      });
    }

    // 拉取当前页的完整记录，并与主题标题进行联结，且保持按 created_at 倒序
    const pageQuery = supabase
      .from('shadowing_subtopics')
      .select(
        `
        *,
        theme:shadowing_themes(title)
      `,
      )
      .in('id', pageIds)
      .order('created_at', { ascending: false });
    const { data: pageItems, error: pageError } = await pageQuery;
    if (pageError) {
      return NextResponse.json({ error: pageError.message || String(pageError) }, { status: 400 });
    }

    // 标注 has_article 字段（可选）
    const finalItems = (pageItems as SubtopicRow[] | null || []).map((row: SubtopicRow) => ({
      ...row,
      has_article: hasArticleIds.has(row.id),
    }));

    return NextResponse.json({
      items: finalItems,
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
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

    const data: Record<string, unknown> = {
      ...item,
      updated_at: now,
      created_by: item.created_by || user?.id,
    };

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
