export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { normUsage } from '@/lib/ai/usage';

const SYS = `You generate CLOZE passages for language learning. Return VALID JSON only. For each blank, only a single reference answer is required.`;

function extractArrayFromObject(obj: any): any[] | null {
  if (!obj || typeof obj !== 'object') return null;
  const candidateKeys = ['items', 'data', 'result', 'output', 'questions', 'cloze'];
  for (const key of candidateKeys) {
    if (Array.isArray(obj[key])) return obj[key];
    // 一些提供商可能返回 { key: { items: [...] } }
    if (obj[key] && typeof obj[key] === 'object') {
      const nested = extractArrayFromObject(obj[key]);
      if (nested) return nested;
    }
  }
  return null;
}

function tryParseJson<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function buildPrompt({ lang, level, count, topic }: { lang: 'en' | 'ja' | 'zh', level: number, count: number, topic?: string }) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  const focus = lang === 'en'
    ? 'prefer high-frequency collocations and connectors (e.g., despite/in spite of, due to, moreover), basic grammar chunks'
    : lang === 'ja'
      ? 'prefer particles (は/が/を/に/で/へ/から/まで/と/より/や), set phrases, polite forms, 接続詞'
      : '优先高频连接词/固定搭配（例如：然而、尽管、由于、不仅…而且…）、功能词（的、地、得）';
  const length = level <= 2 ? '80~140' : level === 3 ? '120~180' : level === 4 ? '150~220' : '180~260';
  
  return `LANG=${L}
LEVEL=L${level}
TOPIC=${topic || 'General'}
FOCUS=${focus}
LENGTH=${length} ${lang === 'en' ? 'words' : '字'}

TASK: Create ${count} CLOZE items.
For each item, produce JSON object:
{
  "title": "short title",
  "passage": "text with {{1}}, {{2}}, {{3}} placeholders for blanks",
  "blanks": [
    {
      "id": 1,
      "answer": "reference answer only (single string)",
      "type": "grammar|vocabulary|connector|particle (optional)"
    }
  ]
}

RULES:
- Use {{1}}, {{2}}, {{3}} etc. for blanks in passage
- Include ${level <= 2 ? '3-5' : level === 3 ? '4-7' : '5-8'} blanks per passage to make it richer
- Only provide a single reference answer per blank (no alternatives needed)
- Choose blanks that are meaningful in context (connectors, particles, collocations, grammar chunks)
- Ensure passage flows naturally
- Focus on ${focus}
- Keep within ${length} length limit

Return array of ${count} items.`;
}

