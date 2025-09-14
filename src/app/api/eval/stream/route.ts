export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SYS = (lang: string, rag?: string) => {
  const base = `
你是严格的语言评审员。仅输出 JSON（scores{}, feedback, rewrite_best）。
规则：
- 语言=${lang}（feedback 与 rewrite_best 都用此语言）
- 对给定 rubrics（如 Task/Naturalness/Tone）逐项打分，整数 1..5；5=非常好，1=差。
- feedback：简短、可操作（≤80字/词），先指出问题再给替代建议。
- 在不改变信息的前提下，给出更自然/更礼貌/更连贯的 rewrite_best。仅输出 JSON。`;
  return rag ? `${base}\n\n【USER CONTEXT / RAG】\n${rag.slice(0,2000)}` : base;
};

export async function POST(req: NextRequest) {
  try {
    const { lang, instruction, user_output, rubrics, model = "deepseek-chat", rag } = await req.json();
    
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
      return new Response("Unauthorized", { status: 401 });
    }

    // 获取用户API密钥
    const { getUserAPIKeys } = await import('@/lib/user-api-keys');
    const userKeys = await getUserAPIKeys(user.id);
    const apiKey = userKeys?.deepseek || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return new Response("Missing DEEPSEEK_API_KEY", { status: 500 });

    const prompt = `
请根据 rubrics 对下列输出打分并给出反馈与更佳改写。
[Instruction]
${instruction}
[User Output]
${user_output}
[Rubrics]
${Array.isArray(rubrics) ? rubrics.join(", ") : ""}`;

    const ds = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYS(lang, rag) },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        stream: true
      })
    });

    if (!ds.ok || !ds.body) {
      const text = await ds.text().catch(()=> "upstream error");
      return new Response(text, { status: 502 });
    }

    return new Response(ds.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
