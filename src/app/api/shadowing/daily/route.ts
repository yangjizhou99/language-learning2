export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

type Metrics = {
  wer?: number;
  cer?: number;
  complete?: boolean;
  accuracy?: number;
};

function calculateAccuracy(metrics: Metrics): number {
  if (!metrics) return 0.0;
  if (typeof metrics.wer === 'number') return Math.max(0, 1 - metrics.wer);
  if (typeof metrics.cer === 'number') return Math.max(0, 1 - metrics.cer);
  if (typeof metrics.accuracy === 'number') return Math.max(0, Math.min(1, metrics.accuracy));
  return 0.0;
}

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

    // 计算推荐等级（与 /api/shadowing/recommended 一致逻辑）
    const supabaseAdmin = getServiceSupabase();
    const { data: attempts } = await supabaseAdmin
      .from('shadowing_attempts')
      .select('level, metrics, created_at')
      .eq('lang', lang)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    let level = 2;
    if (attempts && attempts.length > 0) {
      const lastLevel = attempts[0].level as number;
      const recentSame = attempts.filter((a: any) => a.level === lastLevel).slice(0, 3);
      const lastAttempt = attempts[0];
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      if (recentSame.length === 3) {
        const accuracies = recentSame.map((r: any) => calculateAccuracy(r.metrics as Metrics));
        const avgAccuracy = avg(accuracies);
        if (avgAccuracy >= 0.92) level = Math.min(5, lastLevel + 1);
        else level = lastLevel;
      } else {
        const lastAccuracy = calculateAccuracy((lastAttempt?.metrics || {}) as Metrics);
        const incomplete = (lastAttempt?.metrics as Metrics)?.complete === false;
        if (incomplete || lastAccuracy < 0.75) level = Math.max(1, lastLevel - 1);
        else level = lastLevel;
      }
    }

    // 拉取该语言/等级的已审核题目
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('shadowing_items')
      .select('*')
      .eq('lang', lang)
      .eq('level', level)
      .order('created_at', { ascending: false })
      .limit(500);
    if (itemsError) {
      return NextResponse.json({ error: 'items_query_failed' }, { status: 500 });
    }

    const allItems = items || [];
    if (allItems.length === 0) {
      return NextResponse.json({ lang, level, phase: 'cleared' });
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
    const hasChoice = (arr: unknown[]) => Array.isArray(arr) && arr.length > 0;

    let pool = unpracticed;
    let phase: 'unpracticed' | 'unfinished' | 'cleared' = 'unpracticed';
    if (!hasChoice(pool)) {
      pool = unfinished;
      phase = hasChoice(pool) ? 'unfinished' : 'cleared';
    }

    if (phase === 'cleared') {
      return NextResponse.json({ lang, level, phase: 'cleared', message: '恭喜清空题库' });
    }

    const seed = `${user.id}:${lang}:${new Date().toISOString().slice(0, 10)}`;
    const idx = parseInt(crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) % pool.length;
    const raw = pool[idx] as Record<string, any>;
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
      created_at: raw.created_at,
      theme_id: raw.theme_id,
      subtopic_id: raw.subtopic_id,
      theme,
      subtopic,
    };

    return NextResponse.json({ lang, level, phase, item });
  } catch (e) {
    console.error('daily api failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}


