import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { ALIGNMENT_LANGS } from '@/lib/alignment/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function languageLabel(lang: string) {
  if (lang === 'en') return 'English';
  if (lang === 'ja') return 'Japanese';
  if (lang === 'zh') return 'Simplified Chinese';
  return lang;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === 'unauthorized' ? 401 : 403 },
    );
  }
  const body = await req.json();
  const lang = typeof body.lang === 'string' ? body.lang : null;
  const payload = body.payload;
  if (!lang || !payload) {
    return NextResponse.json({ error: '缺少语言或待翻译数据' }, { status: 400 });
  }

  const targetLangs = ALIGNMENT_LANGS.filter((code) => code !== lang);
  if (targetLangs.length === 0) {
    return NextResponse.json({ item: payload });
  }

  const prompt = `
BASE_LANGUAGE=${languageLabel(lang)}
TARGET_LANGUAGES=${targetLangs.join(', ')}

请将以下 JSON 中的文本翻译为 TARGET_LANGUAGES。所有翻译需自然、符合学习语境：
${JSON.stringify(payload, null, 2)}

返回严格 JSON，结构如下（仅填充目标语言，若无法翻译可使用空字符串）：
{
  "task_prompt_translations": { "${targetLangs.join('": "...", "')}" : "..." },
  "exemplar_translations": { "${targetLangs.join('": "...", "')}" : "..." },
  "standard_answer_translations": { "${targetLangs.join('": "...", "')}" : "..." },
  "knowledge_points": {
    "words": [
      { "term": "...", "translations": { "${targetLangs.join('": "...", "')}" : "..." } }
    ],
    "sentences": [
      { "sentence": "...", "translations": { "${targetLangs.join('": "...", "')}" : "..." } }
    ]
  },
  "requirements": [
    { "translations": { "${targetLangs.join('": "...", "')}" : "..." } }
  ],
  "practice_scenario": {
    "summary_translations": { "${targetLangs.join('": "...", "')}" : "..." },
    "user_role": { "translations": { "${targetLangs.join('": "...", "')}" : "..." } },
    "ai_role": { "translations": { "${targetLangs.join('": "...", "')}" : "..." } },
    "context_notes_translations": { "${targetLangs.join('": "...", "')}" : "..." }
  },
  "standard_dialogue": {
    "summary_translations": { "${targetLangs.join('": "...", "')}" : "..." },
    "turns": [
      { "translations": { "${targetLangs.join('": "...", "')}" : "..." } }
    ]
  }
}
`;

  try {
    const { content } = await chatJSON({
      provider: 'deepseek',
      model: body.model || 'deepseek-chat',
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
      response_json: true,
      timeoutMs: 90000,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise translation assistant. Translate the provided text into the requested languages and return STRICT JSON matching the schema.',
        },
        { role: 'user', content: prompt },
      ],
    });

    let data: any;
    try {
      data = JSON.parse(content);
    } catch (error) {
      console.error('alignment translation JSON parse failed', { content, error });
      return NextResponse.json({ error: '翻译结果解析失败' }, { status: 400 });
    }

    const merged = { ...payload };

    const mergeTranslations = (target: Record<string, string>, incoming: Record<string, string>) => {
      for (const code of targetLangs) {
        const value = incoming?.[code];
        if (typeof value === 'string' && value.trim()) {
          target[code] = value.trim();
        }
      }
    };

    merged.task_prompt_translations = payload.task_prompt_translations || {};
    mergeTranslations(merged.task_prompt_translations, data.task_prompt_translations || {});

    merged.exemplar_translations = payload.exemplar_translations || {};
    mergeTranslations(merged.exemplar_translations, data.exemplar_translations || {});

    merged.standard_answer_translations = payload.standard_answer_translations || {};
    mergeTranslations(
      merged.standard_answer_translations,
      data.standard_answer_translations || {},
    );

    merged.knowledge_points = merged.knowledge_points || { words: [], sentences: [] };
    if (Array.isArray(merged.knowledge_points.words)) {
      merged.knowledge_points.words = merged.knowledge_points.words.map(
        (item: any, idx: number) => {
          const incoming = Array.isArray(data?.knowledge_points?.words)
            ? data.knowledge_points.words[idx] || {}
            : {};
          return {
            term: item.term,
            translations: {
              ...(item.translations || {}),
              ...(incoming.translations || {}),
            },
          };
        },
      );
    }
    if (Array.isArray(merged.knowledge_points.sentences)) {
      merged.knowledge_points.sentences = merged.knowledge_points.sentences.map(
        (item: any, idx: number) => {
          const incoming = Array.isArray(data?.knowledge_points?.sentences)
            ? data.knowledge_points.sentences[idx] || {}
            : {};
          return {
            sentence: item.sentence,
            translations: {
              ...(item.translations || {}),
              ...(incoming.translations || {}),
            },
          };
        },
      );
    }

    if (Array.isArray(merged.requirements)) {
      merged.requirements = merged.requirements.map((item: any, idx: number) => {
        const incoming = Array.isArray(data?.requirements) ? data.requirements[idx] || {} : {};
        return {
          label: item.label,
          translations: {
            ...(item.translations || {}),
            ...(incoming.translations || {}),
          },
        };
      });
    }

    if (merged.practice_scenario) {
      merged.practice_scenario.summary_translations =
        merged.practice_scenario.summary_translations || {};
      mergeTranslations(
        merged.practice_scenario.summary_translations,
        data.practice_scenario?.summary_translations || {},
      );
      if (merged.practice_scenario.user_role) {
        merged.practice_scenario.user_role.translations =
          merged.practice_scenario.user_role.translations || {};
        mergeTranslations(
          merged.practice_scenario.user_role.translations,
          data.practice_scenario?.user_role?.translations || {},
        );
      }
      if (merged.practice_scenario.ai_role) {
        merged.practice_scenario.ai_role.translations =
          merged.practice_scenario.ai_role.translations || {};
        mergeTranslations(
          merged.practice_scenario.ai_role.translations,
          data.practice_scenario?.ai_role?.translations || {},
        );
      }
      if (typeof merged.practice_scenario.context_notes === 'string') {
        merged.practice_scenario.context_notes_translations =
          merged.practice_scenario.context_notes_translations || {};
        mergeTranslations(
          merged.practice_scenario.context_notes_translations,
          data.practice_scenario?.context_notes_translations || {},
        );
      }
      if (Array.isArray(merged.practice_scenario.objectives)) {
        merged.practice_scenario.objectives = merged.practice_scenario.objectives.map(
          (obj: any, idx: number) => {
            const incoming = Array.isArray(data?.practice_scenario?.objectives)
              ? data.practice_scenario.objectives[idx] || {}
              : {};
            return {
              label: obj.label,
              translations: {
                ...(obj.translations || {}),
                ...(incoming.translations || {}),
              },
            };
          },
        );
      }
    }

    if (merged.standard_dialogue) {
      merged.standard_dialogue.summary_translations =
        merged.standard_dialogue.summary_translations || {};
      mergeTranslations(
        merged.standard_dialogue.summary_translations,
        data.standard_dialogue?.summary_translations || {},
      );
      if (Array.isArray(merged.standard_dialogue.turns)) {
        merged.standard_dialogue.turns = merged.standard_dialogue.turns.map(
          (turn: any, idx: number) => {
            const incoming = Array.isArray(data?.standard_dialogue?.turns)
              ? data.standard_dialogue.turns[idx] || {}
              : {};
            turn.translations = { ...(turn.translations || {}), ...(incoming.translations || {}) };
            return turn;
          },
        );
      }
    }

    return NextResponse.json({ item: merged });
  } catch (error) {
    console.error('alignment translation request failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '翻译生成失败' },
      { status: 500 },
    );
  }
}
