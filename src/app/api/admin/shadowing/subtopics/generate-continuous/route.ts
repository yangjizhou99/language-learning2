import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTINUOUS_STORY_SYS = `You are a creative writer and curriculum designer. You expand a macro theme into a CONTINUOUS STORY sequence of SUBTOPICS.
- The subtopics must form a chronological narrative with the SAME PROTAGONIST(S).
- The story must have a clear BEGINNING, MIDDLE, and END.
- Each subtopic represents a scene or chapter in the story.
- Keep subtopic titles concise.
- Return STRICT JSON only.`;

function buildContinuousSubtopicPrompt({
    lang,
    level,
    genre,
    themeTitle,
    themeScript,
    count,
}: {
    lang: string;
    level: number;
    genre: string;
    themeTitle: string;
    themeScript?: string;
    count: number;
}) {
    const langMap = { en: 'English', ja: '日本語', zh: '简体中文', ko: '한국어' } as const;
    const L = langMap[lang as keyof typeof langMap] || 'English';

    const titleGuidance =
        lang === 'en'
            ? 'Subtopic titles should be concise in English (max 8 words).'
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
THEME_TITLE=${themeTitle}
${themeScript ? `THEME_SCRIPT=${themeScript}` : ''}
COUNT=${count}

Requirements:
- Subtopics must form a CONTINUOUS STORY (Chapter 1 -> Chapter 2 -> ...).
- The story must follow a logical timeline with a clear BEGINNING and END/CONCLUSION.
${themeScript ? `- Adhere to the provided THEME_SCRIPT for the overall plot.` : ''}
- The first subtopic should introduce the situation/characters.
- The last subtopic should provide a resolution or conclusion to the story arc.
- Difficulty/lexicon scale with LEVEL.
- Must include the same protagonist (implied or explicit).
- Cover different stages of the THEME.
- ${titleGuidance}
- ${oneLineGuidance}
- IF GENRE is 'dialogue', you MUST generate a 'dialogue_type' field (e.g., casual, task, emotion, opinion, request, roleplay, pattern) that best fits the scenario.
- You MUST generate a 'roles' object mapping dialogue placeholders (A, B, C...) to character names.
- Example: "roles": { "A": "Ken (Protagonist)", "B": "Mary (Teacher)" }

Output JSON ONLY:
{
  "theme": { "title": "${themeTitle}", "level": "L${level}", "genre": "${genre}" },
  "subtopics": [
    {
      "title": "...",
      "seed": "keyword, keyword, ...",
      "one_line": "...",
      "dialogue_type": "...",
      "roles": {
        "A": "...",
        "B": "..."
      }
    }
  ]
}
Ensure subtopics.length = ${count} and titles are unique.`;
}

export async function POST(req: NextRequest) {
    try {
        // const auth = await requireAdmin(req);
        // if (!auth.ok) {
        //     return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        // }

        const body = await req.json();
        const {
            theme_title,
            theme_title_cn,
            theme_script, // Add theme_script
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

        if (!themeTitle || !lang || !level || !genre) {
            return NextResponse.json(
                {
                    error: 'Missing required parameters',
                    received: { theme_title, theme_title_cn, lang, level, genre },
                },
                { status: 400 },
            );
        }

        const prompt = buildContinuousSubtopicPrompt({
            lang,
            level,
            genre,
            themeTitle,
            themeScript: theme_script,
            count,
        });

        const result = await chatJSON({
            provider: provider as 'openrouter' | 'deepseek' | 'openai',
            model,
            temperature: Math.min(temperature + 0.1, 1.0),
            timeoutMs: 90000,
            messages: [
                { role: 'system', content: CONTINUOUS_STORY_SYS },
                { role: 'user', content: prompt },
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

        if (!parsed.subtopics || !Array.isArray(parsed.subtopics)) {
            throw new Error('Invalid response format');
        }

        return NextResponse.json({
            success: true,
            generated_subtopics: parsed.subtopics,
            message: `Successfully generated ${parsed.subtopics.length} continuous story subtopics`,
        });
    } catch (error) {
        console.error('Continuous subtopic generation error:', error);
        const errObj: any = error as any;
        return NextResponse.json(
            { error: errObj?.message || String(error) },
            { status: 500 },
        );
    }
}
