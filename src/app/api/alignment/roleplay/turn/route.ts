export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/ai/client";
import { normUsage } from "@/lib/ai/usage";

const SYS = `You are the counterpart in a roleplay dialogue for language learners.
Speak ONLY as the assigned role (not both), in the target language.
For D1 (easy): 1–3 short sentences. For D2 (rich): 2–5 sentences.
When continuing a running dialogue, end with a question to keep it going.
For the very first turn (kickoff), produce a natural opening for your role based on the exemplar (no need to end with a question unless natural).
Return plain text only.`;

function extractFirstLineForRole(exemplar: string, role: "A"|"B"): string {
  const lines = (exemplar || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${role}:`)) {
      return trimmed.replace(/^A:\s*|^B:\s*/,"").trim();
    }
  }
  return "";
}

function buildTurnPrompt({ lang, topic, stepKey, step, role, historyPreview, isKickoff }:{
  lang: "en"|"ja"|"zh"; topic: string; stepKey: string; step: any; role: "A"|"B"; historyPreview: string; isKickoff: boolean;
}){
  const L = lang === "en" ? "English" : lang === "ja" ? "日本語" : "简体中文";
  const aiRole = role === "A" ? "B" : "A";
  const exemplar = (step?.exemplar || "").slice(0, 1500);
  const openingTemplate = extractFirstLineForRole(step?.exemplar || "", aiRole);
  const support = [
    step?.key_phrases ? `KEY_PHRASES=${JSON.stringify(step.key_phrases)}` : "",
    step?.patterns ? `PATTERNS=${JSON.stringify(step.patterns)}` : "",
    step?.hints ? `HINTS=${JSON.stringify(step.hints)}` : "",
    isKickoff && openingTemplate ? `OPENING_TEMPLATE(${aiRole})=${openingTemplate}` : "",
  ].filter(Boolean).join("\n");

  const modeLine = isKickoff
    ? `KICKOFF: Start the dialogue as ROLE ${aiRole}. Write 1-2 natural opening sentences appropriate for your role and scenario, aligned with the exemplar's first ${aiRole} line. No need to end with a question unless natural.`
    : `CONTINUE: Continue the dialogue naturally as ROLE ${aiRole}. End with a question.`;

  return `LANG=${L}\nTOPIC=${topic}\nSTEP=${stepKey} (${step?.type})\nYOU_ARE_ROLE=${aiRole} (the AI). The user is ROLE=${role}.\n\n${modeLine}\n- Use key phrases/patterns when natural.\n- Do NOT output the user's lines.\n\nEXEMPLAR_SNIPPET<<<\n${exemplar}\n>>>\n\nSUPPORT<<<\n${support}\n>>>\n\nRECENT HISTORY (newest first)<<<\n${historyPreview}\n>>>`;
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const { pack_id, step_key, role, messages = [], provider = "openrouter", model = "openai/gpt-4o-mini", temperature = 0.3 } = b as any;
  if (!pack_id || !step_key || !role) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const mockPack = {
    lang: "zh" as const,
    topic: "订餐",
    steps: {
      D1: { type: "dialogue_easy", exemplar: "A: 你好，我想订餐.\nB: 您好，请问需要点什么？\nA: 我要一份宫保鸡丁和一碗米饭。\nB: 好的，还需要别的吗？\nA: 不用了，谢谢。\nB: 请稍等，马上就好。", key_phrases: ["你好", "我想订餐", "请问需要点什么"], patterns: ["我想+动词", "请问+什么"], hints: ["使用基本问候语"] },
      D2: { type: "dialogue_rich", exemplar: "A: 您好，我想订一份外卖。\nB: 好的，您想点些什么？\nA: 请给我来一份鱼香肉丝，不要放辣椒。另外再加一份炒青菜。\nB: 鱼香肉丝不加辣椒，炒青菜一份。需要主食吗？\nA: 要两碗米饭。大概多久能送到？\nB: 大约30分钟。您的地址是？\nA: 人民路123号。\nB: 好的，总计45元。\nA: 谢谢，我等你。", key_phrases: ["我想订外卖", "不要放辣椒", "另外再加"], patterns: ["不要+动词", "另外+动词"], hints: ["提出特殊要求"] }
    }
  };

  const step = mockPack.steps[step_key as keyof typeof mockPack.steps];
  const type = step?.type || step_key;
  if (!step || !(String(type).startsWith("dialogue") || step_key.startsWith("D1") || step_key.startsWith("D2"))) {
    return NextResponse.json({ error: "step is not a dialogue" }, { status: 400 });
  }

  const isKickoff = (messages || []).length === 0;

  const lastTurns = [...messages]
    .slice(-8)
    .reverse()
    .map((m: any) => `${m.role === "user" ? role : (role === "A" ? "B" : "A")}: ${m.content}`)
    .join("\n");

  try {
    const { content, usage } = await chatJSON({
      provider, model, temperature,
      response_json: false,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: buildTurnPrompt({ lang: mockPack.lang, topic: mockPack.topic, stepKey: step_key, step, role, historyPreview: lastTurns, isKickoff }) },
      ],
    });

    console.log("角色扮演对话:", { pack_id, step_key, role, messages: messages.length, reply: content });

    const u = normUsage(usage);
    return NextResponse.json({ ok: true, reply: content, usage: u });
  } catch (error) {
    console.error("角色扮演对话错误:", error);
    return NextResponse.json({ error: "AI 对话失败: " + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
