export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { normUsage } from '@/lib/ai/usage';

const SYS = `You generate CLOZE passages for language learning. Return VALID JSON only. For each blank, only a single reference answer is required.`;

function generateBlanksFromPassage(passage: string, lang: 'en' | 'ja' | 'zh', level: number) {
  const target = level <= 2 ? 3 : level === 3 ? 5 : 6;
  const blanks: Array<{ id: number; answer: string; type: string }> = [];
  let out = passage;

  // 面向“任何词都可挖空”的统一策略：对所有词做候选，等距取样
  const tokens = out.split(/(\s+|，|。|、|；|：|！|？|\.|,|;|:|!|\?|\)|\(|\]|\[|"|')/);
  const words = tokens.filter((w) => w && !/^\s+$/.test(w));
  const candidates = words.filter(
    (w) =>
      /[A-Za-z\u3040-\u30ff\u4e00-\u9fa5]/.test(w) &&
      !/^\{\{\d+\}\}$/.test(w) &&
      !/^https?:\/\//i.test(w),
  );
  if (candidates.length === 0) return { passage: out, blanks };

  const N = Math.max(1, Math.min(target, candidates.length));
  const step = Math.max(1, Math.floor(candidates.length / N));
  const picked: string[] = [];
  for (let i = 0; i < candidates.length && picked.length < N; i += step) picked.push(candidates[i]);

  for (const word of picked) {
    const id = blanks.length + 1;
    const before = out;
    out = out.replace(word, `{{${id}}}`);
    if (before !== out) blanks.push({ id, answer: word, type: 'vocabulary' });
  }

  return { passage: out, blanks };
}

// 从原始文本宽松提取一个 item（即使 JSON 不完整）
function salvageItemFromText(raw: string, lang: 'en' | 'ja' | 'zh', level: number) {
  if (typeof raw !== 'string' || raw.indexOf('passage') === -1) return null;

  const extractString = (key: string): string => {
    const keyRe = new RegExp(`"${key}"\\s*:\\s*"`);
    const m = raw.match(keyRe);
    if (!m) return '';
    let i = (m.index || 0) + m[0].length;
    let out = '';
    let escape = false;
    for (; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') break;
      out += ch;
    }
    return out;
  };

  const title = extractString('title') || '';
  let passage = extractString('passage');
  if (!passage) return null;

  // 提取 blanks：宽松匹配 id 与其后的 answer（允许结构不闭合）
  const blanks: Array<{ id: number; answer: string; type: string }> = [];
  const re = /"id"\s*:\s*(\d+)[\s\S]*?"answer"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const id = Number(m[1]);
    const ans = m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n');
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    blanks.push({ id, answer: ans, type: 'vocabulary' });
  }

  // 如果未能抽取到 blanks，则尝试从 passage 兜底生成
  if (blanks.length === 0) {
    const auto = generateBlanksFromPassage(passage, lang, level);
    passage = auto.passage;
    auto.blanks.forEach((b) => blanks.push(b));
  }

  if (blanks.length === 0) return null;
  return { title, passage, blanks };
}

function extractArrayFromObject(obj: any): any[] | null {
  if (!obj || typeof obj !== 'object') return null;
  const candidateKeys = [
    'items',
    'data',
    'result',
    'output',
    'questions',
    'cloze',
    'list',
    'samples',
    'examples',
    'records',
    'entries',
    'item',
  ];
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

function buildPrompt({
  lang,
  level,
  count,
  topic,
}: {
  lang: 'en' | 'ja' | 'zh';
  level: number;
  count: number;
  topic?: string;
}) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  const focus =
    lang === 'en'
      ? 'any word can be clozed (no restriction on word classes), keep natural flow'
      : lang === 'ja'
        ? '任意词语（含かな/漢字）均可作为空白（不限词类），保持语段自然'
        : '任何词都可以作为空白（不限词类），注意上下文自然流畅';
  const length =
    level <= 2 ? '80~140' : level === 3 ? '120~180' : level === 4 ? '150~220' : '180~260';

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
      "type": "vocabulary|grammar|connector|particle (optional)"
    }
  ]
}

