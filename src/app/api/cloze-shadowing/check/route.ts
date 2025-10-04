export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 即时判定对错，不入库
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

    // 读取 cloze item
    const { data: item, error } = await supabase
      .from('cloze_shadowing_items')
      .select('id, correct_options')
      .eq('source_item_id', article_id)
      .eq('sentence_index', sentence_index)
      .eq('is_published', true)
      .single();
    if (error || !item) return NextResponse.json({ error: 'item not found' }, { status: 404 });

    const correct = new Set((item.correct_options || []).map((s: string) => s.trim().toLowerCase()));
    const sel = (selected_options || []).map((s: string) => s.trim().toLowerCase());
    const selectedAllCorrect = sel.every((s) => correct.has(s));
    const hitCount = sel.filter((s) => correct.has(s)).length;
    const isCorrect = selectedAllCorrect && hitCount === correct.size && correct.size > 0;

    return NextResponse.json({ success: true, is_correct: isCorrect });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'internal error' }, { status: 500 });
  }
}


