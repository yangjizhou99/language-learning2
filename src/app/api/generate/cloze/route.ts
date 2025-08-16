import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type Blank = { idx: number; answer: string };
type ClozeResp = {
  passage: string;
  cloze: string;
  blanks: Blank[];
  explain: { idx: number; why: string }[];
};

const systemPrompt = (lang: string, topic: string, level: string) => `
你是语言训练数据生成器。请输出 JSON，字段：passage, cloze, blanks[], explain[]。
要求：话题=${topic}，语言=${lang}，难度=${level}；长度≤150（词/字）；
遮蔽≈10%词，优先功能词/固定搭配；explain 简要说明。仅输出 JSON。`;

export async function POST(req: NextRequest) {
  try {
    const { lang, topic, level, model = "deepseek-reasoner" } = await req.json().catch(() => ({}));
    if (!lang || !topic) {
      return NextResponse.json({ error: "missing params: lang, topic" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DEEPSEEK_API_KEY is missing. Create .env.local from .env.example and restart dev server." },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });

    const resp = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt(lang, topic, level || "mid") },
        { role: "user", content: "生成题目" }
      ],
      // DeepSeek 为 OpenAI 兼容实现；若 response_format 不被支持，可去掉，已在下方做回退。
      // @ts-ignore
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const text = resp.choices?.[0]?.message?.content ?? "{}";
    let data: ClozeResp;
    try {
      data = JSON.parse(text);
    } catch {
      // 回退：尝试从文本中提取第一个 { ... } JSON 块
      const m = text.match(/\{[\s\S]*\}$/);
      if (!m) {
        return NextResponse.json({ error: "LLM returned non-JSON", raw: text?.slice(0, 500) }, { status: 502 });
      }
      data = JSON.parse(m[0]);
    }

    if (!data?.cloze || !Array.isArray(data?.blanks)) {
      return NextResponse.json({ error: "invalid cloze payload", raw: data }, { status: 502 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}