RULES:
- Use {{1}}, {{2}}, {{3}} ... for blanks in passage
- Include ${level <= 2 ? '3-5' : level === 3 ? '4-7' : '5-8'} blanks per passage
- Only provide a single reference answer per blank (no alternatives needed)
- Any word can be blank; avoid breaking numbers/URLs; keep natural flow
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
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    console.log('✅ Admin check passed');

    const {
      lang,
      level,
      count = 3,
      topic,
      provider = 'deepseek',
      model: requestedModel,
    } = await req.json();
    console.log('📋 Request params:', {
      lang,
      level,
      count,
      topic,
      provider,
      model: requestedModel,
    });

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
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      response_json: true,
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
      // 尝试从原始输出打捞为单题数组以继续流程
      const salvage = salvageItemFromText(result.content, lang, level);
      if (salvage) {
        data = [salvage];
      } else {
        console.error('AI Response (unparsed):', result.content);
        return NextResponse.json({ error: 'AI response is not an array' }, { status: 500 });
      }
    }

    // 规范化与验证生成的数据结构（更宽容）
    const validTypes = new Set(['grammar', 'vocabulary', 'connector', 'particle']);
    const toStringSafe = (v: any) => (v === null || v === undefined ? '' : String(v));
    const ensureStringArray = (v: any): string[] => {
      if (Array.isArray(v)) return v.map(toStringSafe).filter(Boolean);
      if (v === null || v === undefined || v === '') return [];
      return [toStringSafe(v)];
    };

    const items = data
      .map((rawItem: any, index: number) => {
        const title = toStringSafe(rawItem?.title) || `Cloze L${level} #${index + 1}`;
        // 更宽容地获取 passage 字段
        const passage =
          toStringSafe(rawItem?.passage) ||
          toStringSafe(rawItem?.text) ||
          toStringSafe(rawItem?.content) ||
          toStringSafe(rawItem?.cloze_text) ||
          toStringSafe(rawItem?.body);

        // 更宽容地获取 blanks：支持数组、对象映射、answers/gaps/holes 等别名
        let blanksInput: any[] = Array.isArray(rawItem?.blanks) ? rawItem.blanks : [];
        if (
          (!blanksInput || blanksInput.length === 0) &&
          rawItem &&
          typeof rawItem?.blanks === 'object' &&
          !Array.isArray(rawItem?.blanks)
        ) {
          blanksInput = Object.entries(rawItem.blanks).map(([k, v]) => ({
            id: Number(k),
            answer: v,
          }));
        }
        if ((!blanksInput || blanksInput.length === 0) && Array.isArray(rawItem?.answers)) {
          blanksInput = rawItem.answers.map((v: any, i: number) => ({ id: i + 1, answer: v }));
        }
        if (
          (!blanksInput || blanksInput.length === 0) &&
          rawItem &&
          typeof rawItem?.answers === 'object' &&
          !Array.isArray(rawItem?.answers)
        ) {
          blanksInput = Object.entries(rawItem.answers).map(([k, v]) => ({
            id: Number(k),
            answer: v,
          }));
        }
        if ((!blanksInput || blanksInput.length === 0) && Array.isArray(rawItem?.gaps)) {
          blanksInput = rawItem.gaps;
        }
        if ((!blanksInput || blanksInput.length === 0) && Array.isArray(rawItem?.holes)) {
          blanksInput = rawItem.holes;
        }

        // 如果仍为空，尝试从 passage 中多种占位符回推空白位
        if ((!blanksInput || blanksInput.length === 0) && passage) {
          const patterns: RegExp[] = [
            /\{\{\s*(\d+)\s*\}\}/g, // {{1}}
            /\[(\d+)\]/g, // [1]
            /\((\d+)\)/g, // (1)
            /<\s*blank\s*(\d+)\s*>/gi, // <blank1>
            /blank\s*(\d+)/gi, // blank1
            /_{3,}/g, // ____ (无法编号，仅占位计数)
          ];
          let ids: number[] = [];
          for (const re of patterns.slice(0, 5)) {
            const found = Array.from(passage.matchAll(re))
              .map((m) => Number(m[1]))
              .filter((n) => Number.isFinite(n));
            ids.push(...found);
          }
          if (ids.length === 0) {
            // 退化为根据下划线段数量生成顺序编号
            const underscores = Array.from(passage.matchAll(patterns[5]));
            if (underscores.length > 0) ids = underscores.map((_, i) => i + 1);
          }
          if (ids.length > 0) {
            blanksInput = ids.map((id, i) => ({
              id,
              answer: toStringSafe(
                (rawItem?.answers &&
                  (Array.isArray(rawItem.answers)
                    ? rawItem.answers[id - 1]
                    : rawItem.answers?.[id])) ||
                  '',
              ),
            }));
          }
        }

        // 若有文章但无空格，尝试兜底自动生成空格
        if (passage && (!Array.isArray(blanksInput) || blanksInput.length === 0)) {
          const auto = generateBlanksFromPassage(passage, lang, level);
          blanksInput = auto.blanks;
          if (auto.passage) {
            rawItem = { ...rawItem, passage: auto.passage };
          }
        }

        // 若仍缺关键字段，则跳过此条，而不是抛错
        if (!passage || !Array.isArray(blanksInput) || blanksInput.length === 0) return null;

        const blanks = blanksInput
          .map((b: any, i: number) => {
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

            // 不再因为空答案直接抛错，允许管理员后续在前端补齐
            return { id: idNum, answer, acceptable, distractors, explanation, type };
          })
          .filter((x: any) => Number.isFinite(x?.id));

        if (!blanks.length) return null;

        return {
          lang,
          level,
          topic: topic || '',
          title,
          passage,
          blanks,
          ai_provider: provider,
          ai_model: model!,
          ai_usage: normUsage(result.usage),
        } as const;
      })
      .filter(Boolean);

    if (!items.length) {
      console.warn('First parse produced 0 items, attempting structured repair...');

      // 二次纠错请求：强制要求返回所需 JSON 数组
      const repair = await chatJSON({
        provider: provider as 'deepseek' | 'openrouter' | 'openai',
        model: model!,
        messages: [
          {
            role: 'system',
            content:
              'You ONLY return a VALID JSON array that matches the required schema for cloze items. No extra text.',
          },
          {
            role: 'user',
            content: `Given the following output, convert it into a JSON array of items with fields: title (string), passage (string with {{1}}, {{2}}...), blanks (array of { id:number, answer:string, type?:"grammar|vocabulary|connector|particle" }). Do not include explanations or alternative answers. Output JSON array only.\n\nOUTPUT TO CONVERT:\n${result.content}`,
          },
        ],
        temperature: 0.2,
        response_json: true,
      });

      let repaired = tryParseJson<any>(repair.content);
      if (!Array.isArray(repaired) && repaired && typeof repaired === 'object') {
        const arr = extractArrayFromObject(repaired);
        if (arr) repaired = arr;
      }
      if (!Array.isArray(repaired)) {
        const m = repair.content.match(/\[[\s\S]*\]/);
        if (m) {
          const p = tryParseJson<any>(m[0]);
          if (Array.isArray(p)) repaired = p;
        }
      }

      if (Array.isArray(repaired)) {
        const items2 = repaired
          .map((rawItem: any, index: number) => {
            const title = toStringSafe(rawItem?.title) || `Cloze L${level} #${index + 1}`;
            const passage =
              toStringSafe(rawItem?.passage) ||
              toStringSafe(rawItem?.text) ||
              toStringSafe(rawItem?.content) ||
              toStringSafe(rawItem?.cloze_text) ||
              toStringSafe(rawItem?.body);
            let blanksInput: any[] = Array.isArray(rawItem?.blanks) ? rawItem.blanks : [];
            if (
              (!blanksInput || blanksInput.length === 0) &&
              rawItem &&
              typeof rawItem?.blanks === 'object' &&
              !Array.isArray(rawItem?.blanks)
            ) {
              blanksInput = Object.entries(rawItem.blanks).map(([k, v]) => ({
                id: Number(k),
                answer: v,
              }));
            }
            if ((!blanksInput || blanksInput.length === 0) && Array.isArray(rawItem?.answers)) {
              blanksInput = rawItem.answers.map((v: any, i: number) => ({ id: i + 1, answer: v }));
            }
            if (
              (!blanksInput || blanksInput.length === 0) &&
              rawItem &&
              typeof rawItem?.answers === 'object' &&
              !Array.isArray(rawItem?.answers)
            ) {
              blanksInput = Object.entries(rawItem.answers).map(([k, v]) => ({
                id: Number(k),
                answer: v,
              }));
            }
            if ((!blanksInput || blanksInput.length === 0) && Array.isArray(rawItem?.gaps)) {
              blanksInput = rawItem.gaps;
            }
            if ((!blanksInput || blanksInput.length === 0) && Array.isArray(rawItem?.holes)) {
              blanksInput = rawItem.holes;
            }
            if ((!blanksInput || blanksInput.length === 0) && passage) {
              const patterns: RegExp[] = [
                /\{\{\s*(\d+)\s*\}\}/g,
                /\[(\d+)\]/g,
                /\((\d+)\)/g,
                /<\s*blank\s*(\d+)\s*>/gi,
                /blank\s*(\d+)/gi,
                /_{3,}/g,
              ];
              let ids: number[] = [];
              for (const re of patterns.slice(0, 5)) {
                const found = Array.from(passage.matchAll(re))
                  .map((m) => Number(m[1]))
                  .filter((n) => Number.isFinite(n));
                ids.push(...found);
              }
              if (ids.length === 0) {
                const underscores = Array.from(passage.matchAll(patterns[5]));
                if (underscores.length > 0) ids = underscores.map((_, i) => i + 1);
              }
              if (ids.length > 0) {
                blanksInput = ids.map((id, i) => ({
                  id,
                  answer: toStringSafe(
                    (rawItem?.answers &&
                      (Array.isArray(rawItem.answers)
                        ? rawItem.answers[id - 1]
                        : rawItem.answers?.[id])) ||
                      '',
                  ),
                }));
              }
            }
            if (passage && (!Array.isArray(blanksInput) || blanksInput.length === 0)) {
              const auto = generateBlanksFromPassage(passage, lang, level);
              blanksInput = auto.blanks;
              if (auto.passage) {
                rawItem = { ...rawItem, passage: auto.passage };
              }
            }
            if (!passage || !Array.isArray(blanksInput) || blanksInput.length === 0) return null;
            const blanks = blanksInput
              .map((b: any, i: number) => {
                let idNum = Number(b?.id);
                if (!Number.isFinite(idNum) || idNum <= 0) idNum = Number(b?.index);
                if (!Number.isFinite(idNum) || idNum <= 0) idNum = i + 1;
                let answer = b?.answer;
                if (Array.isArray(answer)) answer = answer[0];
                if (answer && typeof answer === 'object') {
                  answer = answer.text || answer.value || answer.answer || '';
                }
                answer = toStringSafe(answer);
                const acceptable: string[] = [];
                const distractors: string[] = [];
                const explanation: string = '';
                let type = toStringSafe(b?.type).toLowerCase();
                if (!validTypes.has(type)) type = 'vocabulary';
                return { id: idNum, answer, acceptable, distractors, explanation, type };
              })
              .filter((x: any) => Number.isFinite(x?.id));
            if (!blanks.length) return null;
            return {
              lang,
              level,
              topic: topic || '',
              title,
              passage,
              blanks,
              ai_provider: provider,
              ai_model: model!,
              ai_usage: normUsage(repair.usage || result.usage),
            } as const;
          })
          .filter(Boolean);

        if (items2.length) {
          return NextResponse.json({
            success: true,
            items: items2,
            usage: repair.usage || result.usage,
          });
        }
      }

      // 最后一层兜底：从原始文本强行打捞一个可用 item
      const salvage =
        salvageItemFromText(result.content, lang, level) ||
        (typeof repair.content === 'string'
          ? salvageItemFromText(repair.content, lang, level)
          : null);
      if (salvage) {
        const item = {
          lang,
          level,
          topic: topic || '',
          title: toStringSafe(salvage.title) || `Cloze L${level} #1`,
          passage: toStringSafe(salvage.passage),
          blanks: salvage.blanks.map((b) => ({
            id: b.id,
            answer: toStringSafe(b.answer),
            acceptable: [],
            distractors: [],
            explanation: '',
            type: validTypes.has(String(b.type).toLowerCase())
              ? String(b.type).toLowerCase()
              : 'vocabulary',
          })),
          ai_provider: provider,
          ai_model: model!,
          ai_usage: normUsage(repair.usage || result.usage),
        } as const;
        return NextResponse.json({
          success: true,
          items: [item],
          usage: repair.usage || result.usage,
        });
      }

      console.error(
        'No valid cloze items after repair. Raw (first):',
        result.content?.slice(0, 500),
      );
      console.error(
        'No valid cloze items after repair. Raw (repair):',
        (typeof repaired === 'string' ? repaired : repair.content)?.slice(0, 500),
      );
      return NextResponse.json(
        {
          error:
            'AI 返回数据结构不完整，未解析到有效题目。已尝试自动修复失败，请减少题量（count=1）、降低温度（0.3-0.4）或更换模型/提供商后重试。',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      items,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Cloze generation error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
