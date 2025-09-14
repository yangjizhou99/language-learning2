import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type ReqBody = {
  lang: "en" | "ja" | "zh";
  ref: string;
  hyp: string;
  model?: string;
};

const SYS = (lang: string) => `你是严谨的标点恢复与大小写修复助手，只负责为给定语言恢复自然的标点与大小写。
要求：
- 语言=${lang}（按该语言的自然标点/分句规则）；
- 仅对 HYPOTHESIS 插入/修正标点与大小写；
- 不要翻译，不要增删改词语内容；
- 不要输出解释或额外文本，只输出处理后的文本。`;

export async function POST(req: NextRequest) {
  try {
    const { lang, ref, hyp, model }: ReqBody = await req.json();
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

    const prompt = `请基于参考文本的风格为 HYPOTHESIS 补全标点：
[REFERENCE]
${ref}
[HYPOTHESIS_RAW]
${hyp}`;

    const resp = await client.chat.completions.create({
      model: model || "deepseek-chat",
      messages: [
        { role: "system", content: SYS(lang) },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    });

    const out = resp.choices?.[0]?.message?.content?.trim() || "";
    if (!out) return NextResponse.json({ error: "empty output" }, { status: 502 });
    return new Response(out, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}


