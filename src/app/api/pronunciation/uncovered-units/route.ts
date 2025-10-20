// =====================================================
// 未覆盖音节推荐 API
// 返回用户尚未练习的音节列表和推荐句子
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface UncoveredUnit {
  unit_id: number;
  symbol: string;
  category: string;
  subcategory?: string;
  frequency: number;
  recommended_sentences: Array<{
    sentence_id: number;
    text: string;
    level: number;
  }>;
}

/**
 * GET /api/pronunciation/uncovered-units?lang=zh-CN&limit=10
 * 获取用户尚未练习的音节列表和推荐句子
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
    const lang = searchParams.get('lang') || 'zh-CN';
    const limit = parseInt(searchParams.get('limit') || '10');

    // 3. 获取未覆盖音节
    const supabaseAdmin = getServiceSupabase();
    const uncoveredUnits = await getUncoveredUnits(supabaseAdmin, user.id, lang, limit);

    return NextResponse.json({
      success: true,
      data: uncoveredUnits,
      total: uncoveredUnits.length,
    });
  } catch (error) {
    console.error('[pronunciation/uncovered-units] 错误:', error);
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
 * 获取未覆盖音节列表
 */
async function getUncoveredUnits(
  supabaseAdmin: any,
  userId: string,
  lang: string,
  limit: number
): Promise<UncoveredUnit[]> {
  // 1. 获取用户已练习的音节
  const { data: practicedUnits, error: practicedError } = await supabaseAdmin
    .from('user_unit_stats')
    .select('unit_id')
    .eq('user_id', userId)
    .eq('lang', lang);

  if (practicedError) {
    throw new Error(`获取已练习音节失败: ${practicedError.message}`);
  }

  const practicedUnitIds = new Set((practicedUnits || []).map((u: any) => u.unit_id));

  // 2. 获取所有可用音节（排除已练习的）
  let query = supabaseAdmin
    .from('unit_catalog')
    .select(`
      unit_id,
      symbol,
      unit_type
    `)
    .eq('lang', lang);

  if (practicedUnitIds.size > 0) {
    // Skip the NOT IN filter when the user has no practiced units to avoid invalid "NOT IN ()" SQL
    query = query.not('unit_id', 'in', `(${Array.from(practicedUnitIds).join(',')})`);
  }

  const { data: allUnits, error: unitsError } = await query;

  if (unitsError) {
    throw new Error(`获取可用音节失败: ${unitsError.message}`);
  }

  if (!allUnits || allUnits.length === 0) {
    return [];
  }

  // 3. 获取音节分类信息（根据语言）
  let categoryQuery;
  if (lang === 'zh-CN') {
    categoryQuery = supabaseAdmin
      .from('zh_pinyin_units')
      .select('symbol, shengmu, yunmu, tone');
  } else if (lang === 'en-US') {
    categoryQuery = supabaseAdmin
      .from('en_phoneme_units')
      .select('symbol, category, subcategory');
  } else if (lang === 'ja-JP') {
    categoryQuery = supabaseAdmin
      .from('ja_phoneme_units')
      .select('symbol, category, subcategory');
  } else {
    throw new Error(`不支持的语言: ${lang}`);
  }

  const { data: categoryData, error: categoryError } = await categoryQuery;

  if (categoryError) {
    throw new Error(`获取音节分类失败: ${categoryError.message}`);
  }

  // 4. 创建分类映射
  const categoryMap = new Map<string, { category: string; subcategory?: string }>();
  (categoryData || []).forEach((item: any) => {
    if (lang === 'zh-CN') {
      // 中文：使用声母作为主要分类
      const category = item.shengmu || '韵母';
      const subcategory = item.yunmu || '声调';
      categoryMap.set(item.symbol, { category, subcategory });
    } else {
      // 英文和日语：使用现有分类
      categoryMap.set(item.symbol, {
        category: item.category,
        subcategory: item.subcategory,
      });
    }
  });

  // 5. 获取每个音节的句子推荐
  const result: UncoveredUnit[] = [];
  
  for (const unit of allUnits.slice(0, limit)) {
    // 获取包含该音节的句子
    const { data: sentences, error: sentencesError } = await supabaseAdmin
      .from('sentence_units')
      .select(`
        sentence_id,
        count,
        pron_sentences!inner(sentence_id, text, level)
      `)
      .eq('unit_id', unit.unit_id)
      .order('count', { ascending: false })
      .limit(5);

    if (sentencesError) {
      console.error(`获取句子推荐失败 (unit_id: ${unit.unit_id}):`, sentencesError);
      continue;
    }

    const recommendedSentences = (sentences || []).map((s: any) => ({
      sentence_id: s.sentence_id,
      text: s.pron_sentences.text,
      level: s.pron_sentences.level,
    }));

    // 计算频率（基于句子数量）
    const frequency = (sentences || []).reduce((sum: number, s: any) => sum + s.count, 0);

    const categoryInfo = categoryMap.get(unit.symbol) || { category: 'unknown' };

    result.push({
      unit_id: unit.unit_id,
      symbol: unit.symbol,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      frequency,
      recommended_sentences: recommendedSentences,
    });
  }

  // 6. 按频率排序（高频音节优先）
  return result.sort((a, b) => b.frequency - a.frequency);
}