export async function POST(req: NextRequest) {
  try {
    console.log('🎯 Cloze generation API called');
    
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      console.log('❌ Admin check failed:', adminResult.reason);
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }
    
    console.log('✅ Admin check passed');
    
    const { lang, level, count = 3, topic, provider = 'deepseek', model: requestedModel } = await req.json();
    console.log('📋 Request params:', { lang, level, count, topic, provider, model: requestedModel });
    
    if (!lang || !level || !['en', 'ja', 'zh'].includes(lang) || level < 1 || level > 5) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    
    if (!['deepseek', 'openrouter', 'openai'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const prompt = buildPrompt({ lang, level, count, topic });
    console.log('📝 Generated prompt length:', prompt.length);
    
    // 根据 provider 与传入 model 决定模型（传入优先）
    let model = requestedModel as string | undefined;
    if (!model) {
      if (provider === 'openrouter') model = 'anthropic/claude-3.5-sonnet';
      else if (provider === 'openai') model = 'gpt-4o';
      else model = 'deepseek-chat';
    }
    
    console.log('🤖 Calling AI with provider:', provider, 'model:', model);
    const result = await chatJSON({
      provider: provider as 'deepseek' | 'openrouter' | 'openai',
      model: model,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      response_json: true
    });

    console.log('🤖 AI response received');
    console.log('📊 AI usage:', result.usage);
    
    if (!result.content) {
      console.log('❌ No content in AI response');
      return NextResponse.json({ error: 'Failed to generate cloze items' }, { status: 500 });
    }
    
    console.log('📝 AI response length:', result.content.length);
    console.log('📝 AI response preview:', result.content.substring(0, 200) + '...');

    // 解析 JSON 内容（增强兼容性）
    let data: any = tryParseJson(result.content);

    // 情况1：直接是数组
    if (!Array.isArray(data)) {
      // 情况2：对象包裹数组，如 { items: [...] } / { data: [...] }
      if (data && typeof data === 'object') {
        const arr = extractArrayFromObject(data);
        if (arr) data = arr;
      }
    }

    // 情况3：代码块包裹 ```json ... ```
    if (!Array.isArray(data)) {
      const codeBlock = result.content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlock && codeBlock[1]) {
        const parsed = tryParseJson(codeBlock[1]);
        if (Array.isArray(parsed)) data = parsed;
        else if (parsed && typeof parsed === 'object') {
          const arr = extractArrayFromObject(parsed);
          if (arr) data = arr;
        }
      }
    }

    // 情况4：提取首个数组字面量 [...]
    if (!Array.isArray(data)) {
      const jsonMatch = result.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = tryParseJson(jsonMatch[0]);
        if (Array.isArray(parsed)) data = parsed;
      }
    }

    // 情况5：单个对象（推断为单题）
    if (!Array.isArray(data)) {
      const single = tryParseJson(result.content);
      if (single && typeof single === 'object' && single.passage && Array.isArray(single.blanks)) {
        data = [single];
      }
    }

    if (!Array.isArray(data)) {
      console.error('AI Response (unparsed):', result.content);
      return NextResponse.json({ error: 'AI response is not an array' }, { status: 500 });
    }

    // 规范化与验证生成的数据结构（更宽容）
    const validTypes = new Set(['grammar','vocabulary','connector','particle']);
    const toStringSafe = (v: any) => (v === null || v === undefined) ? '' : String(v);
    const ensureStringArray = (v: any): string[] => {
      if (Array.isArray(v)) return v.map(toStringSafe).filter(Boolean);
      if (v === null || v === undefined || v === '') return [];
      return [toStringSafe(v)];
    };

    const items = data.map((rawItem: any, index: number) => {
      const title = toStringSafe(rawItem?.title) || `Cloze L${level} #${index + 1}`;
      const passage = toStringSafe(rawItem?.passage);
      const blanksInput = Array.isArray(rawItem?.blanks) ? rawItem.blanks : [];

      if (!passage || !Array.isArray(blanksInput) || blanksInput.length === 0) {
        throw new Error(`Invalid item structure at index ${index}`);
      }

      const blanks = blanksInput.map((b: any, i: number) => {
        let idNum = Number(b?.id);
        if (!Number.isFinite(idNum) || idNum <= 0) idNum = Number(b?.index);
        if (!Number.isFinite(idNum) || idNum <= 0) idNum = i + 1;

        let answer = b?.answer;
        if (Array.isArray(answer)) answer = answer[0];
        if (answer && typeof answer === 'object') {
          answer = answer.text || answer.value || answer.answer || '';
        }
        answer = toStringSafe(answer);

        // 生成阶段现在仅需要参考答案，以下字段置空/默认
        const acceptable: string[] = [];
        const distractors: string[] = [];
        const explanation: string = '';
        let type = toStringSafe(b?.type).toLowerCase();
        if (!validTypes.has(type)) type = 'vocabulary';

        if (!answer) {
          throw new Error(`Invalid blank structure at item ${index}, blank ${i}`);
        }

        return { id: idNum, answer, acceptable, distractors, explanation, type };
      });

      return {
        lang,
        level,
        topic: topic || '',
        title,
        passage,
        blanks,
        ai_provider: provider,
        ai_model: model!,
        ai_usage: normUsage(result.usage)
      };
    });

    return NextResponse.json({ 
      success: true, 
      items,
      usage: result.usage 
    });

  } catch (error) {
    console.error('Cloze generation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
