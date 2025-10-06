export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getUserPermissions, checkLevelPermission, checkLanguagePermission, checkAccessPermission } from '@/lib/user-permissions-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const articleId = searchParams.get('article_id');
    if (!articleId) return NextResponse.json({ error: 'missing article_id' }, { status: 400 });

    // auth: Bearer 优先，其次 Cookie
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

    // 读取文章并校验权限
    const { data: article } = await supabase
      .from('shadowing_items')
      .select('id, lang, level, title')
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

    // 获取全部句子的 cloze 数据
    const { data: rows } = await supabase
      .from('cloze_shadowing_items')
      .select('sentence_index, sentence_text, blank_start, blank_length, correct_options, distractor_options')
      .eq('source_item_id', articleId)
      .eq('is_published', true)
      .order('sentence_index', { ascending: true });

    // 稳定随机：基于用户+文章+句序的种子打乱选项顺序，避免正确项总是第一个
    const stringHash = (str: string) => {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };
    const mulberry32 = (a: number) => {
      return function() {
        let t = (a += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const shuffleWithSeed = (arr: string[], seed: number) => {
      const a = arr.slice();
      const rand = mulberry32(seed);
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const sentences = (rows || []).map((r: any) => {
      const correct = Array.isArray(r.correct_options) ? r.correct_options : [];
      const distractors = Array.isArray(r.distractor_options) ? r.distractor_options : [];
      const seedStr = `${user.id}|${article.id}|${r.sentence_index}`;
      const options = shuffleWithSeed([...correct, ...distractors], stringHash(seedStr));
      return {
        index: r.sentence_index,
        text: r.sentence_text,
        blank: { start: r.blank_start, length: r.blank_length },
        options,
        num_correct: correct.length,
        is_placeholder: (Number(r.blank_length) || 0) === 0,
      };
    });

    return NextResponse.json({
      success: true,
      article: {
        id: article.id,
        lang: article.lang,
        level: article.level,
        title: article.title,
      },
      sentences,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'internal error' }, { status: 500 });
  }
}



