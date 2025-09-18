export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // 检查是否有 Authorization header
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');

    let supabase: any;

    if (hasBearer) {
      // 使用 Authorization header
      console.log('使用 Authorization header 认证');
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } },
        },
      );
    } else {
      // 使用 cookie 认证
      console.log('使用 Cookie 认证');
      const authToken = cookieStore.get('sb-yyfyieqfuwwyqrlewswu-auth-token')?.value;
      console.log('Auth token cookie exists:', !!authToken);

      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              const value = cookieStore.get(name)?.value;
              console.log(`Getting cookie ${name}:`, !!value);
              return value;
            },
            set(name: string, value: string, options: any) {
              console.log(`Setting cookie ${name}:`, !!value);
              // no-op for Route Handler
            },
            remove(name: string, options: any) {
              console.log(`Removing cookie ${name}`);
              // no-op for Route Handler
            },
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

    // 构建查询
    let query = supabase
      .from('vocab_entries')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 添加过滤条件
    if (lang) {
      query = query.eq('lang', lang);
    }

    if (status) {
      query = query.eq('status', status);
    }

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

    const { data, error, count } = await query;

    if (error) {
      console.error('查询生词列表失败:', error);
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
    });
  } catch (error) {
    console.error('查询生词列表API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
