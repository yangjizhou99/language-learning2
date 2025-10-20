// =====================================================
// 覆盖度统计 API
// 返回用户音节的覆盖度统计信息
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CoverageStats {
  total_units: number;
  practiced_units: number;
  coverage_rate: number;
  category_stats: Array<{
    category: string;
    total: number;
    practiced: number;
    rate: number;
  }>;
}

/**
 * GET /api/pronunciation/coverage-stats?lang=zh-CN
 * 获取用户的音节覆盖度统计信息
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 获取用户认证信息
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

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

    // 3. 获取覆盖度统计（使用管理员权限）
    const adminSupabase = getServiceSupabase();
    const stats = await getCoverageStats(adminSupabase, user.id, lang);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[pronunciation/coverage-stats] 错误:', error);
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
 * 获取覆盖度统计
 */
type UnitRow = { unit_id: number; symbol: string };

async function getCoverageStats(
  supabase: SupabaseClient,
  userId: string,
  lang: string
): Promise<CoverageStats> {
  // 1. 获取用户已练习的音节
  const { data: practicedUnits, error: practicedError } = await supabase
    .from('user_unit_stats')
    .select('unit_id')
    .eq('user_id', userId)
    .eq('lang', lang);

  if (practicedError) {
    console.error('获取已练习音节失败:', practicedError);
    throw new Error('获取已练习音节失败');
  }

  const practicedUnitIds = new Set<number>(
    ((practicedUnits as Array<{ unit_id: number }> | null) || []).map((u) => Number(u.unit_id)),
  );

  // 2. 获取所有音节
  const { data: allUnits, error: unitsError } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol')
    .eq('lang', lang);

  if (unitsError) {
    console.error('获取音节列表失败:', unitsError);
    throw new Error('获取音节列表失败');
  }

  const totalUnits = (allUnits as UnitRow[] | null)?.length || 0;
  const practicedUnitsCount = practicedUnitIds.size;
  const coverageRate = totalUnits > 0 ? (practicedUnitsCount / totalUnits) * 100 : 0;

  // 3. 获取分类统计
  let categoryStats: Array<{
    category: string;
    total: number;
    practiced: number;
    rate: number;
  }> = [];

  if (lang === 'zh-CN') {
    categoryStats = await getChineseCategoryStats(supabase, practicedUnitIds);
  } else if (lang === 'en-US') {
    categoryStats = await getEnglishCategoryStats(supabase, practicedUnitIds);
  } else if (lang === 'ja-JP') {
    categoryStats = await getJapaneseCategoryStats(supabase, practicedUnitIds);
  }

  return {
    total_units: totalUnits,
    practiced_units: practicedUnitsCount,
    coverage_rate: coverageRate,
    category_stats: categoryStats,
  };
}

/**
 * 获取中文分类统计
 */
async function getChineseCategoryStats(
  supabase: SupabaseClient,
  practicedUnitIds: Set<number>
): Promise<Array<{ category: string; total: number; practiced: number; rate: number }>> {
  const { data: units, error: unitsError } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol')
    .eq('lang', 'zh-CN');

  if (unitsError || !units) {
    console.error('获取中文音节失败:', unitsError);
    return [];
  }

  // 基于symbol进行简单分类
  const categoryMap = new Map<string, { total: number; practiced: number }>();

  (units as UnitRow[]).forEach((unit) => {
    const symbol = unit.symbol;
    let category = '韵母'; // 默认韵母

    // 简单判断：常见声母
    if (['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'].includes(symbol)) {
      category = '声母';
    }

    const existing = categoryMap.get(category) || { total: 0, practiced: 0 };
    existing.total += 1;
    if (practicedUnitIds.has(unit.unit_id)) {
      existing.practiced += 1;
    }
    categoryMap.set(category, existing);
  });

  const result: Array<{ category: string; total: number; practiced: number; rate: number }> = [];
  for (const [category, stats] of categoryMap.entries()) {
    result.push({
      category,
      total: stats.total,
      practiced: stats.practiced,
      rate: stats.total > 0 ? (stats.practiced / stats.total) * 100 : 0,
    });
  }

  return result;
}

/**
 * 获取英文分类统计
 */
async function getEnglishCategoryStats(
  supabase: SupabaseClient,
  practicedUnitIds: Set<number>
): Promise<Array<{ category: string; total: number; practiced: number; rate: number }>> {
  const { data: units, error: unitsError } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol')
    .eq('lang', 'en-US');

  if (unitsError || !units) {
    console.error('获取英文音素失败:', unitsError);
    return [];
  }

  // 基于symbol进行简单分类
  const categoryMap = new Map<string, { total: number; practiced: number }>();

  (units as UnitRow[]).forEach((unit) => {
    const symbol = unit.symbol;
    let category = 'consonant'; // 默认辅音

    // 简单判断：常见元音IPA符号
    if (['i', 'ɪ', 'e', 'ɛ', 'æ', 'ɑ', 'ɔ', 'o', 'ʊ', 'u', 'ʌ', 'ə', 'ɜ'].includes(symbol)) {
      category = 'vowel';
    }

    const existing = categoryMap.get(category) || { total: 0, practiced: 0 };
    existing.total += 1;
    if (practicedUnitIds.has(unit.unit_id)) {
      existing.practiced += 1;
    }
    categoryMap.set(category, existing);
  });

  const result: Array<{ category: string; total: number; practiced: number; rate: number }> = [];
  for (const [category, stats] of categoryMap.entries()) {
    result.push({
      category,
      total: stats.total,
      practiced: stats.practiced,
      rate: stats.total > 0 ? (stats.practiced / stats.total) * 100 : 0,
    });
  }

  return result;
}

/**
 * 获取日文分类统计
 */
async function getJapaneseCategoryStats(
  supabase: SupabaseClient,
  practicedUnitIds: Set<number>
): Promise<Array<{ category: string; total: number; practiced: number; rate: number }>> {
  const { data: units, error: unitsError } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol')
    .eq('lang', 'ja-JP');

  if (unitsError || !units) {
    console.error('获取日文音素失败:', unitsError);
    return [];
  }

  // 基于symbol进行简单分类
  const categoryMap = new Map<string, { total: number; practiced: number }>();

  (units as UnitRow[]).forEach((unit) => {
    const symbol = unit.symbol;
    let category = 'consonant'; // 默认辅音

    // 简单判断：常见元音符号
    if (['a', 'i', 'ɯ', 'e', 'o'].includes(symbol)) {
      category = 'vowel';
    } else if (['Q', ':', 'N'].includes(symbol)) {
      category = 'special';
    }

    const existing = categoryMap.get(category) || { total: 0, practiced: 0 };
    existing.total += 1;
    if (practicedUnitIds.has(unit.unit_id)) {
      existing.practiced += 1;
    }
    categoryMap.set(category, existing);
  });

  const result: Array<{ category: string; total: number; practiced: number; rate: number }> = [];
  for (const [category, stats] of categoryMap.entries()) {
    result.push({
      category,
      total: stats.total,
      practiced: stats.practiced,
      rate: stats.total > 0 ? (stats.practiced / stats.total) * 100 : 0,
    });
  }

  return result;
}

