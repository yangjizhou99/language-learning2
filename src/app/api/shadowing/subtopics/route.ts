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

    // 认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限
    const permissions = await getUserPermissions(user.id);
    if (!checkAccessPermission(permissions, 'can_access_shadowing')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang');
    const level = searchParams.get('level');
    const genre = searchParams.get('genre');
    const theme_id = searchParams.get('theme_id');

    if (lang && !checkLanguagePermission(permissions, lang)) {
      return NextResponse.json({ items: [] });
    }
    if (level) {
      const lvl = parseInt(level);
      if (!checkLevelPermission(permissions, lvl)) {
        return NextResponse.json({ items: [] });
      }
    }

    let query = supabase
      .from('shadowing_subtopics')
      .select('id, title, one_line, lang, level, genre, theme_id, status, created_at')
      .eq('status', 'active');
    if (lang) query = query.eq('lang', lang);
    if (level) query = query.eq('level', parseInt(level));
    if (genre && genre !== 'all') query = query.eq('genre', genre);
    if (theme_id && theme_id !== 'all') query = query.eq('theme_id', theme_id);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Subtopics query error:', error);
      }
      return NextResponse.json({ error: 'Failed to load subtopics' }, { status: 400 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Error in shadowing subtopics API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}






















