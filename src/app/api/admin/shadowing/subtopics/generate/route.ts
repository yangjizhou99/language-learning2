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

// 小主题生成的用户提示词模板
function buildSubtopicPrompt({
  lang,
  level,
  genre,
  themeTitleCn,
  count,
}: {
  lang: string;
  level: number;
  genre: string;
  themeTitleCn: string;
  count: number;
}) {
  const langMap = { en: 'English', ja: '日本語', zh: '简体中文' };
  const L = langMap[lang as keyof typeof langMap] || 'English';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
THEME_TITLE_CN=${themeTitleCn}
COUNT=${count}

Requirements:
- Subtopics must be specific and generative (each can yield a short script).
- Difficulty/lexicon scale with LEVEL (L1 基础词，L5+ 可含抽象概念/数据点)。
- 不得重复或仅做表述改写；覆盖 THEME 的不同切面（流程、角色、情绪/冲突、数据/时间等）。

Output JSON ONLY:
{
  "theme": { "title_cn": "${themeTitleCn}", "level": "L${level}", "genre": "${genre}" },
  "subtopics": [
    {
      "title_cn": "……",          // 小主题中文标题（≤ 16 汉字）
      "seed_en": "keyword, keyword, …",   // 英文关键词 2–6 个，逗号分隔（用于约束生成）
      "one_line_cn": "……"         // 12–30 字的一句话意图/场景说明
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
      theme_title_cn,
      lang,
      level,
      genre,
      count = 5,
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.7,
    } = body;

    if (!theme_id || !theme_title_cn || !lang || !level || !genre) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          received: { theme_id, theme_title_cn, lang, level, genre },
          missing: {
            theme_id: !theme_id,
            theme_title_cn: !theme_title_cn,
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
      .select('title_cn, one_line_cn')
      .eq('theme_id', theme_id);

    const existingSubtopicTitles = existingSubtopics?.map((s) => s.title_cn) || [];

    // 构建包含现有小主题信息的提示词（一次性生成所有小主题）
    const enhancedPrompt =
      buildSubtopicPrompt({
        lang,
        level,
        genre,
        themeTitleCn: theme_title_cn,
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
      title_cn: subtopic.title_cn,
      seed_en: subtopic.seed_en || '',
      one_line_cn: subtopic.one_line_cn || '',
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
        .select('id, title_cn');

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
