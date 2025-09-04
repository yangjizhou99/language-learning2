export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { chatJSON } from '@/lib/ai/client';
import { normUsage } from '@/lib/ai/usage';

const SYS = `You are an expert language teacher. Judge if each filled blank is contextually appropriate for the passage. Return VALID JSON only.`;

function normalizeBlanks(blanksRaw: any[]): { id: number; reference: string }[] {
  return (Array.isArray(blanksRaw) ? blanksRaw : []).map((b: any, idx: number) => {
    let id: number | null = null;
    if (typeof b?.id === 'number') id = b.id;
    if (id === null && typeof b?.placeholder === 'string') {
      const m = b.placeholder.match(/\{\{(\d+)\}\}/);
      if (m) id = Number(m[1]);
    }
    if (id === null) id = idx + 1;
    return { id, reference: String(b?.answer || '') };
  }).sort((a, b) => a.id - b.id);
}

function buildScoringPrompt(item: any, answers: Record<string, string>) {
  const blanks = normalizeBlanks(item.blanks);

  return `LANGUAGE: ${item.lang.toUpperCase()}
LEVEL: ${item.level}

CLOZE ITEM:
Title: ${item.title}
Passage: ${item.passage}

FILLED ANSWERS:
${blanks.map((b: any) => `Blank ${b.id}: "${answers[b.id] || ''}"`).join('\n')}

REFERENCE ANSWERS (single per blank, for reference only):
${blanks.map((b: any) => `Blank ${b.id}: "${b.reference}"`).join('\n')}

TASK: For each blank, judge if the learner's answer is contextually appropriate. Use 1.0 (appropriate), 0.5 (partially ok), 0.0 (inappropriate). Provide a brief reason for each.

Return JSON:
{
  "per_blank": [ { "id": 1, "score": 1.0, "reason": "..." } ],
  "overall": { "score": 0.75, "feedback": "...", "strengths": ["..."], "improvements": ["..."] }
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { itemId, answers, provider = 'deepseek', model: requestedModel } = await req.json();
    
    if (!itemId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabaseUser: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>;
    if (hasBearer) {
      supabaseUser = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      supabaseUser = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }

    const { data: { user } } = await (supabaseUser as any).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取题目详情
    const { data: item, error: itemError } = await (supabaseUser as any)
      .from('cloze_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 选择模型（前端优先，其次默认）
    let model = requestedModel as string | undefined;
    if (!model) {
      if (provider === 'openrouter') model = 'anthropic/claude-3.5-sonnet';
      else if (provider === 'openai') model = 'gpt-4o';
      else model = 'deepseek-chat';
    }

    // AI 评分
    const prompt = buildScoringPrompt(item, answers);
    const result = await chatJSON({
      provider: provider as 'deepseek'|'openrouter'|'openai',
      model: model!,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_json: true
    });

    if (!result.content) {
      return NextResponse.json({ error: 'Failed to score answers' }, { status: 500 });
    }

    // 解析 JSON 内容
    let aiResult;
    try {
      aiResult = JSON.parse(result.content);
    } catch (error) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // 保存作答记录
    const supabaseAdmin = getServiceSupabase();
    const { data: attempt, error: saveError } = await supabaseAdmin
      .from('cloze_attempts')
      .insert({
        user_id: user.id,
        item_id: itemId,
        lang: item.lang,
        level: item.level,
        answers,
        ai_result: aiResult
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save attempt error:', saveError);
      return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      result: aiResult,
      attemptId: attempt.id,
      usage: result.usage
    });

  } catch (error) {
    console.error('Score cloze error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
