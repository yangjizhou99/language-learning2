export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { normUsage } from '@/lib/ai/usage';

function sysPrompt() {
  return `You are a JSON-only assistant that provides textual hints for manual annotation.
Return **valid JSON only** (no extra text). Do NOT include character indices. Keep lists concise and high-quality.`;
}

function userPrompt(text: string, lang: 'en' | 'ja' | 'zh') {
  if (lang === 'en')
    return `
LANG=en

TASK: Provide **textual suggestions only** for a language-learning annotator.
1) pass1_suggestions.connectives: discourse connectives (e.g., however, therefore, although, because, while, since, moreover, in contrast).
2) pass1_suggestions.time: time expressions (years, months, weekdays, "in/at/on + time", "X years later", etc.).
3) pass2_pairs: pronoun → antecedent hints **within the same sentence**. Pronouns to consider: he, she, they, it, him, her, them, his, her, their, this/that/these/those. Each item: {"pronoun":"...", "antecedent_hint":"..."} (use short noun phrases).
4) triples_text: simple S–V–O or S–BE–C descriptions as short strings, one per sentence at most (e.g., "Company A — acquired — Startup B").
5) cloze_candidates: frequent collocations or multiword units and connectives as {"phrase":"...", "hint":"collocation|connective"}; avoid stopwords; ≤1 per sentence on average.

OUTPUT JSON schema:
{
  "pass1_suggestions": { "connectives": ["..."], "time": ["..."] },
  "pass2_pairs": [ { "pronoun": "...", "antecedent_hint": "..." } ],
  "triples_text": [ "S — V — O: ...", "S — BE — C: ..." ],
  "cloze_candidates": [ { "phrase": "...", "hint": "collocation|connective" } ]
}

TEXT<<<
${text}
>>>`;
  if (lang === 'ja')
    return `
LANG=ja

目的: 文字のみの参考意見（索引は不要）。管理者が手動でアノテーションします。
1) pass1_suggestions.connectives: 接続表現（しかし、つまり、そのため、一方で、さらに、ところが など）。
2) pass1_suggestions.time: 時間表現（YYYY年、昨日、今朝、午後、3ヶ月後 等）。
3) pass2_pairs: 同一句内の照応ヒント {"pronoun":"これ/それ/彼/彼女/同社 など","antecedent_hint":"名詞句の短いヒント"}。ゼロ代名詞は扱わない。
4) triples_text: 文内の S–V–O（助詞を手掛かりに）を短い文字列で（例「A社 — 発表する — 新製品」）。各文最大1件。
5) cloze_candidates: 慣用連語・接続表現 {"phrase":"...", "hint":"collocation|connective"}。助詞単独は避ける。

出力 JSON:
{
  "pass1_suggestions": { "connectives": ["..."], "time": ["..."] },
  "pass2_pairs": [ { "pronoun": "...", "antecedent_hint": "..." } ],
  "triples_text": [ "S — V — O: ..." ],
  "cloze_candidates": [ { "phrase": "...", "hint": "collocation|connective" } ]
}

TEXT<<<
${text}
>>>`;
  // zh
  return `
LANG=zh

目标：只给**文字建议**，不返回索引。管理员将据此手工标注。
1) pass1_suggestions.connectives：连接词（然而、因此、不过、同时、此外、尽管、由于、相反、总之 等）。
2) pass1_suggestions.time：时间表达（YYYY年、上/下周、昨天、上午、三天后 等）。
3) pass2_pairs：同句指代提示，每项 {"pronoun":"他/她/它/他们/这些/那/此/其/该 等","antecedent_hint":"精炼名词短语"}，先行词应在代词之前。
4) triples_text：用短句写出 S–V–O/“是/为/成为...”式三元组（例：“研究团队 — 发布 — 新模型”），每句最多 1 条。
5) cloze_candidates：高频搭配/固定短语与连接词 {"phrase":"...", "hint":"collocation|connective"}，避免把“的/了/地/得/把/被/在/是”等功能词作为短语。

输出 JSON：
{
  "pass1_suggestions": { "connectives": ["..."], "time": ["..."] },
  "pass2_pairs": [ { "pronoun": "...", "antecedent_hint": "..." } ],
  "triples_text": [ "S — V — O: ..." ],
  "cloze_candidates": [ { "phrase": "...", "hint": "collocation|connective" } ]
}

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
  const provider = (body.provider || 'deepseek') as 'openrouter' | 'deepseek' | 'openai';
  const model = body.model || 'deepseek-chat';
  const temperature = body.temperature ?? 0.3;

  const lang = (d.lang as 'en' | 'ja' | 'zh') || 'en';
  const text: string = d.text;

  const { content, usage } = await chatJSON({
    provider,
    model,
    temperature,
    response_json: true,
    messages: [
      { role: 'system', content: sysPrompt() },
      { role: 'user', content: userPrompt(text, lang) },
    ],
  });

  let suggestions: any;
  try {
    suggestions = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'LLM 未返回 JSON' }, { status: 400 });
  }
  const u = normUsage(usage);

  await supabase
    .from('article_drafts')
    .update({
      ai_text_provider: provider,
      ai_text_model: model,
      ai_text_usage: u,
      ai_text_suggestion: suggestions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({ ok: true, suggestions, usage: u });
}
