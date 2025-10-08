import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { ALIGNMENT_GENRES, ALIGNMENT_LANGS } from '@/lib/alignment/constants';
import { normalizeTitle } from '@/lib/alignment/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYS_PROMPT = `You are a senior curriculum designer creating alignment practice THEMES.
Return STRICT JSON only. Do not include prose outside JSON.
Each theme should be broad enough to spawn 6-10 subtopics, match CEFR difficulty (L1≈A1/A2 ... L6≈C1/C2),
and provide concise multilingual titles + rationale. Avoid duplicates with provided list.`;

function buildUserPrompt({
  lang,
  level,
  genre,
  count,
  existing,
}: {
  lang: string;
  level: number;
  genre: string;
  count: number;
  existing: string[];
}) {
  const langLabel =
    lang === 'en' ? 'English' : lang === 'ja' ? 'Japanese' : lang === 'zh' ? 'Simplified Chinese' : lang;
  const genreMap: Record<string, string> = {
    dialogue: 'interactive role-play dialogue themes',
    article: 'analytic article-writing themes',
    task_email: 'task-based email or memo writing themes',
    long_writing: 'extended long-form writing themes',
  };
  const genreLabel = genreMap[genre] || genre;
  const existingBlock =
    existing.length > 0
      ? `Existing themes for LANG=${lang}, LEVEL=L${level}, GENRE=${genre}:\n${existing
          .slice(0, 40)
          .map((t, idx) => `${idx + 1}. ${t}`)
          .join('\n')}\n`
      : 'No existing themes yet.\n';

  return `LANG=${langLabel}
LEVEL=L${level}
GENRE=${genreLabel}
COUNT=${count}

${existingBlock}

Constraints:
- Provide fresh, non-overlapping ideas.
- Titles must be in the target learner language (LANG).
- Provide translations for all supported languages (en, ja, zh).
- Include a 1-2 sentence summary explaining why the theme fits the level & genre.
- Summary translations should convey the same meaning, not literal word-by-word.

Return JSON ONLY:
{
  "themes": [
    {
      "title": "…",                        // LANG version
      "title_translations": { "en": "…", "ja": "…", "zh": "…" },
      "summary": "…",                      // LANG version rationale
      "summary_translations": { "en": "…", "ja": "…", "zh": "…" }
    }
  ]
}
Make sure themes.length === ${count}.`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }
  const supabase = auth.supabase;
  const body = await req.json();

  const lang = String(body.lang || 'en');
  const level = parseInt(body.level ?? '1', 10);
  const genre = String(body.genre || 'dialogue');
  const count = Math.min(Math.max(parseInt(body.count ?? '5', 10) || 5, 1), 15);
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;

  if (!ALIGNMENT_LANGS.includes(lang as any)) {
    return NextResponse.json({ error: '语言不支持' }, { status: 400 });
  }
  if (Number.isNaN(level) || level < 1 || level > 6) {
    return NextResponse.json({ error: '等级不合法' }, { status: 400 });
  }
  if (!ALIGNMENT_GENRES.includes(genre as any)) {
    return NextResponse.json({ error: '体裁不支持' }, { status: 400 });
  }

  const { data: existingThemes } = await supabase
    .from('alignment_themes')
    .select('title')
    .eq('lang', lang)
    .eq('level', level)
    .eq('genre', genre)
    .limit(200);
  const existingList = (existingThemes || []).map((row) => (row as { title: string }).title);

  const prompt = buildUserPrompt({ lang, level, genre, count, existing: existingList });

  const { content } = await chatJSON({
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature,
    response_json: true,
    timeoutMs: 90000,
    messages: [
      { role: 'system', content: SYS_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error('alignment theme generation JSON parse failed', { content, error });
    return NextResponse.json({ error: 'LLM 返回的 JSON 无法解析' }, { status: 400 });
  }

  const themes = Array.isArray(parsed?.themes) ? parsed.themes : [];
  const cleaned = themes
    .map((theme: any) => {
      const title = String(theme?.title || '').trim();
      const summary = String(theme?.summary || '').trim();
      const titleTranslations = theme?.title_translations || {};
      const summaryTranslations = theme?.summary_translations || {};
      if (!title) return null;
      const normalized = normalizeTitle(title);
      return {
        title,
        summary,
        title_translations: {
          en: titleTranslations.en || title,
          ja: titleTranslations.ja || title,
          zh: titleTranslations.zh || title,
        },
        summary_translations: {
          en: summaryTranslations.en || summary,
          ja: summaryTranslations.ja || summary,
          zh: summaryTranslations.zh || summary,
        },
        title_normalized: normalized,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items: cleaned });
}
