import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chatJSON } from '@/lib/ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    const { 
      subtopic_ids, 
      lang, 
      level, 
      genre, 
      provider, 
      model, 
      temperature,
      concurrency = 10
    } = await request.json();

    if (!subtopic_ids || !Array.isArray(subtopic_ids) || subtopic_ids.length === 0) {
      return NextResponse.json({ error: 'subtopic_ids is required and must be a non-empty array' }, { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
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
      return NextResponse.json({ error: 'No subtopics found' }, { 
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
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
            message: 'Draft already exists'
          };
        }

        // 构建AI提示
        const prompt = `请为以下小主题生成一篇${lang}语言、${level}级、${genre}类型的影子跟读文章：

小主题：${subtopic.title_cn}
英文种子：${subtopic.seed_en}
一句话描述：${subtopic.one_line_cn}
标签：${subtopic.tags?.join(', ') || ''}

要求：
1. 文章长度：${lang === 'en' ? '90-120' : lang === 'ja' ? '260-360' : '240-320'}个字符
2. 句子数量：7-9句
3. 每句长度：${lang === 'en' ? '最多16' : '最多45'}个字符
4. 内容要符合${level}级难度，适合${genre}类型
5. 语言自然流畅，适合影子跟读练习

请返回JSON格式：
{
  "title": "文章标题",
  "content": "文章内容",
  "difficulty_notes": "难度说明",
  "learning_points": ["学习要点1", "学习要点2"]
}`;

        // 调用AI生成
        const aiResponse = await chatJSON(prompt, {
          provider,
          model,
          temperature: temperature || 0.7
        });

        if (!aiResponse || !aiResponse.title || !aiResponse.content) {
          throw new Error('AI response is invalid');
        }

        // 保存草稿
        const { data: draft, error: draftError } = await supabase
          .from('shadowing_drafts')
          .insert({
            subtopic_id: subtopic.id,
            title: aiResponse.title,
            content: aiResponse.content,
            difficulty_notes: aiResponse.difficulty_notes || '',
            learning_points: aiResponse.learning_points || [],
            lang,
            level,
            genre,
            status: 'draft',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (draftError) {
          throw new Error(`Failed to save draft: ${draftError.message}`);
        }

        // 保存到items表
        const { error: itemError } = await supabase
          .from('shadowing_items')
          .insert({
            subtopic_id: subtopic.id,
            draft_id: draft.id,
            title: aiResponse.title,
            content: aiResponse.content,
            lang,
            level,
            genre,
            status: 'draft'
          });

        if (itemError) {
          console.warn(`Failed to save item for subtopic ${subtopic.id}:`, itemError);
        }

        return {
          subtopic_id: subtopic.id,
          status: 'success',
          draft_id: draft.id,
          title: aiResponse.title
        };

      } catch (error: any) {
        console.error(`Error processing subtopic ${subtopic.id}:`, error);
        return {
          subtopic_id: subtopic.id,
          status: 'error',
          error: error.message
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
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      total: subtopics.length,
      success_count: successCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      results
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error: any) {
    console.error('Batch generation error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
