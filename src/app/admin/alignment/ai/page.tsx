"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";

export default function AlignmentAIPage(){
  const [lang, setLang] = useState<"en"|"ja"|"zh">("en");
  const [topic, setTopic] = useState("");
  const [tags, setTags] = useState<string>("");
  const [style, setStyle] = useState({ formality:"neutral", tone:"friendly", length:"balanced", voice:"first", extras:["examples"] as string[] });

  const [provider, setProvider] = useState<"openrouter"|"deepseek"|"openai">("openrouter");
  const [models, setModels] = useState<{id:string;name:string}[]>([]);
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.5);

  const [pack, setPack] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState("");

  useEffect(()=>{ (async()=>{
    if (provider==="openrouter") {
      const r = await fetch(`/api/ai/models?provider=${provider}`); const j = await r.json(); setModels(j||[]); setModel(j?.[0]?.id||"");
    } else if (provider==="deepseek") {
      const j=[{id:"deepseek-chat",name:"deepseek-chat"},{id:"deepseek-reasoner",name:"deepseek-reasoner"}];
      setModels(j); setModel(j[0].id);
    } else { const j=[{id:"gpt-4o-mini",name:"gpt-4o-mini"}]; setModels(j); setModel(j[0].id); }
  })(); }, [provider]);

  // 回退：非流式生成
  const generateFallback = async () => {
    try {
      const r = await fetch("/api/admin/alignment/generate", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ lang, topic, tags: tags.split(",").map(s=>s.trim()).filter(Boolean), style, provider, model, temperature })
      });
      const j = await r.json();
      if (!r.ok) {
        setLog("生成失败：" + j.error);
        return;
      }
      setPack(j.pack);
      setUsage(j.usage);
      setLog(`完成。Token: PT=${j.usage.prompt_tokens} CT=${j.usage.completion_tokens} TT=${j.usage.total_tokens}`);
    } catch (error) {
      setLog("生成失败：" + String(error));
    }
  };

  // 流式生成训练包
  async function gen(){
    setLoading(true);
    setUsage(null);
    setPack(null);
    setLive("");
    setLog("流式生成中…");
    
    try {
      const r = await fetch("/api/admin/alignment/generate/stream", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ lang, topic, tags: tags.split(",").map(s=>s.trim()).filter(Boolean), style, provider, model, temperature })
      });
      
      let acc = "";
      const reader = r.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        setLog("无法创建流式读取器，回退普通请求…");
        await generateFallback();
        return;
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[START]') {
              setLive("开始生成...\n");
            } else if (data === '[DONE]') {
              setLive(prev => prev + "\n生成完成！");
              setLog("流式生成完成");
              break;
            } else if (data.trim()) {
              acc += data;
              setLive(prev => prev + data);
            }
          }
        }
      }
      
      // 最终解析
      try {
        console.log("尝试解析 JSON:", acc);
        const parsed = JSON.parse(acc);
        if (parsed.version && parsed.order) {
          setPack(parsed);
          setUsage({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
          setLog("训练包生成完成");
        } else {
          setLog("生成的 JSON 格式不正确，回退普通请求…");
          await generateFallback();
        }
      } catch (e: any) {
        console.error("JSON 解析失败:", e, "原始内容:", acc);
        setLog(`JSON 解析失败：${e?.message || String(e)}，回退普通请求…`);
        await generateFallback();
      }
      
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      setLog(`流式生成失败：${err}，回退普通请求…`);
      await generateFallback();
    } finally {
      setLoading(false);
    }
  }

  async function save(){
    if (!pack) return;
    const r = await fetch("/api/admin/alignment/save", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ lang, topic, tags: tags.split(",").map(s=>s.trim()).filter(Boolean), style, pack, provider, model, usage })
    });
    const j = await r.json();
    if (!r.ok) { setLog("保存失败：" + j.error); return; }
    setLog("已保存为草稿包。");
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">AI 生成 对齐训练包（范例→仿写）</h1>

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">语言
            <select className="border rounded px-2 py-1 w-full" value={lang} onChange={e=>setLang(e.target.value as any)}>
              <option value="en">英语</option><option value="ja">日语</option><option value="zh">中文</option>
            </select>
          </label>
          <label className="text-sm">主题
            <input className="border rounded px-2 py-1 w-full" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="例如：订餐 / 投诉退货 / 组会汇报"/>
          </label>
          <label className="text-sm">标签（逗号分隔）
            <input className="border rounded px-2 py-1 w-full" value={tags} onChange={e=>setTags(e.target.value)} placeholder="service, polite, negotiation"/>
          </label>
          <label className="text-sm">Provider/Model
            <div className="flex gap-2">
              <select className="border rounded px-2 py-1" value={provider} onChange={e=>setProvider(e.target.value as any)}>
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
              </select>
              <select className="border rounded px-2 py-1 flex-1" value={model} onChange={e=>setModel(e.target.value)}>
                {models.map(m=> <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </label>
          <label className="text-sm">温度
            <input type="number" step="0.1" min={0} max={1} className="border rounded px-2 py-1 w-full" value={temperature} onChange={e=>setTemperature(Number(e.target.value)||0.5)} />
          </label>
        </div>

        {/* 风格偏好 */}
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm">Formality
            <select className="border rounded px-2 py-1 w-full" value={style.formality} onChange={e=>setStyle({...style, formality:e.target.value})}>
              <option value="neutral">neutral</option><option value="formal">formal</option><option value="casual">casual</option>
            </select>
          </label>
          <label className="text-sm">Tone
            <select className="border rounded px-2 py-1 w-full" value={style.tone} onChange={e=>setStyle({...style, tone:e.target.value})}>
              <option value="friendly">friendly</option><option value="direct">direct</option><option value="polite">polite</option><option value="academic">academic</option>
            </select>
          </label>
          <label className="text-sm">Length
            <select className="border rounded px-2 py-1 w-full" value={style.length} onChange={e=>setStyle({...style, length:e.target.value})}>
              <option value="concise">concise</option><option value="balanced">balanced</option><option value="detailed">detailed</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={gen} 
            disabled={loading}
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? "生成中..." : "生成训练包"}
          </button>
          {pack && <button onClick={save} className="px-3 py-1 rounded bg-emerald-600 text-white">保存为草稿</button>}
          {usage && <span className="text-xs text-gray-600">LLM 用量：PT={usage.prompt_tokens} · CT={usage.completion_tokens} · TT={usage.total_tokens}</span>}
        </div>
        
        {/* 流式生成实时显示 */}
        {loading && live && (
          <div className="mt-2 text-xs text-gray-700 bg-gray-50 p-3 rounded max-h-48 overflow-auto">
            <div className="font-mono whitespace-pre-wrap break-words">{live}</div>
          </div>
        )}
      </section>

      {/* 预览与微调 */}
      {pack && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-4">
          <h3 className="font-medium">预览（可直接在文本框中微调后再保存）</h3>
          <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto whitespace-pre-wrap">
{JSON.stringify(pack, null, 2)}
          </pre>
        </section>
      )}

      {log && <div className="text-sm text-gray-600">{log}</div>}
    </main>
  );
}
