import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type EvalReq = {
  lang: "en" | "ja";
  instruction: string;
  user_output: string;
  rubrics: string[]; // e.g. ["Task","Naturalness","Tone"]
  model?: string;    // deepseek-chat | deepseek-reasoner
};

type EvalResp = {
  scores: Record<string, number>; // rubric -> 1..5
  feedback: string;
  rewrite_best?: string;          // same-language rewrite
  overall?: number;               // avg
};

const sys = (lang: string) => `
你是严格的语言评审员。仅输出 JSON（scores{}, feedback, rewrite_best）。
规则：
- 语言=${lang}（feedback 与 rewrite_best 都用此语言）
- 对给定 rubrics（如 Task/Naturalness/Tone）逐项打分，整数 1..5；5=非常好，1=差。
- feedback：简短、可操作（≤80字/词），先指出问题再给替代建议。
- 在不改变信息的前提下，给出更自然/更礼貌/更连贯的 rewrite_best。仅输出 JSON。`;

export async function POST(req: NextRequest) {
  try {
    const { lang, instruction, user_output, rubrics, model }: EvalReq = await req.json();
    if (!lang || !instruction || !user_output || !rubrics?.length) {
      return NextResponse.json({ error: "missing params: lang/instruction/user_output/rubrics" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "DEEPSEEK_API_KEY is missing" }, { status: 500 });

    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

    const prompt = `
请根据 rubrics 对下列输出打分并给出反馈与更佳改写。
[Instruction]
${instruction}
[User Output]
${user_output}
[Rubrics]
${rubrics.join(", ")}
`;

    const resp = await client.chat.completions.create({
      model: model || "deepseek-chat",
      messages: [
        { role: "system", content: sys(lang) },
        { role: "user", content: prompt }
      ],
      // @ts-ignore
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    let data: EvalResp;
    try {
      data = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/);
      if (!m) return NextResponse.json({ error: "LLM non-JSON", raw: raw.slice(0, 500) }, { status: 502 });
      data = JSON.parse(m[0]);
    }

    // 基本有效性校验 + 归一化（1..5）
    if (!data?.scores || typeof data?.feedback !== "string") {
      return NextResponse.json({ error: "invalid eval payload", raw: data }, { status: 502 });
    }
    for (const k of Object.keys(data.scores)) {
      let v = Number(data.scores[k]);
      if (!Number.isFinite(v)) v = 1;
      data.scores[k] = Math.max(1, Math.min(5, Math.round(v)));
    }
    const vals = Object.values(data.scores) as number[];
    data.overall = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : undefined;

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}
