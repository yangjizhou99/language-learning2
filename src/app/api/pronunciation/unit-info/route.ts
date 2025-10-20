// =====================================================
// Unit信息 API
// 返回指定unit的基本信息
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pronunciation/unit-info?unit_id=123
 * 获取unit的基本信息
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 2. 解析参数
    const { searchParams } = new URL(req.url);
    const unitId = parseInt(searchParams.get('unit_id') || '0');

    if (!unitId) {
      return NextResponse.json(
        { success: false, error: '缺少unit_id参数' },
        { status: 400 }
      );
    }

    // 3. 获取unit信息
    const supabaseAdmin = getServiceSupabase();

    const { data: unitInfo, error: unitError } = await supabaseAdmin
      .from('unit_catalog')
      .select('symbol, lang, unit_type')
      .eq('unit_id', unitId)
      .single();

    if (unitError || !unitInfo) {
      return NextResponse.json(
        { success: false, error: 'Unit不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        unit_id: unitId,
        symbol: unitInfo.symbol,
        lang: unitInfo.lang,
        unit_type: unitInfo.unit_type,
      },
    });
  } catch (error) {
    console.error('[pronunciation/unit-info] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

