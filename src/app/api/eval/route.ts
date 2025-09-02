import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type EvalReq = {
  lang: "en" | "ja" | "zh";
  instruction: string;
  user_output: string;
  rubrics: string[]; // e.g. ["Task","Naturalness","Tone"]
  model?: string;    // deepseek-chat | deepseek-reasoner
};

type AudioEvalReq = {
  text: string;
  lang: "en" | "ja" | "zh";
};

type EvalResp = {
  scores: Record<string, number>; // rubric -> 1..5
  feedback: string;
  rewrite_best?: string;          // same-language rewrite
  overall?: number;               // avg
};

type AudioEvalResp = {
  score: number; // 0.0 - 1.0
  feedback: string;
  accuracy: number; // 0.0 - 1.0
  fluency: number; // 0.0 - 1.0
};

const sys = (lang: string) => `
你是严格的语言评审员。仅输出 JSON（scores{}, feedback, rewrite_best）。
规则：
- 语言=${lang}（feedback 与 rewrite_best 都用此语言）
- 对给定 rubrics（如 Task/Naturalness/Tone）逐项打分，整数 1..5；5=非常好，1=差。
- feedback：简短、可操作（≤80字/词），先指出问题再给替代建议。
- 在不改变信息的前提下，给出更自然/更礼貌/更连贯的 rewrite_best。仅输出 JSON。`;

const audioEvalSys = (lang: string) => `
你是严格的语言发音评审员。仅输出 JSON（score, feedback, accuracy, fluency）。
规则：
- 语言=${lang}（feedback 用此语言）
- score：整体评分 0.0-1.0（1.0=完美，0.0=完全错误）
- accuracy：发音准确性 0.0-1.0
- fluency：流利度 0.0-1.0
- feedback：简短、可操作的改进建议（≤50字/词）
仅输出 JSON。`;

export async function POST(req: NextRequest) {
  try {
    // 检查是否是音频评分请求
    const contentType = req.headers.get("content-type");
    
    if (contentType?.includes("multipart/form-data")) {
      // 音频评分请求
      const formData = await req.formData();
      const audio = formData.get("audio") as File;
      const text = formData.get("text") as string;
      const lang = formData.get("lang") as "en" | "ja" | "zh";
      
      if (!audio || !text || !lang) {
        return NextResponse.json({ error: "missing params: audio/text/lang" }, { status: 400 });
      }

      // 这里应该调用语音识别 API 来转录音频
      // 暂时使用模拟评分，实际应用中需要集成 Whisper 或其他 ASR 服务
      
      // 模拟评分逻辑（实际应用中需要真实的语音识别和评分）
      const mockScore = Math.random() * 0.4 + 0.6; // 0.6-1.0 之间的随机分数
      const mockAccuracy = Math.random() * 0.3 + 0.7;
      const mockFluency = Math.random() * 0.3 + 0.7;
      
      const feedbacks = {
        ja: "発音は良好です。より自然なリズムで練習してみてください。",
        en: "Good pronunciation. Try to practice with more natural rhythm.",
        zh: "发音不错。尝试练习更自然的语调。"
      };
      
      const response: AudioEvalResp = {
        score: mockScore,
        feedback: feedbacks[lang],
        accuracy: mockAccuracy,
        fluency: mockFluency
      };
      
      return NextResponse.json(response);
    } else {
      // 文本评分请求（原有功能）
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
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}
