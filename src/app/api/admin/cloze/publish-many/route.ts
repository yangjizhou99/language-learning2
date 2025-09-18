export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

type Filter = {
  lang?: 'en' | 'ja' | 'zh';
  level?: number;
  status?: 'draft' | 'needs_fix' | 'approved';
  provider?: 'deepseek' | 'openrouter' | 'openai';
};

export async function POST(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const { draftIds, filter }: { draftIds?: string[]; filter?: Filter } = await req.json();

    const supabaseAdmin = getServiceSupabase();

    // 选择要发布的草稿
    let query = supabaseAdmin.from('cloze_drafts').select('*');

    if (draftIds && draftIds.length > 0) {
      query = query.in('id', draftIds);
    } else {
      // 按筛选条件选择，默认仅发布非 approved 的
      query = query.neq('status', 'approved');
      if (filter?.lang) query = query.eq('lang', filter.lang);
      if (typeof filter?.level === 'number') query = query.eq('level', filter.level);
      if (filter?.status) query = query.eq('status', filter.status);
      if (filter?.provider) query = query.eq('ai_provider', filter.provider);
    }

    const { data: drafts, error: loadErr } = await query;
    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (!drafts || drafts.length === 0) {
      return NextResponse.json({ success: true, published: 0 });
    }

    // 批量插入 cloze_items
    const items = drafts.map((d: any) => ({
      lang: d.lang,
      level: d.level,
      topic: d.topic,
      title: d.title,
      passage: d.passage,
      blanks: d.blanks,
      meta: { from_draft: d.id, published_at: new Date().toISOString() },
    }));

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('cloze_items')
      .insert(items)
      .select('id');

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 批量更新草稿状态
    const ids = drafts.map((d: any) => d.id);
    const { error: updErr } = await supabaseAdmin
      .from('cloze_drafts')
      .update({ status: 'approved' })
      .in('id', ids);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, published: inserted?.length || 0 });
  } catch (error) {
    console.error('Publish many drafts error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
