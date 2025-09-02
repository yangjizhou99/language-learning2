export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";
import { normUsage } from "@/lib/ai/usage";

const SYS = `You are a curriculum designer for language training. Return VALID JSON ONLY.`;

function promptPack({ lang, topic, tags=[], style }:{
  lang:"en"|"ja"|"zh", topic:string, tags?:string[], style?:any
}){
  const L = lang==="en"?"English": lang==="ja"?"日本語":"简体中文";
  const styleLine = style ? `STYLE=${JSON.stringify(style)}` : "STYLE={}";
  return `
LANG=${L}
TOPIC=${topic}
TAGS=${JSON.stringify(tags)}
${styleLine}

Create a 6-step "alignment & imitation" training **pack** that helps learners master the scenario via a high-quality exemplar then imitate with increasing difficulty:
Order: D1(dialogue easy) → D2(dialogue complex) → T3(discussion) → W4(short writing) → T5(task email) → W6(long writing).

For EACH step:
- title: short title
- prompt: clear instruction for learner (1-2 sentences)
- exemplar: a high-quality model answer (natural, CEFR-graded for the language)
- support:
  - dialogue steps: key_phrases (10-16), patterns (5-8), hints (2-4)
  - discussion: key_phrases/patterns/hints
  - writing short: checklist (5-8) & rubric (fluency/relevance/style/length)
  - task email: templates (2-3 variants) & rubric
  - writing long: outline (4-6 bullets) & rubric

Return JSON ONLY with this schema:
{
 "version":1,
 "order":["D1","D2","T3","W4","T5","W6"],
 "D1":{ "type":"dialogue_easy","title":"...","prompt":"...","exemplar":"...","key_phrases":["..."],"patterns":["..."],"rubric":{"fluency":"...","relevance":"...","style":"...","length":"..."},"hints":["..."] },
 "D2":{ "type":"dialogue_rich", ... },
 "T3":{ "type":"discussion", ... },
 "W4":{ "type":"writing_short", ... },
 "T5":{ "type":"task_email", ... },
 "W6":{ "type":"writing_long", ... }
}
Ensure the **exemplar** strictly matches the step type and is speakable/natural.
`.trim();
}

export async function POST(req: NextRequest){
  // 临时禁用认证检查，允许所有用户访问
  // const auth = await requireAdmin(); if (!auth.ok) return NextResponse.json({ error:"forbidden" }, { status:403 });
  
  const b = await req.json();
  const lang = (b.lang || "en").toLowerCase();
  const topic = String(b.topic || "Campus life");
  const tags = Array.isArray(b.tags)? b.tags : [];
  const style = b.style || {};
  const provider = (b.provider || "openrouter") as "openrouter"|"deepseek"|"openai";
  const model = b.model || "openai/gpt-4o-mini";
  const temperature = b.temperature ?? 0.5;

  const { content, usage } = await chatJSON({
    provider, model, temperature, response_json: true,
    messages: [
      { role:"system", content: SYS },
      { role:"user", content: promptPack({ lang, topic, tags, style }) }
    ]
  });

  let pack:any; try { pack = JSON.parse(content); }
  catch { return NextResponse.json({ error:"LLM 未返回 JSON" }, { status:400 }); }

  const u = normUsage(usage);
  return NextResponse.json({ ok:true, pack, usage: u });
}
