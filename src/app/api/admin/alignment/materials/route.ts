import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import type { AlignmentMaterial } from '@/lib/alignment/types';

type UpsertPayload = {
  action: 'upsert';
  item: Partial<AlignmentMaterial> & {
    id?: string;
    subtopic_id: string;
    lang: string;
    task_type: string;
    status?: string;
    is_current?: boolean;
  };
};

type ReviewPayload = {
  action: 'review';
  id: string;
  status?: AlignmentMaterial['status'];
  review_status?: AlignmentMaterial['review_status'];
  review_notes?: string | null;
  is_current?: boolean;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }

  const supabase = auth.supabase;
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang');
  const status = searchParams.get('status');
  const taskType = searchParams.get('task_type');
  const subtopicId = searchParams.get('subtopic_id');
  const themeId = searchParams.get('theme_id');
  const q = searchParams.get('q');
  const isCurrent = searchParams.get('is_current');

  let query = supabase
    .from('alignment_materials')
    .select('*, subtopic:alignment_subtopics!alignment_materials_subtopic_fkey(*, theme:alignment_themes(*))')
    .order('created_at', { ascending: false });

  if (lang && lang !== 'all') query = query.eq('lang', lang);
  if (status && status !== 'all') query = query.eq('status', status);
  if (taskType && taskType !== 'all') query = query.eq('task_type', taskType);
  if (subtopicId) query = query.eq('subtopic_id', subtopicId);
  let themeSubtopicIds: string[] | null = null;
  if (themeId && themeId !== 'all') {
    const { data: subtopicRows, error: subtopicErr } = await supabase
      .from('alignment_subtopics')
      .select('id')
      .eq('theme_id', themeId);
    if (subtopicErr) {
      console.error('Failed to fetch subtopics for theme', subtopicErr);
      return NextResponse.json(
        { error: subtopicErr instanceof Error ? subtopicErr.message : String(subtopicErr) },
        { status: 400 },
      );
    }
    themeSubtopicIds = (subtopicRows || []).map((row) => (row as { id: string }).id);
    if (themeSubtopicIds.length === 0) {
      return NextResponse.json({ items: [] });
    }
    query = query.in('subtopic_id', themeSubtopicIds);
  }
  if (typeof isCurrent === 'string' && (isCurrent === 'true' || isCurrent === 'false')) {
    query = query.eq('is_current', isCurrent === 'true');
  }
  if (q) {
    query = query.or(
      [
        `task_prompt.ilike.%${q}%`,
        `exemplar.ilike.%${q}%`,
        `standard_answer.ilike.%${q}%`,
        `subtopic.title.ilike.%${q}%`,
      ].join(','),
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to load alignment materials', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }
  const supabase = auth.supabase;
  const body = (await req.json()) as UpsertPayload | ReviewPayload;

  if (body.action === 'upsert') {
    const { item } = body;
    if (!item.subtopic_id || !item.lang || !item.task_type || !item.task_prompt || !item.exemplar) {
      return NextResponse.json({ error: '缺少必要字段（subtopic_id/lang/task_type/task_prompt/exemplar）' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const payload: Partial<AlignmentMaterial> = {
      ...item,
      status: item.status || 'pending_review',
      review_status: item.review_status || 'pending',
      updated_at: now,
      created_by: item.created_by || auth.user?.id || null,
    };

    if (!item.id) {
      payload.created_at = now;
    }

    // ensure JSON fields fallback
    payload.task_prompt_translations = item.task_prompt_translations || {};
    payload.exemplar_translations = item.exemplar_translations || {};
    const knowledgePoints = item.knowledge_points || {};
    payload.knowledge_points = {
      words: Array.isArray(knowledgePoints.words) ? knowledgePoints.words : [],
      sentences: Array.isArray(knowledgePoints.sentences) ? knowledgePoints.sentences : [],
    };
    payload.requirements = Array.isArray(item.requirements) ? item.requirements : [];
    payload.standard_answer_translations = item.standard_answer_translations || {};
    payload.core_sentences = Array.isArray(item.core_sentences) ? item.core_sentences : [];
    payload.rubric = item.rubric || {};
    payload.dialogue_meta = item.dialogue_meta || {};
    payload.writing_meta = item.writing_meta || {};
    payload.ai_metadata = item.ai_metadata || {};
    payload.practice_scenario = item.practice_scenario || {};
    payload.standard_dialogue = item.standard_dialogue || { turns: [] };

    const { data, error } = await supabase
      .from('alignment_materials')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to upsert alignment material', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }

    if (payload.is_current) {
      await supabase
        .from('alignment_materials')
        .update({ is_current: false })
        .eq('subtopic_id', data.subtopic_id)
        .neq('id', data.id);
      await supabase.from('alignment_materials').update({ is_current: true }).eq('id', data.id);
    }

    return NextResponse.json({ item: data });
  }

  if (body.action === 'review') {
    const { id, status, review_status, review_notes, is_current } = body;
    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }
    const patch: Partial<AlignmentMaterial> = { updated_at: new Date().toISOString() };
    if (status) patch.status = status;
    if (review_status) patch.review_status = review_status;
    if (typeof review_notes !== 'undefined') patch.review_notes = review_notes;

    const { data, error } = await supabase
      .from('alignment_materials')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      console.error('Failed to review alignment material', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }

    if (is_current) {
      await supabase.from('alignment_materials').update({ is_current: false }).eq('subtopic_id', data.subtopic_id).neq('id', data.id);
      await supabase.from('alignment_materials').update({ is_current: true }).eq('id', data.id);
    }

    return NextResponse.json({ item: data });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
