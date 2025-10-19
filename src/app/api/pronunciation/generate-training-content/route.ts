// =====================================================
// 生成训练内容
// POST /api/pronunciation/generate-training-content
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { chatJSON } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TrainingContentData {
  articulation_points: string;
  common_errors: string;
  tips: string;
  ipa_symbol: string;
  practice_words: string[];
  practice_phrases: string[];
  difficulty: number;
}

/**
 * POST /api/pronunciation/generate-training-content
 * 为指定音素生成训练内容
 * 
 * 请求体:
 * {
 *   unit_ids?: number[],  // 指定音素ID，为空则生成所有音素
 *   lang?: string,        // 语言 zh-CN 或 en-US，默认 zh-CN
 *   batch_size?: number   // 批处理大小，默认10
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

    // 2. 解析参数
    const body = await req.json();
    const targetUnitIds = body.unit_ids || [];
    const lang = body.lang || 'zh-CN';
    const batchSize = body.batch_size || 10;

    // 验证语言参数
    if (!['zh-CN', 'en-US'].includes(lang)) {
      return NextResponse.json(
        { success: false, error: '不支持的语言，仅支持 zh-CN 和 en-US' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();

    // 3. 获取需要处理的音素
    let unitIds: number[];

    if (targetUnitIds.length > 0) {
      // 验证指定的音素ID是否存在且为指定语言
      const { data: units, error: fetchError } = await supabaseAdmin
        .from('unit_catalog')
        .select('unit_id')
        .in('unit_id', targetUnitIds)
        .eq('lang', lang);

      if (fetchError) {
        throw new Error(`获取音素失败: ${fetchError.message}`);
      }

      unitIds = units?.map(u => u.unit_id) || [];
      
      if (unitIds.length !== targetUnitIds.length) {
        return NextResponse.json(
          { success: false, error: '部分音素ID不存在或不是指定语言的音素' },
          { status: 400 }
        );
      }
    } else {
      // 获取所有指定语言的音素
      const { data: units, error: fetchError } = await supabaseAdmin
        .from('unit_catalog')
        .select('unit_id')
        .eq('lang', lang)
        .order('unit_id', { ascending: true });

      if (fetchError) {
        throw new Error(`获取音素失败: ${fetchError.message}`);
      }

      unitIds = units?.map(u => u.unit_id) || [];
    }

    if (unitIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要处理的音素',
        stats: {
          total_units: 0,
          processed: 0,
          success: 0,
          failed: 0,
          errors: []
        }
      });
    }

    // 4. 分批处理
    const results = {
      total_units: unitIds.length,
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < unitIds.length; i += batchSize) {
      const batch = unitIds.slice(i, i + batchSize);
      console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(unitIds.length / batchSize)}: ${batch.length} 个音素`);

      for (const unitId of batch) {
        try {
          // 检查是否已存在训练内容
          const { data: existing } = await supabaseAdmin
            .from('training_content')
            .select('content_id')
            .eq('unit_id', unitId)
            .maybeSingle();

          if (existing) {
            console.log(`音素 ${unitId} 已有训练内容，跳过`);
            results.processed++;
            results.success++;
            continue;
          }

          // 获取音素信息
          const { data: unitInfo, error: unitError } = await supabaseAdmin
            .from('unit_catalog')
            .select('symbol, lang')
            .eq('unit_id', unitId)
            .single();

          if (unitError || !unitInfo) {
            throw new Error(`找不到音素信息: ${unitId}`);
          }

          // 生成训练内容
          const trainingContent = await generateTrainingContentForUnit(
            unitInfo.symbol,
            lang,
            user.id
          );

          // 插入数据库
          const { error: insertError } = await supabaseAdmin
            .from('training_content')
            .insert({
              unit_id: unitId,
              lang: lang,
              articulation_points: trainingContent.articulation_points,
              common_errors: trainingContent.common_errors,
              tips: trainingContent.tips,
              ipa_symbol: trainingContent.ipa_symbol,
              practice_words: trainingContent.practice_words,
              practice_phrases: trainingContent.practice_phrases,
              difficulty: trainingContent.difficulty,
            });

          if (insertError) {
            throw new Error(`插入训练内容失败: ${insertError.message}`);
          }

          console.log(`✅ 音素 ${unitInfo.symbol} 训练内容生成成功`);
          results.processed++;
          results.success++;

        } catch (error) {
          console.error(`❌ 音素 ${unitId} 处理失败:`, error);
          results.processed++;
          results.failed++;
          results.errors.push(`音素 ${unitId}: ${error instanceof Error ? error.message : '未知错误'}`);
        }

        // 添加小延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      message: `训练内容生成完成！成功: ${results.success}, 失败: ${results.failed}`,
      stats: results
    });

  } catch (error) {
    console.error('[pronunciation/generate-training-content] 错误:', error);
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
 * 为单个音素生成训练内容
 */
