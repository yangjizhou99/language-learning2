import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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
  dialogueType,
}: {
  lang: string;
  level: number;
  genre: string;
  themeTitle: string;
  count: number;
  dialogueType?: string;
}) {
  const langMap = { en: 'English', ja: '日本語', zh: '简体中文', ko: '한국어' } as const;
  const L = langMap[lang as keyof typeof langMap] || 'English';

  const titleGuidance =
    lang === 'en'
      ? 'Subtopic titles should be concise in English (≤ 8 words).'
      : lang === 'ja'
        ? 'サブトピックのタイトルは日本語で簡潔に（全角16字以内）。'
        : lang === 'ko'
          ? '하위 주제 제목은 한국어로 간결하게 (16자 이내).'
          : '小主题标题用简体中文，简洁清晰（≤ 16 个汉字）。';
  const oneLineGuidance =
    lang === 'en'
      ? 'Provide a one-line intent/scene in English (12–30 words).'
      : lang === 'ja'
        ? '1行の意図・場面説明を日本語で（全角12–30字）。'
        : lang === 'ko'
          ? '한 줄의 의도/장면 설명을 한국어로 (12–30자).'
          : '给出12–30字的一句话意图/场景说明（中文）。';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
${dialogueType ? `DIALOGUE_TYPE=${dialogueType}` : ''}
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
      dialogue_type,
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
        dialogueType: dialogue_type,
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

    // 处理生成的小主题（去重 + 显式主键/时间，兼容无默认值环境）
    type SubtopicInsert = {
      id: string;
      created_at: string;
      theme_id: string;
      lang: string;
      level: number;
      genre: string;
      dialogue_type?: string;
      title: string;
      seed: string;
      one_line: string;
      ai_provider: string;
      ai_model: string;
      ai_usage: Record<string, unknown>;
      status: string;
      created_by?: string | null;
    };
    const nowIso = new Date().toISOString();
    const seenTitles = new Set<string>();
    const subtopicsToProcess: SubtopicInsert[] = parsed.subtopics
      .filter((s: any) => {
        const key = String(s?.title || '').trim();
        if (!key || seenTitles.has(key) || existingSubtopicTitles.includes(key)) return false;
        seenTitles.add(key);
        return true;
      })
      .map((subtopic: any): SubtopicInsert => ({
        id: randomUUID(),
        created_at: nowIso,
        theme_id,
        lang,
        level,
        genre,
        dialogue_type,
        title: subtopic.title,
        seed: subtopic.seed || '',
        one_line: subtopic.one_line || '',
        ai_provider: provider,
        ai_model: model,
        ai_usage: result.usage || {},
        status: 'active',
        created_by: auth.user?.id,
      }));

    let insertedData: Array<Pick<SubtopicInsert, 'id' | 'title'>> = [];
    if (subtopicsToProcess.length > 0) {
      const attemptInsert = async (rows: Array<Partial<SubtopicInsert>>) =>
        await supabase.from('shadowing_subtopics').insert(rows).select('id, title');

      const { data, error } = await attemptInsert(subtopicsToProcess);
      if (error) {
        console.error('shadowing_subtopics insert error:', error);
        const errMsg = (error as any)?.message || '';
        const errCode = (error as any)?.code || '';
        const likelyUnknownColumn = /column .* does not exist/i.test(errMsg) || errCode === '42703';

        if (likelyUnknownColumn) {
          const minimalRows = subtopicsToProcess.map((t: SubtopicInsert) => ({
            id: t.id,
            created_at: t.created_at,
            theme_id: t.theme_id,
            lang: t.lang,
            level: t.level,
            genre: t.genre,
            dialogue_type: t.dialogue_type,
            title: t.title,
            one_line: t.one_line,
            status: t.status,
            created_by: t.created_by,
          }));
          const { data: data2, error: error2 } = await attemptInsert(minimalRows);
          if (error2) {
            console.error('shadowing_subtopics minimal insert error:', error2);
            const formatted = {
              message: (error2 as any)?.message || String(error2),
              details: (error2 as any)?.details,
              hint: (error2 as any)?.hint,
              code: (error2 as any)?.code,
            };
            return NextResponse.json(
              { error: `Database error: ${formatted.message}`, error_detail: formatted },
              { status: 500 },
            );
          }
          insertedData = data2 || [];
        } else {
          const formatted = {
            message: (error as any)?.message || String(error),
            details: (error as any)?.details,
            hint: (error as any)?.hint,
            code: (error as any)?.code,
          };
          return NextResponse.json(
            { error: `Database error: ${formatted.message}`, error_detail: formatted },
            { status: 500 },
          );
        }
      } else {
        insertedData = data || [];
      }
    }

    return NextResponse.json({
      success: true,
      inserted_count: insertedData.length,
      inserted_subtopics: insertedData,
      message: `成功生成 ${insertedData.length} 个新小主题（已避免与现有小主题重复）`,
    });
  } catch (error) {
    console.error('Subtopic generation error:', error);
    const errObj: any = error as any;
    const formatted = {
      message: errObj?.message || String(error),
      details: errObj?.details,
      hint: errObj?.hint,
      code: errObj?.code,
    };
    return NextResponse.json(
      { error: formatted.message, error_detail: formatted },
      { status: 500 },
    );
  }
}
