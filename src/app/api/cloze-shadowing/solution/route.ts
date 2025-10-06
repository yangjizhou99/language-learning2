export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const articleId = searchParams.get('article_id');
    if (!articleId) return NextResponse.json({ error: 'missing article_id' }, { status: 400 });

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

    const { data: article } = await supabase
      .from('shadowing_items')
      .select('id, lang, level, title, text, audio_url, translations')
      .eq('id', articleId)
      .single();
    if (!article) return NextResponse.json({ error: 'article not found' }, { status: 404 });

    // 获取全部句子的 cloze 数据（仅已发布）
    const { data: sentences } = await supabase
      .from('cloze_shadowing_items')
      .select('sentence_index, sentence_text, blank_start, blank_length, correct_options, is_published')
      .eq('source_item_id', articleId)
      .eq('is_published', true)
      .order('sentence_index', { ascending: true });

    const mapped = (sentences || []).map((s: any) => ({
      sentence_index: s.sentence_index,
      sentence_text: s.sentence_text,
      blank_start: s.blank_start,
      blank_length: s.blank_length,
      correct_options: Array.isArray(s.correct_options) ? s.correct_options : [],
      is_placeholder: (Number(s.blank_length) || 0) === 0 || !(Array.isArray(s.correct_options) && s.correct_options.length > 0),
    }));

    return NextResponse.json({
      success: true,
      article: {
        id: article.id,
        lang: article.lang,
        level: article.level,
        title: article.title,
        text: article.text,
        audio_url: article.audio_url,
        translations: article.translations || {},
      },
      sentences: mapped,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'internal error' }, { status: 500 });
  }
}





