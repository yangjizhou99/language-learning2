import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type SFTTask = {
  instruction: string;
  constraints: string[];
  rubrics: string[]; // e.g. ["Task","Naturalness","Tone"]
};

const sys = (lang: string, topic: string, template: string) => `
你是语言学习的“任务生成器”。仅输出 JSON（instruction, constraints[], rubrics[]）。
要求：
- 语言=${lang}（instruction 用此语言书写）
- 话题=${topic}
- 模板=${template}（如：polite_mail, time_request, apology, request_favor, status_update）
- constraints：3~5 条，短而可执行（例如 “≤120字/词；使用丁寧語；给出2个时间备选”）
- rubrics 固定用 ["Task","Naturalness","Tone"] 三维
仅输出 JSON。`;

export async function POST(req: NextRequest) {
  try {
    const { lang, topic, template = "polite_mail", model } = await req.json();
    if (!lang || !topic) {
      return NextResponse.json({ error: "missing params: lang, topic" }, { status: 400 });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "DEEPSEEK_API_KEY is missing" }, { status: 500 });

    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

    const resp = await client.chat.completions.create({
      model: model || "deepseek-chat",
      messages: [
        { role: "system", content: sys(lang, topic, template) },
        { role: "user", content: "生成 1 条任务" }
      ],
      // @ts-ignore
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const raw = resp.choices?.[0]?.message?.content ?? "{}";
    let data: SFTTask;
    try {
      data = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/);
      if (!m) return NextResponse.json({ error: "LLM non-JSON", raw: raw.slice(0, 500) }, { status: 502 });
      data = JSON.parse(m[0]);
    }

    if (!data?.instruction || !Array.isArray(data?.constraints) || !Array.isArray(data?.rubrics)) {
      return NextResponse.json({ error: "invalid task payload", raw: data }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}
