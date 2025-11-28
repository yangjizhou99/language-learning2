export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getUserPreferenceVectors } from '@/lib/recommendation/preferences';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      }) as unknown as SupabaseClient;
    } else if (cookieHeader) {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const url = new URL(req.url);
    const refreshParam = url.searchParams.get('refresh');
    const forceRefresh = refreshParam === '1' || refreshParam === 'true';

    const vectors = await getUserPreferenceVectors(user.id, { forceRefresh });

    // Attach basic theme/subtopic metadata for convenience
    const supabaseAdmin = getServiceSupabase();
    const themeIds = vectors.themes.map((t) => t.theme_id);
    const subtopicIds = vectors.subtopics.map((s) => s.subtopic_id);

    let themesMeta: any[] = [];
    let subtopicsMeta: any[] = [];

    if (themeIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('shadowing_themes')
        .select('id, lang, level, genre, title, desc')
        .in('id', themeIds);
      themesMeta = data || [];
    }

    if (subtopicIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('shadowing_subtopics')
        .select('id, theme_id, lang, level, genre, title_cn, one_line_cn, tags')
        .in('id', subtopicIds);
      subtopicsMeta = data || [];
    }

    const themeMetaMap = new Map<string, any>();
    for (const t of themesMeta) {
      themeMetaMap.set(t.id, t);
    }

    const subtopicMetaMap = new Map<string, any>();
    for (const s of subtopicsMeta) {
      subtopicMetaMap.set(s.id, s);
    }

    const themes = vectors.themes.map((t) => ({
      theme_id: t.theme_id,
      weight: t.weight,
      theme: themeMetaMap.get(t.theme_id) || null,
    }));

    const subtopics = vectors.subtopics.map((s) => ({
      subtopic_id: s.subtopic_id,
      weight: s.weight,
      subtopic: subtopicMetaMap.get(s.subtopic_id) || null,
    }));

    return NextResponse.json({
      success: true,
      themes,
      subtopics,
    });
  } catch (error) {
    console.error('Error in /api/recommend/preferences:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

