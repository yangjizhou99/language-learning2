// =====================================================
// 再测对比 API
// 返回某个unit在训练前后的统计数据对比
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RetestDataPoint {
  date: string;
  score: number;
  count: number;
}

interface RetestComparison {
  unit_id: number;
  symbol: string;
  lang: string;
  before: {
    mean: number;
    count: number;
    period: string;
    dataPoints: RetestDataPoint[];
  };
  after: {
    mean: number;
    count: number;
    period: string;
    dataPoints: RetestDataPoint[];
  };
  improvement: {
    scoreChange: number;
    percentageChange: number;
    isSignificant: boolean;
  };
}

type PronunciationAttempt = {
  accuracy: number;
  created_at: string;
  sentence_units: Array<{ unit_id: number; count: number }>;
};

/**
 * GET /api/pronunciation/retest?unit_id=123&lang=zh-CN&days=7
 * 获取某个unit的再测对比数据
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
    const lang = searchParams.get('lang') || 'zh-CN';
    const days = parseInt(searchParams.get('days') || '7');

    if (!unitId) {
      return NextResponse.json(
        { success: false, error: '缺少unit_id参数' },
        { status: 400 }
      );
    }

    // 3. 获取再测对比数据
    const supabaseAdmin = getServiceSupabase();
    const retestData = await getRetestComparison(supabaseAdmin, user.id, unitId, lang, days);

    return NextResponse.json({
      success: true,
      data: retestData,
    });
  } catch (error) {
    console.error('[pronunciation/retest] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取再测对比数据
 */
async function getRetestComparison(
  supabaseAdmin: any,
  userId: string,
  unitId: number,
  lang: string,
  days: number
): Promise<RetestComparison> {
  // 1. 获取unit信息
  const { data: unitInfo, error: unitError } = await supabaseAdmin
    .from('unit_catalog')
    .select('symbol')
    .eq('unit_id', unitId)
    .single();

  if (unitError || !unitInfo) {
    throw new Error(`获取unit信息失败: ${unitError?.message}`);
  }

  // 2. 计算时间范围
  const now = new Date();
  const afterDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const beforeDate = new Date(now.getTime() - (days * 2) * 24 * 60 * 60 * 1000);

  // 3. 获取训练后的数据（最近days天）
  const afterData = await getTimeRangeData(supabaseAdmin, userId, unitId, lang, afterDate, now);
  
  // 4. 获取训练前的数据（days天前到2*days天前）
  const beforeData = await getTimeRangeData(supabaseAdmin, userId, unitId, lang, beforeDate, afterDate);

  // 5. 计算改进情况
  const improvement = calculateImprovement(beforeData, afterData);

  return {
    unit_id: unitId,
    symbol: unitInfo.symbol,
    lang,
    before: beforeData,
    after: afterData,
    improvement,
  };
}

/**
 * 获取指定时间范围内的数据
 */
async function getTimeRangeData(
  supabaseAdmin: any,
  userId: string,
  unitId: number,
  lang: string,
  startDate: Date,
  endDate: Date
): Promise<{
  mean: number;
  count: number;
  period: string;
  dataPoints: RetestDataPoint[];
}> {
  // 获取该时间范围内的所有attempts
  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from('user_pron_attempts')
    .select(`
      attempt_id,
      accuracy,
      created_at,
      sentence_id,
      sentence_units!inner(unit_id, count)
    `)
    .eq('user_id', userId)
    .eq('lang', lang)
    .eq('valid_flag', true)
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (attemptsError) {
    throw new Error(`获取attempts数据失败: ${attemptsError.message}`);
  }

  // 过滤出包含目标unit的attempts
  const attemptList = (attempts || []) as PronunciationAttempt[];

  const relevantAttempts = attemptList.filter((attempt) =>
    attempt.sentence_units.some((su) => su.unit_id === unitId)
  );

  if (relevantAttempts.length === 0) {
    return {
      mean: 0,
      count: 0,
      period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      dataPoints: [],
    };
  }

  // 按日期聚合数据
  const dailyData = new Map<string, { sum: number; count: number }>();
  
  relevantAttempts.forEach((attempt) => {
    const date = new Date(attempt.created_at).toISOString().split('T')[0];
    const existing = dailyData.get(date) || { sum: 0, count: 0 };
    existing.sum += attempt.accuracy;
    existing.count += 1;
    dailyData.set(date, existing);
  });

  // 转换为数据点
  const dataPoints: RetestDataPoint[] = Array.from(dailyData.entries()).map(([date, data]) => ({
    date,
    score: data.sum / data.count,
    count: data.count,
  }));

  // 计算总体统计
  const totalSum = dataPoints.reduce((sum, point) => sum + (point.score * point.count), 0);
  const totalCount = dataPoints.reduce((sum, point) => sum + point.count, 0);
  const mean = totalCount > 0 ? totalSum / totalCount : 0;

  return {
    mean: Number(mean.toFixed(1)),
    count: totalCount,
    period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    dataPoints,
  };
}

/**
 * 计算改进情况
 */
function calculateImprovement(
  before: { mean: number; count: number },
  after: { mean: number; count: number }
): {
  scoreChange: number;
  percentageChange: number;
  isSignificant: boolean;
} {
  const scoreChange = after.mean - before.mean;
  const percentageChange = before.mean > 0 ? (scoreChange / before.mean) * 100 : 0;
  
  // 判断是否显著改进（改进超过5分或10%）
  const isSignificant = Math.abs(scoreChange) >= 5 || Math.abs(percentageChange) >= 10;

  return {
    scoreChange: Number(scoreChange.toFixed(1)),
    percentageChange: Number(percentageChange.toFixed(1)),
    isSignificant,
  };
}
