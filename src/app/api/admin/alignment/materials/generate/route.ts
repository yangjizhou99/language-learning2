import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { ALIGNMENT_LEVEL_REQUIREMENT_COUNTS, ALIGNMENT_WRITING_WORD_RANGES } from '@/lib/alignment/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGE_ONE_SYS = `You are an instructional designer creating scaffolded alignment practice materials.
Produce STRICT JSON that matches the requested schema. Focus on actionable objectives, clear language, and reusable knowledge supports.`;

const STAGE_TWO_SYS = `You are a roleplay scenario designer for language learners.
Given the learning objectives and exemplar, craft a concise practice scenario and standard answer dialogue (when applicable).
Respond with STRICT JSON and no commentary.`;

const TASK_LABEL: Record<string, string> = {
  dialogue: '对话任务',
  article: '文章写作',
  task_email: '任务邮件',
  long_writing: '长写作',
};

function languageLabel(lang: string) {
  if (lang === 'en') return 'English';
  if (lang === 'ja') return 'Japanese';
  if (lang === 'zh') return 'Simplified Chinese';
  return lang;
}

function buildStageOnePrompt({
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
  const langLabel = languageLabel(lang);
  const taskLabel = TASK_LABEL[taskType] || taskType;
  const objectiveText = objectives.length
    ? objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')
    : 'N/A';
  const wordRange =
    taskType === 'dialogue'
      ? null
      : ALIGNMENT_WRITING_WORD_RANGES[level as 1 | 2 | 3 | 4 | 5 | 6]?.[
          taskType as 'article' | 'task_email' | 'long_writing'
        ] || null;

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
${wordRange ? `TARGET_WORD_RANGE=${wordRange[0]}-${wordRange[1]} words` : ''}

Stage 1 Goals:
- Produce a motivating task prompt in ${langLabel} that references the scenario naturally.
- Provide a complete exemplar that satisfies all objectives.
- Extract essential vocabulary (words) and model sentences learners must master to reach the objectives. Each entry should only include the base-language expression; leave translations empty for now.
- Draft ${requirementsMin === requirementsMax ? requirementsMin : `${requirementsMin}-${requirementsMax}`} concise requirements aligned to the objectives（仅给出目标语言文本，翻译稍后生成）.
- Provide 3-6 core sentences that best evidence requirement completion.
- Build a rubric covering fluency, relevance, language, structure, length (or dialog adequacy) with optional weights.
- Include dialogue_meta for dialogue tasks (roles, expected_turns 8-12, max_turns, strategy). For writing tasks include writing_meta (word_range, style, tone).
- ai_metadata should summarise modelling choices and keywords.

Return JSON ONLY:
{
  "task_prompt": "...",
  "task_prompt_translations": {},
  "exemplar": "...",
  "exemplar_translations": {},
  "knowledge_points": {
    "words": [
      {
        "term": "...",
        "translations": {}
      }
    ],
    "sentences": [
      {
        "sentence": "...",
        "translations": {}
      }
    ]
  },
  "requirements": [
    { "label": "...", "translations": {} }
  ],
  "core_sentences": ["..."],
  "rubric": {
    "fluency": { "label": "...", "description": "...", "weight": 0.2 },
    "relevance": { ... },
    "language": { ... },
    "structure": { ... },
    "length": { ... }
  },
  "dialogue_meta": {
    "roles": [{ "name": "...", "description": "...", "translations": {} }],
    "expected_turns": 10,
    "max_turns": 12,
    "notes": "...",
    "strategy": "...",
    "keywords": ["..."]
  },
  "writing_meta": {
    "word_range": [${wordRange ? `${wordRange[0]}, ${wordRange[1]}` : 'min,max'}],
    "style": "...",
    "tone": "...",
    "notes": "..."
  },
  "ai_metadata": { "modeling_notes": "...", "keywords": ["..."] }
}

Ensure arrays exist even when empty (words/sentences), keys are double quoted, and no comments.`;
}

