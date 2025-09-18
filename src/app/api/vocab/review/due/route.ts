export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 1000);
    const offset = (page - 1) * limit;

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
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const nowIso = new Date().toISOString();

    let query = supabase
      .from('vocab_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .lte('srs_due', nowIso)
      .order('srs_due', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('获取到期生词失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    return NextResponse.json({
      entries: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      now: nowIso,
    });
  } catch (e) {
    console.error('due route error:', e);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}


