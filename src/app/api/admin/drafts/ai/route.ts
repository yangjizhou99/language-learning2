import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";

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
  const provider = (b.provider || "deepseek") as "openrouter"|"deepseek"|"openai";
  const model = b.model || "deepseek-chat"; // 例子：DeepSeek 模型 id
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

  // 2) 直接存草稿（不生成答案；keys/cloze 为空，等待草稿页再生成）
  const { data, error } = await supabase.from("article_drafts").insert([{
    source:"ai", lang:b.lang, genre:b.genre, difficulty:b.difficulty,
    title, text, license:"AI-Generated",
    ai_provider: provider, ai_model: model, ai_params: {temperature, topic:b.topic, words:b.words},
    ai_usage: usage,
    keys: { pass1:[], pass2:[], pass3:[] },
    cloze_short: [], cloze_long: [],
    validator_report: { len: text.length },
    status:"pending", created_by: auth.user.id
  }]).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok:true, draft_id: data.id, title });
}