function buildStageTwoPrompt({
  lang,
  level,
  taskType,
  objectives,
  exemplar,
  requirements,
  themeTitle,
  subtopicTitle,
}: {
  lang: string;
  level: number;
  taskType: string;
  objectives: string[];
  exemplar: string;
  requirements: Array<{ label: string; translations?: Record<string, string> }>;
  themeTitle: string;
  subtopicTitle: string;
}) {
  const langLabel = languageLabel(lang);
  const objectiveLines = objectives.length
    ? objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')
    : 'N/A';
  const requirementLines = requirements.length
    ? requirements.map((r, i) => `${i + 1}. ${r.label}`).join('\n')
    : 'N/A';

  return `
LANGUAGE=${langLabel}
LEVEL=L${level}
THEME="${themeTitle}"
SUBTOPIC="${subtopicTitle}"
OBJECTIVES:
${objectiveLines}
REQUIREMENTS:
${requirementLines}

Stage 2 Goals:
- Craft a fresh scenario summary (learner-facing) that sets the stage for practising the objectives.
- Define clear roles for the learner (user) and AI partner, including names and descriptions in ${langLabel}; add translations when helpful.
- Decide who should speak first ("user" or "ai") so the conversation flows naturally according to the exemplar.
- Provide a short list of objectives (reuse above wording as needed) for the scenario section.
- Offer optional context notes if additional framing is needed.

If TASK_TYPE=${taskType.toUpperCase()} is dialogue:
- Produce a STANDARD dialogue answer showing a successful completion. Use alternating turns labelled "user" or "ai".
- Each turn must stay in ${langLabel} with translations for en/ja/zh when that aids understanding.
- Reference objectives with 1-based indices via "objective_refs".
- Keep dialogue concise (8-12 turns total) and natural.

If TASK_TYPE is not dialogue:
- Still provide the practice_scenario.
- Return an empty turns array for standard_dialogue.

Return JSON ONLY:
{
  "practice_scenario": {
    "summary": "...",
    "summary_translations": {},
    "user_role": { "name": "...", "description": "...", "translations": {} },
    "ai_role": { "name": "...", "description": "...", "translations": {} },
    "kickoff_speaker": "user"|"ai",
    "objectives": [
      { "label": "...", "translations": {} }
    ],
    "context_notes": "...",
    "context_notes_translations": {}
  },
  "standard_dialogue": {
    "summary": "...",
    "summary_translations": {},
    "turns": [
      { "speaker": "user", "text": "...", "translations": {}, "objective_refs": [1] }
    ]
  }
}

Ensure arrays exist even if empty.`;
}

type GenerateStep = 'stage1' | 'stage2' | 'all';

