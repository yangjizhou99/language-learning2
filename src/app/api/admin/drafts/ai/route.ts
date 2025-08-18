import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";
import { pass1, pass2, pass3, makeCloze } from "@/lib/answerkey/generate";
import { splitSentencesWithIndex } from "@/lib/nlp/segment";
import { inBounds, exact } from "@/lib/answerkey/validate";

export const runtime = "nodejs"; 
export const dynamic = "force-dynamic";

function buildPrompt(b:any) {
  const L = b.lang==="zh"?"简体中文": b.lang==="ja"?"日本語":"English";
  const len = Math.max(150, Math.min(1200, b.words||300));
  const genreMap:any = { news:"新闻报道", science:"科普说明文", essay:"随笔/评论", dialogue:"对话体", literature:"叙事短文" };
  return `
你是语言教学素材生成器。用 ${L} 写一篇 ${genreMap[b.genre]}，面向 L${b.difficulty} 学习者。
${b.topic?`主题：${b.topic}\n`:""}长度：约 ${len} ${b.lang==="en"?"words":"字"}（±20%）。
限制：原创；段落清晰（2–6段）；不要输出任何解释。
仅以 JSON 输出：{"title":"...", "text":"..."}
`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = auth.supabase;

  const b = await req.json();
  const provider = (b.provider || "openrouter") as "openrouter"|"deepseek"|"openai";
  const model = b.model || "openai/gpt-4o-mini"; // 例子：OpenRouter 模型 id
  const temperature = b.temperature ?? 0.6;

  // 1) AI 产草稿
  const prompt = buildPrompt(b);
  const { content, usage } = await chatJSON({ provider, model, temperature, messages:[
    { role:"system", content:"You are a helpful writing assistant." },
    { role:"user", content: prompt }
  ]});
  let parsed; 
  try { 
    parsed = JSON.parse(content); 
  } catch { 
    return NextResponse.json({ error:"LLM 未返回 JSON" }, { status: 400 }); 
  }
  const title = (parsed.title || "Untitled").slice(0,200);
  const text: string = String(parsed.text||"").trim();
  if (text.length < 200) return NextResponse.json({ error:"文本过短" }, { status: 400 });

  // 2) 规则生成答案键 + Cloze，并做校验过滤
  const p1 = pass1(text, b.lang), p2 = pass2(text, b.lang), p3 = pass3(text, b.lang);
  const shortCloze = makeCloze(text, b.lang, "short");
  const longCloze  = makeCloze(text, b.lang, "long");
  const sents = splitSentencesWithIndex(text, b.lang), len = text.length;

  const p1c = p1.filter((k:any)=> inBounds(k.span, len) && exact(text, k.span, k.surface));
  const p2c = p2.map((x:any)=>({
    pron:x.pron,
    antecedents:(x.antecedents||[]).filter((a:any)=> inBounds(a,len) && a[1]<=x.pron[0] && sents.some(S=> a[0]>=S.start&&a[1]<=S.end && x.pron[0]>=S.start&&x.pron[1]<=S.end)).slice(-3)
  })).filter((x:any)=>x.antecedents.length>0);
  const p3c = p3.filter((t:any)=>{
    const same = sents.some(S => t.s[0]>=S.start && t.o[1]<=S.end);
    const order = t.s[0]<=t.v[0] && t.v[0]<=t.o[0];
    const disjoint = t.s[1]<=t.v[0] && t.v[1]<=t.o[0];
    return same && order && disjoint;
  });

  // 3) 存草稿
  const { data, error } = await supabase.from("article_drafts").insert([{
    source:"ai", lang:b.lang, genre:b.genre, difficulty:b.difficulty,
    title, text, license:"AI-Generated",
    ai_provider: provider, ai_model: model, ai_params: {temperature, topic:b.topic, words:b.words},
    ai_usage: usage, keys: { pass1:p1c, pass2:p2c, pass3:p3c },
    cloze_short: shortCloze, cloze_long: longCloze,
    validator_report: { len, sentences: sents.length, p1:p1c.length, p2:p2c.length, p3:p3c.length },
    status:"pending", created_by: auth.user.id
  }]).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok:true, draft_id: data.id, title });
}
