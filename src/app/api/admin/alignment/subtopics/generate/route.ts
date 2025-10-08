import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { ALIGNMENT_LANGS } from '@/lib/alignment/constants';
import { normalizeTitle } from '@/lib/alignment/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYS_PROMPT = `You are designing alignment practice SUBTOPICS derived from a broader THEME.
Return strictly valid JSON. Each subtopic must be specific, teachable, and align with the supplied level & genre.
Include multilingual titles, a one-line hook, and learner objectives that can drive writing/dialogue tasks.
Avoid duplicates of provided lists.`;

function buildPrompt({
  themeTitle,
  themeSummary,
  lang,
  level,
  genre,
  count,
  existing,
}: {
  themeTitle: string;
  themeSummary: string;
  lang: string;
  level: number;
  genre: string;
  count: number;
  existing: string[];
}) {
  const langLabel = lang === 'en' ? 'English' : lang === 'ja' ? 'Japanese' : 'Simplified Chinese';
  const genreLabel = genre;
  const existingBlock =
    existing.length > 0
      ? `Existing subtopics already used:\n${existing
          .slice(0, 60)
          .map((title, idx) => `${idx + 1}. ${title}`)
          .join('\n')}\n`
      : 'No existing subtopics yet.\n';

  const objectivesGuidance =
    level === 1
      ? 'Provide exactly 2 learner objectives.'
      : level === 2
        ? 'Provide exactly 3 learner objectives.'
        : level === 3
          ? 'Provide exactly 4 learner objectives.'
          : level === 4
            ? 'Provide exactly 5 learner objectives.'
            : level === 5
              ? 'Provide exactly 6 learner objectives.'
              : 'Provide 6 to 8 learner objectives (decide based on scenario).';

  return `Theme: "${themeTitle}"
Summary: ${themeSummary || 'N/A'}
Target language: ${langLabel}
Target level: L${level}
Genre: ${genreLabel}
Desired count: ${count}

${existingBlock}

Subtopic requirements:
- Concrete scenario anchored to the theme; no broad duplicates.
- Title must be in the learner language (${langLabel}), <= 14 words/characters ideally.
- Provide translations for en/ja/zh.
- Provide a one-line hook in the learner language summarizing the scenario, plus translations.
- Objectives should be action-oriented bullet strings describing what the learner must accomplish in the final task.
- ${objectivesGuidance}

Return JSON ONLY:
{
  "subtopics": [
    {
      "title": "…",                         // learner language
      "title_translations": { "en": "…", "ja": "…", "zh": "…" },
      "one_line": "…",                      // learner language
      "one_line_translations": { "en": "…", "ja": "…", "zh": "…" },
      "objectives": [
        {
          "label": "…",                    // learner language
          "translations": { "en": "…", "ja": "…", "zh": "…" }
        }
      ]
    }
  ]
}
Ensure subtopics.length === ${count}.`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }

  const { supabase } = auth;
  const body = await req.json();
  const themeId = String(body.theme_id || '');
  const count = Math.min(Math.max(parseInt(body.count ?? '6', 10) || 6, 1), 20);
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.8;

  if (!themeId) {
    return NextResponse.json({ error: '缺少主题ID' }, { status: 400 });
  }

  const { data: theme, error: themeError } = await supabase
    .from('alignment_themes')
    .select('*')
    .eq('id', themeId)
    .single();

  if (themeError || !theme) {
    return NextResponse.json({ error: '主题不存在' }, { status: 404 });
  }

  const lang = theme.lang as string;
  if (!ALIGNMENT_LANGS.includes(lang as any)) {
    return NextResponse.json({ error: '主题语言不支持' }, { status: 400 });
  }

  const { data: existingSubtopics } = await supabase
    .from('alignment_subtopics')
    .select('title')
    .eq('theme_id', themeId);
  const existingList = (existingSubtopics || []).map((row) => (row as { title: string }).title);

  const prompt = buildPrompt({
    themeTitle: theme.title,
    themeSummary: theme.summary || '',
    lang,
    level: theme.level,
    genre: theme.genre,
    count,
    existing: existingList,
  });

  const { content } = await chatJSON({
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature,
    response_json: true,
    timeoutMs: 120000,
    messages: [
      { role: 'system', content: SYS_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error('alignment subtopic generation JSON parse failed', { content, error });
    return NextResponse.json({ error: 'LLM 返回的 JSON 无法解析' }, { status: 400 });
  }

  const subtopics = Array.isArray(parsed?.subtopics) ? parsed.subtopics : [];
  const cleaned = subtopics
    .map((subtopic: any) => {
      const title = String(subtopic?.title || '').trim();
      if (!title) return null;
      const oneLine = String(subtopic?.one_line || '').trim();
      const titleTranslations = subtopic?.title_translations || {};
      const oneLineTranslations = subtopic?.one_line_translations || {};
      const objectives = Array.isArray(subtopic?.objectives) ? subtopic.objectives : [];
      return {
        title,
        title_translations: {
          en: titleTranslations.en || title,
          ja: titleTranslations.ja || title,
          zh: titleTranslations.zh || title,
        },
        title_normalized: normalizeTitle(title),
        one_line: oneLine,
        one_line_translations: {
          en: oneLineTranslations.en || oneLine,
          ja: oneLineTranslations.ja || oneLine,
          zh: oneLineTranslations.zh || oneLine,
        },
        objectives: objectives.map((obj: any) => {
          const label = String(obj?.label || '').trim();
          const translations = obj?.translations || {};
          return {
            label,
            translations: {
              en: translations.en || label,
              ja: translations.ja || label,
              zh: translations.zh || label,
            },
          };
        }),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items: cleaned });
}
