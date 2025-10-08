import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { ALIGNMENT_LEVEL_REQUIREMENT_COUNTS, ALIGNMENT_WRITING_WORD_RANGES } from '@/lib/alignment/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYS_PROMPT = `You are an instructional designer building alignment-writing tasks.
Return STRICT JSON only, matching schema.`;

const TASK_LABEL: Record<string, string> = {
  dialogue: '对话任务',
  article: '文章写作',
  task_email: '任务邮件',
  long_writing: '长写作',
};

function buildPrompt({
  themeTitle,
  themeSummary,
  subtopicTitle,
  subtopicOneLine,
  objectives,
  lang,
  level,
  genre,
  taskType,
  requirementsMin,
  requirementsMax,
}: {
  themeTitle: string;
  themeSummary: string;
  subtopicTitle: string;
  subtopicOneLine: string;
  objectives: string[];
  lang: string;
  level: number;
  genre: string;
  taskType: string;
  requirementsMin: number;
  requirementsMax: number;
}) {
  const langLabel =
    lang === 'en' ? 'English' : lang === 'ja' ? 'Japanese' : 'Simplified Chinese';
  const taskLabel = TASK_LABEL[taskType] || taskType;
  const objectiveText = objectives.length ? objectives.map((o, i) => `${i + 1}. ${o}`).join('\n') : 'N/A';
  const wordRange = ALIGNMENT_WRITING_WORD_RANGES[level as 1 | 2 | 3 | 4 | 5 | 6]?.[
    taskType as 'article' | 'task_email' | 'long_writing'
  ];
  const wordLine =
    taskType === 'dialogue'
      ? 'For dialogue tasks, provide role guidance (two speakers) and expected turn count (8-12 turns).'
      : wordRange
        ? `Target word count range: ${wordRange[0]}-${wordRange[1]} words.`
        : 'Provide an appropriate length target.';

  return `
LANGUAGE=${langLabel}
LEVEL=L${level}
THEME="${themeTitle}"
THEME_SUMMARY="${themeSummary}"
SUBTOPIC="${subtopicTitle}"
SUBTOPIC_SUMMARY="${subtopicOneLine}"
OBJECTIVES:
${objectiveText}
TASK_TYPE=${taskLabel}
GENRE=${genre}
REQUIREMENT_COUNT=${requirementsMin}-${requirementsMax}

Design a comprehensive alignment ${taskLabel} package that helps learners study exemplar content, review knowledge points, then perform the task. Requirements:
- task_prompt: instruction for learner in ${langLabel}.
- exemplar: high-quality model response in ${langLabel}.
- knowledge_points: include grammar, vocabulary, phrases, culture (each 2-4 items) with explanation and examples; examples should have source sentence and translation.
- requirements: ${requirementsMin}-${requirementsMax} bullet requirements labeled succinctly; include translation fields for en/ja/zh.
- standard_answer: polished reference answer in ${langLabel} that satisfies all requirements.
- standard_answer_translations: provide literal translations for en/ja/zh (may reuse exemplar for en if LANG is English).
- core_sentences: list 3-6 sentences from standard answer that best demonstrate requirement completion.
- rubric: provide dimensions (fluency, relevance, language, structure, length) each with description and optional weight (0-1).
- dialogue_meta (if task_type=dialogue): include roles (two speakers), expected_turns, max_turns, strategy tips.
- writing_meta (if non-dialogue): include word_range and notes.
- ai_metadata: include "modeling_notes" summarizing style and difficulty.

Return JSON **only** with the exact schema:
{
  "task_prompt": "...",
  "task_prompt_translations": { "en": "...", "ja": "...", "zh": "..." },
  "exemplar": "...",
  "exemplar_translations": { "en": "...", "ja": "...", "zh": "..." },
  "knowledge_points": {
    "grammar": [{ "label": "...", "explanation": "...", "examples": [{ "source": "...", "translation": "..." }] }],
    "vocabulary": [...],
    "phrases": [...],
    "culture": [...]
  },
  "requirements": [
    { "label": "...", "translations": { "en": "...", "ja": "...", "zh": "..." } }
  ],
  "standard_answer": "...",
  "standard_answer_translations": { "en": "...", "ja": "...", "zh": "..." },
  "core_sentences": ["..."],
  "rubric": {
    "fluency": { "label": "Fluency", "description": "...", "weight": 0.2, "translations": { "ja": "...", "zh": "..." } },
    "relevance": { ... },
    "language": { ... },
    "structure": { ... },
    "length": { ... }
  },
  "dialogue_meta": {
    "roles": [{ "name": "Learner", "description": "...", "translations": { "ja": "...", "zh": "..." } }],
    "expected_turns": 10,
    "max_turns": 12,
    "notes": "...",
    "strategy": "..."
  },
  "writing_meta": {
    "word_range": [min,max],
    "style": "...",
    "tone": "...",
    "notes": "..."
  },
  "ai_metadata": { "modeling_notes": "...", "keywords": ["..."] }
}

Ensure JSON is valid, double quoted keys, no trailing comments.
`.trim();
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === 'unauthorized' ? 401 : 403 });
  }
  const supabase = auth.supabase;
  const body = await req.json();
  const subtopic_id: string = body.subtopic_id;
  const task_type: string = body.task_type || 'article';
  const temperature: number = typeof body.temperature === 'number' ? body.temperature : 0.75;

  if (!subtopic_id) {
    return NextResponse.json({ error: '缺少 subtopic_id' }, { status: 400 });
  }

  const { data: subtopic, error: subtopicError } = await supabase
    .from('alignment_subtopics')
    .select('*, theme:alignment_themes(*)')
    .eq('id', subtopic_id)
    .single();

  if (subtopicError || !subtopic) {
    return NextResponse.json({ error: '小主题不存在' }, { status: 404 });
  }

  const { theme } = subtopic as typeof subtopic & { theme: any };
  if (!theme) {
    return NextResponse.json({ error: '小主题缺少关联主题' }, { status: 400 });
  }

  const [minReq, maxReq] = ALIGNMENT_LEVEL_REQUIREMENT_COUNTS[subtopic.level as 1 | 2 | 3 | 4 | 5 | 6] || [3, 5];

  const prompt = buildPrompt({
    themeTitle: theme.title,
    themeSummary: theme.summary || '',
    subtopicTitle: subtopic.title,
    subtopicOneLine: subtopic.one_line || '',
    objectives: (subtopic.objectives || []).map((obj: any) => obj.label || obj.title || ''),
    lang: subtopic.lang,
    level: subtopic.level,
    genre: subtopic.genre,
    taskType: task_type,
    requirementsMin: minReq,
    requirementsMax: maxReq,
  });

  const { content } = await chatJSON({
    provider: 'deepseek',
    model: body.model || 'deepseek-chat',
    temperature,
    response_json: true,
    timeoutMs: 120000,
    messages: [
      { role: 'system', content: SYS_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error('alignment material generation JSON parse failed', { content, error });
    return NextResponse.json({ error: 'LLM 返回的 JSON 无法解析' }, { status: 400 });
  }

  return NextResponse.json({
    item: parsed,
    meta: {
      subtopic,
      theme,
    },
  });
}
