export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';

const SYS = `You generate CLOZE passages for language learning. Prefer returning valid JSON. Use placeholders {{1}}, {{2}}, {{3}} for blanks.`;

export async function POST(req: NextRequest) {
  const adminResult = await requireAdmin(req);
  if (!adminResult.ok) {
    return new Response(JSON.stringify({ error: adminResult.reason }), { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
  }

  const { provider = 'deepseek', model, lang, level, count = 3, topic } = await req.json();
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  const focus = lang === 'en'
    ? 'prefer high-frequency collocations and connectors, basic grammar chunks'
    : lang === 'ja'
      ? 'prefer particles, set phrases, polite forms, 接続詞'
      : '优先高频连接词/固定搭配、功能词（的、地、得）';
  const length = level <= 2 ? '80~140' : level === 3 ? '120~180' : level === 4 ? '150~220' : '180~260';
  const prompt = `LANG=${L}\nLEVEL=L${level}\nTOPIC=${topic || 'General'}\nFOCUS=${focus}\nLENGTH=${length} ${lang === 'en' ? 'words' : '字'}\n\nTASK: Create ${count} CLOZE items. Return a JSON array when finished.`;

  // Prepare provider request
  let url = '';
  let headers: Record<string,string> = { 'Content-Type': 'application/json' };
  let body: any = {
    model: model || (provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' : provider === 'openai' ? 'gpt-4o' : 'deepseek-chat'),
    temperature: 0.7,
    stream: true,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: prompt }
    ]
  };

  if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    const key = process.env.OPENROUTER_API_KEY!;
    headers = {
      ...headers,
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || '',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'Lang Trainer Admin'
    };
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    headers = { ...headers, 'Authorization': `Bearer ${process.env.OPENAI_API_KEY!}` };
  } else {
    url = 'https://api.deepseek.com/chat/completions';
    headers = { ...headers, 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY!}` };
  }

  const upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(text || 'Upstream error', { status: upstream.status || 502 });
  }

  // Transform SSE -> plain text deltas (content only)
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = upstream.body!.getReader();
      const read = () => reader.read().then(({ done, value }) => {
        if (done) {
          // end
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (payload === '[DONE]') { controller.close(); return; }
          try {
            const j = JSON.parse(payload);
            const delta = j?.choices?.[0]?.delta?.content || j?.choices?.[0]?.message?.content || '';
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            // ignore parse error
          }
        }
        return read();
      }).catch(err => { controller.error(err); });
      read();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}


