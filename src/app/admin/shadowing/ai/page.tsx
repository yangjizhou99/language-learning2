"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readSSE } from "@/lib/sse";
import { supabase } from "@/lib/supabase";
import CandidateVoiceSelector from "@/components/CandidateVoiceSelector";
import VoiceSelectionConfirmation from "@/components/VoiceSelectionConfirmation";

type GenItem = { 
  idx: number; 
  title: string; 
  text: string; 
  audio_url?: string;         // 远端存储 URL（签名或公共）
  play_url?: string;          // 本地播放 URL（Blob 对象 URL）
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
  const [provider, setProvider] = useState<"openrouter" | "deepseek" | "openai">("deepseek");
  
  // 主题相关状态
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>("");
  const [themes, setThemes] = useState<Array<{id: string, title: string, desc?: string}>>([]);
  const [subtopics, setSubtopics] = useState<Array<{id: string, title_cn: string, one_line_cn?: string}>>([]);
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  
  // 新增状态：备选音色选择流程
  const [candidateVoices, setCandidateVoices] = useState<any[]>([]);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [voiceAnalysis, setVoiceAnalysis] = useState<any>(null);
  const [currentText, setCurrentText] = useState("");

  // 获取认证头
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // 加载主题数据
  const loadThemes = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/shadowing/themes?lang=${lang}&level=${level || ''}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setThemes(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  };

  // 加载子主题数据
  const loadSubtopics = async (themeId: string) => {
    if (themeId === "") {
      setSubtopics([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/shadowing/subtopics?theme_id=${themeId}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setSubtopics(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load subtopics:', error);
    }
  };

  function isAllSelected(): boolean {
    if (items.length === 0) return false;
    return items.every(it => selected.has(it.idx));
  }
  function toggleSelectAll() {
    setSelected(prev => {
      if (items.length === 0) return new Set();
      const all = new Set<number>();
      if (!isAllSelected()) {
        items.forEach(it => all.add(it.idx));
      }
      return isAllSelected() ? new Set() : all;
    });
  }
  function toggleSelect(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }


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

  // 加载主题数据
  useEffect(() => {
    loadThemes();
  }, [lang, level]);

  // 当选择大主题时，加载小主题
  useEffect(() => {
    loadSubtopics(selectedThemeId);
  }, [selectedThemeId]);

  // 回退：非流式生成
  const generateFallback = async () => {
    try {
      const r = await fetch("/api/admin/shadowing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
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

  // 智能生成流程：先设置备选音色，再生成内容
  const startSmartGeneration = () => {
    if (candidateVoices.length === 0) {
      setLog("请先设置备选音色");
      return;
    }
    setShowCandidateSelector(false);
    setLog("开始智能生成流程...");
    generate();
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
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
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
      
      // 如果有备选音色，自动分析第一个文本的音色分配
      if (candidateVoices.length > 0 && clean.length > 0) {
        await analyzeVoiceForText(clean[0].text);
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      setLog(`流式生成失败：${err}，回退普通请求…`);
      await generateFallback();
    } finally {
      setLoading(false);
    }
  };

  // AI音色分析
  const analyzeVoiceForText = async (text: string) => {
    try {
      setLog("AI正在从备选音色中选择最适合的音色...");
      const response = await fetch("/api/admin/shadowing/analyze-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          text,
          language: lang,
          candidateVoices: candidateVoices
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setVoiceAnalysis(data);
        setCurrentText(text);
        setShowConfirmation(true);
        setLog(`AI已从${candidateVoices.length}个备选音色中选择了${data.selectedVoices.length}个音色`);
      } else {
        setLog("AI音色分析失败: " + data.error);
      }
    } catch (error) {
      setLog("AI音色分析失败: " + String(error));
    }
  };

  // 合成单条音频
  const synthOne = async (idx: number) => {
    const it = items[idx];
    setLog(`合成第 ${idx + 1} 条音频中...`);
    
    try {
      const r = await fetch("/api/admin/shadowing/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
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
      
      // 如果跨域签名 URL 导致 <audio> 不显示时长，尝试通过 fetch->blob->objectURL 本地播放
      let playableUrl: string = j.audio_url;
      try {
        const ar = await fetch(j.audio_url, { headers: { Range: "bytes=0-" } });
        const blob = await ar.blob();
        if (blob && blob.size > 0) {
          playableUrl = URL.createObjectURL(blob);
        }
      } catch {}

      // 修复：使用函数式更新，避免状态覆盖
      setItems(prevItems => {
        const next = [...prevItems];
        next[idx] = { ...next[idx], audio_url: j.audio_url, play_url: playableUrl };
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

  // 批量合成（选中）
  const synthSelected = async () => {
    if (selected.size === 0) {
      setLog("未选择任何条目");
      return;
    }
    setLoading(true);
    setLog("批量合成选中中…");
    try {
      // 顺序串行，避免并发限流问题
      const order = items.filter(it => selected.has(it.idx));
      for (let i = 0; i < order.length; i++) {
        const realIndex = items.findIndex(x => x.idx === order[i].idx);
        if (realIndex >= 0) {
          await synthOne(realIndex);
          setLog(`选中项合成 ${i + 1}/${order.length}`);
        }
      }
      setLog("选中项合成完成。");
    } catch (e) {
      setLog("批量合成选中失败：" + String(e));
    } finally {
      setLoading(false);
    }
  };

  // 删除选中
  const deleteSelected = () => {
    if (selected.size === 0) {
      setLog("未选择任何条目");
      return;
    }
    const remain = items.filter(it => !selected.has(it.idx));
    setItems(remain);
    setSelected(new Set());
    setLog("已删除选中条目。");
  };



  // 确认生成
  const confirmGeneration = async () => {
    setShowConfirmation(false);
    setLog("开始使用AI选择的音色生成音频...");
    
    // 这里可以添加使用AI选择音色生成音频的逻辑
    // 暂时使用现有的合成逻辑
    await synthAll();
  };

  // 取消确认
  const cancelConfirmation = () => {
    setShowConfirmation(false);
    setVoiceAnalysis(null);
    setLog("已取消音色分析");
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
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ 
          lang, 
          level, 
          items: cleanRows,
          theme_id: selectedThemeId || null,
          subtopic_id: selectedSubtopicId || null
        })
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
            大主题
            <select 
              className="border rounded px-2 py-1 w-full" 
              value={selectedThemeId} 
              onChange={e => {
                setSelectedThemeId(e.target.value);
                setSelectedSubtopicId(""); // 重置小主题选择
              }}
            >
              <option value="">不关联主题</option>
              {themes.map(theme => (
                <option key={theme.id} value={theme.id}>{theme.title}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            小主题
            <select 
              className="border rounded px-2 py-1 w-full" 
              value={selectedSubtopicId} 
              onChange={e => setSelectedSubtopicId(e.target.value)}
              disabled={!selectedThemeId}
            >
              <option value="">不关联小主题</option>
              {subtopics.map(subtopic => (
                <option key={subtopic.id} value={subtopic.id}>{subtopic.title_cn}</option>
              ))}
            </select>
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
        
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setShowCandidateSelector(true)} 
            disabled={loading}
            className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            智能生成（推荐）
          </button>
          
          <button 
            onClick={generate} 
            disabled={loading}
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? "生成中..." : "传统生成"}
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
            <label className="ml-2 text-sm inline-flex items-center gap-2">
              <input type="checkbox" checked={isAllSelected()} onChange={toggleSelectAll} /> 全选
            </label>
            <button 
              onClick={synthSelected}
              disabled={loading || selected.size === 0}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              批量合成选中
            </button>
            <button 
              onClick={deleteSelected}
              disabled={loading || selected.size === 0}
              className="px-3 py-1 rounded border text-red-600 disabled:opacity-50"
            >
              删除选中
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
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={selected.has(it.idx)} onChange={() => toggleSelect(it.idx)} />
                  <span className="text-xs text-gray-500"># {it.idx}</span>
                </div>
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
                  {it.audio_url || it.play_url ? (
                    <div className="flex items-center gap-2">
                      <audio controls src={it.play_url || it.audio_url} className="h-8" />
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

      {/* 备选音色设置面板 */}
      {showCandidateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">设置备选音色</h2>
                <button
                  onClick={() => setShowCandidateSelector(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <CandidateVoiceSelector
                language={lang}
                onCandidateVoicesSet={setCandidateVoices}
                maxCandidates={5}
              />
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCandidateSelector(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={startSmartGeneration}
                  disabled={candidateVoices.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  开始智能生成 ({candidateVoices.length} 个备选音色)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成确认面板 */}
      {showConfirmation && voiceAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <VoiceSelectionConfirmation
              text={currentText}
              language={lang}
              speakers={voiceAnalysis.speakers}
              isDialogue={voiceAnalysis.isDialogue}
              selectedVoices={voiceAnalysis.selectedVoices}
              candidateVoices={candidateVoices}
              onConfirm={confirmGeneration}
              onCancel={cancelConfirmation}
              loading={loading}
            />
          </div>
        </div>
      )}
    </main>
  );
}
