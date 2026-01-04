import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import {
  validateMarkedSentence,
  parseUnits,
  splitSentences,
  buildS1Prompt,
  buildS2Prompt,
  isTextTooLong,
  type AcuResult,
  type AcuUnit
} from '@/lib/acu-utils';
import { supabase } from '@/lib/supabase';

interface RequestBody {
  id?: string;
  text: string;
  lang: 'zh' | 'en' | 'ja' | 'ko';
  provider: string;
  model: string;
  concurrency?: number;
  retries?: number;
  genre?: string;
}

interface S1S2Result {
  marked: string;
  success: boolean;
  error?: string;
}

/**
 * 执行 S1 阶段（过度细分）
 */
async function executeS1(
  sentence: string,
  lang: string,
  userId?: string
): Promise<S1S2Result> {
  // 处理对话格式，临时移除 A: 和 B: 标识符
  const isDialogue = /^[ABab][:：]\s/.test(sentence);
  let processedSentence = sentence;
  let dialoguePrefix = '';

  if (isDialogue) {
    const match = sentence.match(/^([ABab][:：])\s*(.*)$/);
    if (match) {
      dialoguePrefix = match[1] + ' ';
      processedSentence = match[2];
    }
  }

  const systemPrompt = `你是"学习最小单元"划分器。请在【原句】中插入星号*作为语义边界，且：
- 只能插入*；不得改动任何原字符（包括空格/标点/大小写）。
- * 只能插在两个原字符之间；不得出现在句首/句尾；不得出现连续**。
- 中文按"词"或"短语"划分，如"这个商品"、"价格是多少"、"98元"、"现在有活动"等。
- 标点符号可以单独成块，也可以与相邻词汇组合。
- 必须进行细分，不能整句不划分。
- 如果原句没有星号，说明你没有进行细分，这是错误的。
- 只输出插*后的句子，禁止任何解释。`;

  try {
    console.log(`S1 开始处理句子: "${sentence}"`);
    const { content } = await chatJSON({
      provider: 'deepseek',
      model: 'deepseek-chat',
      temperature: 0.3,
      response_json: false,
      timeoutMs: 30000,
      userId: undefined, // 管理员调用，不传 userId 绕过权限检查
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildS1Prompt(lang, processedSentence) }
      ]
    });

    let marked = content.trim();

    // 清理 LLM 返回结果中的多余引号（更彻底的清理）
    while ((marked.startsWith('"') && marked.endsWith('"')) ||
      (marked.startsWith("'") && marked.endsWith("'"))) {
      if (marked.startsWith('"') && marked.endsWith('"')) {
        marked = marked.slice(1, -1);
      }
      if (marked.startsWith("'") && marked.endsWith("'")) {
        marked = marked.slice(1, -1);
      }
    }

    // 如果是对话格式，恢复对话标识符，但确保标识符不会被分块
    if (isDialogue && dialoguePrefix) {
      // 在对话标识符后添加星号，确保标识符与内容连接
      marked = dialoguePrefix + '*' + marked;
    }

    console.log(`S1 返回结果: "${marked}"`);

    // 直接返回 S1 结果，不进行校验
    console.log(`S1 直接返回结果`);
    return { marked, success: true };
  } catch (error) {
    console.error(`S1 调用异常:`, error);
    return {
      marked: '',
      success: false,
      error: `S1 调用失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 执行 S2 阶段（最小化合并）
 */
async function executeS2(
  markedSentence: string,
  userId?: string
): Promise<S1S2Result> {
  const systemPrompt = `你是"最小可理解块"裁判。输入为句子的"过度细分版"（已插*）。
任务：仅当"保留当前切分会损伤理解"（即再拆会导致片段无法独立解释/破坏固定搭配/名词化/短语动词等）时，才合并相邻片段；否则保持细分。
要求：
- 只能去掉某些*（进行合并）；不得改动任何原字符（含空格/标点/大小写），不得增加新*。
- 输出仍是插*后的句子（最小可理解块级别）。
- 绝不输出说明文字。
判断依据（示例）：
- 固定搭配/短语动词/惯用语：look up, take off, ～という、〜하기, 〜している 等 → 合为一块。
- 名词化结构：中文"V+结果/程度/抽象名词"、日语连体+名、韩语[连体形+것/수(+格助词)] → 合为一块。
- 名词+格助词（韩/日）、功能词链（て/で/は/が/を/に 等）通常应与核心词保持最小可理解边界，若拆后无法独立说明则合并。
- URL/邮箱/代码/公式/数字+单位保持整体。`;

  try {
    const { content } = await chatJSON({
      provider: 'deepseek',
      model: 'deepseek-chat',
      temperature: 0.3,
      response_json: false,
      timeoutMs: 30000,
      userId: undefined, // 管理员调用，不传 userId 绕过权限检查
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildS2Prompt(markedSentence) }
      ]
    });

    let marked = content.trim();

    // 清理 LLM 返回结果中的多余引号
    if (marked.startsWith('"') && marked.endsWith('"')) {
      marked = marked.slice(1, -1);
    }
    if (marked.startsWith("'") && marked.endsWith("'")) {
      marked = marked.slice(1, -1);
    }

    // 校验结果
    if (validateMarkedSentence(markedSentence.replace(/\*/g, ''), marked)) {
      return { marked, success: true };
    } else {
      return { marked, success: false, error: 'S2 校验失败' };
    }
  } catch (error) {
    return {
      marked: '',
      success: false,
      error: `S2 调用失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理单个句子的 S1 流程，包含重试逻辑（已删除 S2 阶段）
 */
async function processSentence(
  sentence: string,
  lang: string,
  userId?: string
): Promise<string> {
  // S1 阶段（带重试）
  let s1Result = await executeS1(sentence, lang, userId);
  if (!s1Result.success) {
    // 重试一次
    s1Result = await executeS1(sentence, lang, userId);
    if (!s1Result.success) {
      console.warn(`S1 失败，使用整句: ${sentence}`);
      return sentence; // 回退到整句
    }
  }

  // 直接返回 S1 结果，不再进行 S2 最小化合并
  console.log(`S1 成功，直接使用结果: ${s1Result.marked}`);
  return s1Result.marked;
}

export async function POST(req: NextRequest) {
  try {
    // 权限验证
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body: RequestBody = await req.json();
    const { id, text, lang, provider, model, concurrency = 8, retries = 2, genre } = body;

    console.log('API 接收到的参数:', { text, lang, provider, model });

    // 验证必需参数
    if (!text || !lang || !provider || !model) {
      console.log('缺少参数:', { text: !!text, lang: !!lang, provider: !!provider, model: !!model });
      return NextResponse.json({ error: '缺少必需参数' }, { status: 400 });
    }

    // 检查文本长度
    if (isTextTooLong(text)) {
      return NextResponse.json({
        error: `文本过长（${text.length} 字符），请分批处理或缩短文本`
      }, { status: 400 });
    }

    // 检查文本是否为空
    if (!text.trim()) {
      return NextResponse.json({ error: '文本内容不能为空' }, { status: 400 });
    }

    // 验证语言支持
    if (!['zh', 'en', 'ja', 'ko'].includes(lang)) {
      return NextResponse.json({ error: '不支持的语言' }, { status: 400 });
    }

    // 验证提供商
    if (provider !== 'deepseek' || model !== 'deepseek-chat') {
      return NextResponse.json({ error: '仅支持 DeepSeek 提供商' }, { status: 400 });
    }

    console.log(`开始处理 ACU 生成: lang=${lang}, textLength=${text.length}`);

    // 句子切分
    const sentences = splitSentences(text, lang, genre);
    console.log(`切分得到 ${sentences.length} 个句子`);

    if (sentences.length === 0) {
      return NextResponse.json({ error: '无法切分句子' }, { status: 400 });
    }

    // 处理每个句子（支持并发处理）
    const processedSentences: string[] = new Array(sentences.length);
    let successCount = 0;
    let failCount = 0;

    // 使用并发池处理句子
    const processSentenceWithRetry = async (sentenceInfo: any, index: number) => {
      try {
        const processed = await processSentence(sentenceInfo.text, lang, auth.user?.id);
        processedSentences[index] = processed;
        successCount++;
        return { success: true, index };
      } catch (error) {
        console.error(`句子 ${sentenceInfo.sid} 处理失败:`, error);
        // 使用原句作为回退
        processedSentences[index] = sentenceInfo.text;
        failCount++;
        return { success: false, index };
      }
    };

    // 并发处理句子，使用传入的concurrency参数
    const concurrencyLimit = Math.min(concurrency || 8, sentences.length);
    const batches = [];
    for (let i = 0; i < sentences.length; i += concurrencyLimit) {
      const batch = sentences.slice(i, i + concurrencyLimit);
      batches.push(batch);
    }

    for (const batch of batches) {
      const promises = batch.map((sentenceInfo, batchIndex) => {
        const globalIndex = sentences.indexOf(sentenceInfo);
        return processSentenceWithRetry(sentenceInfo, globalIndex);
      });

      await Promise.all(promises);

      // 批次间延迟，避免API限制
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`ACU 处理完成: 成功 ${successCount}/${sentences.length} 句`);
    if (failCount > 0) {
      console.warn(`有 ${failCount} 个句子处理失败，使用原句作为回退`);
    }

    // 合并所有句子的结果
    const acu_marked = processedSentences.join(' ');

    // 生成 ACU units
    const allUnits: AcuUnit[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const sentenceInfo = sentences[i];
      const processed = processedSentences[i];
      const units = parseUnits(processed, sentenceInfo.sentenceAbsStart, sentenceInfo.sid);
      allUnits.push(...units);
    }

    const result: AcuResult = {
      acu_marked,
      units: allUnits,
      sentenceCount: sentences.length
    };

    // 如果传入了 id，更新数据库（同时生成 lex_profile）
    if (id) {
      try {
        // 先获取现有的 notes 数据，避免覆盖
        const { data: existingDraft, error: fetchError } = await auth.supabase
          .from('shadowing_drafts')
          .select('notes')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('获取现有数据失败:', fetchError);
          return NextResponse.json({ error: '获取现有数据失败' }, { status: 500 });
        }

        // 生成 lex_profile（使用与 lex-profile-test 相同的配置）
        let lexProfileData: any = null;
        try {
          console.log(`开始生成 Lex Profile: lang=${lang}`);

          // 动态导入分析函数
          const { analyzeLexProfileAsync } = await import('@/lib/recommendation/lexProfileAnalyzer');

          // 使用 Kuromoji 分词器和 Combined 词典（位置参数）
          // analyzeLexProfileAsync(text, lang, jaTokenizer, jaVocabDict, jaGrammarDict)
          const analysisResult = await analyzeLexProfileAsync(
            text,
            lang as 'ja' | 'zh' | 'en',
            'kuromoji',   // jaTokenizer
            'combined',   // jaVocabDict (Combined Strong = 8,805词)
            'combined'    // jaGrammarDict (Combined Strong = 3,273模式)
          );

          // 提取词汇分布和频度信息
          lexProfileData = {
            A1_A2: analysisResult.lexProfile.A1_A2,
            B1_B2: analysisResult.lexProfile.B1_B2,
            C1_plus: analysisResult.lexProfile.C1_plus,
            unknown: analysisResult.lexProfile.unknown,
            contentWordCount: analysisResult.contentWordCount,
            totalTokens: analysisResult.tokens,
            // 保存详细的词汇分布（用于更精确的计算）
            tokenDetails: analysisResult.details?.tokenList?.slice(0, 100).map(t => ({
              token: t.token,
              level: t.originalLevel || t.broadCEFR || 'unknown',
              frequencyRank: t.frequencyRank,
              isContentWord: t.isContentWord,
            })),
          };

          console.log(`Lex Profile 生成成功:`, {
            A1_A2: lexProfileData.A1_A2,
            B1_B2: lexProfileData.B1_B2,
            C1_plus: lexProfileData.C1_plus,
            unknown: lexProfileData.unknown,
            contentWordCount: lexProfileData.contentWordCount,
          });
        } catch (lexError) {
          console.error('Lex Profile 生成失败:', lexError);
          // 继续保存 ACU，不影响主流程
        }

        // 保留现有的 notes 数据，更新 ACU 和 lex_profile 字段
        const existingNotes = existingDraft?.notes || {};
        const updateData: any = {
          notes: {
            ...existingNotes,
            acu_marked: result.acu_marked,
            acu_units: result.units
          }
        };

        // 如果 lex_profile 生成成功，保存到 notes.lex_profile
        if (lexProfileData) {
          updateData.notes.lex_profile = lexProfileData;
          // 注意：shadowing_drafts 表没有独立的 lex_profile 字段，只存在 notes 里
        }

        const { error } = await auth.supabase
          .from('shadowing_drafts')
          .update(updateData)
          .eq('id', id);

        if (error) {
          console.error('更新数据库失败:', error);
          return NextResponse.json({ error: '保存失败' }, { status: 500 });
        }
      } catch (error) {
        console.error('数据库操作失败:', error);
        return NextResponse.json({ error: '保存失败' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      acu_marked: result.acu_marked,
      units: result.units,
      sentenceCount: result.sentenceCount,
      provider,
      model
    });

  } catch (error) {
    console.error('ACU 生成失败:', error);
    return NextResponse.json({
      error: `处理失败: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
}
