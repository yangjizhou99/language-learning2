export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { article_id } = (await req.json().catch(() => ({}))) as { article_id?: string };
    if (!article_id) return NextResponse.json({ error: 'missing article_id' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: any;
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        },
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 统计需要作答的总句数（排除占位/未挖空）
    const { data: totalRows, error: totalErr } = await supabase
      .from('cloze_shadowing_items')
      .select('id', { count: 'exact', head: true })
      .eq('source_item_id', article_id)
      .neq('blank_length', 0);
    if (totalErr) return NextResponse.json({ error: 'count total failed' }, { status: 500 });
    const total = totalRows?.length ? totalRows.length : (totalRows as any) || 0; // head:true returns null, but count exposed via response; workaround below

    // Supabase count workaround: re-query with count
    let totalCount = 0;
    if (!total || typeof total !== 'number') {
      const { count } = await supabase
        .from('cloze_shadowing_items')
        .select('*', { count: 'exact', head: true })
        .eq('source_item_id', article_id)
        .neq('blank_length', 0);
      totalCount = count || 0;
    } else totalCount = total;

    // 统计用户正确句数
    const { data: correctRows, error: corrErr, count: correctCount } = await supabase
      .from('cloze_shadowing_attempts_sentence')
      .select('*', { count: 'exact' })
      .eq('source_item_id', article_id)
      .eq('user_id', user.id)
      .eq('is_correct', true);
    if (corrErr) return NextResponse.json({ error: 'count correct failed' }, { status: 500 });

    const correct = correctCount || (correctRows ? correctRows.length : 0);
    const accuracy = totalCount > 0 ? Math.max(0, Math.min(1, correct / totalCount)) : 0;

    // 写入汇总
    const { error: insErr } = await supabase
      .from('cloze_shadowing_attempts_article')
      .insert({
        user_id: user.id,
        source_item_id: article_id,
        total_sentences: totalCount,
        correct_sentences: correct,
        accuracy,
      });
    if (insErr) return NextResponse.json({ error: 'save summary failed' }, { status: 500 });

    return NextResponse.json({ success: true, total: totalCount, correct, accuracy });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'internal error' }, { status: 500 });
  }
}





