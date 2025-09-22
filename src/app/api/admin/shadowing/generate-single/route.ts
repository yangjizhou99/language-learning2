import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { buildShadowPrompt } from '@/lib/shadowing/prompt';
import { chatJSON } from '@/lib/ai/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 处理CORS预检请求
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = auth.supabase;
  const body = await req.json();
  const {
    subtopic_id,
    lang,
    level,
    genre,
    provider = 'deepseek',
    model = 'deepseek-chat',
    temperature = 0.7,
  } = body;

  if (!subtopic_id) {
    return NextResponse.json({ error: 'subtopic_id is required' }, { status: 400 });
  }

  try {
    // 获取小主题数据
    const { data: subtopic, error: fetchError } = await supabase
      .from('shadowing_subtopics')
      .select('*')
      .eq('id', subtopic_id)
      .eq('status', 'active')
      .single();

    if (fetchError || !subtopic) {
      return NextResponse.json({ error: 'subtopic not found' }, { status: 400 });
    }

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('shadowing_drafts')
      .select('id')
      .eq('source->>subtopic_id', subtopic_id)
      .eq('status', 'draft')
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: 'Shadowing content already exists for this subtopic',
          code: 'ALREADY_EXISTS',
        },
        { status: 409 },
      );
    }

    // 构建提示词（使用统一字段）
    const prompt = buildShadowPrompt({
      lang: subtopic.lang,
      level: subtopic.level,
      genre: subtopic.genre,
      title: subtopic.title,
      seed: subtopic.seed,
      one_line: subtopic.one_line,
    });

    // 调用AI生成
    const result = await chatJSON({
      provider: provider as 'openrouter' | 'deepseek' | 'openai',
      model,
      temperature,
      timeoutMs: 120000, // 2分钟超时
      messages: [
        { role: 'system', content: 'You are a helpful writing assistant.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = result.content;

    // 解析JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    // 获取小主题对应的大主题ID
    const { data: themeData } = await supabase
      .from('shadowing_subtopics')
      .select('theme_id')
      .eq('id', subtopic_id)
      .single();

    // 保存到数据库
    const { error: saveError } = await supabase.from('shadowing_drafts').insert({
      lang: subtopic.lang,
      level: subtopic.level,
      topic: subtopic.title,
      genre: subtopic.genre,
      title: parsed.title || subtopic.title,
      text: parsed.passage || content,
      theme_id: themeData?.theme_id || null,
      subtopic_id: subtopic_id,
      notes: {
        ...parsed.notes,
        violations: parsed.violations || [],
        source: {
          kind: 'subtopic',
          subtopic_id: subtopic_id,
        },
        meta: parsed.meta || {},
      },
      ai_provider: provider,
      ai_model: model,
      ai_usage: result.usage || {},
      status: 'draft',
    });

    if (saveError) {
      throw new Error(`Save failed: ${saveError.message}`);
    }

    // 同时保存到 shadowing_items 表
    const { error: itemsError } = await supabase.from('shadowing_items').insert({
      lang: subtopic.lang,
      level: subtopic.level,
      title: parsed.title || subtopic.title,
      text: parsed.passage || content,
      audio_url: '', // 稍后生成音频
      translations: {},
      meta: {
        from_draft: true,
        theme_id: themeData?.theme_id || null,
        subtopic_id: subtopic_id,
        genre: subtopic.genre,
        notes: {
          ...parsed.notes,
          violations: parsed.violations || [],
          source: {
            kind: 'subtopic',
            subtopic_id: subtopic_id,
          },
          meta: parsed.meta || {},
        },
        ai_provider: provider,
        ai_model: model,
        ai_usage: result.usage || {},
        published_at: new Date().toISOString(),
      },
    });

    if (itemsError) {
      console.warn(`Failed to save to shadowing_items: ${itemsError.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Shadowing content generated successfully',
        subtopic_id,
        title: parsed.title || subtopic.title,
        usage: result.usage || {},
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      },
    );
  } catch (error: any) {
    console.error('Generate single shadowing failed:', error);
    return NextResponse.json(
      {
        error: error.message || 'Generation failed',
        subtopic_id,
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      },
    );
  }
}
