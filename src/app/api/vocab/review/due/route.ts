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

    // 首选包含 SRS 的查询
    // 到期规则：
    // - 未归档（status != 'archived' 或 status 为空）
    // - 且 (srs_due <= now 或 srs_due 为空 -> 表示从未安排，按新词优先复习)
    let query = supabase
      .from('vocab_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .or('status.neq.archived,status.is.null')
      .or(`srs_due.lte.${nowIso},srs_due.is.null`)
      .order('srs_due', { ascending: true, nullsFirst: true })
      .range(offset, offset + limit - 1);

    let { data, error, count } = await query;

    // 若 srs_due 列不存在，则降级为按 created_at 查询
    // Postgres 错误码 42703: undefined_column
    if (error && (error as any)?.code === '42703') {
      const fallbackSelect = 'id,term,lang,native_lang,source,context,tags,status,explanation,created_at,updated_at';
      const fallback = await supabase
        .from('vocab_entries')
        .select(fallbackSelect, { count: 'exact' })
        .eq('user_id', user.id)
        .or('status.neq.archived,status.is.null')
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (fallback.error) {
        console.error('获取到期生词失败(降级查询失败):', fallback.error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      return NextResponse.json({
        entries: fallback.data || [],
        pagination: {
          page,
          limit,
          total: fallback.count || 0,
          totalPages: Math.ceil((fallback.count || 0) / limit),
        },
        now: nowIso,
        degraded: true,
      });
    }

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

