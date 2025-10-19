// =====================================================
// 获取训练内容 API
// GET /api/pronunciation/training/[unit_id]?lang=zh-CN
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { gradeFromMeanCI } from '@/lib/pronunciation/stats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pronunciation/training/[unit_id]?lang=zh-CN
 * 获取指定音节的训练内容
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unit_id: string }> }
) {
  try {
    const { unit_id } = await params;
    const unitId = parseInt(unit_id);

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
    const lang = searchParams.get('lang') || 'zh-CN';

    const supabaseAdmin = getServiceSupabase();

    // 3. 获取音节信息和统计
    const { data: unitInfo, error: unitError } = await supabaseAdmin
      .from('unit_catalog')
      .select('unit_id, symbol')
      .eq('unit_id', unitId)
      .single();

    if (unitError || !unitInfo) {
      return NextResponse.json(
        { success: false, error: '音节不存在' },
        { status: 404 }
      );
    }

    // 4. 获取用户统计（可能不存在）
    const { data: stat } = await supabaseAdmin
      .from('user_unit_stats')
      .select('n, mean, ci_low, ci_high')
      .eq('user_id', user.id)
      .eq('lang', lang)
      .eq('unit_id', unitId)
      .maybeSingle();

    const currentMean = stat ? Number(stat.mean) : 0;
    const currentCount = stat ? stat.n : 0;
    const grade = stat ? gradeFromMeanCI(Number(stat.mean), stat.ci_low) : 'C';

    // 5. 获取训练内容
    const { data: content } = await supabaseAdmin
      .from('training_content')
      .select('*')
      .eq('unit_id', unitId)
      .eq('lang', lang)
      .maybeSingle();

    // 6. 获取最小对立词
    const { data: pairs } = await supabaseAdmin
      .from('minimal_pairs')
      .select('word_1, word_2, pinyin_1, pinyin_2')
      .eq('lang', lang)
      .or(`unit_id_1.eq.${unitId},unit_id_2.eq.${unitId}`)
      .limit(5);

    return NextResponse.json({
      success: true,
      unit: {
        unit_id: unitId,
        symbol: unitInfo.symbol,
        current_mean: currentMean,
        current_count: currentCount,
        grade,
      },
      content: content ? {
        articulation_points: content.articulation_points,
        common_errors: content.common_errors,
        tips: content.tips,
        ipa_symbol: content.ipa_symbol,
        practice_words: content.practice_words || [],
        practice_phrases: content.practice_phrases || [],
      } : null,
      minimal_pairs: pairs || [],
    });
  } catch (error) {
    console.error('[pronunciation/training] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

