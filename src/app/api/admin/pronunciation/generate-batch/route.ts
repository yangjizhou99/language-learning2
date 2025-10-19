// =====================================================
// 管理页面批量句子生成 API
// POST /api/admin/pronunciation/generate-batch
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { chatJSON } from '@/lib/ai/client';

type SuccessfulBatch = {
  generated_count: number;
  sentence_units_count: number;
  level: number;
};

type FailedBatch = {
  batch: number;
  success: false;
  error: string;
};

type BatchResult = SuccessfulBatch | FailedBatch;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/pronunciation/generate-batch
 * 批量迭代生成句子
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
    const totalCount = body.totalCount || body.total_count || 50;
    const batchSize = body.batchSize || body.batch_size || 10;
    const targetLevel = body.level || 2;
    const lang = body.lang || 'zh-CN';
    
    // 验证语言参数
    if (!['zh-CN', 'en-US', 'ja-JP'].includes(lang)) {
      return NextResponse.json(
        { success: false, error: '不支持的语言，仅支持 zh-CN、en-US 和 ja-JP' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();
    const batches = Math.ceil(totalCount / batchSize);
    let totalGenerated = 0;
    let totalUnits = 0;
    const batchResults: BatchResult[] = [];

    // 3. 分批生成
    for (let i = 0; i < batches; i++) {
      const currentBatchSize = Math.min(batchSize, totalCount - totalGenerated);
      
      try {
        // 生成当前批次的句子
        const batchResult = await generateBatchSentences(
          supabaseAdmin,
          user.id,
          currentBatchSize,
          targetLevel,
          lang
        );
        
        totalGenerated += batchResult.generated_count;
        totalUnits += batchResult.sentence_units_count;
        batchResults.push(batchResult);
        
        // 每批之间稍作延迟，避免API限制
        if (i < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`批次 ${i + 1} 生成失败:`, error);
        batchResults.push({
          batch: i + 1,
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    // 计算平均覆盖度
    const avgUnitsPerSentence = totalGenerated > 0 ? totalUnits / totalGenerated : 0;
    
    // 分离成功和失败的批次
    const successfulBatches = batchResults.filter(
      (b): b is SuccessfulBatch => !('success' in b)
    );
    const failedBatches = batchResults.filter(
      (b): b is FailedBatch => 'success' in b && b.success === false
    );
    
    return NextResponse.json({
      success: true,
      summary: {
        total_batches: batches,
        total_generated: totalGenerated,
        total_units: totalUnits,
        avg_units_per_sentence: avgUnitsPerSentence,
        level: targetLevel,
        lang: lang,
      },
      batches: successfulBatches.map((b, idx) => ({
        batch: idx + 1,
        generated: b.generated_count || 0,
        units: b.sentence_units_count || 0,
        target_units: [], // 暂时为空，后续可以添加
      })),
      errors: failedBatches.map(b => b.error || '未知错误'),
      message: `批量生成完成！共生成 ${totalGenerated} 个句子，创建 ${totalUnits} 条音节关联`,
    });
  } catch (error) {
    console.error('[admin/pronunciation/generate-batch] 错误:', error);
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
 * 生成单批句子
 */
async function generateBatchSentences(
  supabaseAdmin: any,
  userId: string,
  count: number,
  level: number,
  lang: string
): Promise<SuccessfulBatch> {
  // 根据语言生成不同的提示词
  let systemPrompt: string;
  let userPrompt: string;

  if (lang === 'zh-CN') {
    systemPrompt = `你是一个中文发音练习句子生成专家。你需要生成适合发音评测的中文句子。

要求：
1. 句子长度：8-15个字
2. 难度等级：${level}（1=最简单，5=最复杂）
3. 覆盖常用汉字和拼音音节
4. 句子要自然、通顺、有实际意义
5. 避免生僻字和专业术语
6. 优先包含容易混淆的音节（如翘舌/平舌、前后鼻音等）

返回 JSON 格式：
{
  "sentences": [
    { "text": "句子内容", "level": 难度等级(1-5) },
    ...
  ]
}`;

    userPrompt = `请生成 ${count} 个适合中文发音练习的句子。

重点覆盖以下发音难点：
- 翘舌音：zh, ch, sh
- 平舌音：z, c, s
- 前后鼻音：an/ang, en/eng, in/ing
- 鼻边音：n/l
- 声调变化：尤其是第二声和第三声

难度等级：${level}
生成数量：${count}

请确保句子多样化，覆盖不同的主题和场景。`;
  } else if (lang === 'en-US') {
    systemPrompt = `You are an English pronunciation practice sentence generator. You need to generate English sentences suitable for pronunciation assessment.

Requirements:
1. Sentence length: 8-15 words
2. Difficulty level: ${level} (1=easier, 5=harder)
3. Cover common English phonemes and pronunciation challenges
4. Sentences should be natural, fluent, and meaningful
5. Avoid rare words and technical terms
6. Prioritize challenging phonemes (th, r, l, vowel contrasts, etc.)

Return JSON format:
{
  "sentences": [
    { "text": "sentence content", "level": difficulty_level(1-5) },
    ...
  ]
}`;

    userPrompt = `Please generate ${count} English sentences suitable for pronunciation practice.

Focus on covering these pronunciation challenges:
- Th sounds: /θ/ (think) and /ð/ (this)
- R and L sounds: /r/ (red) and /l/ (leg)
- Vowel contrasts: /ɪ/ vs /i/, /æ/ vs /ɑ/
- Consonant clusters: /tʃ/ (chair), /dʒ/ (jump)
- Word stress and rhythm

Difficulty level: ${level}
Generation count: ${count}

Please ensure sentence diversity, covering different topics and scenarios.`;
  } else {
    // 日语提示词
    systemPrompt = `あなたは日本語発音練習文生成の専門家です。発音評価に適した日本語文を生成する必要があります。

要件：
1. 文の長さ：8-15文字
2. 難易度レベル：${level}（1=最も簡単、5=最も複雑）
3. 一般的なひらがな、カタカナ、漢字をカバー
4. 文は自然で流暢で意味のあるものであること
5. 稀な文字や専門用語は避ける
6. 発音の難点を優先（濁音、半濁音、拗音、促音、長音など）

JSON形式で返す：
{
  "sentences": [
    { "text": "文の内容", "level": 難易度レベル(1-5) },
    ...
  ]
}`;

    userPrompt = `発音練習に適した${count}個の日本語文を生成してください。

**重要：文には必ず漢字を含めてください。ひらがなだけの文は避けてください。**

以下の発音の難点を重点的にカバーしてください：
- 濁音：が、ざ、だ、ば行
- 半濁音：ぱ行
- 拗音：きゃ、しゃ、ちゃ行など
- 促音：っ（小つ）
- 長音：ー
- 撥音：ん

**漢字の例：**
- 学校、学生、勉強、友達、家族
- 食べる、飲む、行く、来る、見る
- 今日、明日、昨日、時間、場所
- 本、映画、音楽、スポーツ、料理

難易度レベル：${level}
生成数：${count}

文の多様性を確保し、異なるトピックと場面をカバーしてください。各文には漢字を必ず含めてください。`;
  }

  const result = await chatJSON({
    provider: 'deepseek',
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    response_json: true,
    timeoutMs: 45000,
    userId: userId,
  });

  // 解析结果
  const responseData = JSON.parse(result.content);
  const sentences = responseData.sentences || [];

  if (!Array.isArray(sentences) || sentences.length === 0) {
    throw new Error('生成的句子格式不正确');
  }

  // 插入数据库
  const insertData = sentences.map((s: any) => ({
    lang: lang,
    text: s.text,
    level: s.level || level,
    domain_tags: ['ai-generated'],
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('pron_sentences')
    .insert(insertData)
    .select('sentence_id, text, level');

  if (insertError) {
    throw new Error(`插入句子失败: ${insertError.message}`);
  }

  // 自动生成 sentence_units
  let generatedUnits = 0;
  
  try {
    if (lang === 'zh-CN') {
      // 中文：使用 pinyin 库
      const pinyinLib = (await import('pinyin')).default;
      const { data: units } = await supabaseAdmin
        .from('unit_catalog')
        .select('unit_id, symbol')
        .eq('lang', 'zh-CN');

      const unitIdMap = new Map<string, number>();
      for (const unit of units || []) {
        unitIdMap.set(unit.symbol, unit.unit_id);
      }

      for (const sentence of inserted || []) {
        const result = pinyinLib(sentence.text, {
          style: pinyinLib.STYLE_TONE2,
          heteronym: false,
          segment: true,
        });

        const pinyinMap = new Map<string, number>();
        result.forEach((item: any) => {
          if (item && item[0]) {
            const normalized = item[0].toLowerCase().replace(/^([a-z]+)([1-5])$/, '$1 $2');
            pinyinMap.set(normalized, (pinyinMap.get(normalized) || 0) + 1);
          }
        });

        const insertUnits = [];
        for (const [symbol, count] of pinyinMap.entries()) {
          const unitId = unitIdMap.get(symbol);
          if (unitId) {
            insertUnits.push({
              sentence_id: sentence.sentence_id,
              unit_id: unitId,
              count,
            });
          }
        }

        if (insertUnits.length > 0) {
          await supabaseAdmin
            .from('sentence_units')
            .upsert(insertUnits, { onConflict: 'sentence_id,unit_id' });
          generatedUnits += insertUnits.length;
        }
      }
    } else if (lang === 'en-US') {
      // 英语：暂时跳过，后续实现英语音素提取
      console.log('英语音素提取将在后续实现');
    } else if (lang === 'ja-JP') {
      // 日语：使用日语G2P工具
      const { japaneseToRomaji } = await import('@/lib/pronunciation/japanese-romaji-extractor');
      const { data: units } = await supabaseAdmin
        .from('unit_catalog')
        .select('unit_id, symbol')
        .eq('lang', 'ja-JP');

      const unitIdMap = new Map<string, number>();
      for (const unit of units || []) {
        unitIdMap.set(unit.symbol, unit.unit_id);
      }

      for (const sentence of inserted || []) {
        const romajiSyllables = japaneseToRomaji(sentence.text);

        const syllableMap = new Map<string, number>();
        romajiSyllables.forEach((syllable) => {
          syllableMap.set(syllable, (syllableMap.get(syllable) || 0) + 1);
        });

        const insertUnits = [];
        for (const [symbol, count] of syllableMap.entries()) {
          const unitId = unitIdMap.get(symbol);
          if (unitId) {
            insertUnits.push({
              sentence_id: sentence.sentence_id,
              unit_id: unitId,
              count,
            });
          }
        }

        if (insertUnits.length > 0) {
          await supabaseAdmin
            .from('sentence_units')
            .upsert(insertUnits, { onConflict: 'sentence_id,unit_id' });
          generatedUnits += insertUnits.length;
        }
      }
    }
  } catch (err) {
    console.error('生成 sentence_units 失败:', err);
    // 不影响主流程，继续
  }

  return {
    generated_count: inserted?.length || 0,
    sentence_units_count: generatedUnits,
    level: level,
  };
}
