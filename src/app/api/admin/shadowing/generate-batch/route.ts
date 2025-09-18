import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chatJSON } from '@/lib/ai/client';
import { requireAdmin } from '@/lib/admin';

export const maxDuration = 300; // 5分钟超时，符合Vercel Hobby计划限制

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // 添加管理员权限验证
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const {
      subtopic_ids,
      lang,
      level,
      genre,
      provider,
      model,
      temperature,
      concurrency = 10,
    } = await request.json();

    if (!subtopic_ids || !Array.isArray(subtopic_ids) || subtopic_ids.length === 0) {
      return NextResponse.json(
        { error: 'subtopic_ids is required and must be a non-empty array' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    // 获取小主题数据
    const { data: subtopics, error: subtopicsError } = await supabase
      .from('shadowing_subtopics')
      .select('*')
      .in('id', subtopic_ids);

    if (subtopicsError) {
      throw new Error(`Failed to fetch subtopics: ${subtopicsError.message}`);
    }

    if (!subtopics || subtopics.length === 0) {
      return NextResponse.json(
        { error: 'No subtopics found' },
        {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    const results = [];
    const errors = [];

    // 并发处理小主题
    const processSubtopic = async (subtopic: any) => {
      try {
        // 检查是否已有草稿
        const { data: existingDrafts } = await supabase
          .from('shadowing_drafts')
          .select('id')
          .eq('subtopic_id', subtopic.id)
          .limit(1);

        if (existingDrafts && existingDrafts.length > 0) {
          return {
            subtopic_id: subtopic.id,
            status: 'skipped',
            message: 'Draft already exists',
          };
        }

        // 根据级别设置字数要求（L1从50字开始，每级别两倍）
        const getWordCountRange = (level: string, lang: string) => {
          const levelNum = parseInt(level);
          const baseRanges = {
            en: [25, 50, 100, 200, 400, 800],
            ja: [50, 100, 200, 400, 800, 1600],
            zh: [50, 100, 200, 400, 800, 1600],
          };
          const ranges = baseRanges[lang as keyof typeof baseRanges] || baseRanges.zh;
          const min = ranges[levelNum - 1] || ranges[0];
          const max = ranges[levelNum] || ranges[1];
          return `${min}-${max}`;
        };

        // 如果level为'all'，使用小主题本身的level
        const actualLevel = level === 'all' ? subtopic.level.toString() : level;
        // 如果genre为'all'，使用小主题本身的体裁
        const actualGenre = genre === 'all' ? subtopic.genre : genre;
        // 如果lang为'all'，使用小主题本身的语言
        const actualLang = lang === 'all' ? subtopic.lang : lang;
        console.log(
          `Processing subtopic ${subtopic.id}: level=${level}, subtopic.level=${subtopic.level}, actualLevel=${actualLevel}, genre=${genre}, subtopic.genre=${subtopic.genre}, actualGenre=${actualGenre}, lang=${lang}, subtopic.lang=${subtopic.lang}, actualLang=${actualLang}`,
        );
        const wordCountRange = getWordCountRange(actualLevel, actualLang);
        const sentenceCount = Math.min(7 + parseInt(actualLevel), 15); // 级别越高，句子越多

        // 构建AI提示
        const formatInstruction =
          actualGenre === 'dialogue'
            ? '必须使用A: B: 对话格式，每行以A: 或B: 开头'
            : '使用完整句子，不要使用A/B对话格式';

        const prompt = `请为以下小主题生成一篇${actualLang}语言、${actualLevel}级、${actualGenre}类型的影子跟读文章：

小主题：${subtopic.title_cn}
英文种子：${subtopic.seed_en}
一句话描述：${subtopic.one_line_cn}
标签：${subtopic.tags?.join(', ') || ''}

要求：
1. 文章长度必须达到${wordCountRange}个字符（这是硬性要求，绝对不能少于最小值，必须严格达到）
2. ${formatInstruction}
3. 请确保内容长度严格符合要求，生成后请检查字数
4. 如果内容不够长，请增加更多细节和描述
5. 字数要求是最高优先级，必须严格遵守

请返回JSON格式：
{
  "title": "文章标题",
  "content": "文章内容"
}`;

        // 调用AI生成
        let rawContent, usage;

        // 根据provider决定使用哪个API
        let actualProvider = provider;
        let actualModel = model;

        if (provider === 'deepseek') {
          // 如果选择的是DeepSeek，使用OpenRouter的DeepSeek模型
          actualProvider = 'openrouter';
          actualModel = 'deepseek/deepseek-chat';
        }

        try {
          const result = await chatJSON({
            provider: actualProvider,
            model: actualModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: temperature || 0.7,
            userId: auth.user.id, // 传递用户ID以使用用户特定的API密钥
          });
          rawContent = result.content;
          usage = result.usage;
        } catch (error: any) {
          // 如果失败，尝试回退到DeepSeek
          if (actualProvider !== 'openrouter' || actualModel !== 'deepseek/deepseek-chat') {
            console.log('Primary model failed, falling back to DeepSeek');
            try {
              const result = await chatJSON({
                provider: 'openrouter',
                model: 'deepseek/deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: temperature || 0.7,
                userId: auth.user.id, // 传递用户ID以使用用户特定的API密钥
              });
              rawContent = result.content;
              usage = result.usage;
            } catch (fallbackError: any) {
              throw fallbackError;
            }
          } else {
            throw error;
          }
        }

        // 解析AI返回的JSON内容
        let aiResponse;
        try {
          aiResponse = JSON.parse(rawContent);
        } catch (parseError) {
          console.error('Failed to parse AI response:', rawContent);
          throw new Error('AI response is not valid JSON');
        }

        console.log('Parsed AI response:', JSON.stringify(aiResponse, null, 2));

        if (!aiResponse || !aiResponse.title || !aiResponse.content) {
          console.error('AI response missing required fields:', {
            hasTitle: !!aiResponse?.title,
            hasContent: !!aiResponse?.content,
            response: aiResponse,
          });
          throw new Error('AI response is invalid');
        }

        // 保存草稿
        const { data: draft, error: draftError } = await supabase
          .from('shadowing_drafts')
          .insert({
            subtopic_id: subtopic.id,
            title: aiResponse.title,
            text: aiResponse.content,
            notes: {},
            lang: actualLang,
            level: parseInt(actualLevel),
            genre: actualGenre,
            status: 'draft',
            created_by: auth.user.id, // 添加创建者ID，确保RLS策略允许插入
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (draftError) {
          throw new Error(`Failed to save draft: ${draftError.message}`);
        }

        // 注意：不直接保存到shadowing_items表
        // shadowing_items表应该只包含已发布的内容
        // 草稿内容应该通过审核流程从shadowing_drafts表发布到shadowing_items表

        return {
          subtopic_id: subtopic.id,
          status: 'success',
          draft_id: draft.id,
          title: aiResponse.title,
        };
      } catch (error: any) {
        console.error(`Error processing subtopic ${subtopic.id}:`, error);
        return {
          subtopic_id: subtopic.id,
          status: 'error',
          error: error.message,
        };
      }
    };

    // 分批并发处理
    const batchSize = Math.min(concurrency, subtopics.length);
    for (let i = 0; i < subtopics.length; i += batchSize) {
      const batch = subtopics.slice(i, i + batchSize);
      const batchPromises = batch.map(processSubtopic);
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults);

      // 批次间延迟，避免过载
      if (i + batchSize < subtopics.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    return NextResponse.json(
      {
        success: true,
        total: subtopics.length,
        success_count: successCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        results,
      },
      {
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    );
  } catch (error: any) {
    console.error('Batch generation error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
      },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
    );
  }
}
