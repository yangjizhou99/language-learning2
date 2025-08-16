"use client";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Phrase = { id?: string; user_id?: string; lang: "en"|"ja"; tag: string; text: string; example: string; created_at?: string };

const MODELS = [
  { id: "deepseek-chat", label: "deepseek-chat（推荐）" },
  { id: "deepseek-reasoner", label: "deepseek-reasoner" },
];

export default function PhraseBankPage() {
  const [lang, setLang] = useState<"ja"|"en">("ja");
  const [topic, setTopic] = useState(lang === "ja" ? "約束の時間調整" : "Travel plan");
  const [model, setModel] = useState("deepseek-chat");
  const [k, setK] = useState(10);

  const [uid, setUid] = useState<string|undefined>();
  const [mine, setMine] = useState<Phrase[]>([]);
  const [candidates, setCandidates] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user?.id) {
        setUid(u.user.id);
        // 确保 profile 存在（AuthGate 已做，这里再稳一把）
        await supabase.from("profiles").upsert({ id: u.user.id }, { onConflict: "id" });
        await refreshMine();
      }
    })();
  }, []);

  const refreshMine = async () => {
    const { data, error } = await supabase
      .from("phrases").select("*").order("created_at", { ascending: false });
    if (!error && data) setMine(data as any);
  };

  const gen = async () => {
    setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/generate/phrases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, topic, k, model }),
      });
      
      const text = await r.text();
      try {
        const j = JSON.parse(text);
        if (!r.ok) {
          setErr(j?.message || j?.error || "生成失败");
          if (j?.details) console.error("API Error Details:", j.details);
          setCandidates([]);
        } else {
          setCandidates(j);
        }
      } catch (e) {
        throw new Error(`无效的API响应: ${text.slice(0, 100)}`);
      }
    } catch (e: any) {
      setErr(e?.message || "请求失败");
      console.error("生成短语错误:", e);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async () => {
    if (!uid || candidates.length === 0) return;
    const rows = candidates.map(c => ({ ...c, user_id: uid }));
    const { error } = await supabase.from("phrases").insert(rows);
    if (error) setErr(error.message);
    else { setCandidates([]); await refreshMine(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("phrases").delete().eq("id", id);
    if (error) setErr(error.message);
    else setMine(m => m.filter(x => x.id !== id));
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">短语库（Phrase Bank）</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="flex items-center gap-2">
          <span className="w-24">语言</span>
          <select value={lang} onChange={e=>{const v=e.target.value as "ja"|"en"; setLang(v); setTopic(v==="ja"?"約束の時間調整":"Travel plan");}} className="border rounded px-2 py-1">
            <option value="ja">日语</option>
            <option value="en">英语</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-24">模型</span>
          <select value={model} onChange={e=>setModel(e.target.value)} className="border rounded px-2 py-1">
            {MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <span className="w-24">话题</span>
            <input value={topic} onChange={e=>setTopic(e.target.value)} className="border rounded px-2 py-1 flex-1" />
        </label>
      </div>

      <div className="flex gap-2">
        <button onClick={gen} disabled={loading} className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
          {loading ? "生成中..." : "生成候选短语"}
        </button>
        <button onClick={saveAll} disabled={!uid || candidates.length===0} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-60">
          保存到我的短语库
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {candidates.length>0 && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-2">
          <h2 className="font-medium">候选</h2>
          <ul className="space-y-1">
            {candidates.map((p,i)=>(
              <li key={i} className="p-2 border rounded">
                <div className="text-xs text-gray-500">{p.tag}</div>
                <div className="font-medium">{p.text}</div>
                <div className="text-gray-700">{p.example}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <h2 className="font-medium">我的短语</h2>
        <ul className="space-y-1">
          {mine.map(p=>(
            <li key={p.id} className="p-2 border rounded flex justify-between items-start gap-2">
              <div>
                <div className="text-xs text-gray-500">{p.tag} · {p.lang}</div>
                <div className="font-medium">{p.text}</div>
                <div className="text-gray-700">{p.example}</div>
              </div>
              <button onClick={()=>remove(p.id!)} className="px-2 py-1 rounded border">删除</button>
            </li>
          ))}
          {mine.length===0 && <li className="text-sm text-gray-500">暂无短语，先生成一些吧。</li>}
        </ul>
      </section>
    </main>
  );
}
