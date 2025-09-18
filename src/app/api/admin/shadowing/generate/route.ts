export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';

function buildUserPrompt({
  lang,
  level,
  count,
  words,
  topic,
}: {
  lang: 'en' | 'ja' | 'zh';
  level: number;
  count: number;
  words: [number, number] | undefined;
  topic: string | undefined;
}) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';

  // 每级的长度约束 - 以L1为基础翻倍
  const perLevel: Record<number, { desc: string; words: [number, number] }> = {
    1: { desc: '超短句', words: words ?? [40, 80] },
    2: { desc: '短句', words: words ?? [80, 160] },
    3: { desc: '中等篇幅', words: words ?? [160, 320] },
    4: { desc: '较长', words: words ?? [320, 640] },
    5: { desc: '长句', words: words ?? [640, 1280] },
  };

  const conf = perLevel[level] || perLevel[3];
  const minW = conf.words[0];
  const maxW = conf.words[1];

  return `
你是一个shadowing练习的文本生成器。

语言：${L}
等级：L${level}（${conf.desc}）
${topic ? `主题：${topic}\n` : ''}

任务：创建${count}个适合shadowing练习的短文本。每个项目必须是一个对象：
{ "title": "...", "text": "..." }

要求：
- 标题：简短描述性（最多12个词/12字）
- 文本长度：${minW}~${maxW} ${lang === 'en' ? 'words' : '字'}
- 风格：自然、可朗读、2-4个短段落或句子；不要项目符号列表；不要URL
- 内容：适合口语练习

只返回JSON格式：{ "items": [ { "title":"...", "text":"..." }, ... ] }，必须包含 exactly ${count} 个项目。
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const lang = (body.lang || 'en').toLowerCase();
    const level = Math.max(1, Math.min(5, Number(body.level) || 3));
    const count = Math.max(1, Math.min(20, Number(body.count) || 5));
    const provider = (body.provider || 'deepseek') as 'openrouter' | 'deepseek' | 'openai';
    const model = body.model || 'deepseek-chat';
    const temperature = body.temperature ?? 0.6;
    const words = body.words as [number, number] | undefined;
    const topic = body.topic as string | undefined;

    // 验证语言参数
    if (!['en', 'ja', 'zh'].includes(lang)) {
      return NextResponse.json({ error: '无效的语言参数' }, { status: 400 });
    }

    const { content, usage } = await chatJSON({
      provider,
      model,
      temperature,
      response_json: true,
      messages: [
        { role: 'system', content: '你只返回有效的JSON格式。' },
        { role: 'user', content: buildUserPrompt({ lang, level, count, words, topic }) },
      ],
      userId: auth.user.id, // 传递用户ID以使用用户特定的API密钥
    });

    let parsed: { items?: Array<{ title?: unknown; text?: unknown }> };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'LLM未返回有效JSON' }, { status: 400 });
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];

    // 轻量清洗
    const clean = items
      .slice(0, count)
      .map((it: { title?: unknown; text?: unknown }, i: number) => ({
        idx: i,
        title: String(it.title || 'Untitled').slice(0, 80),
        text: String(it.text || '').trim(),
      }))
      .filter((it) => it.text.length >= 30);

    return NextResponse.json({
      ok: true,
      lang,
      level,
      items: clean,
      usage,
    });
  } catch (error) {
    console.error('生成题库失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
