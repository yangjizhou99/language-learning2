// =====================================================
// 管理页面生成训练内容 API
// POST /api/admin/pronunciation/generate-training-content
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { chatJSON } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/pronunciation/generate-training-content
 * 生成训练内容
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
    const lang = body.lang || 'zh-CN';
    const batchSize = body.batch_size || 10;
    
    // 验证语言参数
    if (!['zh-CN', 'en-US', 'ja-JP'].includes(lang)) {
      return NextResponse.json(
        { success: false, error: '不支持的语言，仅支持 zh-CN、en-US 和 ja-JP' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();
    
    // 3. 获取需要生成训练内容的音素
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('unit_catalog')
      .select('unit_id, symbol, lang')
      .eq('lang', lang)
      .order('unit_id', { ascending: true });

    if (unitsError) {
      throw new Error(`获取音素失败: ${unitsError.message}`);
    }

    if (!units || units.length === 0) {
      return NextResponse.json({
        success: true,
        message: `没有需要处理的${lang}音素`,
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
      total_units: units.length,
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < units.length; i += batchSize) {
      const batch = units.slice(i, i + batchSize);
      
      try {
        const batchResult = await processBatch(supabaseAdmin, batch, lang);
        results.processed += batch.length;
        results.success += batchResult.success;
        results.failed += batchResult.failed;
        results.errors.push(...batchResult.errors);
        
        // 批次间延迟
        if (i + batchSize < units.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`批次处理失败:`, error);
        results.processed += batch.length;
        results.failed += batch.length;
        results.errors.push(`批次 ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    return NextResponse.json({
      success: true,
      stats: results,
      message: `训练内容生成完成！处理 ${results.processed} 个音素，成功 ${results.success} 个，失败 ${results.failed} 个`,
    });
  } catch (error) {
    console.error('[admin/pronunciation/generate-training-content] 错误:', error);
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
 * 处理单个批次
 */
async function processBatch(supabaseAdmin: any, units: any[], lang: string) {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const unit of units) {
    try {
      // 检查是否已有训练内容
      const { data: existing } = await supabaseAdmin
        .from('training_content')
        .select('content_id')
        .eq('unit_id', unit.unit_id)
        .single();

      if (existing) {
        result.success++;
        continue;
      }

      // 生成训练内容
      const trainingContent = await generateTrainingContent(unit, lang);
      
      if (trainingContent) {
        await supabaseAdmin
          .from('training_content')
          .insert({
            unit_id: unit.unit_id,
            content_type: 'pronunciation_guide',
            title: trainingContent.title,
            content: trainingContent.content,
            difficulty_level: trainingContent.difficulty_level,
            practice_words: trainingContent.practice_words,
            practice_phrases: trainingContent.practice_phrases,
            common_errors: trainingContent.common_errors,
            tips: trainingContent.tips,
            lang: lang,
          });
        
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`音素 ${unit.symbol}: 生成训练内容失败`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`音素 ${unit.symbol}: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  return result;
}

/**
 * 生成单个音素的训练内容
 */
async function generateTrainingContent(unit: any, lang: string) {
  let systemPrompt: string;
  let userPrompt: string;

  if (lang === 'zh-CN') {
    systemPrompt = `你是一个中文发音训练专家。你需要为拼音音节生成详细的发音训练指导内容。

要求：
1. 提供准确的发音要领（口型、舌位、气流）
2. 列出常见错误和纠正方法
3. 提供实用的练习技巧
4. 包含5个包含该音节的练习词汇
5. 包含3个实用短语
6. 评估难度等级（1-5级）

返回 JSON 格式：
{
  "title": "音节训练指导",
  "content": "详细的发音要领...",
  "difficulty_level": 3,
  "practice_words": ["词汇1", "词汇2", "词汇3", "词汇4", "词汇5"],
  "practice_phrases": ["短语1", "短语2", "短语3"],
  "common_errors": ["错误1", "错误2"],
  "tips": ["技巧1", "技巧2"]
}`;

    userPrompt = `请为拼音音节 "${unit.symbol}" 生成详细的发音训练指导内容。

重点关注：
- 发音要领和技巧
- 常见错误和纠正方法
- 实用的练习建议
- 包含该音节的练习词汇和短语

请确保内容准确、实用、易懂。`;
  } else if (lang === 'en-US') {
    systemPrompt = `You are an English pronunciation training expert. You need to generate detailed pronunciation training content for English phonemes.

Requirements:
1. Provide accurate pronunciation guidance (mouth shape, tongue position, airflow)
2. List common errors and correction methods
3. Provide practical practice tips
4. Include 5 practice words containing this phoneme
5. Include 3 practical phrases
6. Assess difficulty level (1-5)

Return JSON format:
{
  "title": "Phoneme Training Guide",
  "content": "Detailed pronunciation guidance...",
  "difficulty_level": 3,
  "practice_words": ["word1", "word2", "word3", "word4", "word5"],
  "practice_phrases": ["phrase1", "phrase2", "phrase3"],
  "common_errors": ["error1", "error2"],
  "tips": ["tip1", "tip2"]
}`;

    userPrompt = `Please generate detailed pronunciation training content for English phoneme "${unit.symbol}".

Focus on:
- Pronunciation guidance and techniques
- Common errors and correction methods
- Practical practice suggestions
- Practice words and phrases containing this phoneme

Please ensure the content is accurate, practical, and easy to understand.`;
  } else {
    // 日语提示词
    systemPrompt = `あなたは日本語発音訓練の専門家です。日本語音素の詳細な発音訓練指導内容を生成する必要があります。

要件：
1. 正確な発音指導（口型、舌位、気流）
2. 一般的な間違いと修正方法
3. 実用的な練習のコツ
4. その音素を含む5つの練習単語
5. 3つの実用的なフレーズ
6. 難易度レベル（1-5級）

JSON形式で返す：
{
  "title": "音素訓練指導",
  "content": "詳細な発音指導...",
  "difficulty_level": 3,
  "practice_words": ["単語1", "単語2", "単語3", "単語4", "単語5"],
  "practice_phrases": ["フレーズ1", "フレーズ2", "フレーズ3"],
  "common_errors": ["間違い1", "間違い2"],
  "tips": ["コツ1", "コツ2"]
}`;

    userPrompt = `日本語音素 "${unit.symbol}" の詳細な発音訓練指導内容を生成してください。

重点：
- 発音指導とテクニック
- 一般的な間違いと修正方法
- 実用的な練習提案
- その音素を含む練習単語とフレーズ

内容が正確で実用的で理解しやすいことを確認してください。`;
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
    userId: 'admin',
  });

  try {
    return JSON.parse(result.content);
  } catch (error) {
    console.error('解析训练内容失败:', error);
    return null;
  }
}
