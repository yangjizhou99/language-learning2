export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getUserPermissions,
  checkLevelPermission,
  checkLanguagePermission,
  checkAccessPermission,
} from '@/lib/user-permissions-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      }) as unknown as SupabaseClient;
    } else {
      if (cookieHeader) {
        const cookieMap = new Map<string, string>();
        cookieHeader.split(';').forEach((pair) => {
          const [k, ...rest] = pair.split('=');
          const key = k.trim();
          const value = rest.join('=').trim();
          if (key) cookieMap.set(key, value);
        });
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() {},
            remove() {},
          },
        }) as unknown as SupabaseClient;
      } else {
        const cookieStore = await cookies();
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        }) as unknown as SupabaseClient;
      }
    }

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限：使用 can_access_cloze
    const permissions = await getUserPermissions(user.id);
    if (!checkAccessPermission(permissions, 'can_access_cloze')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Params
    const url = new URL(req.url);
    const lang = url.searchParams.get('lang');
    const level = url.searchParams.get('level');
    const practiced = url.searchParams.get('practiced'); // 'true' | 'false' | null
    const themeId = url.searchParams.get('theme');
    const subtopicId = url.searchParams.get('subtopic');
    const keyword = url.searchParams.get('q');
    const genre = url.searchParams.get('genre');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam))) : null;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam)) : 0;

    // 仅展示：有已发布 cloze 的文章 + 源文章已审核
    // 先取有已发布 cloze 的 source_item_id 列表（按创建时间近→远）
    const clozeQuery = supabase
      .from('cloze_shadowing_items')
      .select('source_item_id')
      .eq('is_published', true);

    const { data: clozeRows, error: clozeErr } = await clozeQuery;
    if (clozeErr) {
      return NextResponse.json({ error: 'Cloze query failed' }, { status: 500 });
    }

    const sourceIds = Array.from(
      new Set((clozeRows || []).map((r: { source_item_id: string | null }) => r.source_item_id)),
    ).filter(Boolean) as string[];
    if (sourceIds.length === 0) {
      return NextResponse.json({ success: true, items: [], total: 0 });
    }

    // 查询源文章（已审核）
    let itemQuery = supabase
      .from('shadowing_items')
      .select('id, lang, level, title, theme_id, subtopic_id, status, created_at, genre, meta')
      .in('id', sourceIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (lang) {
      if (!checkLanguagePermission(permissions, lang)) {
        return NextResponse.json({ success: true, items: [], total: 0 });
      }
      itemQuery = itemQuery.eq('lang', lang);
    }
    if (level) {
      const levelNum = parseInt(level);
      if (!checkLevelPermission(permissions, levelNum)) {
        return NextResponse.json({ success: true, items: [], total: 0 });
      }
      itemQuery = itemQuery.eq('level', levelNum);
    }

    if (themeId) {
      itemQuery = itemQuery.eq('theme_id', themeId);
    }
    if (subtopicId) {
      itemQuery = itemQuery.eq('subtopic_id', subtopicId);
    }
    if (keyword) {
      // 简单标题包含搜索（数据库端可能不支持 ilike，在此简化为客户端过滤，先取全量后过滤）
      // 这里先取后过滤
    }

    // 应用数据库端关键词/体裁过滤
    if (keyword) {
      itemQuery = itemQuery.ilike('title', `%${keyword}%`);
    }
    if (genre && genre !== 'all') {
      itemQuery = itemQuery.eq('genre', genre);
    }

    // practiced/unpracticed 预过滤（数据库端）
    if (practiced === 'true' || practiced === 'false') {
      const { data: completedRows } = await supabase
        .from('shadowing_sessions')
        .select('item_id')
        .eq('user_id', user.id)
        .eq('status', 'completed');
      const completedIds = Array.from(
        new Set(
          (completedRows || [])
            .map((r: { item_id: string | null }) => r.item_id)
            .filter((v): v is string => Boolean(v)),
        ),
      );
      if (practiced === 'true') {
        const none = '00000000-0000-0000-0000-000000000000';
        itemQuery = itemQuery.in('id', completedIds.length > 0 ? completedIds : [none]);
      } else if (practiced === 'false') {
        // 为避免使用不安全的 not-in hack，改为稍后在内存中过滤
        // 这里不对 itemQuery 追加条件
      }
    }

    const { data: items, error: itemsErr } = await itemQuery;
    if (itemsErr) {
      return NextResponse.json({ error: 'Items query failed' }, { status: 500 });
    }

    const filteredTitleItems = items || [];

    // 取用户 Shadowing 会话，沿用“完成”判定
    type ItemRow = {
      id: string;
      lang: string;
      level: number;
      title: string;
      theme_id: string | null;
      subtopic_id: string | null;
      status: string | null;
      created_at: string;
      genre: string | null;
      meta: unknown;
    };

    const ids = (filteredTitleItems as ItemRow[]).map((it) => it.id);
    let sessions: Array<{ item_id: string; status: 'draft' | 'completed' | null }> = [];
    if (ids.length > 0) {
      const { data: s } = await supabase
        .from('shadowing_sessions')
        .select('item_id, status')
        .eq('user_id', user.id)
        .in('item_id', ids);
      sessions = s || [];
    }

    // 统计：每篇发布句数（仅针对本页 ids，避免全量扫描）
    const publishedCountMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: pageClozeRows } = await supabase
        .from('cloze_shadowing_items')
        .select('source_item_id')
        .eq('is_published', true)
        .in('source_item_id', ids);
      for (const row of pageClozeRows || []) {
        const sid = (row as { source_item_id: string | null }).source_item_id as string;
        if (!sid) continue;
        publishedCountMap.set(sid, (publishedCountMap.get(sid) || 0) + 1);
      }
    }

    // Cloze 总结与最近练习时间
    let articleAttempts: Array<{
      source_item_id: string;
      total_sentences: number;
      accuracy: number;
      created_at: string;
    }> = [];
    if (ids.length > 0) {
      const { data: aa } = await supabase
        .from('cloze_shadowing_attempts_article')
        .select('source_item_id, total_sentences, accuracy, created_at')
        .eq('user_id', user.id)
        .in('source_item_id', ids)
        .order('created_at', { ascending: false });
      articleAttempts = aa || [];
    }

    const latestAttemptMap = new Map<string, { total_sentences: number; accuracy: number; created_at: string }>();
    for (const a of articleAttempts) {
      if (!latestAttemptMap.has(a.source_item_id)) latestAttemptMap.set(a.source_item_id, a);
    }

    type ProcessedItem = ItemRow & {
      isPracticed: boolean;
      status: 'draft' | 'completed' | null;
      stats: {
        sentenceCount: number;
        lastPracticed: string | null;
        accuracy: number | null;
        totalSentences: number | null;
      };
    };

    const processed: ProcessedItem[] = (filteredTitleItems as ItemRow[]).map((it) => {
      const session = sessions.find((s) => s.item_id === it.id);
      const isPracticed = session?.status === 'completed';
      const publishedCount = publishedCountMap.get(it.id) || 0;
      const latest = latestAttemptMap.get(it.id) || null;
      return {
        id: it.id,
        lang: it.lang,
        level: it.level,
        title: it.title,
        created_at: it.created_at,
        genre: it.genre,
        meta: it.meta,
        theme_id: it.theme_id,
        subtopic_id: it.subtopic_id,
        isPracticed,
        status: session?.status ?? null,
        stats: {
          sentenceCount: publishedCount,
          lastPracticed: latest?.created_at || null,
          accuracy: latest?.accuracy ?? null,
          totalSentences: latest?.total_sentences ?? null,
        },
      };
    });

    // practiced 过滤
    let filtered: ProcessedItem[] = processed;
    if (practiced === 'true') filtered = processed.filter((i) => i.isPracticed);
    else if (practiced === 'false') filtered = processed.filter((i) => !i.isPracticed);

    // 语言/等级未指定时，再次按权限过滤
    if (!lang) filtered = filtered.filter((i) => checkLanguagePermission(permissions, i.lang));
    if (!level) filtered = filtered.filter((i) => checkLevelPermission(permissions, i.level));

    // 主题与子主题元数据（用于筛选）
    const themeIds = Array.from(new Set(processed.map((i) => i.theme_id).filter(Boolean))) as string[];
    const subtopicIds = Array.from(new Set(processed.map((i) => i.subtopic_id).filter(Boolean))) as string[];

    let themes: Array<{ id: string; title: string; desc?: string }> = [];
    let subtopics: Array<{ id: string; title: string; one_line?: string }> = [];
    if (themeIds.length > 0) {
      const { data: themeRows } = await supabase
        .from('shadowing_themes')
        .select('id, title, desc')
        .in('id', themeIds);
      themes = themeRows || [];
    }
    if (subtopicIds.length > 0) {
      const { data: subRows } = await supabase
        .from('shadowing_subtopics')
        .select('id, title, one_line')
        .in('id', subtopicIds);
      subtopics = subRows || [];
    }

    // practiced=false 的情况在此处做内存过滤
    if (practiced === 'false') {
      const practicedIds = new Set(
        sessions.filter((s) => s.status === 'completed').map((s) => s.item_id),
      );
      filtered = processed.filter((i) => !practicedIds.has(i.id));
    }

    const total = filtered.length;
    const paged = limit != null ? filtered.slice(offset, offset + limit) : filtered;

    return NextResponse.json({ success: true, items: paged, total, themes, subtopics, limit: limit ?? undefined, offset: limit != null ? offset : undefined });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
