export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";
import { normUsage } from "@/lib/ai/usage";

type Lang = "en"|"ja"|"zh";

function sse(obj: any) { return `data: ${JSON.stringify(obj)}\n\n`; }

const SYS_ALIGN = "You are a curriculum designer for language training. Return VALID JSON only.";
function promptAlignment({ lang, topic, style }:{ lang:Lang, topic:string, style:any }){
  const L = lang==='en'? 'English' : lang==='ja'? '日本語' : '简体中文';
  return `LANG=${L}\nTOPIC=${topic}\nSTYLE=${JSON.stringify(style||{})}\nCreate ONE 6-step alignment pack (D1→W6) as JSON.`;
}

const SYS_CLOZE = "You generate CLOZE passages for language learning. Return VALID JSON only.";
function promptCloze(params: { lang: Lang; level: number; topic: string; blanksRange: [number, number]; weights: { connector: number; collocation: number; grammar: number } }) {
  const { lang, level, topic, blanksRange, weights } = params;
  const L = lang==='en'? 'English' : lang==='ja'? '日本語' : '简体中文';
  const length = level<=2? '80~140' : level===3? '120~180' : level===4? '150~220':'180~260';
  return `LANG=${L}\nLEVEL=L${level}\nTOPIC=${topic}\nLENGTH=${length} ${lang==='en'?'words':'字'}\nBLANKS=${blanksRange[0]}-${blanksRange[1]}\nFOCUS_WEIGHTS=${JSON.stringify(weights)}\nTASK: Create 1 cloze item with placeholders {{1}}, {{2}}, ... and detailed blanks array. Return {"items":[...]}`;
}

