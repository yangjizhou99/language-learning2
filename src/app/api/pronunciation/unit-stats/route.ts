// =====================================================
// 个人发音画像 API
// 返回用户所有 Unit 的统计数据和等级
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { gradeFromMeanCI } from '@/lib/pronunciation/stats';
import type { UnitStats } from '@/types/pronunciation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pronunciation/unit-stats?lang=zh-CN
 * 获取用户的 Unit 统计数据
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份（使用项目标准认证方式）
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
    const lang = searchParams.get('lang') || 'zh-CN';

    // 3. 获取用户统计数据
    const { data: stats, error: statsError } = await supabase
      .from('user_unit_stats')
      .select(`
        unit_id,
        n,
        mean,
        ci_low,
        ci_high,
        unit_catalog!inner(symbol, unit_type)
      `)
      .eq('user_id', user.id)
      .eq('lang', lang)
      .order('mean', { ascending: true }); // 分数低的排前面（薄弱项）

    if (statsError) {
      throw new Error(`获取统计数据失败: ${statsError.message}`);
    }

    // 4. 转换为返回格式
    const result: UnitStats[] = (stats || []).map((stat: any) => {
      const grade = gradeFromMeanCI(stat.mean, stat.ci_low);
      
      return {
        unit_id: stat.unit_id,
        symbol: stat.unit_catalog.symbol,
        unit_type: stat.unit_catalog.unit_type,
        n: stat.n,
        mean: Number(stat.mean),
        ci_low: stat.ci_low !== null ? Number(stat.ci_low) : undefined,
        ci_high: stat.ci_high !== null ? Number(stat.ci_high) : undefined,
        grade,
      };
    });

    return NextResponse.json({
      success: true,
      stats: result,
      total: result.length,
    });
  } catch (error) {
    console.error('[pronunciation/unit-stats] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

