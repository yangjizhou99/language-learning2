export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel 函数最长执行时间（SSE更稳）

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";
import { normUsage } from "@/lib/ai/usage";

type Lang = "en"|"ja"|"zh";
type Task = { topic: string; level: number };

function sse(obj: any) { return `data: ${JSON.stringify(obj)}\n\n`; }

// 重试机制
function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const code = err?.status || err?.response?.status;
      if (i < retries && (code === 429 || code === 503)) {
        await sleep(500 * Math.pow(2, i)); // 指数退避
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// 系统提示词
const SYS_ALIGN = "You are a curriculum designer for language training. Return VALID JSON only.";
const SYS_CLOZE = "You generate CLOZE passages for language learning. Return VALID JSON only.";
const SYS_SHADOW = "You create concise shadowing scripts for language learners. Return VALID JSON only.";

// 提示词生成函数
function promptAlignment({ lang, topic, style, batchSize }: { lang: Lang; topic: string; style: any; batchSize: number }) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  return `LANG=${L}\nTOPIC=${topic}\nSTYLE=${JSON.stringify(style || {})}\nCOUNT=${batchSize}\nCreate ${batchSize} 6-step alignment packs (D1→W6) as JSON array. Return {"items":[...]}`;
}

function promptCloze(params: { lang: Lang; level: number; topic: string; blanksRange: [number, number]; weights: { connector: number; collocation: number; grammar: number }; batchSize: number }) {
  const { lang, level, topic, blanksRange, weights, batchSize } = params;
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  const length = level <= 2 ? '80~140' : level === 3 ? '120~180' : level === 4 ? '150~220' : '180~260';
  return `LANG=${L}\nLEVEL=L${level}\nTOPIC=${topic}\nLENGTH=${length} ${lang === 'en' ? 'words' : '字'}\nBLANKS=${blanksRange[0]}-${blanksRange[1]}\nFOCUS_WEIGHTS=${JSON.stringify(weights)}\nCOUNT=${batchSize}\nTASK: Create ${batchSize} cloze items with placeholders {{1}}, {{2}}, ... and detailed blanks array. Return {"items":[...]}`;
}

function promptShadow({ lang, level, topic, genre, register, sentRange, batchSize }: { lang: Lang; level: number; topic: string; genre: string; register: 'casual' | 'neutral' | 'formal'; sentRange: [number, number]; batchSize: number }) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  
  // 根据等级设置字数要求
  const wordCount = level <= 2 ? '30-50' : level === 3 ? '50-80' : level === 4 ? '80-120' : '120-180';
  const complexity = level <= 2 ? 'simple' : level === 3 ? 'intermediate' : level === 4 ? 'advanced' : 'expert';
  
  return `LANG=${L}\nLEVEL=L${level}\nTOPIC=${topic}\nGENRE=${genre}\nREGISTER=${register}\nSENTENCES=${sentRange[0]}-${sentRange[1]}\nCOUNT=${batchSize}\nWORD_COUNT=${wordCount} words\nCOMPLEXITY=${complexity}\n\nTASK: Write ${batchSize} ${genre} shadowing scripts about "${topic}". Each script must be ${wordCount} words long and include natural dialogue between 2-3 people. Use ${complexity} level vocabulary and grammar. Make it engaging and educational for language learners.\n\nDIALOGUE FORMAT: Format the dialogue with clear speaker labels and line breaks:\nA: Hello, how are you today?\nB: I'm doing great, thank you! How about you?\nA: I'm fine too. What are you planning to do this weekend?\n\nIMPORTANT: Return ONLY valid JSON in this exact format:\n{\n  "items": [\n    {\n      "title": "Script title here",\n      "passage": "A: First speaker's line\\nB: Second speaker's line\\nA: Response line\\nB: Final line",\n      "notes": {\n        "key_phrases": ["phrase1", "phrase2"],\n        "pacing": "slow/medium/fast",\n        "tips": "learning tips here"\n      }\n    }\n  ]\n}\n\nMake sure the "passage" field contains the full dialogue text with proper line breaks between speakers (use \\n for line breaks).`;
}

