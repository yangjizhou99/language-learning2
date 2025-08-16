"use client";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ShadowingData = { text: string; lang: "ja"|"en"; topic: string; approx_duration_sec?: number };

const MODELS = [
  { id: "deepseek-chat", label: "deepseek-chat（推荐）" },
  { id: "deepseek-reasoner", label: "deepseek-reasoner" },
];

export default function ShadowingPage() {
  const [lang, setLang] = useState<"ja"|"en">("ja");
  const [topic, setTopic] = useState(lang === "ja" ? "日程の調整" : "Travel plan");
  const [model, setModel] = useState("deepseek-chat");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShadowingData|null>(null);
  const [err, setErr] = useState("");

  // TTS
  const speak = () => {
    if (!data?.text) return;
    const synth = window.speechSynthesis;
    if (!synth) { alert("此浏览器不支持 Web Speech TTS"); return; }
    const u = new SpeechSynthesisUtterance(data.text);
    // 尝试选择对应语言的 voice
    const voices = synth.getVoices();
    const targetLang = lang === "ja" ? "ja" : "en";
    const v = voices.find(v => v.lang?.toLowerCase().startsWith(targetLang));
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.0;
    synth.cancel();
    synth.speak(u);
  };

  // MediaRecorder
  const [recState, setRecState] = useState<"idle"|"recording"|"stopped">("idle");
  const mediaStreamRef = useRef<MediaStream|null>(null);
  const recorderRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [localUrl, setLocalUrl] = useState<string>("");

  const startRec = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setLocalUrl(url);
      };
      rec.start();
      setRecState("recording");
    } catch (e:any) {
      setErr(e?.message || "无法访问麦克风");
    }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    setRecState("stopped");
  };

  const upload = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) { setErr("未登录"); return; }
      if (chunksRef.current.length === 0) { setErr("没有录音数据"); return; }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const ts = Date.now();
      const path = `${uid}/${ts}.webm`;

      const { error: upErr } = await supabase.storage.from("recordings").upload(path, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "audio/webm",
      });
      if (upErr) { setErr(upErr.message); return; }

      // 生成一个短期签名 URL（7 天）
      const { data: signed, error: sErr } = await supabase.storage
        .from("recordings")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (sErr) { setErr(sErr.message); return; }

      // 写入 sessions
      if (data) {
        await supabase.from("sessions").insert({
          user_id: uid,
          task_type: "shadowing",
          topic: data.topic,
          input: { text: data.text },
          output: { audio_path: path, audio_url: signed?.signedUrl },
          ai_feedback: null,
          score: null
        });
      }

      alert("上传成功");
    } catch (e:any) {
      setErr(e?.message || "上传失败");
    }
  };

  const gen = async () => {
    setErr(""); setLoading(true); setData(null); setLocalUrl(""); setRecState("idle");
    try {
      const r = await fetch("/api/generate/shadowing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, topic, model })
      });
      const j = await r.json();
      if (!r.ok) setErr(j?.error || "生成失败"); else setData(j);
    } catch (e:any) {
      setErr(e?.message || "网络错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 某些浏览器需要异步获取 voices
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Shadowing 跟读练习（TTS + 录音）</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="flex items-center gap-2">
          <span className="w-24">语言</span>
          <select value={lang} onChange={e=>{const v=e.target.value as "ja"|"en"; setLang(v); setTopic(v==="ja"?"日程の調整":"Travel plan");}} className="border rounded px-2 py-1">
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
          {loading ? "生成中..." : "生成文本"}
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {data && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <div className="text-sm text-gray-600">话题：{data.topic} · 语言：{data.lang}</div>
          <p className="whitespace-pre-wrap">{data.text}</p>

          <div className="flex gap-2">
            <button onClick={speak} className="px-3 py-1 rounded border">▶ 听 TTS</button>
            {recState !== "recording" && <button onClick={startRec} className="px-3 py-1 rounded bg-emerald-600 text-white">● 开始录音</button>}
            {recState === "recording" && <button onClick={stopRec} className="px-3 py-1 rounded bg-red-600 text-white">■ 停止</button>}
            <button onClick={upload} disabled={!localUrl} className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">↑ 上传保存</button>
            {localUrl && <a className="px-3 py-1 rounded border" href={localUrl} download>下载本地录音</a>}
          </div>

          {localUrl && <audio className="mt-2 w-full" controls src={localUrl}></audio>}
        </section>
      )}
    </main>
  );
}
