export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { splitSentencesWithIndex } from '@/lib/nlp/segment';
import { pass1, pass2, pass3, makeCloze } from '@/lib/answerkey/generate';
import { normUsage } from '@/lib/ai/usage';

type Span = [number, number];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function buildKeyPrompt(text: string, lang: 'en' | 'ja' | 'zh') {
  return `You are an NLP annotator for language learning. Given the TEXT below, return JSON with character index spans (0-based, [start,end), JavaScript indexing) that EXACTLY slice TEXT.

Constraints:
- All spans MUST be inside [0, TEXT.length). Use indices only; DO NOT invent tokens.
- Pass2: antecedents MUST be in the same sentence as the pronoun and appear BEFORE it.
- Pass3: s,v,o MUST be in the same sentence, non-overlapping, in order S≤V≤O.
- Keep total counts modest: pass1<=30, pass2<=15, pass3<=15, cloze_short<=10, cloze_long<=20.

Return JSON:
{
 "pass1":[{"span":[s,e],"tag":"connective"|"time"}],
 "pass2":[{"pron":[s,e],"antecedents":[[s,e], ...]}],
 "pass3":[{"s":[s,e],"v":[s,e],"o":[s,e]}],
 "cloze_short":[{"start":s,"end":e,"hint":"...","type":"collocation"}],
 "cloze_long":[{"start":s,"end":e,"hint":"...","type":"collocation"}]
}

LANG=${lang}
TEXT<<<
${text}
>>>`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const supabase = auth.supabase;
  const { id } = await params;
  const { data: d, error } = await supabase
    .from('article_drafts')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !d) return NextResponse.json({ error: 'draft not found' }, { status: 404 });

  const body = await req.json();
  const mode = (body.mode || 'ai') as 'ai' | 'rule';
  const provider = (body.provider || 'deepseek') as 'openrouter' | 'deepseek' | 'openai';
  const model = body.model || 'deepseek-chat';
  const temperature = body.temperature ?? 0.3;

  const text: string = d.text;
  const lang = d.lang as 'en' | 'ja' | 'zh';
  const len = text.length;
  const sents = splitSentencesWithIndex(text, lang);

  let suggest: any = { pass1: [], pass2: [], pass3: [], cloze_short: [], cloze_long: [] };
  let usage: any = {};

  if (mode === 'ai') {
    try {
      const prompt = buildKeyPrompt(text, lang);
      const { content, usage: raw } = await chatJSON({
        provider,
        model,
        temperature,
        response_json: true,
        timeoutMs: 60000,
        messages: [
          { role: 'system', content: 'You are a precise JSON-only annotator.' },
          { role: 'user', content: prompt },
        ],
      });
      usage = normUsage(raw);
      suggest = JSON.parse(content);
    } catch (e: any) {
      const msg = String(e?.message || e || 'LLM 调用失败');
      return NextResponse.json(
        { error: msg.includes('The user aborted a request') ? '调用超时或被取消' : msg },
        { status: 400 },
      );
    }
  } else {
    suggest.pass1 = pass1(text, lang).map((k: any) => ({ span: k.span, tag: k.tag }));
    suggest.pass2 = pass2(text, lang);
    suggest.pass3 = pass3(text, lang);
    suggest.cloze_short = makeCloze(text, lang, 'short');
    suggest.cloze_long = makeCloze(text, lang, 'long');
    usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  }

  function sameSentence(a: Span, b: Span) {
    return sents.some((S) => a[0] >= S.start && b[1] <= S.end);
  }

  const P1 = (suggest.pass1 || [])
    .map((it: any) => {
      const s = clamp(it.span?.[0] ?? 0, 0, len),
        e = clamp(it.span?.[1] ?? 0, 0, len);
      return e > s && (it.tag === 'connective' || it.tag === 'time')
        ? { span: [s, e] as Span, tag: it.tag }
        : null;
    })
    .filter(Boolean);

  const P2 = (suggest.pass2 || [])
    .map((x: any) => {
      const ps = clamp(x.pron?.[0] ?? 0, 0, len),
        pe = clamp(x.pron?.[1] ?? 0, 0, len);
      const pron: Span = [ps, pe];
      if (pe <= ps) return null;
      const ants = (x.antecedents || [])
        .map((a: any) => [clamp(a?.[0] ?? 0, 0, len), clamp(a?.[1] ?? 0, 0, len)] as Span)
        .filter((a: Span) => a[1] > a[0] && a[1] <= pron[0] && sameSentence(a, pron))
        .slice(-3);
      return ants.length ? { pron, antecedents: ants } : null;
    })
    .filter(Boolean);

  const P3 = (suggest.pass3 || [])
    .map((t: any) => {
      const S: Span = [clamp(t.s?.[0] ?? 0, 0, len), clamp(t.s?.[1] ?? 0, 0, len)];
      const V: Span = [clamp(t.v?.[0] ?? 0, 0, len), clamp(t.v?.[1] ?? 0, 0, len)];
      const O: Span = [clamp(t.o?.[0] ?? 0, 0, len), clamp(t.o?.[1] ?? 0, 0, len)];
      const ok =
        S[1] > S[0] &&
        V[1] > V[0] &&
        O[1] > O[0] &&
        S[0] <= V[0] &&
        V[0] <= O[0] &&
        S[1] <= V[0] &&
        V[1] <= O[0] &&
        sents.some((Sent) => S[0] >= Sent.start && O[1] <= Sent.end);
      return ok ? { s: S, v: V, o: O } : null;
    })
    .filter(Boolean);

  function cleanCloze(arr: any[]) {
    const out: any[] = [];
    const bySent = new Map<number, number>();
    for (const it of arr || []) {
      const s = clamp(it.start ?? 0, 0, len),
        e = clamp(it.end ?? 0, 0, len);
      if (e <= s) continue;
      const si = sents.findIndex((S) => s >= S.start && e <= S.end);
      if (si < 0) continue;
      const q = bySent.get(si) || 0;
      if (q >= 1) continue;
      out.push({
        start: s,
        end: e,
        answer: text.slice(s, e),
        hint: it.hint || 'blank',
        type: it.type || 'collocation',
      });
      bySent.set(si, q + 1);
    }
    return out;
  }
  const CzS = cleanCloze(suggest.cloze_short || []);
  const CzL = cleanCloze(suggest.cloze_long || []);

  await supabase
    .from('article_drafts')
    .update({
      ai_answer_provider: mode === 'ai' ? provider : null,
      ai_answer_model: mode === 'ai' ? model : null,
      ai_answer_usage:
        mode === 'ai' ? usage : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({
    ok: true,
    suggestion: { pass1: P1, pass2: P2, pass3: P3, cloze_short: CzS, cloze_long: CzL },
    usage: usage,
  });
}
