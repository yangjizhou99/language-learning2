// =====================================================
// 生成 sentence_units 数据 API
// POST /api/pronunciation/generate-sentence-units
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 最多60秒

// 动态导入 pinyin（仅在服务端使用）
let pinyin: any = null;
async function getPinyin() {
  if (!pinyin) {
    pinyin = (await import('pinyin')).default;
  }
  return pinyin;
}

// 拼音转换为带空格格式
function normalizePinyin(py: string): string {
  const match = py.match(/^([a-z]+)([1-5])$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return py;
}

// 提取句子中的拼音音节
async function extractPinyinFromSentence(text: string) {
  const pinyinLib = await getPinyin();
  
  const result = pinyinLib(text, {
    style: pinyinLib.STYLE_TONE2,
    heteronym: false,
    segment: true,
  });

  const pinyinList = result
    .map((item: any) => {
      if (item && item[0]) {
        return normalizePinyin(item[0].toLowerCase());
      }
      return null;
    })
    .filter(Boolean);

  const countMap = new Map<string, number>();
  for (const py of pinyinList) {
    countMap.set(py, (countMap.get(py) || 0) + 1);
  }

  return countMap;
}

/**
 * POST /api/pronunciation/generate-sentence-units
 * 生成 sentence_units 数据（需要管理员权限或认证用户）
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

    const supabaseAdmin = getServiceSupabase();

    // 2. 清理旧数据（可选）
    const { searchParams } = new URL(req.url);
    const shouldClean = searchParams.get('clean') === 'true';

    if (shouldClean) {
      await supabaseAdmin
        .from('sentence_units')
        .delete()
        .neq('sentence_id', 0);
    }

    // 3. 获取所有句子
    const { data: sentences, error: sentencesError } = await supabaseAdmin
      .from('pron_sentences')
      .select('sentence_id, text, lang')
      .eq('lang', 'zh-CN')
      .order('sentence_id');

    if (sentencesError) {
      throw new Error(`获取句子失败: ${sentencesError.message}`);
    }

    // 4. 预加载所有音节
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('unit_catalog')
      .select('unit_id, symbol')
      .eq('lang', 'zh-CN');

    if (unitsError) {
      throw new Error(`获取音节失败: ${unitsError.message}`);
    }

    const unitIdMap = new Map<string, number>();
    for (const unit of units || []) {
      unitIdMap.set(unit.symbol, unit.unit_id);
    }

    // 5. 逐句处理
    let totalFound = 0;
    let totalNotFound = 0;
    let successCount = 0;
    const notFoundSymbols = new Set<string>();

    for (const sentence of sentences || []) {
      const pinyinMap = await extractPinyinFromSentence(sentence.text);

      const insertData = [];
      
      for (const [symbol, count] of pinyinMap.entries()) {
        const unitId = unitIdMap.get(symbol);
        
        if (unitId) {
          insertData.push({
            sentence_id: sentence.sentence_id,
            unit_id: unitId,
            count: count,
          });
          totalFound++;
        } else {
          notFoundSymbols.add(symbol);
          totalNotFound++;
        }
      }

      if (insertData.length > 0) {
        const { error } = await supabaseAdmin
          .from('sentence_units')
          .upsert(insertData, {
            onConflict: 'sentence_id,unit_id',
            ignoreDuplicates: false,
          });

        if (!error) {
          successCount++;
        }
      }
    }

    // 6. 统计结果
    const { count: finalCount } = await supabaseAdmin
      .from('sentence_units')
      .select('*', { count: 'exact', head: true });

    const avgPerSentence = finalCount && sentences.length > 0
      ? finalCount / sentences.length
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        total_sentences: sentences.length,
        success_count: successCount,
        total_found: totalFound,
        total_not_found: totalNotFound,
        final_count: finalCount,
        avg_per_sentence: Number(avgPerSentence.toFixed(1)),
        not_found_symbols: Array.from(notFoundSymbols).slice(0, 10), // 最多显示10个
      },
      message: `成功处理 ${successCount}/${sentences.length} 个句子，生成 ${finalCount} 条关联记录`,
    });
  } catch (error) {
    console.error('[pronunciation/generate-sentence-units] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

