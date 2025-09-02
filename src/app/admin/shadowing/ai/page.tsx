"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readSSE } from "@/lib/sse";

type GenItem = { 
  idx: number; 
  title: string; 
  text: string; 
  audio_url?: string;
  duration_ms?: number;
  tokens?: number;
};

// 导航组件
function AdminNav() {
  return (
    <nav className="bg-gray-100 p-4 rounded-lg mb-6">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link href="/admin/setup" className="text-blue-600 hover:underline">
          管理员设置
        </Link>
        <Link href="/admin/drafts" className="text-blue-600 hover:underline">
          草稿箱
        </Link>
        <Link href="/admin/shadowing/ai" className="text-blue-600 hover:underline font-medium">
          AI生成Shadowing题库
        </Link>
        <Link href="/admin/alignment/ai" className="text-blue-600 hover:underline">
          AI生成对齐训练包
        </Link>
        <Link href="/practice/shadowing" className="text-green-600 hover:underline">
          练习页面
        </Link>
      </div>
    </nav>
  );
}

export default function ShadowingAIPage() {
  const [lang, setLang] = useState<"en" | "ja" | "zh">("ja"); // 默认改为日语
  const [level, setLevel] = useState(2);
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState("");
  const [provider, setProvider] = useState<"openrouter" | "deepseek" | "openai">("openrouter");
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.6);
  const [items, setItems] = useState<GenItem[]>([]);
  const [usage, setUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null);
  const [voices, setVoices] = useState<{ name: string; ssmlGender?: string }[]>([]);
  const [voice, setVoice] = useState<string>("");
  const [rate, setRate] = useState<number>(1.0);
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState("");

  // 加载模型列表
  useEffect(() => {
    (async () => {
      if (provider === "openrouter") {
        try {
          const r = await fetch(`/api/ai/models?provider=${provider}`);
          const j = await r.json();
          setModels(j || []);
          setModel(j?.[0]?.id || "");
        } catch (error) {
          console.error("加载OpenRouter模型失败:", error);
          setModels([]);
        }
      } else if (provider === "deepseek") {
        const j = [
          { id: "deepseek-chat", name: "deepseek-chat" },
          { id: "deepseek-reasoner", name: "deepseek-reasoner" }
        ];
        setModels(j);
        setModel(j[0].id);
      } else {
        const j = [
          { id: "gpt-4o-mini", name: "gpt-4o-mini" },
          { id: "gpt-4o", name: "gpt-4o" }
        ];
        setModels(j);
        setModel(j[0].id);
      }
    })();
  }, [provider]);

  // 加载TTS声音列表
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/tts/voices?lang=${lang}`);
        const j = await r.json();
        setVoices(j || []);
        setVoice(j?.[0]?.name || "");
      } catch (error) {
        console.error("加载TTS声音失败:", error);
        setVoices([]);
      }
    })();
  }, [lang]);

  // 回退：非流式生成
  const generateFallback = async () => {
    try {
      const r = await fetch("/api/admin/shadowing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, level, count, topic, provider, model, temperature })
      });
      const j = await r.json();
      if (!r.ok) {
        setLog("生成失败：" + j.error);
        return;
      }
      setItems(j.items);
      setUsage(j.usage);
      setLog(`已生成 ${j.items.length} 条，Token 用量：PT=${j.usage.prompt_tokens}, CT=${j.usage.completion_tokens}, TT=${j.usage.total_tokens}`);
    } catch (error) {
      setLog("生成失败：" + String(error));
    }
  };

  // 生成文本（优先流式）
  const generate = async () => {
    setLoading(true);
    setUsage(null);
    setItems([]);
    setLive("");
    setLog("流式生成中…");
    try {
      const r = await fetch("/api/admin/shadowing/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, level, count, topic, provider, model, temperature })
      });
      let acc = "";
      await readSSE(r as unknown as Response, (t: string) => {
        acc += t;
        setLive(acc);
      });

      const trimmed = acc.trim();
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        const m = trimmed.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("LLM 返回的不是 JSON");
        parsed = JSON.parse(m[0]);
      }
      const list = Array.isArray(parsed.items) ? parsed.items : [];
      const clean = list
        .slice(0, count)
        .map((it: any, i: number) => ({
          idx: i,
          title: String(it.title || "Untitled").slice(0, 80),
          text: String(it.text || "").trim()
        }))
        .filter((it: any) => it.text.length >= 30);

      setItems(clean);
      setLog(`已生成 ${clean.length} 条（流式）`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      setLog(`流式生成失败：${err}，回退普通请求…`);
      await generateFallback();
    } finally {
      setLoading(false);
    }
  };

  // 合成单条音频
  const synthOne = async (idx: number) => {
    const it = items[idx];
    setLog(`合成第 ${idx + 1} 条音频中...`);
    
    try {
      const r = await fetch("/api/admin/shadowing/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: it.text, 
          lang, 
          voice, 
          speakingRate: rate, 
          title: it.title 
        })
      });
      
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "合成失败");
      
      // 修复：使用函数式更新，避免状态覆盖
      setItems(prevItems => {
        const next = [...prevItems];
        next[idx] = { ...next[idx], audio_url: j.audio_url };
        return next;
      });
      setLog(`第 ${idx + 1} 条音频合成成功`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLog(`第 ${idx + 1} 条失败：${errorMessage}`);
    }
  };

  // 批量合成音频
  const synthAll = async () => {
    setLoading(true);
    setLog("批量合成中…");
    
    try {
      for (let i = 0; i < items.length; i++) {
        if (!items[i].audio_url) {
          await synthOne(i);
          setLog(`合成 ${i + 1}/${items.length}`);
        }
      }
      setLog("合成完成。");
    } catch (error) {
      setLog("批量合成失败：" + String(error));
    } finally {
      setLoading(false);
    }
  };



  // 保存到题库
  const saveAll = async () => {
    const rows = items.filter(it => it.audio_url);
    if (!rows.length) {
      setLog("没有可保存的条目（请先合成音频）");
      return;
    }
    
    setLoading(true);
    setLog("保存中...");
    
    try {
      // 修复：移除 idx 字段，因为数据库表没有这个列
      const cleanRows = rows.map(({ idx, ...rest }) => rest);
      
      const r = await fetch("/api/admin/shadowing/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, level, items: cleanRows })
      });
      
      const j = await r.json();
      if (!r.ok) {
        setLog("保存失败：" + j.error);
        return;
      }
      
      setLog(`已入库 ${j.inserted} 条。`);
    } catch (error) {
      setLog("保存失败：" + String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <AdminNav />
      <h1 className="text-2xl font-semibold">AI 生成 Shadowing 题库</h1>

      {/* 配置面板 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            语言
            <select 
              className="border rounded px-2 py-1 w-full" 
              value={lang} 
              onChange={e => setLang(e.target.value as "en" | "ja" | "zh")}
            >
              <option value="en">英语</option>
              <option value="ja">日语</option>
              <option value="zh">中文</option>
            </select>
          </label>
          
          <label className="text-sm">
            等级
            <select 
              className="border rounded px-2 py-1 w-full" 
              value={level} 
              onChange={e => setLevel(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map(l => (
                <option key={l} value={l}>L{l}</option>
              ))}
            </select>
          </label>
          
          <label className="text-sm">
            条数
            <input 
              type="number" 
              min={1} 
              max={20} 
              className="border rounded px-2 py-1 w-full" 
              value={count} 
              onChange={e => setCount(Number(e.target.value) || 5)} 
            />
          </label>
          
          <label className="text-sm">
            主题（可空）
            <input 
              className="border rounded px-2 py-1 w-full" 
              value={topic} 
              onChange={e => setTopic(e.target.value)} 
              placeholder="e.g., campus life / tech news / travel" 
            />
          </label>

          <label className="text-sm">
            Provider/Model
            <div className="flex gap-2">
              <select 
                className="border rounded px-2 py-1" 
                value={provider} 
                onChange={e => setProvider(e.target.value as "openrouter" | "deepseek" | "openai")}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
              </select>
              <select 
                className="border rounded px-2 py-1 flex-1" 
                value={model} 
                onChange={e => setModel(e.target.value)}
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </label>
          
          <label className="text-sm">
            温度
            <input 
              type="number" 
              step={0.1} 
              min={0} 
              max={1} 
              className="border rounded px-2 py-1 w-full" 
              value={temperature} 
              onChange={e => setTemperature(Number(e.target.value) || 0.6)} 
            />
          </label>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={generate} 
            disabled={loading}
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? "生成中..." : "生成文本"}
          </button>
          
          {usage && (
            <span className="text-xs text-gray-600">
              LLM 用量：PT={usage.prompt_tokens} · CT={usage.completion_tokens} · TT={usage.total_tokens}
            </span>
          )}
        </div>
        {loading && live && (
          <div className="mt-2 text-xs text-gray-700 bg-gray-50 p-2 rounded max-h-48 overflow-auto">
            <div className="font-mono whitespace-pre-wrap break-words">{live}</div>
          </div>
        )}
      </section>

      {/* 文本校对 & TTS 合成 */}
      {items.length > 0 && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">TTS 声音</label>
            <select 
              className="border rounded px-2 py-1 min-w-[220px]" 
              value={voice} 
              onChange={e => setVoice(e.target.value)}
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}{v.ssmlGender ? ` (${v.ssmlGender})` : ''}
                </option>
              ))}
            </select>
            
            <label className="text-sm">播放速率</label>
            <input 
              type="number" 
              min={0.7} 
              max={1.3} 
              step={0.05} 
              className="border rounded px-2 py-1 w-28" 
              value={rate} 
              onChange={e => setRate(Number(e.target.value) || 1.0)} 
            />
            
            <button 
              onClick={synthAll} 
              disabled={loading}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              批量合成音频
            </button>
            
            <button 
              onClick={saveAll} 
              disabled={loading}
              className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              保存到题库
            </button>
          </div>

          <ul className="space-y-3">
            {items.map((it, idx) => (
              <li key={it.idx} className="p-3 border rounded">
                <input 
                  className="border rounded px-2 py-1 w-full font-medium" 
                  value={it.title} 
                  onChange={e => {
                    const next = [...items];
                    next[idx] = { ...it, title: e.target.value };
                    setItems(next);
                  }}
                />
                
                <textarea 
                  className="border rounded px-2 py-1 w-full h-32 mt-2" 
                  value={it.text} 
                  onChange={e => {
                    const next = [...items];
                    next[idx] = { ...it, text: e.target.value };
                    setItems(next);
                  }}
                />
                
                <div className="mt-2 flex items-center gap-2 text-sm">
                  {it.audio_url ? (
                    <div className="flex items-center gap-2">
                      <audio controls src={it.audio_url} className="h-8" />
                      <span className="text-green-600 text-xs">✓ 已合成</span>
                    </div>
                  ) : (
                    <span className="text-gray-500">尚未合成</span>
                  )}
                  
                  <button 
                    onClick={() => synthOne(idx)} 
                    disabled={loading}
                    className="px-2 py-0.5 rounded border disabled:opacity-50"
                  >
                    单条合成
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {log && (
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
          {log}
        </div>
      )}
    </main>
  );
}
