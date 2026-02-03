import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 大主题生成的系统提示词
const CURRICULUM_SYS = `You are a curriculum designer for language shadowing. 
Produce CEFR-appropriate, teachable and diverse MACRO THEMES.
- Each theme MUST be broad enough to support a CONTINUOUS STORY with multiple chapters/scenes.
- Avoid narrow, single-event topics (e.g., "Buying a ticket"). Instead, use broader themes (e.g., "Travel Adventures", "University Life").
- Adapt difficulty by LEVEL (L1≈A1/A2 … L6≈C1).
- Return STRICT JSON only. No extra text.
- Avoid duplicates; avoid niche proper nouns unless L5+.`;

// 大主题生成的用户提示词模板（按语言输出标题/说明）
function buildThemePrompt({
  lang,
  level,
  genre,
  count,
  dialogueType,
}: {
  lang: string;
  level: number;
  genre: string;
  count: number;
  dialogueType?: string;
}) {
  const langNameMap = { en: 'English', ja: '日本語', zh: '简体中文', ko: '한국어' } as const;
  const L = langNameMap[lang as keyof typeof langNameMap] || 'English';

  // 针对不同学习语言，要求主题标题与说明用对应语言输出
  const titleGuidance =
    lang === 'en'
      ? 'Each theme title should be concise in English (≤ 8 words).'
      : lang === 'ja'
        ? '各テーマのタイトルは日本語で簡潔に（全角14字以内）。'
        : lang === 'ko'
          ? '각 테마 제목은 한국어로 간결하게 (14자 이내).'
          : '每个主题标题使用简体中文，简洁清晰（≤ 14 个汉字）。';
  const rationaleGuidance =
    lang === 'en'
      ? 'Provide 1–2 sentences of rationale in English.'
      : lang === 'ja'
        ? '適合レベル／ジャンルの理由を日本語で1–2文記述。'
        : lang === 'ko'
          ? '해당 레벨/장르에 적합한 이유를 한국어로 1–2문장으로 설명.'
          : '用中文写1–2句说明其为何适配该等级和体裁。';
  const coverageLabel1 = lang === 'ja' ? '要点1' : lang === 'ko' ? '포인트1' : lang === 'en' ? 'Point 1' : '要点1';
  const coverageLabel2 = lang === 'ja' ? '要点2' : lang === 'ko' ? '포인트2' : lang === 'en' ? 'Point 2' : '要点2';
  const coverageLabel3 = lang === 'ja' ? '要点3' : lang === 'ko' ? '포인트3' : lang === 'en' ? 'Point 3' : '要点3';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
${dialogueType ? `DIALOGUE_TYPE=${dialogueType}` : ''}
COUNT=${count}

Constraints:
- Themes must be BROAD and EXPANSIVE (Macro Themes).
- They must be suitable for a continuous story arc (e.g., a protagonist's journey, a developing relationship, a long-term project).
- Themes must match the GENRE use-cases and the LEVEL difficulty.
- Prefer everyday domains for L1–L2; allow abstract/specialized for L5–L6.
- ${titleGuidance}
- ${rationaleGuidance}

Return JSON ONLY:
{
  "themes": [
    {
      "title_cn": "……",          // 标题：按 LANG 输出；字段名保持不变供后端使用
      "title_en": "……",          // 对译（可留空）；若 LANG=en 可与标题相同
      "rationale": "……",         // 1–2句：按 LANG 输出
      "coverage": ["${coverageLabel1}","${coverageLabel2}","${coverageLabel3}"],
      "level": "L${level}",
      "genre": "${genre}"
    }
  ]
}
Make sure themes.length = ${count}. If you produce more or fewer, self-correct before returning.`;
}

// 剧本大纲生成的提示词
function buildScriptOnlyPrompt({
  lang,
  level,
  genre,
  theme,
}: {
  lang: string;
  level: number;
  genre: string;
  theme: any;
}) {
  const langNameMap = { en: 'English', ja: '日本語', zh: '简体中文', ko: '한국어' } as const;
  const L = langNameMap[lang as keyof typeof langNameMap] || 'English';

  const scriptGuidance =
    lang === 'en'
      ? 'Provide a DETAILED script/plot outline as a NUMBERED LIST (5-10 scenes). DO NOT write actual dialogue lines. Focus on the narrative flow and how each scene connects to the next.'
      : lang === 'ja'
        ? '「1. ... 2. ...」の番号付きリスト（5-10シーン）で詳細なあらすじを記述。具体的なセリフは書かないこと。各シーンのつながりと物語の流れを重視する。'
        : lang === 'ko'
          ? '"1. ... 2. ... " 번호가 매겨진 목록(5-10 장면)으로 상세 줄거리를 기술. 구체적인 대사는 쓰지 말 것. 각 장면의 연결과 이야기의 흐름을 중시할 것.'
          : '用"1. ... 2. ..."的编号列表形式详细描述故事大纲（5-10个场景）。不要写具体的对话台词。重点描述故事情节的发展和场景之间的连贯性。';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
THEME_TITLE=${theme.title_cn || theme.title}
THEME_DESC=${theme.rationale || theme.desc}

Constraints:
- Create a DETAILED script/plot outline for this specific theme.
- The script must be a NUMBERED LIST (e.g. 1. Scene One... 2. Scene Two...).
- Generate between 5 and 10 scenes.
- Each scene must be a DIALOGUE SCENARIO (e.g., "A talks to B about...").
- EVERY scene must involve a conversation between at least two characters. NO monologues or pure narration.
- Start each scene with: [Interlocutors & Context] ... then expand on the plot.
- DO NOT include specific dialogue lines (A: ..., B: ...).
- Ensure strong narrative connections between scenes.
- Write the script in ${L}.
- ${scriptGuidance}

Return JSON ONLY:
{
  "script": "1. ...\\n2. ...\\n..."  // 编号列表形式的剧本
}`;
}

export async function POST(req: NextRequest) {
  try {
    // const auth = await requireAdmin(req);
    // if (!auth.ok) {
    //   return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    // }

    // Mock auth for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    const auth = { ok: true, user: { id: randomUUID() }, supabase };
    const body = await req.json();
    const {
      step, // 'themes_only' | 'script_only' | undefined (默认生成主题)
      theme, // For script_only step
      lang,
      level,
      genre,
      dialogue_type,
      count = 5,
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.7,
    } = body;

    if (!lang || !level || !genre) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 处理 script_only 步骤 - 为单个主题生成剧本大纲
    if (step === 'script_only') {
      if (!theme) {
        return NextResponse.json({ error: 'Missing theme object for script generation' }, { status: 400 });
      }

      const prompt = buildScriptOnlyPrompt({ lang, level, genre, theme });

      const result = await chatJSON({
        provider: provider as 'openrouter' | 'deepseek' | 'openai',
        model,
        temperature,
        timeoutMs: 60000,
        messages: [
          { role: 'system', content: 'You are a creative writer.' },
          { role: 'user', content: prompt }
        ]
      });

      let parsed;
      try {
        parsed = JSON.parse(result.content);
      } catch (e) {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response');
        }
      }

      // Calculate recommended_count from script
      const script = parsed.script || '';
      // Count lines that start with a number followed by a dot or parenthesis
      const matches = script.match(/^\d+[\.|、|\)]/gm);
      const calculatedCount = matches ? matches.length : 5; // Default to 5 if no numbering found
      const recommended_count = Math.min(Math.max(calculatedCount, 3), 10); // Clamp between 3 and 10

      return NextResponse.json({
        success: true,
        script: script,
        recommended_count: recommended_count,
      });
    }

    // 默认处理：生成主题列表
    // 获取现有主题信息
    const { data: existingThemes } = await supabase
      .from('shadowing_themes')
      .select('title, desc')
      .eq('lang', lang)
      .eq('level', level)
      .eq('genre', genre);

    const existingTitles = existingThemes?.map((t) => t.title) || [];

    // 构建包含现有主题信息的提示词（一次性生成所有主题）
    const enhancedPrompt =
      buildThemePrompt({ lang, level, genre, count, dialogueType: dialogue_type }) +
      `\n\n现有主题列表（请避免重复）：\n${existingTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')}\n\n请生成与上述主题不同的新主题。`;

    // 只调用一次 AI 生成，设置90秒超时
    const result = await chatJSON({
      provider: provider as 'openrouter' | 'deepseek' | 'openai',
      model,
      temperature: Math.min(temperature + 0.1, 1.0), // 稍微增加创造性
      timeoutMs: 90000, // 90秒超时
      messages: [
        { role: 'system', content: CURRICULUM_SYS },
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

    if (!parsed.themes || !Array.isArray(parsed.themes)) {
      throw new Error('Invalid response format');
    }

    // 处理生成的主题
    const nowIso = new Date().toISOString();
    type ThemeInsert = {
      id: string;
      created_at: string;
      lang: string;
      level: number;
      genre: string;
      dialogue_type?: string;
      title: string;
      title_en: string;
      desc: string;
      coverage: unknown[];
      ai_provider: string;
      ai_model: string;
      ai_usage: Record<string, unknown>;
      status: string;
      created_by?: string | null;
    };

    const themesToProcess: ThemeInsert[] = parsed.themes.map((theme: any): ThemeInsert => ({
      id: randomUUID(), // 兼容数据库未设置默认值的环境
      created_at: nowIso, // 兼容数据库未设置默认值的环境
      lang,
      level,
      genre,
      dialogue_type,
      title: theme.title_cn,
      title_en: theme.title_en || '',
      desc: theme.rationale || '',
      coverage: theme.coverage || [],
      ai_provider: provider,
      ai_model: model,
      ai_usage: result.usage || {},
      status: 'active',
      created_by: auth.user?.id,
    }));

    let insertedData: Array<Pick<ThemeInsert, 'id' | 'title'>> = [];
    if (themesToProcess.length > 0) {
      // 优先尝试插入完整字段集合
      const attemptInsert = async (rows: Array<Partial<ThemeInsert>>) =>
        await supabase.from('shadowing_themes').insert(rows).select('id, title');

      const { data, error } = await attemptInsert(themesToProcess);

      if (error) {
        // 记录详细错误，便于排查
        console.error('shadowing_themes insert error:', error);

        // 如果是列不存在（数据库未升级到最新结构），降级仅插入基础字段
        const errMsg = (error as any)?.message || '';
        const errCode = (error as any)?.code || '';
        const likelyUnknownColumn = /column .* does not exist/i.test(errMsg) || errCode === '42703';

        if (likelyUnknownColumn) {
          const minimalRows = themesToProcess.map((t: ThemeInsert) => ({
            id: t.id,
            created_at: t.created_at,
            lang: t.lang,
            level: t.level,
            genre: t.genre,
            dialogue_type: t.dialogue_type,
            title: t.title,
            desc: t.desc,
            status: t.status,
            created_by: t.created_by,
          }));

          const { data: data2, error: error2 } = await attemptInsert(minimalRows);
          if (error2) {
            console.error('shadowing_themes minimal insert error:', error2);
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
      themes: themesToProcess, // 返回完整主题数据供前端使用
      inserted_count: insertedData.length,
      inserted_themes: insertedData,
      message: `成功生成 ${insertedData.length} 个新主题（已避免与现有主题重复）`,
    });
  } catch (error) {
    console.error('Theme generation error:', error);
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
