"use client";
import React, { useMemo, useState } from "react";
import { readSSE } from "@/lib/sse";
import { supabase } from "@/lib/supabase";
import { safeJsonFetch } from "@/lib/safeFetch";
import { nextSftLevel, SftLevel } from "@/lib/adaptive";
import { buildRAG } from "@/lib/rag";

type SFTTask = { instruction: string; constraints: string[]; rubrics: string[] };
type EvalResp = { scores: Record<string, number>; feedback: string; rewrite_best?: string; overall?: number };

const TEMPLATES = [
  { id: "polite_mail", label: "礼貌邮件 / Polite Mail" },
  { id: "time_request", label: "约时间 / Time Request" },
  { id: "apology", label: "致歉 / Apology" },
  { id: "request_favor", label: "拜托请求 / Request a Favor" },
  { id: "status_update", label: "进度汇报 / Status Update" },
];

const MODELS = [
  { id: "deepseek-chat", label: "deepseek-chat（推荐）" },
  { id: "deepseek-reasoner", label: "deepseek-reasoner（推理更强）" },
];

export default function SFTPage() {
  const [lang, setLang] = useState<"ja"|"en">("ja");
  const [template, setTemplate] = useState<string>("polite_mail");
  const [topic, setTopic] = useState<string>(lang === "ja" ? "約束の時間調整" : "Travel plan");
  const [model, setModel] = useState<string>("deepseek-chat");
  const [sftLevel, setSftLevel] = useState<SftLevel>("standard");
  const [startedAt, setStartedAt] = useState<number|null>(null);

  const [loadingTask, setLoadingTask] = useState(false);
  const [task, setTask] = useState<SFTTask | null>(null);

  const [userOutput, setUserOutput] = useState("");
  const [loadingEval, setLoadingEval] = useState(false);
  const [evalRes, setEvalRes] = useState<EvalResp | null>(null);
  const [error, setError] = useState("");
  const [useRAG, setUseRAG] = useState(true);
  const [streamMode, setStreamMode] = useState(true);
  const [liveEval, setLiveEval] = useState("");
  const [ragStats, setRagStats] = useState<{terms:number;phrases:number;hasProfile:boolean}>({terms:0,phrases:0,hasProfile:false});

  const canEval = useMemo(() => !!(task && userOutput.trim().length > 0), [task, userOutput]);

  const genTask = async () => {
    setError(""); setTask(null); setEvalRes(null); setLoadingTask(true);
    try {
      let rag = "";
      if (useRAG) {
        const r = await buildRAG(lang, topic);
        rag = r.text;
        setRagStats(r.stats);
      } else {
        setRagStats({terms:0, phrases:0, hasProfile:false});
      }
      const r = await safeJsonFetch("/api/generate/sft-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, topic, template, model, difficulty: sftLevel, rag }),
      });
      if (!r.ok || !r.data) return setError(`任务生成失败 (${r.status}): ${r.error || r.text || "unknown"}`);
      setTask(r.data);
      setStartedAt(Date.now());
      // 给一个初始提示
      if (!userOutput) setUserOutput("");
    } catch (e:any) {
      setError(e?.message || "网络错误");
    } finally {
      setLoadingTask(false);
    }
  };

  const doEvalStream = async () => {
    if (!task) return;
    setError(""); setLoadingEval(true); setEvalRes(null); setLiveEval("");
    try {
      let rag = "";
      try {
        // 若已实现 buildRAG
        const mod: any = (globalThis as any);
        if (mod.buildRAG) rag = (await mod.buildRAG(lang, topic)).text;
      } catch {}

      const res = await fetch("/api/eval/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          instruction: task.instruction,
          user_output: userOutput,
          rubrics: task.rubrics,
          model,
          rag
        })
      });

      let acc = "";
      await readSSE(res, (t) => { acc += t; setLiveEval(acc); });

      // 解析 JSON
      const trimmed = acc.trim();
      let parsed: any;
      try { parsed = JSON.parse(trimmed); }
      catch {
        const m = trimmed.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("LLM non-JSON");
        parsed = JSON.parse(m[0]);
      }

      // 归一化
      if (!parsed?.scores || typeof parsed?.feedback !== "string") throw new Error("invalid eval payload");
      for (const k of Object.keys(parsed.scores)) {
        let v = Number(parsed.scores[k]);
        if (!Number.isFinite(v)) v = 1;
        parsed.scores[k] = Math.max(1, Math.min(5, Math.round(v)));
      }
      const vals = Object.values(parsed.scores) as number[];
      parsed.overall = vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : undefined;

      setEvalRes(parsed);

      // 写入 sessions（沿用你原有逻辑）
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (uid) {
        await supabase.from("sessions").insert({
          user_id: uid,
          task_type: "sft",
          topic,
          input: { instruction: task.instruction, rubrics: task.rubrics },
          output: { user_output: userOutput },
          ai_feedback: parsed,
          score: parsed?.overall ?? null,
          duration_sec: startedAt ? Math.max(1, Math.round((Date.now()-startedAt)/1000)) : null,
          difficulty: sftLevel
        });
      }
    } catch (e:any) {
      setError(e?.message || "流式打分失败，尝试回退普通请求…");
      await doEval();
    } finally {
      setLoadingEval(false);
    }
  };

  const doEval = async () => {
    if (!task) return;
    setError(""); setLoadingEval(true); setEvalRes(null);
    try {
      let rag = "";
      if (useRAG) {
        const r = await buildRAG(lang, topic);
        rag = r.text;
        setRagStats(r.stats);
      } else {
        setRagStats({terms:0, phrases:0, hasProfile:false});
      }
      const r = await safeJsonFetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          instruction: task.instruction,
          user_output: userOutput,
          rubrics: task.rubrics,
          model,
          rag
        })
      });
      if (!r.ok || !r.data) return setError(`打分失败 (${r.status}): ${r.error || r.text || "unknown"}`);
      setEvalRes(r.data);

      // 建议下次难度（仅提示，不强制）
      const suggested = nextSftLevel(sftLevel, r.data?.overall);
      setSftLevel(suggested);

      // 保存 sessions
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (uid) {
        await supabase.from("sessions").insert({
          user_id: uid,
          task_type: "sft",
          topic,
          input: { instruction: task.instruction, rubrics: task.rubrics },
          output: { user_output: userOutput },
          ai_feedback: r.data,
          score: r.data?.overall ?? null,
          duration_sec: startedAt ? Math.max(1, Math.round((Date.now()-startedAt)/1000)) : null,
          difficulty: sftLevel
        });
      }
    } catch (e:any) {
      setError(e?.message || "网络错误");
    } finally {
      setLoadingEval(false);
    }
  };

  const adoptRewrite = () => {
    if (evalRes?.rewrite_best) setUserOutput(evalRes.rewrite_best);
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">SFT 任务 & RLHF 打分</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="flex items-center gap-2">
          <span className="w-28">语言</span>
          <select value={lang} onChange={e=>{const v=e.target.value as "ja"|"en"; setLang(v); setTopic(v==="ja"?"約束の時間調整":"Travel plan");}} className="border rounded px-2 py-1">
            <option value="ja">日语</option>
            <option value="en">英语</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="w-28">模板</span>
          <select value={template} onChange={e=>setTemplate(e.target.value)} className="border rounded px-2 py-1">
            {TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="w-28">难度</span>
          <select value={sftLevel} onChange={e=>setSftLevel(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="basic">basic</option>
            <option value="standard">standard</option>
            <option value="advanced">advanced</option>
          </select>
        </label>

        <label className="flex items-center gap-2 md:col-span-2">
          <span className="w-28">话题</span>
          <input value={topic} onChange={e=>setTopic(e.target.value)} className="border rounded px-2 py-1 flex-1" placeholder="如：レストランで注文 / Travel plan / 面接の時間調整" />
        </label>

        <label className="flex items-center gap-2 md:col-span-2">
          <span className="w-28">模型</span>
          <select value={model} onChange={e=>setModel(e.target.value)} className="border rounded px-2 py-1">
            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={genTask} disabled={loadingTask} className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
          {loadingTask ? "生成中..." : "生成任务"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useRAG} onChange={e=>setUseRAG(e.target.checked)} />
          使用我的 RAG（画像/术语/常用表达）
        </label>
        {useRAG && <div className="text-xs text-gray-500">RAG 注入：profile {ragStats.hasProfile?"✓":"×"} · terms {ragStats.terms} · phrases {ragStats.phrases}</div>}
      </div>

      {error && <div className="text-red-600 text-sm whitespace-pre-wrap">{error}</div>}

      {task && (
        <section className="space-y-3">
          <div className="p-4 bg-white rounded-2xl shadow">
            <h2 className="font-medium mb-2">任务指令</h2>
            <p className="whitespace-pre-wrap">{task.instruction}</p>
            <h3 className="font-medium mt-3">约束</h3>
            <ul className="list-disc pl-6">
              {task.constraints.map((c,i)=><li key={i}>{c}</li>)}
            </ul>
            <div className="text-sm text-gray-500 mt-2">评分维度：{task.rubrics.join(" / ")}</div>
          </div>

          <div className="p-4 bg-white rounded-2xl shadow space-y-2">
            <h2 className="font-medium">我的作答</h2>
            <textarea
              className="w-full min-h-[140px] border rounded p-2"
              value={userOutput}
              onChange={e=>setUserOutput(e.target.value)}
              placeholder={lang === "ja" ? "ここに丁寧語で書いてみよう..." : "Write here in a polite tone..."}
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={streamMode} onChange={e=>setStreamMode(e.target.checked)} />
                流式
              </label>
              <button onClick={streamMode ? doEvalStream : doEval} disabled={!canEval || loadingEval} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-60">
                {loadingEval ? "打分中..." : "AI 打分"}
              </button>
              {evalRes?.overall!=null && <span className="text-sm">总体：<b>{evalRes.overall}</b>/5</span>}
            </div>
          </div>

          {streamMode && loadingEval && (
            <pre className="p-3 bg-gray-50 rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">
              {liveEval || "（流式输出中…）"}
            </pre>
          )}

          {evalRes && (
            <div className="p-4 bg-gray-50 rounded-2xl shadow-inner space-y-3">
              <h2 className="font-medium">评分与反馈</h2>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {Object.entries(evalRes.scores).map(([k,v])=>(
                  <li key={k} className="p-2 bg-white rounded border">
                    <div className="text-sm text-gray-600">{k}</div>
                    <div className="text-lg font-semibold">{v}/5</div>
                  </li>
                ))}
              </ul>
              <div>
                <div className="text-sm text-gray-600 mb-1">反馈</div>
                <p className="whitespace-pre-wrap">{evalRes.feedback}</p>
              </div>

              {evalRes.rewrite_best && (
                <div className="p-3 bg-white rounded border space-y-2">
                  <div className="text-sm text-gray-600">更自然/更礼貌的版本</div>
                  <p className="whitespace-pre-wrap">{evalRes.rewrite_best}</p>
                  <div className="flex gap-2">
                    <button onClick={adoptRewrite} className="px-3 py-1 rounded bg-black text-white">采用为我的作答</button>
                    <button onClick={()=>navigator.clipboard.writeText(evalRes.rewrite_best || "")} className="px-3 py-1 rounded border">复制</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
