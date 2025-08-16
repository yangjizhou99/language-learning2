"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { safeJsonFetch } from "@/lib/safeFetch";

type Blank = { idx: number; answer: string };
type Explain = { idx:number; why:string };
type ClozeResp = { passage: string; cloze: string; blanks: Blank[]; explain: Explain[] };

export default function ClozePage() {
  const [lang, setLang] = useState<"en"|"ja">("ja");
  const [topic, setTopic] = useState("約束の時間調整");
  const [model, setModel] = useState<"deepseek-chat"|"deepseek-reasoner">("deepseek-reasoner");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClozeResp|null>(null);
  const [answers, setAnswers] = useState<Record<number,string>>({});
  const [score, setScore] = useState<number|null>(null);
  const [error, setError] = useState<string>("");

  const gen = async () => {
    setScore(null); setError(""); setLoading(true);
    try {
      const r = await safeJsonFetch("/api/generate/cloze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, topic, level: "mid", model })
      });
      if (!r.ok || !r.data) {
        setError(`生成失败 (${r.status}): ${r.error || r.text || "unknown"}`);
        setData(null);
      } else {
        setData(r.data as any);
        setAnswers({});
      }
    } catch (e:any) {
      setError(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  const grade = async () => {
    if (!data) return;
    const total = data.blanks.length || 1;
    let hit = 0;
    for (const b of data.blanks) {
      const u = (answers[b.idx] || "").trim();
      if (u && u === b.answer) hit++;
    }
    const sc = Math.round((hit/total)*100);
    setScore(sc);

    // 保存 sessions
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (uid) {
      await supabase.from("sessions").insert({
        user_id: uid,
        task_type: "cloze",
        topic,
        input: { cloze: data.cloze, blanks: data.blanks },
        output: { answers },
        ai_feedback: null,
        score: sc
      });
    }
  };

  const renderCloze = () => {
    if (!data) return null;
    const parts = data.cloze.split("____");
    const fields = data.blanks.map((b) => (
      <input
        key={b.idx}
        className="border rounded px-2 py-1 mx-1 w-28"
        placeholder={`#${b.idx}`}
        value={answers[b.idx] || ""}
        onChange={e => setAnswers(s => ({ ...s, [b.idx]: e.target.value }))}
      />
    ));
    const composed: React.ReactNode[] = [];
    for (let i=0; i<parts.length; i++){
      composed.push(<span key={`t${i}`}>{parts[i]}</span>);
      if (i < fields.length) composed.push(fields[i]);
    }
    return <p className="leading-8">{composed}</p>;
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Cloze 预测练习（DeepSeek）</h1>

      <div className="flex gap-2">
        <select value={lang} onChange={e=>setLang(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="ja">日语</option>
          <option value="en">英语</option>
        </select>
        <select value={model} onChange={e=>setModel(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="deepseek-reasoner">Reasoner</option>
          <option value="deepseek-chat">Chat</option>
        </select>
        <input className="border rounded px-2 py-1 flex-1"
               value={topic} onChange={e=>setTopic(e.target.value)}
               placeholder="话题，如：レストランで注文 / 約束の時間調整 / Travel plan" />
        <button onClick={gen} disabled={loading}
                className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
          {loading ? "生成中..." : "生成题目"}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm whitespace-pre-wrap">{error}</div>}

      {data && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">原文（参考，不要先看）：{data.passage}</div>
          <div className="p-4 bg-white rounded-2xl shadow">{renderCloze()}</div>

          <div className="flex gap-2 items-center">
            <button onClick={grade} className="px-3 py-1 rounded bg-emerald-600 text-white">提交判分</button>
            {score!==null && <span className="font-medium">得分：{score}</span>}
          </div>

          {score!==null && (
            <details className="p-3 bg-gray-50 rounded">
              <summary className="cursor-pointer">查看答案与解释</summary>
              <ul className="list-disc pl-6 mt-2">
                {data.blanks.map(b=>(
                  <li key={b.idx}>#{b.idx} 正确：<b>{b.answer}</b> —— {data.explain.find(e=>e.idx===b.idx)?.why}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
