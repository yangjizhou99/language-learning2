import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { chatJSON } from '@/lib/ai/client';
import { normUsage } from '@/lib/ai/usage';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import type { AlignmentDialogueSpeaker } from '@/lib/alignment/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type TurnMessage = {
  speaker: AlignmentDialogueSpeaker;
  text: string;
};

const SYSTEM_PROMPT = `You are the AI partner in a language learning roleplay.
Stay in character, speak only in the target language, and keep replies natural and concise (1-3 sentences unless scenario requires more).
Return STRICT JSON only.`;

async function getAuthSupabase(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (/^Bearer\s+/i.test(authHeader)) {
    return createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

function labelLanguage(lang: string) {
  if (lang === 'en') return 'English';
  if (lang === 'ja') return 'Japanese';
  if (lang === 'zh') return 'Simplified Chinese';
  return lang;
}

function serialiseHistory(history: TurnMessage[]) {
  return history
    .slice(-12)
    .map((turn) => `${turn.speaker === 'user' ? 'LEARNER' : 'AI'}: ${turn.text}`)
    .join('\n');
}

function buildPrompt({
  lang,
  level,
  scenario,
  standardDialogue,
  knowledgePoints,
  objectives,
  requirements,
  history,
  kickoffSpeaker,
}: {
  lang: string;
  level: number;
  scenario: any;
  standardDialogue: any;
  knowledgePoints: { words: any[]; sentences: any[] };
  objectives: string[];
  requirements: string[];
  history: TurnMessage[];
  kickoffSpeaker: AlignmentDialogueSpeaker;
}) {
  const langLabel = labelLanguage(lang);
  const historyText = serialiseHistory(history) || 'NONE';
  const latestUserMsg =
    [...history].reverse().find((turn) => turn.speaker === 'user')?.text || '';
  const isKickoff = history.length === 0;

  const wordLines = knowledgePoints.words
    .map((item: any) => `- ${item.term ?? ''}`)
    .join('\n');
  const sentenceLines = knowledgePoints.sentences
    .map((item: any) => `- ${item.sentence ?? ''}`)
    .join('\n');
  const objectivesLines = objectives.map((label, idx) => `${idx + 1}. ${label}`).join('\n') || 'N/A';
  const requirementsLine = requirements.map((label, idx) => `${idx + 1}. ${label}`).join('\n') || 'N/A';
  const referenceDialogue =
    Array.isArray(standardDialogue?.turns) && standardDialogue.turns.length
      ? standardDialogue.turns
          .slice(0, 12)
          .map(
            (turn: any, idx: number) =>
              `${idx + 1}. ${turn.speaker === 'ai' ? 'AI' : 'Learner'}: ${turn.text}`,
          )
          .join('\n')
      : 'N/A';

  const kickoffLine = isKickoff
    ? `KICKOFF: No conversation yet. ${kickoffSpeaker === 'ai' ? 'You speak first.' : 'Wait for learner input.'}`
    : '';

  const responseInstruction =
    kickoffSpeaker === 'ai' && isKickoff
      ? 'Start the dialogue with a friendly opener (1-2 sentences) that fits the scenario.'
      : 'Respond to the learner. Avoid repeating their message and end with a question if conversation should continue.';

  return `
TARGET_LANGUAGE=${langLabel}
LEVEL=L${level}
${kickoffLine}
SCENARIO_SUMMARY=${scenario?.summary ?? ''}
LEARNER_ROLE=${scenario?.user_role?.name ?? ''}: ${scenario?.user_role?.description ?? ''}
AI_ROLE=${scenario?.ai_role?.name ?? ''}: ${scenario?.ai_role?.description ?? ''}
OBJECTIVES:
${objectivesLines}
REQUIREMENTS:
${requirementsLine}
KEY_WORDS:
${wordLines || 'N/A'}
KEY_SENTENCES:
${sentenceLines || 'N/A'}
REFERENCE_STANDARD_DIALOGUE:
${referenceDialogue}

CONVERSATION_HISTORY (oldest -> newest):
${historyText}

LATEST_LEARNER_MESSAGE:
${latestUserMsg || '(none)'}

TASK:
${responseInstruction}
- Correct the learner's latest message only when there are clear grammar or word choice errors; provide the corrected sentence(s) without explanations.
- Track objective completion using the entire history. When an objective becomes completed for the first time this turn, flag it with evidence text (key sentence).
- If no corrections are needed, return an empty array.

Return JSON ONLY with this shape:
{
  "reply": STRING,                               // your next message, in ${langLabel}
  "corrections": [                               // optional corrections for learner
    { "original": STRING, "corrected": STRING }
  ],
  "objectives": [                                // status for each objective (1-based index)
    { "index": NUMBER, "label": STRING, "met": BOOLEAN, "evidence": STRING }
  ],
  "newly_completed": [NUMBER]                    // subset of indexes that became met this turn
}
Ensure arrays exist even if empty.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      material_id,
      history: rawHistory = [],
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.3,
    } = body as {
      material_id: string;
      history?: TurnMessage[];
      provider?: string;
      model?: string;
      temperature?: number;
    };

    if (!material_id) {
      return NextResponse.json({ error: 'missing material_id' }, { status: 400 });
    }

    const supabaseAuth = await getAuthSupabase(req);
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getServiceSupabase();
    const { data: material, error: materialError } = await supabaseAdmin
      .from('alignment_materials')
      .select(
        `
        id,
        lang,
        task_type,
        status,
        review_status,
        practice_scenario,
        standard_dialogue,
        knowledge_points,
        requirements,
        subtopic:alignment_subtopics!alignment_materials_subtopic_fkey(
          id,
          title,
          level,
          objectives
        )
      `,
      )
      .eq('id', material_id)
      .single();

    if (materialError || !material) {
      return NextResponse.json({ error: 'material not found' }, { status: 404 });
    }
    if (material.status !== 'active' || material.review_status !== 'approved') {
      return NextResponse.json({ error: 'material not available' }, { status: 403 });
    }

    const scenario = material.practice_scenario || {};
    const kickoffSpeaker: AlignmentDialogueSpeaker =
      scenario?.kickoff_speaker === 'user' ? 'user' : 'ai';

    const history: TurnMessage[] = Array.isArray(rawHistory)
      ? rawHistory
          .filter(
            (turn) =>
              turn &&
              (turn.speaker === 'user' || turn.speaker === 'ai') &&
              typeof turn.text === 'string',
          )
          .map((turn) => ({ speaker: turn.speaker, text: turn.text.trim() }))
      : [];

    if (history.length === 0 && kickoffSpeaker === 'user') {
      return NextResponse.json({
        ok: true,
        wait_for_user: true,
        objectives: [],
        corrections: [],
        reply: '',
        newly_completed: [],
      });
    }

    const knowledgePoints = {
      words: Array.isArray(material.knowledge_points?.words)
        ? material.knowledge_points.words
        : [],
      sentences: Array.isArray(material.knowledge_points?.sentences)
        ? material.knowledge_points.sentences
        : [],
    };

    const scenarioObjectives = Array.isArray(scenario?.objectives)
      ? scenario.objectives.map((obj: any) => obj.label || '').filter(Boolean)
      : [];
    const fallbackObjectives = Array.isArray(material.subtopic?.objectives)
      ? material.subtopic.objectives.map((obj: any) => obj.label || obj.title || '').filter(Boolean)
      : [];
    const objectives = scenarioObjectives.length ? scenarioObjectives : fallbackObjectives;

    const requirements = Array.isArray(material.requirements)
      ? material.requirements.map((req: any) => req.label || '').filter(Boolean)
      : [];

    const prompt = buildPrompt({
      lang: material.lang,
      level: material.subtopic?.level || 0,
      scenario,
      standardDialogue: material.standard_dialogue || {},
      knowledgePoints,
      objectives,
      requirements,
      history,
      kickoffSpeaker,
    });

    const { content, usage } = await chatJSON({
      provider,
      model,
      temperature,
      response_json: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      userId: user.id,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error('roleplay turn JSON parse failed', { content, error });
      return NextResponse.json({ error: 'LLM 返回的 JSON 无法解析' }, { status: 400 });
    }

    const reply = typeof parsed.reply === 'string' ? parsed.reply : '';
    const corrections = Array.isArray(parsed.corrections)
      ? parsed.corrections
          .filter(
            (item: any) =>
              item &&
              typeof item.original === 'string' &&
              typeof item.corrected === 'string' &&
              item.original.trim() &&
              item.corrected.trim(),
          )
          .map((item: any) => ({
            original: item.original,
            corrected: item.corrected,
          }))
      : [];

    const objectivesState = Array.isArray(parsed.objectives)
      ? parsed.objectives
          .filter(
            (item: any) =>
              item && typeof item.index === 'number' && typeof item.label === 'string',
          )
          .map((item: any) => ({
            index: item.index,
            label: item.label,
            met: Boolean(item.met),
            evidence: typeof item.evidence === 'string' ? item.evidence : '',
          }))
      : objectives.map((label, idx) => ({
          index: idx + 1,
          label,
          met: false,
          evidence: '',
        }));

    const newlyCompleted = Array.isArray(parsed.newly_completed)
      ? parsed.newly_completed.filter((n: any) => Number.isInteger(n))
      : [];

    return NextResponse.json({
      ok: true,
      reply,
      corrections,
      objectives: objectivesState,
      newly_completed: newlyCompleted,
      usage: normUsage(usage),
    });
  } catch (error) {
    console.error('roleplay turn error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal error' },
      { status: 500 },
    );
  }
}
