import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 小主题生成的系统提示词
const SUBTOPIC_SYS = `You expand a macro theme into concrete, classroom-ready SUBTOPICS.
- Vary scenarios while staying within the macro theme.
- Keep subtopic titles concise and non-overlapping.
- Return STRICT JSON only.`;

// 小主题生成的用户提示词模板（按语言输出标题/一句话）
function buildSubtopicPrompt({
  lang,
  level,
  genre,
  themeTitle,
  count,
}: {
  lang: string;
  level: number;
  genre: string;
  themeTitle: string;
  count: number;
}) {
  const langMap = { en: 'English', ja: '日本語', zh: '简体中文' } as const;
  const L = langMap[lang as keyof typeof langMap] || 'English';

  const titleGuidance =
    lang === 'en'
      ? 'Subtopic titles should be concise in English (≤ 8 words).'
      : lang === 'ja'
        ? 'サブトピックのタイトルは日本語で簡潔に（全角16字以内）。'
        : '小主题标题用简体中文，简洁清晰（≤ 16 个汉字）。';
  const oneLineGuidance =
    lang === 'en'
      ? 'Provide a one-line intent/scene in English (12–30 words).'
      : lang === 'ja'
        ? '1行の意図・場面説明を日本語で（全角12–30字）。'
        : '给出12–30字的一句话意图/场景说明（中文）。';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
THEME_TITLE=${themeTitle}
COUNT=${count}

Requirements:
- Subtopics must be specific and generative (each can yield a short script).
- Difficulty/lexicon scale with LEVEL (L1 基础词，L5+ 可含抽象概念/数据点)。
- 不得重复或仅做表述改写；覆盖 THEME 的不同切面（流程、角色、情绪/冲突、数据/时间等）。
- ${titleGuidance}
- ${oneLineGuidance}

Output JSON ONLY:
{
  "theme": { "title": "${themeTitle}", "level": "L${level}", "genre": "${genre}" },
  "subtopics": [
    {
      "title": "……",          // 标题：按 LANG 输出
      "seed": "keyword, keyword, …",   // 关键词 2–6 个
      "one_line": "……"         // 一句话意图/场景说明
    }
  ]
}
Ensure subtopics.length = ${count} and titles are unique. If not, self-repair before returning.`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = auth.supabase;
    const body = await req.json();
    const {
      theme_id,
      theme_title,
      theme_title_cn,
      lang,
      level,
      genre,
      count = 5,
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.7,
    } = body;

    const themeTitle = theme_title || theme_title_cn;
    if (!theme_id || !themeTitle || !lang || !level || !genre) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          received: { theme_id, theme_title, theme_title_cn, lang, level, genre },
          missing: {
            theme_id: !theme_id,
            theme_title: !themeTitle,
            lang: !lang,
            level: !level,
            genre: !genre,
          },
        },
        { status: 400 },
      );
    }

    // 获取现有小主题信息
    const { data: existingSubtopics } = await supabase
      .from('shadowing_subtopics')
      .select('title, one_line')
      .eq('theme_id', theme_id);

    const existingSubtopicTitles = existingSubtopics?.map((s) => s.title) || [];

    // 构建包含现有小主题信息的提示词（一次性生成所有小主题）
    const enhancedPrompt =
            buildSubtopicPrompt({
              lang,
              level,
              genre,
              themeTitle,
              count,
            }) +
      `\n\n现有小主题列表（请避免重复）：\n${existingSubtopicTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')}\n\n请生成与上述小主题不同的新小主题。`;

    // 只调用一次 AI 生成，设置90秒超时
    const result = await chatJSON({
      provider: provider as 'openrouter' | 'deepseek' | 'openai',
      model,
      temperature: Math.min(temperature + 0.1, 1.0), // 稍微增加创造性
      timeoutMs: 90000, // 90秒超时
      messages: [
        { role: 'system', content: SUBTOPIC_SYS },
        { role: 'user', content: enhancedPrompt },
      ],
    });

    // 解析 AI 响应
    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch (e) {
      // 尝试提取 JSON
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    if (!parsed.subtopics || !Array.isArray(parsed.subtopics)) {
      throw new Error('Invalid response format');
    }

    // 处理生成的小主题
    const subtopicsToProcess = parsed.subtopics.map((subtopic: any) => ({
      theme_id,
      lang,
      level,
      genre,
      title: subtopic.title,
      seed: subtopic.seed || '',
      one_line: subtopic.one_line || '',
      ai_provider: provider,
      ai_model: model,
      ai_usage: result.usage || {},
      status: 'active',
    }));

    let insertedData: any[] = [];
    if (subtopicsToProcess.length > 0) {
      const { data, error } = await supabase
        .from('shadowing_subtopics')
        .insert(subtopicsToProcess)
        .select('id, title');

      if (error) {
        throw new Error(
          `Database error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      insertedData = data || [];
    }

    return NextResponse.json({
      success: true,
      inserted_count: insertedData.length,
      inserted_subtopics: insertedData,
      message: `成功生成 ${insertedData.length} 个新小主题（已避免与现有小主题重复）`,
    });
  } catch (error) {
    console.error('Subtopic generation error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : 'Generation failed',
      },
      { status: 500 },
    );
  }
}
