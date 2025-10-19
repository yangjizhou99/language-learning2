// =====================================================
// 雷达图数据 API
// 返回用户按分类聚合的统计数据（用于雷达图显示）
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RadarDataPoint {
  category: string;
  value: number;
  count: number;
}

/**
 * GET /api/pronunciation/radar-data?lang=zh-CN
 * 获取用户的雷达图数据（按分类聚合）
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

    let radarData: RadarDataPoint[] = [];

    if (lang === 'zh-CN') {
      // 中文：按声母/韵母/声调分类
      radarData = await getChineseRadarData(supabase, user.id);
    } else if (lang === 'en-US') {
      // 英文：按元音/辅音/双元音分类
      radarData = await getEnglishRadarData(supabase, user.id);
    } else if (lang === 'ja-JP') {
      // 日文：按音素分类
      radarData = await getJapaneseRadarData(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      data: radarData,
      lang,
    });
  } catch (error) {
    console.error('[pronunciation/radar-data] 错误:', error);
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
 * 获取中文雷达图数据（按声母/韵母/声调分类）
 */
async function getChineseRadarData(supabaseClient: SupabaseClient, userId: string): Promise<RadarDataPoint[]> {
  // 获取用户统计数据，包含拼音信息
  const { data: stats, error: statsError } = await supabaseClient
    .from('user_unit_stats')
    .select(`
      unit_id,
      n,
      mean,
      unit_catalog!inner(symbol, unit_type),
      zh_pinyin_units!inner(shengmu, yunmu, tone)
    `)
    .eq('user_id', userId)
    .eq('lang', 'zh-CN')
    .not('zh_pinyin_units.shengmu', 'is', null);

  if (statsError) {
    throw new Error(`获取中文统计数据失败: ${statsError.message}`);
  }

  // 按声母分类聚合
  const shengmuData = aggregateByCategory(stats || [], 'shengmu', '声母');
  
  // 按韵母分类聚合
  const yunmuData = aggregateByCategory(stats || [], 'yunmu', '韵母');
  
  // 按声调分类聚合
  const toneData = aggregateByCategory(stats || [], 'tone', '声调');

  return [...shengmuData, ...yunmuData, ...toneData];
}

/**
 * 获取英文雷达图数据（按元音/辅音/双元音分类）
 */
async function getEnglishRadarData(supabaseClient: SupabaseClient, userId: string): Promise<RadarDataPoint[]> {
  // 获取用户统计数据，包含音素分类信息
  const { data: stats, error: statsError } = await supabaseClient
    .from('user_unit_stats')
    .select(`
      unit_id,
      n,
      mean,
      unit_catalog!inner(symbol, unit_type),
      en_phoneme_units!inner(category, subcategory)
    `)
    .eq('user_id', userId)
    .eq('lang', 'en-US');

  if (statsError) {
    throw new Error(`获取英文统计数据失败: ${statsError.message}`);
  }

  // 按主分类聚合（元音/辅音/双元音）
  const categoryData = aggregateByCategory(stats || [], 'category', 'category');

  return categoryData;
}

/**
 * 获取日文雷达图数据（按音素分类）
 */
async function getJapaneseRadarData(supabaseClient: SupabaseClient, userId: string): Promise<RadarDataPoint[]> {
  // 获取用户统计数据，包含罗马字音节信息
  const { data: stats, error: statsError } = await supabaseClient
    .from('user_unit_stats')
    .select(`
      unit_id,
      n,
      mean,
      unit_catalog!inner(symbol, unit_type)
    `)
    .eq('user_id', userId)
    .eq('lang', 'ja-JP');

  if (statsError) {
    throw new Error(`获取日文统计数据失败: ${statsError.message}`);
  }

  // 按罗马字音节分类聚合（按行分类）
  const categoryMap = new Map<string, { sum: number; count: number; totalCount: number }>();

  (stats || []).forEach(stat => {
    const unitCatalogEntry = Array.isArray(stat.unit_catalog)
      ? stat.unit_catalog[0]
      : stat.unit_catalog;
    const symbol = unitCatalogEntry?.symbol || '未知';
    let category = '其他';
    
    // 按行分类罗马字音节
    if (['a', 'i', 'u', 'e', 'o'].includes(symbol)) {
      category = 'あ行';
    } else if (symbol.startsWith('k')) {
      category = 'か行';
    } else if (symbol.startsWith('g')) {
      category = 'が行';
    } else if (symbol.startsWith('s')) {
      category = 'さ行';
    } else if (symbol.startsWith('z')) {
      category = 'ざ行';
    } else if (symbol.startsWith('t')) {
      category = 'た行';
    } else if (symbol.startsWith('d')) {
      category = 'だ行';
    } else if (symbol.startsWith('n')) {
      category = 'な行';
    } else if (symbol.startsWith('h')) {
      category = 'は行';
    } else if (symbol.startsWith('b')) {
      category = 'ば行';
    } else if (symbol.startsWith('p')) {
      category = 'ぱ行';
    } else if (symbol.startsWith('m')) {
      category = 'ま行';
    } else if (symbol.startsWith('y')) {
      category = 'や行';
    } else if (symbol.startsWith('r')) {
      category = 'ら行';
    } else if (symbol.startsWith('w')) {
      category = 'わ行';
    } else if (symbol === 'n') {
      category = 'ん';
    }
    
    const key = category;
    const existing = categoryMap.get(key) || { sum: 0, count: 0, totalCount: 0 };

    existing.sum += stat.mean * stat.n;
    existing.count += stat.n;
    existing.totalCount += 1;

    categoryMap.set(key, existing);
  });

  // 转换为雷达图数据点
  const result: RadarDataPoint[] = [];

  categoryMap.forEach((data, key) => {
    if (data.count > 0) {
      const avgScore = data.sum / data.count;

      result.push({
        category: key,
        value: Number(avgScore.toFixed(1)),
        count: data.totalCount,
      });
    }
  });

  return result.sort((a, b) => b.value - a.value);
}

/**
 * 按指定字段聚合统计数据
 */
function aggregateByCategory(
  stats: any[], 
  field: string, 
  categoryPrefix: string
): RadarDataPoint[] {
  const categoryMap = new Map<string, { sum: number; count: number; totalCount: number }>();

  stats.forEach(stat => {
    let categoryValue: string;
    
    if (field === 'tone') {
      // 声调特殊处理
      const tone = stat.zh_pinyin_units?.tone;
      categoryValue = tone ? `${tone}声` : '轻声';
    } else {
      categoryValue = stat[field === 'shengmu' ? 'zh_pinyin_units' : 
                           field === 'yunmu' ? 'zh_pinyin_units' : 
                           'en_phoneme_units']?.[field] || '未知';
    }

    const key = `${categoryPrefix}_${categoryValue}`;
    const existing = categoryMap.get(key) || { sum: 0, count: 0, totalCount: 0 };
    
    existing.sum += stat.mean * stat.n;
    existing.count += stat.n;
    existing.totalCount += 1;
    
    categoryMap.set(key, existing);
  });

  // 转换为雷达图数据点
  const result: RadarDataPoint[] = [];
  
  categoryMap.forEach((data, key) => {
    if (data.count > 0) {
      const avgScore = data.sum / data.count;
      const categoryName = key.replace(`${categoryPrefix}_`, '');
      
      result.push({
        category: categoryName,
        value: Number(avgScore.toFixed(1)),
        count: data.totalCount,
      });
    }
  });

  return result.sort((a, b) => b.value - a.value);
}
