export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { pass1, pass2, pass3, makeCloze } from '@/lib/answerkey/generate';
import { sha256 } from '@/lib/ingest/fetchers';

type Body = {
  lang: 'en' | 'ja' | 'zh';
  genre: 'news' | 'science' | 'essay' | 'dialogue' | 'literature';
  difficulty: number; // 1..5
  topic?: string; // 可选主题
  words?: number; // 目标长度（词/字）
  model?: string; // 例如 deepseek-chat / gpt-4o-mini 等
  temperature?: number;
};

const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'deepseek-chat';
const PROVIDER = process.env.AI_PROVIDER || 'deepseek'; // 'deepseek' | 'openai'
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function buildPrompt(b: Body) {
  const L =
    b.lang === 'zh' ? '简体中文（zh-CN）' : b.lang === 'ja' ? '日本語（ja-JP）' : 'English (en-US)';
  const len = Math.max(150, Math.min(1200, b.words || (b.lang === 'en' ? 250 : 300)));
  const genreMap: Record<string, string> = {
    news: '新闻报道（客观、时效性示例，但不要涉及具体真实时事）',
    science: '科普说明文（概念清晰、例子短小）',
    essay: '随笔/评论（有清晰论点）',
    dialogue: '对话体（2–3 人，轮次自然）',
    literature: '叙事性短文（人物/场景/冲突）',
  };
  const topicLine = b.topic ? `主题：${b.topic}\n` : '';
  return `
你是语言教学素材生成器。请用 ${L} 写一篇 ${genreMap[b.genre]} 的文章，面向难度 L${b.difficulty} 学习者。
${topicLine}长度要求：约 ${len} ${b.lang === 'en' ? 'words' : '字'}（允许±20%）。
风格/限制：
- 语言自然可读，避免敏感/时效性信息与可识别个资。
- 不要照搬现有受版权保护文本；输出必须原创。
- 段落清晰（2–6 段），不输出任何解释或题目，只输出正文。

请以 JSON 返回：
{"title": "...", "text": "整篇文章正文"}
仅输出 JSON。`;
}

async function callLLM(body: Body, userId?: string) {
  const model = body.model || DEFAULT_MODEL;
  const prompt = buildPrompt(body);

  // 获取用户API密钥
  let userKeys: { deepseek?: string; openrouter?: string } | null = null;
  if (userId) {
    const { getUserAPIKeys } = await import('@/lib/user-api-keys');
    userKeys = await getUserAPIKeys(userId);
  }

  if (PROVIDER === 'deepseek') {
    const key = userKeys?.deepseek || DEEPSEEK_API_KEY;
    if (!key) throw new Error('DEEPSEEK_API_KEY missing');
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: body.temperature ?? 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a helpful writing assistant.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content || '';
    return JSON.parse(txt);
  } else {
    const key = userKeys?.openrouter || OPENAI_API_KEY;
    if (!key) throw new Error('API key missing');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: body.temperature ?? 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a helpful writing assistant.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content || '';
    return JSON.parse(txt);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    const code = auth.reason === 'unauthorized' ? 401 : 403;
    return NextResponse.json({ error: auth.reason }, { status: code });
  }
  const supabase = auth.supabase;

  const b = (await req.json()) as Body;
  if (!b.lang || !b.genre || !b.difficulty)
    return NextResponse.json({ error: '缺少 lang/genre/difficulty' }, { status: 400 });

  // 调 LLM 生成
  let out: { title: string; text: string };
  try {
    out = await callLLM(b, auth.user.id);
  } catch (e: unknown) {
    const msg = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e);
    return NextResponse.json({ error: 'LLM 生成失败: ' + msg }, { status: 500 });
  }

  const title = (out.title || 'Untitled').slice(0, 200);
  const text = (out.text || '').toString().trim();
  if (text.length < 200)
    return NextResponse.json({ error: '生成文本过短（<200）' }, { status: 400 });

  // 生成答案键 & Cloze（规则化，保证可复核）
  const p1 = pass1(text, b.lang);
  const p2 = pass2(text, b.lang);
  const p3 = pass3(text, b.lang);
  const shortCloze = makeCloze(text, b.lang, 'short');
  const longCloze = makeCloze(text, b.lang, 'long');

  const checksum = sha256(`${b.lang}|${title}|${text}`);

  const { data: art, error: e1 } = await supabase
    .from('articles')
    .insert([
      {
        lang: b.lang,
        genre: b.genre,
        difficulty: b.difficulty,
        title,
        source_url: null,
        license: 'AI-Generated',
        text,
        checksum,
        meta: { attribution: 'AI generated', model: b.model || undefined },
      },
    ])
    .select('id')
    .single();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

  const { error: e2 } = await supabase
    .from('article_keys')
    .insert([{ article_id: art.id, pass1: p1, pass2: p2, pass3: p3 }]);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  const { error: e3 } = await supabase.from('article_cloze').insert([
    { article_id: art.id, version: 'short', items: shortCloze },
    { article_id: art.id, version: 'long', items: longCloze },
  ]);
  if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });

  return NextResponse.json({ ok: true, article_id: art.id, title });
}
