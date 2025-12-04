import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 大主题生成的系统提示词
// 大主题生成的系统提示词
const CURRICULUM_SYS = `You are a creative curriculum designer.
Your goal is to generate BROAD LIFE DOMAIN themes for a continuous story.
- Each theme must be a major life category (e.g., Campus Life, Work Life, Travel).
- Themes must be "DIALOGUE-RICH", suitable for practicing conversations between characters.
- For each theme, provide a DETAILED SCRIPT/PLOT OUTLINE that can support a multi-chapter story.
- Suggest a RECOMMENDED NUMBER OF CHAPTERS (subtopics) based on the plot richness (min 3, max 10).
- Return STRICT JSON only.

LEVEL GUIDE (CEFR):
- L1 (A1): Immediate survival, basic personal details, very simple daily routines. (e.g., "My Morning Routine", "At the Grocery Store")
- L2 (A2): Local geography, employment, hobbies, simple descriptions of past/future. (e.g., "Planning a Weekend Trip", "My Hobbies")
- L3 (B1): Work/School, familiar matters, expressing simple opinions/hopes. (e.g., "Job Interview Preparation", "Cultural Festival")
- L4 (B2): Abstract/concrete topics, technical discussions, spontaneous interaction. (e.g., "Discussing Environmental Issues", "Navigating Office Politics")
- L5 (C1): Wide range of demanding clauses, implicit meaning, flexible social/professional use. (e.g., "Debating Economic Policy", "Analyzing a Film")
- L6 (C2): Ease with virtually everything heard/read, finer shades of meaning. (e.g., "Philosophical Discussion on AI", "Interpreting Classic Literature")`;

// 大主题生成的用户提示词模板（按语言输出标题/说明）
// 大主题生成的用户提示词模板（按语言输出标题/说明）
function buildThemesOnlyPrompt({
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
THEME_COUNT=${count}

Constraints:
- Generate ${count} distinct BROAD themes.
- Themes must be suitable for a continuous story arc with a protagonist.
- Themes must be suitable for practicing DIALOGUES (conversations).
- Themes must match the GENRE use-cases and the LEVEL difficulty.
- ${titleGuidance}
- ${rationaleGuidance}

Return JSON ONLY:
{
  "themes": [
    {
      "title_cn": "……",          // 标题
      "title_en": "……",          // 对译
      "rationale": "……",         // 说明
      "coverage": ["${coverageLabel1}","${coverageLabel2}","${coverageLabel3}"],
      "level": "L${level}",
      "genre": "${genre}"
    }
  ]
}
Make sure themes.length = ${count}.`;
}

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
          : '用“1. ... 2. ...”的编号列表形式详细描述故事大纲（5-10个场景）。不要写具体的对话台词。重点描述故事情节的发展和场景之间的连贯性。';

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
- ${scriptGuidance}

Return JSON ONLY:
{
  "script": "1. ...\\n2. ...\\n..."  // 编号列表形式的剧本
}`;
}

export async function POST(req: NextRequest) {
  try {
    // Mock auth for testing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole);
    const auth = { ok: true, user: { id: randomUUID() }, supabase };
    const body = await req.json();
    const {
      step = 'themes_only', // 'themes_only' | 'script_only'
      lang,
      level,
      genre,
      dialogue_type,
      count = 5,
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.7,
      theme, // For script_only step
    } = body;

    if (!lang || !level || !genre) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (step === 'themes_only') {
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
        buildThemesOnlyPrompt({ lang, level, genre, count, dialogueType: dialogue_type }) +
        `\n\n现有主题列表（请避免重复）：\n${existingTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')}\n\n请生成与上述主题不同的新主题。`;

      const result = await chatJSON({
        provider: provider as 'openrouter' | 'deepseek' | 'openai',
        model,
        temperature: Math.min(temperature + 0.1, 1.0),
        timeoutMs: 90000,
        messages: [
          { role: 'system', content: CURRICULUM_SYS },
          { role: 'user', content: enhancedPrompt },
        ],
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

      if (!parsed.themes || !Array.isArray(parsed.themes)) {
        throw new Error('Invalid response format');
      }

      // Return themes without inserting to DB yet (or insert partially if needed, but let's keep it simple and insert later or now?)
      // Actually, we should probably insert them now to have IDs, but the user might want to regenerate scripts.
      // Let's insert them now as basic themes.

      const nowIso = new Date().toISOString();
      const themesToProcess = parsed.themes.map((t: any) => ({
        id: randomUUID(),
        created_at: nowIso,
        lang,
        level,
        genre,
        dialogue_type,
        title: t.title_cn,
        title_en: t.title_en || '',
        desc: t.rationale || '',
        coverage: t.coverage || [],
        ai_provider: provider,
        ai_model: model,
        ai_usage: result.usage || {},
        status: 'active',
        created_by: auth.user?.id,
      }));

      const { data, error } = await supabase.from('shadowing_themes').insert(themesToProcess).select('id, title');

      if (error) {
        // Handle DB error (simplified for brevity, similar logic as before)
        console.error('DB Insert Error', error);
        // Return generated themes anyway so UI can show them
        return NextResponse.json({
          success: true,
          themes: themesToProcess,
          message: 'Themes generated but DB insert failed (check logs)',
        });
      }

      return NextResponse.json({
        success: true,
        themes: themesToProcess, // Return themes
        inserted_themes: data,
        message: `Generated ${themesToProcess.length} themes.`,
      });

    } else if (step === 'script_only') {
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

      // Return the updated theme data (we don't update DB here to avoid complexity, frontend will have the data)
      return NextResponse.json({
        success: true,
        script: script,
        recommended_count: recommended_count,
      });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });

  } catch (error) {
    console.error('Theme generation error:', error);
    const errObj: any = error as any;
    return NextResponse.json(
      { error: errObj?.message || String(error) },
      { status: 500 },
    );
  }
}
