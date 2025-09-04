"use client";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Lang = "en"|"ja"|"zh";
type Kind = "alignment"|"cloze"|"shadowing";

type EventMsg = { type: string; [k:string]: any };

export default function BatchGenPage(){
  const [kind, setKind] = useState<Kind>("cloze");
  const [lang, setLang] = useState<Lang>("ja");
  const [levels, setLevels] = useState<number[]>([3]);
  const [topicsText, setTopicsText] = useState("Daily life\nCampus");
  const [perCombo, setPerCombo] = useState(2);
  const [provider, setProvider] = useState<"openrouter"|"deepseek">("openrouter");
  const [model, setModel] = useState("");
  const [orModels, setOrModels] = useState<string[]|null>(null);
  const [orLoading, setOrLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.5);
  const [dsModels, setDsModels] = useState<string[]|null>(null);
  const [register, setRegister] = useState<'casual'|'neutral'|'formal'>("neutral");
  const [genre, setGenre] = useState("monologue");
  const [sentRange, setSentRange] = useState<[number,number]>([6,10]);
  const [style, setStyle] = useState<any>({ formality:"neutral", tone:"friendly", length:"medium" });
  const [blanksRange, setBlanksRange] = useState<[number,number]>([6,10]);
  const [autoBlanks, setAutoBlanks] = useState<boolean>(true);
  const [weights, setWeights] = useState({ connector:0.4, collocation:0.3, grammar:0.3 });

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [usage, setUsage] = useState<{prompt_tokens:number;completion_tokens:number;total_tokens:number}|null>(null);
  const abortRef = useRef<AbortController|null>(null);

  const params = useMemo(()=>({ kind, params: { lang, levels, topicsText, perCombo, provider, model: model || (provider==='openrouter'? 'openai/gpt-4o-mini':'deepseek-chat'), temperature, style, blanksRange, autoBlanks, weights, genre, register, sentRange } }), [kind, lang, levels, topicsText, perCombo, provider, model, temperature, style, blanksRange, autoBlanks, weights, genre, register, sentRange]);

  async function start(){
    if (running) return;
    setRunning(true);
    setLog([]);
    setUsage(null);
    setProgress({ done: 0, total: 0 });
    const ac = new AbortController(); abortRef.current = ac;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("未登录或会话失效");
      const r = await fetch("/api/admin/batch/stream", { method:"POST", headers:{"Content-Type":"application/json", Authorization: `Bearer ${session.access_token}`}, body: JSON.stringify(params), signal: ac.signal });
      if (!r.ok || !r.body) throw new Error(`请求失败: ${r.status}`);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts){
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          try {
            const msg: EventMsg = JSON.parse(json);
            if (msg.type === "start"){
              setProgress({ done:0, total: msg.total||0 });
              setLog(L=>[...L, `开始，任务数 ${msg.total}`]);
            } else if (msg.type === "progress"){
              setLog(L=>[...L, `生成中 #${(msg.idx??0)+1} [L${msg.level}] ${msg.topic}`]);
            } else if (msg.type === "saved"){
              setProgress(p=>({ done:(msg.done||p.done), total:(msg.total||p.total) }));
              if (msg.usage) setUsage(msg.usage);
              setLog(L=>[...L, `已保存 #${(msg.idx??0)+1}`]);
            } else if (msg.type === "error"){
              setLog(L=>[...L, `错误 #${(msg.idx??0)+1}: ${msg.message}`]);
            } else if (msg.type === "done"){
              setLog(L=>[...L, `完成，总数 ${msg.total}`]);
            }
          } catch {}
        }
      }
    } catch (e:any) {
      setLog(L=>[...L, `中断/失败：${e?.message||String(e)}`]);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop(){ if (abortRef.current) { abortRef.current.abort(); } }

  const toggleLevel = (n:number)=> setLevels(arr=> arr.includes(n)? arr.filter(x=>x!==n) : [...arr, n].sort((a,b)=>a-b));

  async function refreshOpenRouter(){
    try {
      setOrLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/models/openrouter', { cache: 'no-store' , headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.statusText);
      const list: string[] = Array.isArray(j.models) ? j.models.map((m:any)=> m.id || m) : [];
      if (list.length) setOrModels(list);
    } catch (e) {
      // 忽略错误，保留内置备选
    } finally {
      setOrLoading(false);
    }
  }

  async function refreshDeepSeek(){
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/models/deepseek', { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.statusText);
      const list: string[] = Array.isArray(j.models) ? j.models.map((m:any)=> m.id || m) : [];
      if (list.length) setDsModels(list);
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">批量生成中心（对齐 / Cloze / Shadowing）</h1>

      <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">类型</label>
          <select className="w-full border rounded px-2 py-1" value={kind} onChange={e=> setKind(e.target.value as Kind)}>
            <option value="alignment">alignment</option>
            <option value="cloze">cloze</option>
            <option value="shadowing">shadowing</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">语言</label>
          <select className="w-full border rounded px-2 py-1" value={lang} onChange={e=> setLang(e.target.value as Lang)}>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">简体中文</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">等级（多选 1-6/5）</label>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6].map(n=> (
              <button key={n} type="button" onClick={()=>toggleLevel(n)} className={`px-2 py-1 rounded border ${levels.includes(n)?'bg-blue-600 text-white':'bg-white'}`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">主题（每行一个）</label>
            <textarea className="w-full border rounded px-2 py-1 h-28" value={topicsText} onChange={e=> setTopicsText(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <button type="button" className="px-2 py-1 rounded border" onClick={()=> setTopicsText(defaultTopics.join('\n'))}>填充默认主题</button>
              <button type="button" className="px-2 py-1 rounded border" onClick={()=> setTopicsText(defaultExamTopics.join('\n'))}>考试/学术主题</button>
              <button type="button" className="px-2 py-1 rounded border" onClick={()=> setTopicsText(defaultBusinessTopics.join('\n'))}>商务主题</button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">每组合数量</label>
            <input className="w-full border rounded px-2 py-1" type="number" min={1} max={50} value={perCombo} onChange={e=> setPerCombo(Number(e.target.value)||1)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Provider / Model / 温度</label>
            <div className="flex gap-2">
              <select className="border rounded px-2 py-1" value={provider} onChange={e=> { setProvider(e.target.value as any); setModel(""); }}>
                <option value="openrouter">openrouter</option>
                <option value="deepseek">deepseek</option>
              </select>
              {provider==='openrouter' ? (
                <div className="flex-1 flex gap-2">
                  <select className="flex-1 border rounded px-2 py-1" value={model} onChange={e=> setModel(e.target.value)}>
                    {(orModels || openrouterModels).map(m=>(<option key={m} value={m}>{m}</option>))}
                  </select>
                  <button type="button" className="px-2 py-1 rounded border" onClick={refreshOpenRouter} disabled={orLoading}>{orLoading?"刷新中":"刷新模型"}</button>
                </div>
              ) : (
                <div className="flex-1 flex gap-2">
                  <select className="flex-1 border rounded px-2 py-1" value={model} onChange={e=> setModel(e.target.value)}>
                    {(dsModels || deepseekModels).map(m=>(<option key={m} value={m}>{m}</option>))}
                  </select>
                  <button type="button" className="px-2 py-1 rounded border" onClick={refreshDeepSeek}>刷新模型</button>
                </div>
              )}
              <input className="w-24 border rounded px-2 py-1" type="number" step={0.1} min={0} max={2} value={temperature} onChange={e=> setTemperature(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </section>

      {/* 类型特定参数 */}
      {kind === 'alignment' && (
        <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Formality</label>
            <select className="w-full border rounded px-2 py-1" value={style.formality||"neutral"} onChange={e=> setStyle((s:any)=>({ ...s, formality:e.target.value }))}>
              <option value="casual">casual</option>
              <option value="neutral">neutral</option>
              <option value="formal">formal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tone</label>
            <input className="w-full border rounded px-2 py-1" value={style.tone||"friendly"} onChange={e=> setStyle((s:any)=>({ ...s, tone:e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Length</label>
            <select className="w-full border rounded px-2 py-1" value={style.length||"medium"} onChange={e=> setStyle((s:any)=>({ ...s, length:e.target.value }))}>
              <option value="short">short</option>
              <option value="medium">medium</option>
              <option value="long">long</option>
            </select>
          </div>
        </section>
      )}

      {kind === 'cloze' && (
        <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">空格范围</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoBlanks} onChange={e=> setAutoBlanks(e.target.checked)} /> 自动</label>
              {!autoBlanks && (
                <>
                  <input className="w-24 border rounded px-2 py-1" type="number" min={1} max={30} value={blanksRange[0]} onChange={e=> setBlanksRange([Number(e.target.value)||1, blanksRange[1]])} />
                  <input className="w-24 border rounded px-2 py-1" type="number" min={1} max={30} value={blanksRange[1]} onChange={e=> setBlanksRange([blanksRange[0], Number(e.target.value)||1])} />
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">自动：按等级与目标长度估算空格数</div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">权重（连接词/搭配/语法）</label>
            <div className="flex gap-2">
              <input className="w-24 border rounded px-2 py-1" type="number" step={0.1} value={weights.connector} onChange={e=> setWeights(w=>({ ...w, connector: Number(e.target.value)||0 }))} />
              <input className="w-24 border rounded px-2 py-1" type="number" step={0.1} value={weights.collocation} onChange={e=> setWeights(w=>({ ...w, collocation: Number(e.target.value)||0 }))} />
              <input className="w-24 border rounded px-2 py-1" type="number" step={0.1} value={weights.grammar} onChange={e=> setWeights(w=>({ ...w, grammar: Number(e.target.value)||0 }))} />
            </div>
          </div>
        </section>
      )}

      {kind === 'shadowing' && (
        <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">体裁</label>
            <select className="w-full border rounded px-2 py-1" value={genre} onChange={e=> setGenre(e.target.value)}>
              <option value="monologue">monologue</option>
              <option value="dialogue">dialogue</option>
              <option value="news">news</option>
              <option value="lecture">lecture</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">语域</label>
            <select className="w-full border rounded px-2 py-1" value={register} onChange={e=> setRegister(e.target.value as any)}>
              <option value="casual">casual</option>
              <option value="neutral">neutral</option>
              <option value="formal">formal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">句子范围</label>
            <div className="flex gap-2">
              <input className="w-24 border rounded px-2 py-1" type="number" min={1} max={30} value={sentRange[0]} onChange={e=> setSentRange([Number(e.target.value)||1, sentRange[1]])} />
              <input className="w-24 border rounded px-2 py-1" type="number" min={1} max={30} value={sentRange[1]} onChange={e=> setSentRange([sentRange[0], Number(e.target.value)||1])} />
            </div>
          </div>
        </section>
      )}

      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button className={`px-4 py-2 rounded ${running? 'bg-gray-300':'bg-blue-600 text-white'}`} onClick={start} disabled={running}>开始批量</button>
          <button className="px-4 py-2 rounded border" onClick={stop} disabled={!running}>停止</button>
          <div className="text-sm text-gray-600">进度：{progress.done}/{progress.total}</div>
          {usage && (
            <div className="text-sm text-gray-600">Tokens: {usage.total_tokens} （P:{usage.prompt_tokens} C:{usage.completion_tokens}）</div>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded overflow-hidden">
          <div className="h-full bg-blue-500" style={{ width: progress.total>0? `${Math.round(progress.done/progress.total*100)}%`:'0%' }} />
        </div>
        <div className="max-h-64 overflow-auto text-sm font-mono bg-gray-50 p-2 rounded border">
          {log.map((l,i)=>(<div key={i}>{l}</div>))}
        </div>
      </section>

    </div>
  );
}

// 默认主题集合
const defaultTopics = [
  "Daily life",
  "Campus life",
  "Travel",
  "Food & Cooking",
  "Health & Fitness",
  "Technology & Gadgets",
  "Environment & Sustainability",
  "Culture & Festivals",
  "Hobbies & Sports",
  "Work & Career"
];

const defaultExamTopics = [
  "Academic writing",
  "Presentation skills",
  "Research & Methodology",
  "Critical thinking",
  "Reading comprehension",
  "Listening strategies",
  "Note-taking",
  "Debate & Argumentation",
  "Summarization",
  "Paraphrasing"
];

const defaultBusinessTopics = [
  "Meetings & Negotiation",
  "Email etiquette",
  "Project management",
  "Marketing & Branding",
  "Customer support",
  "Finance & Budgeting",
  "Hiring & Onboarding",
  "Remote collaboration",
  "Product roadmap",
  "Performance review"
];

// 模型列表示例（可根据需要扩展/维护）
const openrouterModels = [
  // OpenAI
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  // Anthropic
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-opus",
  "anthropic/claude-3-haiku",
  // Google
  "google/gemini-1.5-pro",
  "google/gemini-1.5-flash",
  // Meta Llama 3.1
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  // Mistral
  "mistral/mistral-large-2407",
  "mistral/mixtral-8x7b-instruct",
  // Qwen
  "qwen/qwen2.5-7b-instruct",
  "qwen/qwen2.5-72b-instruct",
  // Cohere
  "cohere/command-r",
  "cohere/command-r-plus",
  // Perplexity (在线检索型)
  "perplexity/llama-3-sonar-small-32k-online",
  "perplexity/llama-3-sonar-large-32k-online"
];

const deepseekModels = [
  "deepseek-chat",
  "deepseek-reasoner"
];

 


