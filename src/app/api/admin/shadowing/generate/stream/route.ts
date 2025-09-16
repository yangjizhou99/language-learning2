export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

function buildUserPrompt({
  lang,
  level,
  count,
  words,
  topic
}: {
  lang: "en" | "ja" | "zh";
  level: number;
  count: number;
  words: [number, number] | undefined;
  topic: string | undefined;
}) {
  const L = lang === "en" ? "English" : lang === "ja" ? "日本語" : "简体中文";
  const perLevel: any = {
    1: { desc: "超短句", words: words ?? [40, 80] },
    2: { desc: "短句", words: words ?? [80, 160] },
    3: { desc: "中等篇幅", words: words ?? [160, 320] },
    4: { desc: "较长", words: words ?? [320, 640] },
    5: { desc: "长句", words: words ?? [640, 1280] },
  };
  const conf = perLevel[level] || perLevel[3];
  const minW = conf.words[0];
  const maxW = conf.words[1];

  return `
你是一个shadowing练习的文本生成器。

语言：${L}
等级：L${level}（${conf.desc}）
${topic ? `主题：${topic}\n` : ""}

任务：创建${count}个适合shadowing练习的短文本。每个项目必须是一个对象：
{ "title": "...", "text": "..." }

要求：
- 标题：简短描述性（最多12个词/12字）
- 文本长度：${minW}~${maxW} ${lang === "en" ? "words" : "字"}
- 风格：自然、可朗读、2-4个短段落或句子；不要项目符号列表；不要URL
- 内容：适合口语练习

只返回JSON格式：{ "items": [ { "title":"...", "text":"..." }, ... ] }，必须包含 exactly ${count} 个项目。
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lang = (body.lang || "en").toLowerCase();
    const level = Math.max(1, Math.min(5, Number(body.level) || 3));
    const count = Math.max(1, Math.min(20, Number(body.count) || 5));
    const provider = (body.provider || "deepseek") as "openrouter" | "deepseek" | "openai";
    const model = body.model || "deepseek-chat";
    const temperature = body.temperature ?? 0.6;
    const words = body.words as [number, number] | undefined;
    const topic = body.topic as string | undefined;

    if (!["en", "ja", "zh"].includes(lang)) {
      return new Response("invalid lang", { status: 400 });
    }

    // 获取用户API密钥
    const { getUserAPIKeys } = await import('@/lib/user-api-keys');
    const userKeys = await getUserAPIKeys(body.userId || '');
    
    // 选择上游并以 SSE 形式请求
    let url = "";
    let headers: Record<string,string> = {};
    if (provider === "openrouter") {
      const key = userKeys?.openrouter || process.env.OPENROUTER_API_KEY;
      if (!key) return new Response("Missing OpenRouter API key", { status: 500 });
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers = {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      };
    } else if (provider === "deepseek") {
      const key = userKeys?.deepseek || process.env.DEEPSEEK_API_KEY;
      if (!key) return new Response("Missing DeepSeek API key", { status: 500 });
      url = "https://api.deepseek.com/v1/chat/completions";
      headers = {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      };
    } else {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return new Response("Missing OpenAI API key", { status: 500 });
      url = "https://api.openai.com/v1/chat/completions";
      headers = {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      };
    }

    const sys = "你只返回有效的JSON格式。";
    const user = buildUserPrompt({ lang, level, count, words, topic });

    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature,
        stream: true,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ]
      })
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "upstream error");
      return new Response(text, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });
  } catch (e: any) {
    return new Response(e?.message || "server error", { status: 500 });
  }
}


