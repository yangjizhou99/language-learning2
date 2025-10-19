// =====================================================
// 二次验证 - 提交验证结果
// POST /api/pronunciation/verify/submit
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import {
  shouldReplaceStats,
  calculateVerificationStats,
  formatVerificationReport,
} from '@/lib/pronunciation/verification';
import { welfordUpdate } from '@/lib/pronunciation/stats';
import type { Stat } from '@/types/pronunciation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface VerificationScore {
  sentence_id: number;
  score: number;
  valid: boolean;
}

/**
 * POST /api/pronunciation/verify/submit
 * 提交验证结果，判断是否需要替换统计
 * 
 * 请求体:
 * {
 *   unit_id: number,
 *   lang: string,
 *   scores: VerificationScore[]
 * }
 */
export async function POST(req: NextRequest) {
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

    // 2. 解析请求体
    const body = await req.json();
    const { unit_id, lang = 'zh-CN', scores } = body;

    if (!unit_id || !scores || !Array.isArray(scores)) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();

    // 3. 查询该 Unit 的原始统计数据
    const { data: unitStat, error: statError } = await supabaseAdmin
      .from('user_unit_stats')
      .select('n, mean, m2, ci_low, ci_high')
      .eq('user_id', user.id)
      .eq('lang', lang)
      .eq('unit_id', unit_id)
      .maybeSingle();

    if (statError) {
      throw new Error(`查询统计数据失败: ${statError.message}`);
    }

    if (!unitStat) {
      return NextResponse.json(
        { success: false, error: '该音节暂无统计数据' },
        { status: 404 }
      );
    }

    const originalStat: Stat = {
      n: unitStat.n,
      mean: Number(unitStat.mean),
      m2: Number(unitStat.m2),
    };

    // 4. 计算验证阶段的统计
    const validScores = scores
      .filter((s: VerificationScore) => s.valid)
      .map((s: VerificationScore) => s.score);

    if (validScores.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有有效的验证样本' },
        { status: 400 }
      );
    }

    const verificationStats = calculateVerificationStats(validScores);

    // 5. 判断是否需要替换统计
    const replaced = shouldReplaceStats(
      originalStat,
      verificationStats.mean,
      verificationStats.count
    );

    // 6. 更新数据库
    let newStat: Stat;

    if (replaced) {
      // 替换统计：使用验证阶段的数据
      newStat = {
        n: verificationStats.count,
        mean: verificationStats.mean,
        m2: verificationStats.stdDev * verificationStats.stdDev * (verificationStats.count - 1),
      };
    } else {
      // 合并统计：将验证样本加入原统计
      newStat = originalStat;
      for (const score of validScores) {
        newStat = welfordUpdate(newStat, score);
      }
    }

    // 计算新的置信区间
    const newCI = newStat.n >= 2
      ? {
          low: newStat.mean - 1.96 * Math.sqrt(newStat.m2 / (newStat.n - 1) / newStat.n),
          high: newStat.mean + 1.96 * Math.sqrt(newStat.m2 / (newStat.n - 1) / newStat.n),
        }
      : { low: undefined, high: undefined };

    // 更新数据库
    const { error: updateError } = await supabaseAdmin
      .from('user_unit_stats')
      .update({
        n: newStat.n,
        mean: newStat.mean,
        m2: newStat.m2,
        ci_low: newCI.low,
        ci_high: newCI.high,
        last_updated: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('lang', lang)
      .eq('unit_id', unit_id);

    if (updateError) {
      throw new Error(`更新统计数据失败: ${updateError.message}`);
    }

    // 7. 生成验证报告
    const report = formatVerificationReport(
      originalStat,
      verificationStats,
      replaced
    );

    // 8. 记录验证历史（可选，用于后续分析）
    await supabaseAdmin
      .from('user_pron_verifications')
      .insert({
        user_id: user.id,
        unit_id,
        lang,
        original_mean: originalStat.mean,
        original_count: originalStat.n,
        verification_mean: verificationStats.mean,
        verification_count: verificationStats.count,
        replaced,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    return NextResponse.json({
      success: true,
      report,
      updated_stats: {
        n: newStat.n,
        mean: Number(newStat.mean.toFixed(1)),
        ci_low: newCI.low ? Number(newCI.low.toFixed(1)) : undefined,
        ci_high: newCI.high ? Number(newCI.high.toFixed(1)) : undefined,
      },
    });
  } catch (error) {
    console.error('[pronunciation/verify/submit] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

