import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

type ShadowingResp = {
  text: string;
  lang: 'ja' | 'en';
  topic: string;
  approx_duration_sec?: number;
};

const sys = (lang: string, topic: string) => `
你是 Shadowing 练习文本生成器。输出 JSON：{text, lang, topic, approx_duration_sec}
要求：
- 语言=${lang}，话题=${topic}
- 长度：英语 60~120 词；日语 60~120 字
- 口语自然，句子长度适中，便于跟读
仅输出 JSON。`;

export async function POST(req: NextRequest) {
  try {
    const { lang, topic, model } = await req.json();
    if (!lang || !topic)
      return NextResponse.json({ error: 'missing params: lang, topic' }, { status: 400 });

    // 获取用户信息
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户API密钥
    const { getUserAPIKeys } = await import('@/lib/user-api-keys');
    const userKeys = await getUserAPIKeys(user.id);
    const apiKey = userKeys?.deepseek || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY missing' }, { status: 500 });

    const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
    const resp = await client.chat.completions.create({
      model: model || 'deepseek-chat',
      messages: [
        { role: 'system', content: sys(lang, topic) },
        { role: 'user', content: '生成 shadowing 文本' },
      ],
      // @ts-ignore
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    let data: ShadowingResp;
    try {
      data = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/);
      if (!m)
        return NextResponse.json(
          { error: 'LLM non-JSON', raw: raw.slice(0, 500) },
          { status: 502 },
        );
      data = JSON.parse(m[0]);
    }

    if (!data?.text)
      return NextResponse.json({ error: 'invalid payload', raw: data }, { status: 502 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown error' }, { status: 500 });
  }
}