// 单个任务执行函数
async function runOne(kind: 'alignment' | 'cloze' | 'shadowing', task: Task, params: any, supabase: any, auth: any) {
  const { lang, provider, model, temperature, batchSize } = params;
  
  let sys = "";
  let userPrompt = "";
  
  if (kind === 'alignment') {
    sys = SYS_ALIGN;
    userPrompt = promptAlignment({ lang, topic: task.topic, style: params.style || {}, batchSize });
  } else if (kind === 'cloze') {
    const auto = params.autoBlanks === true;
    const range = auto ? estimateBlanks(lang, task.level) : (params.blanksRange || [6, 10]);
    sys = SYS_CLOZE;
    userPrompt = promptCloze({ lang, level: task.level, topic: task.topic, blanksRange: range, weights: params.weights || { connector: 0.4, collocation: 0.3, grammar: 0.3 }, batchSize });
  } else {
    sys = SYS_SHADOW;
    userPrompt = promptShadow({ lang, level: task.level, topic: task.topic, genre: params.genre || 'monologue', register: params.register || 'neutral', sentRange: params.sentRange || [6, 10], batchSize });
  }

  const { content, usage } = await chatJSON({
    provider,
    model,
    temperature,
    response_json: true,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: userPrompt }
    ]
  });

  const u = normUsage(usage);
  let savedTable = '';
  let savedCount = 0;

  // 解析并批量写入草稿
  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed.items) ? parsed.items : [parsed];
  
  // 调试信息：记录AI返回的内容
  console.log(`AI Response for topic "${task.topic}":`, {
    rawContent: content,
    parsed: parsed,
    items: items,
    itemsLength: items.length
  });

  if (kind === 'alignment') {
    const rows = items.map((item: any) => ({
      lang,
      topic: task.topic,
      steps: item.steps || item,
      preferred_style: params.style || {},
      ai_provider: provider,
      ai_model: model,
      ai_usage: u,
      status: 'draft',
      created_by: auth.user.id
    }));
    
    if (rows.length) {
      const { error } = await supabase.from('alignment_packs').insert(rows);
      if (error) throw new Error(error.message);
      savedTable = 'alignment_packs';
      savedCount = rows.length;
    }
  } else if (kind === 'cloze') {
    const rows = items.map((item: any) => ({
      lang,
      level: task.level,
      topic: task.topic,
      title: String(item.title || 'Untitled').slice(0, 100),
      passage: String(item.passage || item.text || ''),
      blanks: item.blanks || [],
      ai_provider: provider,
      ai_model: model,
      ai_usage: u,
      status: 'draft',
      created_by: auth.user.id
    }));
    
    if (rows.length) {
      const { error } = await supabase.from('cloze_drafts').insert(rows);
      if (error) throw new Error(error.message);
      savedTable = 'cloze_drafts';
      savedCount = rows.length;
    }
  } else {
    const rows = items.map((item: any) => {
      const title = String(item.title || 'Untitled');
      let passage = String(item.passage || item.text || '').trim();
      const notes = item.notes || {};
      
      // 处理对话换行：确保每个说话者的话都在新行
      // 首先处理AI返回的\n换行符
      passage = passage.replace(/\\n/g, '\n');
      
      // 如果已经包含换行符，保持格式
      if (passage.includes('\n')) {
        // 清理多余的空行
        passage = passage
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
      } else if (passage.includes(':')) {
        // 如果包含冒号，按冒号分割并换行
        passage = passage
          .split(/(?<=[.!?])\s*(?=[A-Z])/) // 按句子分割
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n'); // 句子间单换行
      } else if (passage.includes('"')) {
        // 如果包含引号，按引号分割并换行
        passage = passage
          .split(/(?<=")\s*(?=")/) // 按引号分割
          .map(line => line.trim().replace(/^"|"$/g, '')) // 移除首尾引号
          .filter(line => line.length > 0)
          .join('\n'); // 对话间单换行
      }
      
      // 调试信息：检查字段内容
      console.log(`Item for topic "${task.topic}":`, {
        item: item,
        title: title,
        passage: passage,
        passageLength: passage.length,
        availableFields: Object.keys(item)
      });
      
      // 根据等级调整最小长度要求
      const minLength = task.level <= 2 ? 20 : task.level === 3 ? 40 : task.level === 4 ? 60 : 80;
      
      // 如果文本太短，记录详细信息
      if (passage.length < minLength) {
        console.error(`Text too short for topic "${task.topic}" (Level ${task.level}):`, {
          passage: passage,
          length: passage.length,
          minRequired: minLength,
          item: item,
          allFields: Object.keys(item)
        });
        throw new Error(`文本过短: 长度${passage.length}，等级${task.level}要求至少${minLength}字符`);
      }
      
      return {
        lang,
        level: task.level,
        topic: task.topic,
        genre: params.genre || 'monologue',
        register: params.register || 'neutral',
        title,
        text: passage,
        notes,
        ai_provider: provider,
        ai_model: model,
        ai_usage: u,
        status: 'draft',
        created_by: auth.user.id
      };
    });
    
    if (rows.length) {
      const { error } = await supabase.from('shadowing_drafts').insert(rows);
      if (error) throw new Error(error.message);
      savedTable = 'shadowing_drafts';
      savedCount = rows.length;
    }
  }

  return { savedTable, savedCount, usage: u };
}

