import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式（与其它shadowing接口一致）
    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else if (cookieHeader) {
      const cookieMap = new Map<string, string>();
      cookieHeader.split(';').forEach((pair) => {
        const [k, ...rest] = pair.split('=');
        const key = k.trim();
        const value = rest.join('=').trim();
        if (key) cookieMap.set(key, value);
      });
      supabase = (createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() {},
            remove() {},
          },
        },
      ) as unknown) as SupabaseClient;
    } else {
      const cookieStore = await cookies();
      supabase = (createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        },
      ) as unknown) as SupabaseClient;
    }

    const url = new URL(req.url);
    const lang = (url.searchParams.get('lang') || 'en').toLowerCase();

    // 鉴权
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

    // 拉取该语言的所有等级已审核题目（不再使用推荐等级）
    const supabaseAdmin = getServiceSupabase();
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('shadowing_items')
      .select('*')
      .eq('lang', lang)
      .order('created_at', { ascending: false })
      .limit(500);
    if (itemsError) {
      return NextResponse.json({ error: 'items_query_failed' }, { status: 500 });
    }

    const allItems = items || [];
    if (allItems.length === 0) {
      return NextResponse.json({ lang, level: null, phase: 'cleared' });
    }

    const itemIds = allItems.map((i) => i.id);
    const { data: sessions } = await supabaseAdmin
      .from('shadowing_sessions')
      .select('item_id, status')
      .eq('user_id', user.id)
      .in('item_id', itemIds);

    const sessionByItem = new Map<string, 'draft' | 'completed'>();
    (sessions || []).forEach((s: { item_id: string; status: 'draft' | 'completed' }) => {
      if (s?.item_id) sessionByItem.set(s.item_id, s.status);
    });

    const unpracticed = allItems.filter((i) => !sessionByItem.has(i.id));
    const unfinished = allItems.filter((i) => sessionByItem.get(i.id) === 'draft');

    // 计算“当日种子题”完成态（独立于池挑选逻辑，便于前端展示今日是否完成）
    const seedAll = `${user.id}:${lang}:${new Date().toISOString().slice(0, 10)}`;
    const idxAll = parseInt(crypto.createHash('sha1').update(seedAll).digest('hex').slice(0, 8), 16) % allItems.length;
    const rawToday = allItems[idxAll] as Record<string, any>;
    const todayDone = !!rawToday && sessionByItem.get(rawToday.id) === 'completed';
    const hasChoice = (arr: unknown[]) => Array.isArray(arr) && arr.length > 0;

    let pool = unpracticed;
    let phase: 'unpracticed' | 'unfinished' | 'cleared' = 'unpracticed';
    if (!hasChoice(pool)) {
      pool = unfinished;
      phase = hasChoice(pool) ? 'unfinished' : 'cleared';
    }

    if (phase === 'cleared') {
      return NextResponse.json({ lang, level: null, phase: 'cleared', message: '恭喜清空题库', today_done: todayDone });
    }

    // 当日内固定题目：使用基于日期种子的 rawToday，避免完成后换题
    const raw = rawToday as Record<string, any>;
    // 读取主题与小主题信息（如有）
    let theme: { id: string; title: string; desc?: string } | undefined;
    let subtopic: { id: string; title: string; one_line?: string } | undefined;
    try {
      if (raw?.theme_id) {
        const { data: t } = await supabaseAdmin
          .from('shadowing_themes')
          .select('id, title, desc')
          .eq('id', raw.theme_id)
          .single();
        if (t) theme = t as any;
      }
      if (raw?.subtopic_id) {
        const { data: s } = await supabaseAdmin
          .from('shadowing_subtopics')
          .select('id, title, one_line')
          .eq('id', raw.subtopic_id)
          .single();
        if (s) subtopic = s as any;
      }
    } catch {}
    const resolvedAudio =
      raw.audio_url_proxy || raw.audio_url || raw?.notes?.audio_url ||
      (raw.audio_bucket && raw.audio_path
        ? `/api/storage-proxy?path=${encodeURIComponent(raw.audio_path)}&bucket=${encodeURIComponent(raw.audio_bucket)}`
        : null);
    const item = {
      id: raw.id,
      lang: raw.lang,
      level: raw.level,
      title: raw.title,
      text: raw.text,
      audio_url: resolvedAudio,
      duration_ms: raw.duration_ms,
      tokens: raw.tokens,
      cefr: raw.cefr,
      meta: raw.meta,
      translations: raw.translations,
      trans_updated_at: raw.trans_updated_at,
      sentence_timeline: raw.sentence_timeline,
      created_at: raw.created_at,
      theme_id: raw.theme_id,
      subtopic_id: raw.subtopic_id,
      theme,
      subtopic,
      notes: raw.notes, // 包含 acu_units 等ACU相关数据
    };

    return NextResponse.json({ lang, level: raw.level, phase, item, today_done: todayDone });
  } catch (e) {
    console.error('daily api failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}


