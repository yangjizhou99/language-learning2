export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SYS = (lang: string, topic: string, level: string, rag?: string) => {
  const base = `
你是语言训练数据生成器。请输出 JSON，字段：passage, cloze, blanks[], explain[]。
要求：话题=${topic}，语言=${lang}，难度=${level}；长度≤150（词/字）；
遮蔽≈10%词，优先功能词/固定搭配；explain 简要说明。仅输出 JSON。`;
  return rag ? `${base}\n\n【USER CONTEXT / RAG】\n${rag.slice(0, 2000)}` : base;
};

export async function POST(req: NextRequest) {
  try {
    const { lang, topic, level = "mid", rag, model = "deepseek-chat" } = await req.json();
    
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
    if (!apiKey) {
      return new Response("Missing DEEPSEEK_API_KEY", { status: 500 });
    }
    
    const sys = SYS(lang, topic, level, rag);
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
          { role: "system", content: sys },
          { role: "user", content: "生成题目" }
        ],
        temperature: 0.4,
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