function estimateBlanks(lang: Lang, level: number) {
  const targetLen = level <= 2 ? (lang === 'en' ? 100 : 140) : level === 3 ? (lang === 'en' ? 150 : 180) : level === 4 ? (lang === 'en' ? 190 : 220) : (lang === 'en' ? 220 : 260);
  const min = Math.max(3, Math.round(targetLen / (lang === 'en' ? 55 : 60)) + Math.floor(level / 2));
  const max = min + 2;
  return [min, max] as [number, number];
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return new Response("forbidden", { status: 403 });
  const supabase = auth.supabase;

  const body = await req.json();
  const { kind, params } = body as { kind: 'alignment' | 'cloze' | 'shadowing'; params: any };

  // 解析组合
  const topics: string[] = String(params.topicsText || "").split("\n").map((s: string) => s.trim()).filter(Boolean);
  const levels: number[] = Array.isArray(params.levels) ? params.levels.map((n: any) => Number(n)) : [Number(params.level || 3)];
  const perCombo = Math.max(1, Math.min(50, Number(params.perCombo) || 1));
  const lang = (params.lang || 'en').toLowerCase() as Lang;
  const provider = (params.provider || 'openrouter') as 'openrouter' | 'deepseek';
  const model = params.model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'deepseek-chat');
  const temperature = params.temperature ?? 0.5;

  // 性能参数
  const concurrency = Math.min(8, Math.max(1, Number(params.concurrency) || 4));
  const retries = Math.min(5, Math.max(0, Number(params.retries) || 2));
  const throttle = Math.max(0, Number(params.throttle_ms) || 0);
  const batchSize = Math.min(10, Math.max(1, Number(params.batch_size) || 1));

  const tasks: Task[] = [];
  for (const topic of (topics.length ? topics : ['General'])) {
    for (const lv of levels) {
      for (let i = 0; i < perCombo; i++) tasks.push({ topic, level: lv });
    }
  }

  const encoder = new TextEncoder();
  let done = 0;
  let aggUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(sse({ type: "start", total: tasks.length })));

      let idx = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (idx < tasks.length) {
          const i = idx++;
          const task = tasks[i];
          
          try {
            controller.enqueue(encoder.encode(sse({ type: "progress", idx: i, topic: task.topic, level: task.level })));
            
            const res: any = await withRetry(() => runOne(kind, task, { ...params, lang, provider, model, temperature, batchSize }, supabase, auth), retries);
            
            aggUsage.prompt_tokens += res.usage?.prompt_tokens || 0;
            aggUsage.completion_tokens += res.usage?.completion_tokens || 0;
            aggUsage.total_tokens += res.usage?.total_tokens || 0;
            
            done += res.savedCount || 1;
            controller.enqueue(encoder.encode(sse({ 
              type: "saved", 
              idx: i, 
              done, 
              total: tasks.length, 
              saved: { table: res.savedTable, count: res.savedCount },
              usage: aggUsage 
            })));
          } catch (err: any) {
            done++;
            const errorMsg = String(err?.message || err);
            console.error(`Task ${i} failed:`, errorMsg);
            controller.enqueue(encoder.encode(sse({ 
              type: "error", 
              idx: i, 
              done, 
              total: tasks.length, 
              message: errorMsg
            })));
          }
          
          if (throttle) await sleep(throttle);
        }
      });

      await Promise.all(workers);
      controller.enqueue(encoder.encode(sse({ type: "done", total: tasks.length })));
      controller.close();
    }
  });

  return new Response(stream, { 
    headers: { 
      'Content-Type': 'text/event-stream; charset=utf-8', 
      'Cache-Control': 'no-cache', 
      'Connection': 'keep-alive' 
    } 
  });
}


