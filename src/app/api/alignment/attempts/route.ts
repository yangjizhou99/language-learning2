import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { chatJSON } from '@/lib/ai/client';
import { normUsage } from '@/lib/ai/usage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function countWords(text: string) {
  return text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function buildEvaluationPrompt({
  material,
  submission,
  transcript,
}: {
  material: any;
  submission: string;
  transcript?: string | null;
}) {
  const { subtopic } = material;
  const theme = subtopic?.theme;
  const objectives: string[] =
    Array.isArray(subtopic?.objectives) && subtopic.objectives.length
      ? subtopic.objectives.map((obj: any) => obj.label || obj.title || '')
      : [];
  const requirements: string[] = Array.isArray(material.requirements)
    ? material.requirements.map((req: any) => req.label || '')
    : [];

  const knowledge = material.knowledge_points || {};
  const wordList = Array.isArray(knowledge.words)
    ? knowledge.words.map((item: any) => item.term || '').filter(Boolean).join('; ')
    : '';
  const sentenceList = Array.isArray(knowledge.sentences)
    ? knowledge.sentences.map((item: any) => item.sentence || '').filter(Boolean).join('; ')
    : '';
  const knowledgeSummary = [wordList ? `WORDS: ${wordList}` : '', sentenceList ? `SENTENCES: ${sentenceList}` : '']
    .filter(Boolean)
    .join('\n');

  const requirementLines = requirements.map((req, idx) => `${idx + 1}. ${req}`).join('\n');
  const objectiveLines = objectives.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n');

  const userContent = material.task_type === 'dialogue' ? transcript || submission : submission;

  return `
LANGUAGE=${material.lang}
TASK_TYPE=${material.task_type}
LEVEL=L${subtopic?.level || ''}
THEME=${theme?.title || ''}
SUBTOPIC=${subtopic?.title || ''}
SUBTOPIC_SUMMARY=${subtopic?.one_line || ''}
OBJECTIVES:
${objectiveLines || 'N/A'}
REQUIREMENTS (${material.requirements?.length || 0} items):
${requirementLines || 'N/A'}
KNOWLEDGE_POINTS:
${knowledgeSummary || 'N/A'}

REFERENCE_STANDARD_ANSWER:
${material.standard_answer || ''}

LEARNER_SUBMISSION:
${userContent}

评估要点：
- 学习者是否覆盖所有要求，是否达到任务目标
- 是否存在明显的语法或用词错误（只记录真正影响表达的错误）
- 如未完成任务，请说明主要缺失点

返回 STRICT JSON：
{
  "task_completed": true/false,
  "errors": [
    { "type": "grammar|word_choice|content|other", "original": "...", "correction": "..." }
  ],
  "suggestions": ["..."]
}
仅在确有必要时列出错误与建议；当表达自然、无关键错误时，可返回空数组。
`.trim();
}

async function getAuthSupabase(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const hasBearer = /^Bearer\s+/i.test(authHeader);
  if (hasBearer) {
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

export async function GET(req: NextRequest) {
  try {
    const supabaseAuth = await getAuthSupabase(req);
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get('material_id');
    if (!materialId) {
      return NextResponse.json({ error: 'missing material_id' }, { status: 400 });
    }

    const supabaseAdmin = getServiceSupabase();
    const { data, error } = await supabaseAdmin
      .from('alignment_attempts')
      .select('id, attempt_number, score_total, scores, feedback, feedback_json, created_at')
      .eq('user_id', user.id)
      .eq('material_id', materialId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('failed to load attempts', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('alignment attempts GET error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      material_id,
      submission = '',
      transcript = '',
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.2,
    } = body as {
      material_id?: string;
      submission?: string;
      transcript?: string;
      provider?: 'openrouter' | 'deepseek' | 'openai';
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
        *,
        subtopic:alignment_subtopics!alignment_materials_subtopic_fkey(
          id,
          title,
          one_line,
          level,
          objectives,
          theme:alignment_themes (
            id,
            title,
            level,
            genre,
            lang
          )
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

    const isDialogue = material.task_type === 'dialogue';
    const userText = isDialogue ? (transcript || submission).trim() : submission.trim();
    if (!userText) {
      return NextResponse.json(
        { error: isDialogue ? '请先提供对话记录' : '请先输入练习内容' },
        { status: 400 },
      );
    }

    const prompt = buildEvaluationPrompt({
      material,
      submission: userText,
      transcript: isDialogue ? userText : undefined,
    });

    let evaluation: any = null;
    let usage = null;
    try {
      const { content, usage: rawUsage } = await chatJSON({
        provider,
        model,
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        response_json: true,
        messages: [
          {
            role: 'system',
            content:
              'You are a meticulous language tutor. Evaluate the submission and respond with STRICT JSON only.',
          },
          { role: 'user', content: prompt },
        ],
      });
      usage = normUsage(rawUsage);
      evaluation = JSON.parse(content);
    } catch (error) {
      console.error('alignment attempt evaluation failed', error);
      evaluation = null;
    }

    const normalizedErrors: Array<{ type: string; original: string; correction: string }> = Array.isArray(
      evaluation?.errors,
    )
      ? evaluation.errors
          .map((item: any) => ({
            type: item?.type || 'error',
            original: item?.original || '',
            correction: item?.correction || '',
          }))
          .filter((item: { type: string; original: string; correction: string }) => item.original && item.correction)
      : [];
    const normalizedSuggestions: string[] = Array.isArray(evaluation?.suggestions)
      ? evaluation.suggestions
          .filter((s: any) => typeof s === 'string' && s.trim())
          .map((s: string) => s.trim())
      : [];
    const taskCompleted = Boolean(evaluation?.task_completed);
    const overallScore = taskCompleted ? (normalizedErrors.length === 0 ? 100 : 80) : 40;
    const feedbackText = taskCompleted
      ? normalizedErrors.length === 0
        ? '任务完成，表达准确。'
        : '任务完成，但仍有可改进之处。'
      : '任务尚未完成，请继续努力。';

    const evaluationPayload = {
      task_completed: taskCompleted,
      errors: normalizedErrors,
      suggestions: normalizedSuggestions,
      usage,
    };

    const wordCount = isDialogue ? null : countWords(userText);
    const turnCount = isDialogue
      ? userText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean).length
      : null;

    const { data: lastAttempt } = await supabaseAdmin
      .from('alignment_attempts')
      .select('id, attempt_number')
      .eq('user_id', user.id)
      .eq('material_id', material_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const attemptNumber = (lastAttempt?.attempt_number || 0) + 1;

    const insertPayload = {
      user_id: user.id,
      subtopic_id: material.subtopic_id,
      material_id,
      task_type: material.task_type,
      attempt_number: attemptNumber,
      submission: {
        text: submission || '',
        transcript: transcript || '',
      },
      submission_text: userText,
      word_count: wordCount,
      turn_count: turnCount,
      score_total: overallScore,
      scores: { overall: overallScore },
      feedback: feedbackText,
      feedback_json: evaluationPayload,
      ai_model: model,
      ai_response: evaluationPayload,
      duration_seconds: null,
      prev_attempt_id: lastAttempt?.id || null,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('alignment_attempts')
      .insert(insertPayload)
      .select('id, attempt_number, score_total, scores, feedback, feedback_json, created_at')
      .single();

    if (insertError) {
      console.error('failed to insert alignment attempt', insertError);
      return NextResponse.json({ error: '保存失败' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      attempt: inserted,
    });
  } catch (error) {
    console.error('alignment attempts POST error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal error' },
      { status: 500 },
    );
  }
}
