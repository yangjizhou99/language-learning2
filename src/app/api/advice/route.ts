import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type ReqBody = {
  lang: "en" | "ja" | "zh";
  ref: string;
  hyp: string;
  metrics?: { accuracy?: number; coverage?: number; speed_wpm?: number };
  model?: string;
};

const SYS = (lang: string) => `你是专业的语音教练。只输出建议文本，不要解释步骤，也不要输出 JSON。
规则：
- 使用${lang}输出；
- 仅聚焦发音：音素/韵母/辅音连缀、重音、语调、连读等；
- 指出可能发不好的音与易混淆的发音（给混淆对，如 /r/ vs /l/、/s/ vs /ʃ/ 等）；
- 每条建议包含：问题音→口型/舌位要点→2-3组最小对立对→1个短句跟读练习；
- 优先列出影响理解度最大的要点；
- 不设字数限制；
- 不复述整段文本，不讨论语法与词汇。`;

export async function POST(req: NextRequest) {
  try {
    const { lang, ref, hyp, metrics, model }: ReqBody = await req.json();
    if (!lang || typeof ref !== "string" || typeof hyp !== "string") {
      return NextResponse.json({ error: "missing params: lang/ref/hyp" }, { status: 400 });
    }

    // 获取用户信息
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 获取用户API密钥
    const { getUserAPIKeys } = await import('@/lib/user-api-keys');
    const userKeys = await getUserAPIKeys(user.id);
    const apiKey = userKeys?.deepseek || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "DEEPSEEK_API_KEY is missing" }, { status: 500 });

    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
    const metricLine = metrics ? `\n- 评测数据：accuracy=${metrics.accuracy ?? "-"}%, coverage=${metrics.coverage ?? "-"}%, speed=${metrics.speed_wpm ?? "-"}` : "";
    const prompt = `请基于以下信息给出针对性发音建议：\n- 参考文本（ref）：${ref}\n- 识别文本（hyp，已补全标点）：${hyp}${metricLine}`;

    const resp = await client.chat.completions.create({
      model: model || "deepseek-chat",
      messages: [
        { role: "system", content: SYS(lang) },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    });

    const out = resp.choices?.[0]?.message?.content?.trim() || "";
    if (!out) return NextResponse.json({ error: "empty output" }, { status: 502 });
    return new Response(out, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e instanceof Error ? e.message : String(e) : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


