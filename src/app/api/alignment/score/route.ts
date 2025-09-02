export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { chatJSON } from "@/lib/ai/client";
import { normUsage } from "@/lib/ai/usage";

const SYS_SCORER = `You are a strict yet constructive evaluator for language learning tasks.
Return VALID JSON only with numeric scores and concrete, actionable feedback.`;

function buildEvalPrompt({ lang, topic, tags, style, stepKey, step, submission, userRole, transcript }: any) {
  const L = lang === "en" ? "English" : lang === "ja" ? "日本語" : "简体中文";
  const typeMap: any = {
    dialogue_easy: "D1 (easy dialogue)",
    dialogue_rich: "D2 (complex dialogue)",
    discussion: "T3 (discussion)",
    writing_short: "W4 (short writing)",
    task_email: "T5 (task email)",
    writing_long: "W6 (long writing)",
  };
  const typeLine = typeMap[step?.type] || step?.type || stepKey;
  const rubric = step?.rubric || {};
  const extras = [
    step?.key_phrases ? `KEY_PHRASES: ${JSON.stringify(step.key_phrases)}` : "",
    step?.patterns ? `PATTERNS: ${JSON.stringify(step.patterns)}` : "",
    step?.checklist ? `CHECKLIST: ${JSON.stringify(step.checklist)}` : "",
    step?.templates ? `TEMPLATES: ${JSON.stringify(step.templates)}` : "",
    step?.outline ? `OUTLINE: ${JSON.stringify(step.outline)}` : "",
    step?.hints ? `HINTS: ${JSON.stringify(step.hints)}` : "",
  ].filter(Boolean).join("\n");

  // 如果是对话步骤且有转录，使用转录进行评分
  if ((stepKey.startsWith("D") || step?.type?.startsWith("dialogue")) && transcript) {
    return `LANG=${L}\nTOPIC=${topic}\nTAGS=${JSON.stringify(tags||[])}\nSTYLE=${JSON.stringify(style||{})}\nSTEP=${typeLine}\nUSER_ROLE=${userRole}\n\nTASK_PROMPT<<<\n${step?.prompt || ""}\n>>>\n\nEXEMPLAR<<<\n${step?.exemplar || ""}\n>>>\n\nRUBRIC<<<\n${JSON.stringify(rubric)}\n>>>\n\nSUPPORTING_MATERIALS\n${extras}\n\nDIALOGUE_TRANSCRIPT<<<\n${transcript}\n>>>\n\nEVALUATE ONLY the user's lines (ROLE ${userRole}) for:\n- Fluency: natural flow, grammar, pronunciation patterns\n- Relevance: topic alignment, appropriate responses\n- Style: politeness, formality, cultural appropriateness\n- Length: appropriate for step difficulty (D1: 1-3 sentences, D2: 2-5 sentences)\n\nReturn JSON:\n{\n  "scores": { "fluency": 0-100, "relevance": 0-100, "style": 0-100, "length": 0-100, "overall": 0-100 },\n  "feedback": {\n    "highlights": ["..."],\n    "issues": ["..."],\n    "replace_suggestions": [ { "from":"...", "to":"...", "why":"..." } ],\n    "extra_phrases": ["..."]\n  }\n}`;
  }

  // 非对话步骤使用原来的评分方式
  return `LANG=${L}\nTOPIC=${topic}\nTAGS=${JSON.stringify(tags||[])}\nSTYLE=${JSON.stringify(style||{})}\nSTEP=${typeLine}\n\nTASK_PROMPT<<<\n${step?.prompt || ""}\n>>>\n\nEXEMPLAR<<<\n${step?.exemplar || ""}\n>>>\n\nRUBRIC<<<\n${JSON.stringify(rubric)}\n>>>\n\nSUPPORTING_MATERIALS\n${extras}\n\nSTUDENT_SUBMISSION<<<\n${submission}\n>>>\n\nReturn JSON:\n{\n  "scores": { "fluency": 0-100, "relevance": 0-100, "style": 0-100, "length": 0-100, "overall": 0-100 },\n  "feedback": {\n    "highlights": ["..."],\n    "issues": ["..."],\n    "replace_suggestions": [ { "from":"...", "to":"...", "why":"..." } ],\n    "extra_phrases": ["..."]\n  }\n}`;
}

export async function POST(req: NextRequest) {
  // 临时禁用认证检查，允许所有用户访问
  // const supabase = createServerClient();
  // const user = await supabase.auth.getUser();
  // if (!user.data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const b = await req.json();
  const { pack_id, step_key, submission, userRole, transcript, provider = "openrouter", model = "openai/gpt-4o-mini", temperature = 0.2 } = b;

  // 临时使用模拟数据
  const mockPack = {
    lang: "zh",
    topic: "订餐",
    tags: ["service", "polite", "negotiation"],
    preferred_style: { formality: "neutral", tone: "friendly", length: "balanced" },
    steps: {
      D1: { type: "dialogue_easy", prompt: "简单对话", exemplar: "示例对话", rubric: {} },
      D2: { type: "dialogue_rich", prompt: "复杂对话", exemplar: "示例对话", rubric: {} },
      T3: { type: "discussion", prompt: "讨论", exemplar: "示例讨论", rubric: {} },
      W4: { type: "writing_short", prompt: "短文", exemplar: "示例短文", rubric: {} },
      T5: { type: "task_email", prompt: "邮件", exemplar: "示例邮件", rubric: {} },
      W6: { type: "writing_long", prompt: "长文", exemplar: "示例长文", rubric: {} }
    }
  };

  const step = mockPack.steps[step_key as keyof typeof mockPack.steps];
  if (!step) return NextResponse.json({ error: "step not found" }, { status: 404 });

  const { content, usage } = await chatJSON({
    provider,
    model,
    temperature,
    response_json: true,
    messages: [
      { role: "system", content: SYS_SCORER },
      { role: "user", content: buildEvalPrompt({
        lang: mockPack.lang,
        topic: mockPack.topic,
        tags: mockPack.tags,
        style: mockPack.preferred_style,
        stepKey: step_key,
        step,
        submission,
        userRole,
        transcript
      }) }
    ]
  });

  let result: any;
  try {
    result = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "LLM 未返回有效 JSON" }, { status: 400 });
  }

  // 临时跳过数据库保存
  // const { error: saveError } = await supabase.from("alignment_attempts").insert([{
  //   user_id: user.data.user.id,
  //   pack_id,
  //   step_key,
  //   submission,
  //   scores: result.scores,
  //   feedback: result.feedback
  // }]);

  // if (saveError) {
  //   console.error("保存评分记录失败:", saveError);
  // }

  console.log("模拟评分结果:", { pack_id, step_key, submission, result });

  const u = normUsage(usage);
  return NextResponse.json({ ok: true, result, usage: u });
}