async function generateTrainingContentForUnit(
  symbol: string,
  lang: string,
  userId: string
): Promise<TrainingContentData> {
  let systemPrompt: string;
  let userPrompt: string;

  if (lang === 'zh-CN') {
    systemPrompt = `你是一个中文发音训练专家。你需要为中文拼音音节生成详细的训练内容。

要求：
1. 提供准确的发音要领和口型指导
2. 列出常见的发音错误和纠正方法
3. 提供实用的练习技巧
4. 给出5个练习词汇和3个练习短语
5. 内容要专业、准确、易懂

返回 JSON 格式：
{
  "articulation_points": "发音要领描述",
  "common_errors": "常见错误和纠正方法",
  "tips": "练习技巧和建议",
  "ipa_symbol": "IPA符号",
  "practice_words": ["练习词1", "练习词2", "练习词3", "练习词4", "练习词5"],
  "practice_phrases": ["练习短语1", "练习短语2", "练习短语3"],
  "difficulty": 难度等级(1-5)
}`;

    userPrompt = `请为拼音音节 "${symbol}" 生成训练内容。

音节信息：
- 拼音：${symbol}
- 语言：中文

请提供：
1. 详细的发音要领（口型、舌位、气流等）
2. 常见发音错误及纠正方法
3. 实用的练习技巧
4. 5个包含该音节的常用词汇
5. 3个包含该音节的实用短语
6. 难度评估（1-5级）

确保内容准确、专业、适合学习者使用。`;
  } else {
    systemPrompt = `You are an English pronunciation training expert. You need to generate detailed training content for English phonemes.

Requirements:
1. Provide accurate articulation guidance and mouth shape instructions
2. List common pronunciation errors and correction methods
3. Provide practical practice tips
4. Give 5 practice words and 3 practice phrases
5. Content should be professional, accurate, and easy to understand

Return JSON format:
{
  "articulation_points": "Articulation guidance description",
  "common_errors": "Common errors and correction methods",
  "tips": "Practice tips and suggestions",
  "ipa_symbol": "IPA symbol",
  "practice_words": ["practice_word1", "practice_word2", "practice_word3", "practice_word4", "practice_word5"],
  "practice_phrases": ["practice_phrase1", "practice_phrase2", "practice_phrase3"],
  "difficulty": difficulty_level(1-5)
}`;

    userPrompt = `Please generate training content for English phoneme "${symbol}".

Phoneme information:
- Symbol: ${symbol}
- Language: English

Please provide:
1. Detailed articulation guidance (mouth shape, tongue position, airflow, etc.)
2. Common pronunciation errors and correction methods
3. Practical practice tips
4. 5 common words containing this phoneme
5. 3 practical phrases containing this phoneme
6. Difficulty assessment (1-5 levels)

Ensure the content is accurate, professional, and suitable for learners.`;
  }

  const result = await chatJSON({
    provider: 'deepseek',
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    response_json: true,
    timeoutMs: 30000,
    userId: userId,
  });

  const responseData = JSON.parse(result.content);
  
  return {
    articulation_points: responseData.articulation_points || '',
    common_errors: responseData.common_errors || '',
    tips: responseData.tips || '',
    ipa_symbol: responseData.ipa_symbol || symbol,
    practice_words: responseData.practice_words || [],
    practice_phrases: responseData.practice_phrases || [],
    difficulty: responseData.difficulty || 3,
  };
}
