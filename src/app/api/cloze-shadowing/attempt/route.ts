export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { article_id, sentence_index, selected_options } = body as {
      article_id?: string;
      sentence_index?: number;
      selected_options?: string[];
    };

    if (!article_id || typeof sentence_index !== 'number' || !Array.isArray(selected_options)) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

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

    // Load sentence cloze item
    const { data: item, error } = await supabase
      .from('cloze_shadowing_items')
      .select('*')
      .eq('source_item_id', article_id)
      .eq('sentence_index', sentence_index)
      .single();
    if (error || !item) return NextResponse.json({ error: 'item not found' }, { status: 404 });

    const correct = new Set((item.correct_options || []).map((s: string) => s.trim().toLowerCase()));
    const sel = (selected_options || []).map((s: string) => s.trim().toLowerCase());

    // 判定：全部入选必须都在 correct，且不得选到干扰项；允许漏选？此处按需求：多选中只要包含非正确项则判错；正确选项需全部命中
    const selectedAllCorrect = sel.every((s) => correct.has(s));
    const hitCount = sel.filter((s) => correct.has(s)).length;
    const isCorrect = selectedAllCorrect && hitCount === correct.size && correct.size > 0;

    // Insert attempt
    const { error: insErr } = await supabase
      .from('cloze_shadowing_attempts_sentence')
      .insert({
        user_id: user.id,
        source_item_id: article_id,
        cloze_item_id: item.id,
        sentence_index,
        selected_options,
        is_correct: isCorrect,
      });
    if (insErr) return NextResponse.json({ error: 'save attempt failed' }, { status: 500 });

    return NextResponse.json({ success: true, is_correct: isCorrect });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'internal error' }, { status: 500 });
  }
}

