function normalizeStageOnePayload(payload: any) {
  if (!payload) return null;
  const knowledge = payload.knowledge_points || {};
  const normalizedRequirements = Array.isArray(payload.requirements)
    ? payload.requirements.map((req: any) => ({
        label: req?.label || '',
        translations: req?.translations || {},
      }))
    : [];
  return {
    ...payload,
    task_prompt_translations: payload.task_prompt_translations || {},
    exemplar_translations: payload.exemplar_translations || {},
    knowledge_points: {
      words: Array.isArray(knowledge.words)
        ? knowledge.words.map((item: any) => ({
            term: item?.term || '',
            translations: item?.translations || {},
          }))
        : [],
      sentences: Array.isArray(knowledge.sentences)
        ? knowledge.sentences.map((item: any) => ({
            sentence: item?.sentence || '',
            translations: item?.translations || {},
          }))
        : [],
    },
    requirements: normalizedRequirements,
    standard_answer: typeof payload.standard_answer === 'string' ? payload.standard_answer : '',
    standard_answer_translations: payload.standard_answer_translations || {},
    core_sentences: Array.isArray(payload.core_sentences) ? payload.core_sentences : [],
    rubric: payload.rubric || {},
    dialogue_meta: payload.dialogue_meta || {},
    writing_meta: payload.writing_meta || {},
    ai_metadata: payload.ai_metadata || {},
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === 'unauthorized' ? 401 : 403 },
    );
  }

  const supabase = auth.supabase;
  const body = await req.json();
  const subtopic_id: string = body.subtopic_id;
  const task_type: string = body.task_type || 'article';
  const stepRaw = typeof body.step === 'string' ? body.step.toLowerCase() : 'all';
  const step: GenerateStep =
    stepRaw === 'stage1' || stepRaw === 'stage2' ? (stepRaw as GenerateStep) : 'all';
  const temperature: number = typeof body.temperature === 'number' ? body.temperature : 0.75;
  const model: string = body.model || 'deepseek-chat';

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

  const objectives = (subtopic.objectives || []).map((obj: any) => obj.label || obj.title || '');
  const [minReq, maxReq] =
    ALIGNMENT_LEVEL_REQUIREMENT_COUNTS[subtopic.level as 1 | 2 | 3 | 4 | 5 | 6] || [3, 5];

  let stageOnePayload = null;
  if (step === 'stage2') {
    stageOnePayload = normalizeStageOnePayload(body.base_payload);
    if (!stageOnePayload) {
      return NextResponse.json({ error: '缺少步骤一的基础数据' }, { status: 400 });
    }
  } else {
    const stageOnePrompt = buildStageOnePrompt({
      themeTitle: theme.title,
      themeSummary: theme.summary || '',
      subtopicTitle: subtopic.title,
      subtopicOneLine: subtopic.one_line || '',
      objectives,
      lang: subtopic.lang,
      level: subtopic.level,
      genre: subtopic.genre,
      taskType: task_type,
      requirementsMin: minReq,
      requirementsMax: maxReq,
    });

    let stageOneResult;
    try {
      stageOneResult = await chatJSON({
        provider: 'deepseek',
        model,
        temperature,
        response_json: true,
        timeoutMs: 120000,
        messages: [
          { role: 'system', content: STAGE_ONE_SYS },
          { role: 'user', content: stageOnePrompt },
        ],
      });
    } catch (error) {
      console.error('alignment material stage1 chat failed', error);
      return NextResponse.json(
        { error: 'AI 生成范文与知识点失败，请稍后重试' },
        { status: 502 },
      );
    }

    try {
      stageOnePayload = normalizeStageOnePayload(JSON.parse(stageOneResult.content));
    } catch (error) {
      console.error('alignment material stage1 JSON parse failed', {
        content: stageOneResult.content,
        error,
      });
      return NextResponse.json({ error: 'LLM 返回的 Stage1 JSON 无法解析' }, { status: 400 });
    }

    if (step === 'stage1') {
      return NextResponse.json({ stage: 'stage1', data: stageOnePayload });
    }
  }

  const stageTwoPrompt = buildStageTwoPrompt({
    lang: subtopic.lang,
    level: subtopic.level,
    taskType: task_type,
    objectives,
    exemplar: stageOnePayload.exemplar || '',
    requirements: Array.isArray(stageOnePayload.requirements) ? stageOnePayload.requirements : [],
    themeTitle: theme.title,
    subtopicTitle: subtopic.title,
  });

  let stageTwoResult;
  try {
    stageTwoResult = await chatJSON({
      provider: 'deepseek',
      model,
      temperature: Math.min(temperature + 0.05, 1),
      response_json: true,
      timeoutMs: 90000,
      messages: [
        { role: 'system', content: STAGE_TWO_SYS },
        {
          role: 'user',
          content: `${stageTwoPrompt}\n\nREFERENCE_EXEMPLAR<<<\n${stageOnePayload.exemplar || ''}\n>>>`,
        },
      ],
    });
  } catch (error) {
    console.error('alignment material stage2 chat failed', error);
    return NextResponse.json(
      { error: 'AI 生成练习场景失败，请稍后重试' },
      { status: 502 },
    );
  }

  let stageTwoPayload: any;
  try {
    stageTwoPayload = JSON.parse(stageTwoResult.content || '{}');
  } catch (error) {
    console.error('alignment material stage2 JSON parse failed', {
      content: stageTwoResult.content,
      error,
    });
    stageTwoPayload = {};
  }

  const practiceScenario = stageTwoPayload.practice_scenario || null;
  const standardDialogue = stageTwoPayload.standard_dialogue || null;

  if (practiceScenario && !Array.isArray(practiceScenario.objectives)) {
    practiceScenario.objectives = objectives.map((label: string) => ({ label, translations: {} }));
  }
  if (standardDialogue && !Array.isArray(standardDialogue.turns)) {
    standardDialogue.turns = [];
  }

  if (step === 'stage2') {
    return NextResponse.json({
      stage: 'stage2',
      data: {
        practice_scenario: practiceScenario,
        standard_dialogue: standardDialogue,
      },
    });
  }

  return NextResponse.json({
    item: {
      ...stageOnePayload,
      practice_scenario: practiceScenario,
      standard_dialogue: standardDialogue,
    },
    meta: {
      subtopic,
      theme,
    },
  });
}
