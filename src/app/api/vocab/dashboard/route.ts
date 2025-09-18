export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // 检查是否有 Authorization header
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabase: any;

    if (hasBearer) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } },
        },
      );
    } else {
      supabase = createServerClient(
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
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang');
    const status = searchParams.get('status');
    const explanation = searchParams.get('explanation');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log('API分页参数:', { page, limit, offset, lang, status, explanation, search });

    const nowIso = new Date().toISOString();

    // 并行执行多个查询
    const [
      // 生词列表查询
      { data: entries, error: entriesError, count: entriesCount },
      // 到期数量查询
      { count: dueCount, error: dueCountError },
      // 统计信息查询
      { data: stats, error: statsError }
    ] = await Promise.all([
      // 生词列表
      (() => {
        let query = supabase
          .from('vocab_entries')
          .select('id,term,lang,native_lang,source,context,tags,status,explanation,created_at,updated_at,srs_due,srs_interval,srs_ease,srs_reps,srs_lapses,srs_last,srs_state', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // 添加过滤条件
        if (lang) query = query.eq('lang', lang);
        if (status) query = query.eq('status', status);
        if (explanation) {
          if (explanation === 'has') {
            query = query.not('explanation', 'is', null);
          } else if (explanation === 'missing') {
            query = query.is('explanation', null);
          }
        }
        if (search) {
          query = query.or(`term.ilike.%${search}%,context.ilike.%${search}%`);
        }

        // 应用分页
        query = query.range(offset, offset + limit - 1);

        return query;
      })(),
      
      // 到期数量
      supabase
        .from('vocab_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'archived')
        .lte('srs_due', nowIso),
      
      // 统计信息
      supabase
        .from('vocab_entries')
        .select('lang,status,explanation')
        .eq('user_id', user.id)
    ]);

    if (entriesError) {
      console.error('查询生词列表失败:', entriesError);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    if (dueCountError) {
      console.error('查询到期数量失败:', dueCountError);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    if (statsError) {
      console.error('查询统计信息失败:', statsError);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    // 计算统计信息
    const statsData = {
      total: entriesCount || 0,
      byLanguage: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      withExplanation: 0,
      withoutExplanation: 0,
      dueCount: dueCount || 0
    };

    if (stats) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats.forEach((entry: { lang: string; status: string; explanation: any }) => {
        // 按语言统计
        statsData.byLanguage[entry.lang] = (statsData.byLanguage[entry.lang] || 0) + 1;
        
        // 按状态统计
        statsData.byStatus[entry.status] = (statsData.byStatus[entry.status] || 0) + 1;
        
        // 解释统计
        if (entry.explanation) {
          statsData.withExplanation++;
        } else {
          statsData.withoutExplanation++;
        }
      });
    }

    const responseData = {
      entries: entries || [],
      pagination: {
        page,
        limit,
        total: entriesCount || 0,
        totalPages: Math.ceil((entriesCount || 0) / limit),
      },
      stats: statsData,
      now: nowIso,
    };

    console.log('API返回数据:', { 
      entriesCount: entries?.length || 0, 
      totalCount: entriesCount || 0,
      pagination: responseData.pagination,
      firstEntry: entries?.[0]?.term || 'none',
      lastEntry: entries?.[entries.length - 1]?.term || 'none'
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('查询词汇仪表板API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