const SYS_SHADOW = "You create concise shadowing scripts for language learners. Return VALID JSON only.";
function promptShadow({ lang, level, topic, genre, register, sentRange }:{ lang:Lang, level:number, topic:string, genre:string, register:'casual'|'neutral'|'formal', sentRange:[number,number] }){
  const L = lang==='en'? 'English' : lang==='ja'? '日本語' : '简体中文';
  return `LANG=${L}\nLEVEL=L${level}\nTOPIC=${topic}\nGENRE=${genre}\nREGISTER=${register}\nSENTENCES=${sentRange[0]}-${sentRange[1]}\nTASK: Write one ${genre} shadowing script with multiple sentences. Provide JSON: { "title":"...", "passage":"...", "notes": { "key_phrases": ["..."], "pacing":"...", "tips":"..." } }`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return new Response("forbidden", { status: 403 });
  const supabase = auth.supabase;

  const body = await req.json();
  const { kind, params } = body as { kind: 'alignment' | 'cloze' | 'shadowing'; params: any };

  // 解析组合
  const topics: string[] = String(params.topicsText||"").split("\n").map((s:string)=>s.trim()).filter(Boolean);
  const levels: number[] = Array.isArray(params.levels) ? params.levels.map((n:any)=> Number(n)) : [Number(params.level||3)];
  const perCombo = Math.max(1, Math.min(50, Number(params.perCombo)||1));
  const lang = (params.lang||'en').toLowerCase() as Lang;
  const provider = (params.provider||'openrouter') as 'openrouter'|'deepseek';
  const model = params.model || (provider==='openrouter' ? 'openai/gpt-4o-mini' : 'deepseek-chat');
  const temperature = params.temperature ?? 0.5;

  const tasks: { topic:string; level:number }[] = [];
  for (const topic of (topics.length? topics : ['General'])){
    for (const lv of levels){
      for (let i=0;i<perCombo;i++) tasks.push({ topic, level: lv });
    }
  }

  function estimateBlanks(lang: Lang, level: number) {
    const targetLen = level<=2? (lang==='en'? 100:140) : level===3? (lang==='en'? 150:180) : level===4? (lang==='en'? 190:220) : (lang==='en'? 220:260);
    // 每 ~40-60 词/字一个空，随等级略增
    const min = Math.max(3, Math.round(targetLen / (lang==='en'? 55: 60)) + Math.floor(level/2));
    const max = min + 2;
    return [min, max] as [number,number];
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(sse({ type:"start", total: tasks.length })));

      let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } as any;
      let done = 0;

      for (const [idx, t] of tasks.entries()){
        controller.enqueue(encoder.encode(sse({ type:"progress", idx, topic: t.topic, level: t.level })));
        try {
          let sys = ""; let userPrompt = "";
          if (kind === 'alignment') { sys = SYS_ALIGN; userPrompt = promptAlignment({ lang, topic: t.topic, style: params.style||{} }); }
          else if (kind === 'cloze') {
            const auto = params.autoBlanks === true;
            const range = auto ? estimateBlanks(lang, t.level) : (params.blanksRange || [6,10]);
            sys = SYS_CLOZE; userPrompt = promptCloze({ lang, level: t.level, topic: t.topic, blanksRange: range, weights: params.weights || { connector: 0.4, collocation: 0.3, grammar: 0.3 } });
          }
          else { sys = SYS_SHADOW; userPrompt = promptShadow({ lang, level: t.level, topic: t.topic, genre: params.genre||'monologue', register: params.register||'neutral', sentRange: params.sentRange||[6,10] }); }

          const { content, usage } = await chatJSON({ provider, model, temperature, response_json: true, messages: [ { role:"system", content: sys }, { role:"user", content: userPrompt } ] });
          const u = normUsage(usage);
          totalUsage = {
            prompt_tokens: (totalUsage.prompt_tokens||0) + (u.prompt_tokens||0),
            completion_tokens: (totalUsage.completion_tokens||0) + (u.completion_tokens||0),
            total_tokens: (totalUsage.total_tokens||0) + (u.total_tokens||0)
          };

          // 解析并写入草稿
          if (kind === 'alignment') {
            let pack: any; try { pack = JSON.parse(content); } catch { throw new Error("LLM 未返回 JSON"); }
            const { error } = await supabase.from('alignment_packs').insert([{
              lang, topic: t.topic, steps: pack.steps || pack, preferred_style: params.style||{}, ai_provider: provider, ai_model: model, ai_usage: u, status: 'draft', created_by: auth.user.id
            }]);
            if (error) throw new Error(error.message);
          } else if (kind === 'cloze') {
            let parsed: any; try { parsed = JSON.parse(content); } catch { throw new Error("LLM 未返回 JSON"); }
            const item = Array.isArray(parsed.items) ? parsed.items[0] : parsed;
            const { error } = await supabase.from('cloze_drafts').insert([{
              lang, level: t.level, topic: t.topic, title: String(item.title||'Untitled'), passage: String(item.passage||item.text||''), blanks: item.blanks || [], ai_provider: provider, ai_model: model, ai_usage: u, status: 'draft', created_by: auth.user.id
            }]);
            if (error) throw new Error(error.message);
          } else {
            let parsed: any; try { parsed = JSON.parse(content); } catch { throw new Error("LLM 未返回 JSON"); }
            const title = String(parsed.title || 'Untitled');
            const passage = String(parsed.passage || parsed.text || '').trim();
            const notes = parsed.notes || {};
            if (passage.length < 20) throw new Error('文本过短');
            const { error } = await supabase.from('shadowing_drafts').insert([{
              lang, level: t.level, topic: t.topic, genre: params.genre||'monologue', register: params.register||'neutral', title, text: passage, notes, ai_provider: provider, ai_model: model, ai_usage: u, status: 'draft', created_by: auth.user.id
            }]);
            if (error) throw new Error(error.message);
          }

          done++;
          controller.enqueue(encoder.encode(sse({ type:"saved", idx, done, total: tasks.length, usage: totalUsage })));
        } catch (e: any) {
          controller.enqueue(encoder.encode(sse({ type:"error", idx, message: e?.message||String(e) })));
        }
      }

      controller.enqueue(encoder.encode(sse({ type:"done", total: tasks.length })));
      controller.close();
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
}


