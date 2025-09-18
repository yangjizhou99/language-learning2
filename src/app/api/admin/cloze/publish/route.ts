export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const { draftId } = await req.json();

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draft ID' }, { status: 400 });
    }

    // 获取草稿
    const supabaseAdmin = getServiceSupabase();
    const { data: draft, error: draftError } = await supabaseAdmin
      .from('cloze_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // 发布到正式题库
    const { data: item, error: publishError } = await supabaseAdmin
      .from('cloze_items')
      .insert({
        lang: draft.lang,
        level: draft.level,
        topic: draft.topic,
        title: draft.title,
        passage: draft.passage,
        blanks: draft.blanks,
        meta: {
          from_draft: draftId,
          published_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (publishError) {
      console.error('Publish cloze item error:', publishError);
      return NextResponse.json({ error: 'Failed to publish item' }, { status: 500 });
    }

    // 更新草稿状态
    await supabaseAdmin.from('cloze_drafts').update({ status: 'approved' }).eq('id', draftId);

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Publish cloze item error:', error);
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
