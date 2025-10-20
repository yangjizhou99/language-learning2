export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CacheManager } from '@/lib/cache';
import { getUserPermissions, checkLevelPermission, checkLanguagePermission, checkAccessPermission } from '@/lib/user-permissions-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const articleId = searchParams.get('article_id');
    const cursor = searchParams.get('cursor'); // sentence index

    if (!articleId) return NextResponse.json({ error: 'missing article_id' }, { status: 400 });

    // auth: Bearer 优先，其次 Cookie
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      const cookieStore = await cookies();
      supabase = (createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        },
      }) as unknown) as SupabaseClient;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 权限：复用 cloze 权限，且语言/等级来自源 article
    const { data: article } = await supabase
      .from('shadowing_items')
      .select('id, lang, level, title, text, audio_url, translations')
      .eq('id', articleId)
      .single();
    if (!article) return NextResponse.json({ error: 'article not found' }, { status: 404 });

    const permissions = await getUserPermissions(user.id);
    if (!checkAccessPermission(permissions, 'can_access_cloze'))
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    if (!checkLanguagePermission(permissions, article.lang))
      return NextResponse.json({ error: 'Access denied for language' }, { status: 403 });
    if (!checkLevelPermission(permissions, article.level))
      return NextResponse.json({ error: 'Access denied for level' }, { status: 403 });

    // cursor -> 下一句索引（默认0）
    const idx = Math.max(0, parseInt(String(cursor ?? '0'), 10) || 0);

    // 从 cloze_shadowing_items 取该句
    const { data: item, error } = await supabase
      .from('cloze_shadowing_items')
      .select('sentence_index, sentence_text, blank_start, blank_length, correct_options, distractor_options')
      .eq('source_item_id', articleId)
      .eq('sentence_index', idx)
      .eq('is_published', true)
      .single();
    if (error || !item) {
      // 若不存在，表示生成缺失或超尾
      return NextResponse.json({ success: true, done: true });
    }

    // 组装 options（打乱，但不改变可复现性：按固定排序即可，前端可随机本地打乱）
    const options = [
      ...((Array.isArray(item.correct_options) ? item.correct_options : []) as string[]),
      ...((Array.isArray(item.distractor_options) ? item.distractor_options : []) as string[]),
    ];
    const isPlaceholder = (Number(item.blank_length) || 0) === 0;

    return NextResponse.json({
      success: true,
      done: false,
      article: {
        id: article.id,
        lang: article.lang,
        level: article.level,
        title: article.title,
      },
      sentence: {
        index: item.sentence_index,
        text: item.sentence_text,
        blank: { start: item.blank_start, length: item.blank_length },
        options,
        num_correct: (item.correct_options || []).length,
        is_placeholder: isPlaceholder,
      },
      skip: isPlaceholder,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



