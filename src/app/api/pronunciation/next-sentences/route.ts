// =====================================================
// 下一组句子推荐 API
// 贪心 Set Cover 策略：优先覆盖样本数少的 Unit
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import type { NextSentencesResponse } from '@/types/pronunciation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pronunciation/next-sentences?lang=zh-CN&k=5
 * 推荐下一组句子
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
    const k = Number(searchParams.get('k') ?? '5');

    // 3. 构建音节权重映射（平衡增长算法）
    const supabaseAdmin = getServiceSupabase();
    
    // 3.1 获取所有可能的音节
    const { data: allUnits, error: unitsError } = await supabaseAdmin
      .from('unit_catalog')
      .select('unit_id')
      .eq('lang', lang);

    if (unitsError) {
      throw new Error(`获取音节目录失败: ${unitsError.message}`);
    }

    // 3.2 初始化权重映射（所有音节默认权重 1.0，表示未练习）
    const weightMap = new Map<number, number>();
    for (const unit of allUnits || []) {
      weightMap.set(unit.unit_id, 1.0);
    }

    // 3.3 获取用户的音节统计（所有已练习的音节，不限 n < 3）
    const { data: userStats, error: statsError } = await supabaseAdmin
      .from('user_unit_stats')
      .select('unit_id, n')
      .eq('user_id', user.id)
      .eq('lang', lang);

    if (statsError) {
      throw new Error(`获取用户统计失败: ${statsError.message}`);
    }

    // 3.4 更新已练习音节的权重：weight = 1 / (n + 1)
    // 样本数越少，权重越高；样本数越多，权重越低（但不会为0）
    for (const stat of userStats || []) {
      const n = stat.n ?? 0;
      const weight = 1.0 / (n + 1);
      weightMap.set(stat.unit_id, weight);
    }

    // 4. 获取用户已练习过的句子ID（用于排除）
    const { data: practicedSentences, error: practiceError } = await supabaseAdmin
      .from('user_sentence_progress')
      .select('sentence_id')
      .eq('user_id', user.id);

    if (practiceError) {
      throw new Error(`获取练习记录失败: ${practiceError.message}`);
    }

    const practicedIds = new Set((practicedSentences || []).map(p => p.sentence_id));

    // 5. 获取候选句子（排除已练习的）
    const { data: allSentences, error: sentencesError } = await supabaseAdmin
      .from('pron_sentences')
      .select('sentence_id, text, level')
      .eq('lang', lang)
      .limit(500); // 查询更多，因为要过滤

    if (sentencesError) {
      throw new Error(`获取句子失败: ${sentencesError.message}`);
    }

    if (!allSentences || allSentences.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
      });
    }

    // 过滤掉已练习的句子
    const sentences = allSentences.filter(s => !practicedIds.has(s.sentence_id));

    if (sentences.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        message: '所有句子都已练习过了！',
      });
    }

    // 6. 获取句子与 Unit 的关联
    const sentenceIds = sentences.map((s) => s.sentence_id);
    const { data: sentenceUnits, error: sentenceUnitsError } = await supabaseAdmin
      .from('sentence_units')
      .select('sentence_id, unit_id, count')
      .in('sentence_id', sentenceIds);

    if (sentenceUnitsError) {
      throw new Error(`获取句子Unit关联失败: ${sentenceUnitsError.message}`);
    }

    // 如果 sentence_units 是空的（刚开始使用），直接返回随机句子
    if (!sentenceUnits || sentenceUnits.length === 0) {
      const randomSentences = sentences
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(k, sentences.length))
        .map(({ sentence_id, text }) => ({
          sentence_id,
          text,
          gain: 0,
        }));

      return NextResponse.json({
        success: true,
        items: randomSentences,
      });
    }

    // 7. 构建映射：sentence_id → Unit数组
    const sentenceUnitsMap = new Map<number, Array<{ unit_id: number; count: number }>>();
    for (const su of sentenceUnits || []) {
      const arr = sentenceUnitsMap.get(su.sentence_id) || [];
      arr.push({ unit_id: su.unit_id, count: su.count });
      sentenceUnitsMap.set(su.sentence_id, arr);
    }

    // 8. 计算每个句子的增益（使用权重机制，实现平衡增长）
    const scored = sentences.map((sentence) => {
      let gain = 0;
      const units = sentenceUnitsMap.get(sentence.sentence_id) || [];
      
      for (const unit of units) {
        // 获取该音节的权重（未练习的音节权重为 1.0，练习越多权重越低）
        const weight = weightMap.get(unit.unit_id) ?? 1.0;
        // 增益 = 权重 × 该音节在句子中的出现次数
        gain += weight * unit.count;
      }

      return {
        sentence_id: sentence.sentence_id,
        text: sentence.text,
        level: sentence.level,
        gain,
      };
    });

    // 9. 排序：增益高的优先，增益相同时难度低的优先
    scored.sort((a, b) => {
      if (b.gain !== a.gain) return b.gain - a.gain;
      return a.level - b.level;
    });

    // 10. 选择前 k 个（优先选择 gain > 0 的）
    const highGain = scored.filter((x) => x.gain > 0);
    const picked = highGain.slice(0, k);
    
    // 11. 如果不足 k 个，补充 gain = 0 的句子（未练习的）
    const fallbackCount = Math.max(0, k - picked.length);
    if (fallbackCount > 0) {
      const zeroGain = scored.filter((x) => x.gain === 0);
      if (zeroGain.length > 0) {
        const fallback = zeroGain
          .sort(() => Math.random() - 0.5)
          .slice(0, fallbackCount);
        picked.push(...fallback);
      }
    }

    // 12. 返回结果（附带调试信息）
    const response: NextSentencesResponse = {
      items: picked.map(({ sentence_id, text, gain }) => ({
        sentence_id,
        text,
        gain,
      })),
    };

    // 添加调试信息（包含权重统计）
    const weightStats = Array.from(weightMap.values());
    const avgWeight = weightStats.reduce((a, b) => a + b, 0) / weightStats.length;
    const highWeightUnits = weightStats.filter(w => w > 0.5).length;
    
    console.log(`[next-sentences] 用户 ${user.id}:`, {
      总候选句子: allSentences?.length || 0,
      未练习句子: sentences.length,
      已练习句子: practicedIds.size,
      已练习音节数: userStats?.length || 0,
      总音节数: allUnits?.length || 0,
      平均权重: avgWeight.toFixed(3),
      高权重音节数: highWeightUnits,
      高增益句子数: highGain.length,
      最终返回: picked.length,
    });

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error('[pronunciation/next-sentences] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}


