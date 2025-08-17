"use client";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ShadowingData = { text: string; lang: "ja"|"en"|"zh"; topic: string; approx_duration_sec?: number };

const MODELS = [
  { id: "deepseek-chat", label: "deepseek-chat（推荐）" },
  { id: "deepseek-reasoner", label: "deepseek-reasoner" },
];

export default function ShadowingPage() {
  const [lang, setLang] = useState<"ja"|"en"|"zh">("ja");
  const [topic, setTopic] = useState(lang === "ja" ? "日程の調整" : lang === "zh" ? "自我介绍" : "Travel plan");
  const [model, setModel] = useState("deepseek-chat");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShadowingData|null>(null);
  const [err, setErr] = useState("");

  // TTS
  const [voices, setVoices] = useState<{name:string; type:string; ssmlGender:string; naturalSampleRateHertz:number}[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(0);
  const [ttsBlob, setTtsBlob] = useState<Blob|null>(null);
  const [ttsUrl, setTtsUrl] = useState<string>("");

  // MediaRecorder
  const [recState, setRecState] = useState<"idle"|"recording"|"stopped">("idle");
  const mediaStreamRef = useRef<MediaStream|null>(null);
  const recorderRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [localUrl, setLocalUrl] = useState<string>("");

  // 当语言变化或点击“刷新声音”时获取声音列表
  const fetchVoices = async (kind: "Neural2" | "WaveNet" | "Standard" | "all" = "Neural2") => {
    try {
      const r = await fetch(`/api/tts/voices?lang=${lang}&kind=${kind}`);
      const j = await r.json();
      if (Array.isArray(j)) {
        setVoices(j);
        // 自动选第一个
        if (j.length && !voiceName) setVoiceName(j[0].name);
      } else {
        setErr(j?.error || "无法获取声音列表");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "无法获取声音列表");
    }
  };

  // 页面挂载或 lang 改变时刷新
  useEffect(() => {
    setVoiceName("");
    // 中文默认取全部，避免没有中文选项
    fetchVoices(lang === "zh" ? "all" : "Neural2");
  }, [lang]);

  // Google 服务端合成（失败回退 Web Speech）
  const synthGoogle = async () => {
    if (!data?.text) return;
    setErr("");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          lang,
          voiceName: voiceName || undefined,
          speakingRate: rate,
          pitch
        })
      });
      if (!res.ok) {
        // 回退
        speak();
        const t = await res.text();
        setErr(`Google TTS 失败，已回退本地合成：${t.slice(0,200)}`);
        return;
      }
      const ab = await res.arrayBuffer();
      const blob = new Blob([ab], { type: "audio/mpeg" });
      setTtsBlob(blob);
      const url = URL.createObjectURL(blob);
      setTtsUrl(url);
    } catch (e: unknown) {
      speak();
      setErr(e instanceof Error ? e.message : "TTS 网络错误，已回退 Web Speech");
    }
  };

  // Web Speech 本地合成
  const speak = () => {
    if (!data?.text) return;
    const synth = window.speechSynthesis;
    if (!synth) { alert("此浏览器不支持 Web Speech TTS"); return; }
    const u = new SpeechSynthesisUtterance(data.text);
    // 尝试选择对应语言的 voice
    const voices = synth.getVoices();
    const targetLang = lang === "ja" ? "ja" : lang === "zh" ? "zh" : "en";
    const v = voices.find(v => v.lang?.toLowerCase().startsWith(targetLang));
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.0;
    synth.cancel();
    synth.speak(u);
  };

  // 保存到 tts 桶
  const saveTts = async () => {
    try {
      if (!ttsBlob) { setErr("没有可保存的 TTS 音频"); return; }
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) { setErr("未登录"); return; }
      const ts = Date.now();
      const path = `${uid}/tts-${ts}.mp3`;
      const { error: upErr } = await supabase.storage.from("tts").upload(path, ttsBlob, {
        cacheControl: "3600", upsert: false, contentType: "audio/mpeg",
      });
      if (upErr) { setErr(upErr.message); return; }
      const { data: signed, error: sErr } = await supabase.storage.from("tts").createSignedUrl(path, 60*60*24*7);
      if (sErr) { setErr(sErr.message); return; }
      setTtsUrl(signed!.signedUrl);
      alert("TTS 已保存到我的库（链接 7 天有效）");
    } catch (e:any) {
      setErr(e?.message || "保存失败");
    }
  };

  // 录音功能保持不变
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
          lang: data.lang,
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
          <select value={lang} onChange={e=>{const v=e.target.value as "ja"|"en"|"zh"; setLang(v); setTopic(v==="ja"?"日程の調整":v==="zh"?"自我介绍":"Travel plan");}} className="border rounded px-2 py-1">
            <option value="ja">日语</option>
            <option value="en">英语</option>
            <option value="zh">中文（普通话）</option>
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
        <>
          <section className="p-4 bg-white rounded-2xl shadow space-y-3">
            <div className="text-sm text-gray-600">话题：{data.topic} · 语言：{data.lang}</div>
            <p className="whitespace-pre-wrap">{data.text}</p>
          </section>

          <section className="p-4 bg-white rounded-2xl shadow space-y-3">
            <h3 className="font-medium">Google TTS（WaveNet / Neural2）</h3>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={()=>fetchVoices("Neural2")} className="px-3 py-1 rounded border">刷新 Neural2</button>
              <button onClick={()=>fetchVoices("WaveNet")} className="px-3 py-1 rounded border">刷新 WaveNet</button>
              <button onClick={()=>fetchVoices("all")} className="px-3 py-1 rounded border">全部/Standard</button>
              <button onClick={()=>fetchVoices("all")} className="px-3 py-1 rounded border">全部声音</button>

              <select value={voiceName} onChange={e=>setVoiceName(e.target.value)} className="border rounded px-2 py-1 min-w-[280px]">
                {voices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name} · {v.type} · {v.ssmlGender?.toString().replace("SSML_VOICE_GENDER_","")}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1 text-sm">
                语速
                <input type="number" step="0.1" min="0.25" max="4" value={rate} onChange={e=>setRate(Number(e.target.value)||1)} className="w-20 border rounded px-2 py-1" />
              </label>
              <label className="flex items-center gap-1 text-sm">
                音高
                <input type="number" step="1" min="-20" max="20" value={pitch} onChange={e=>setPitch(Number(e.target.value)||0)} className="w-20 border rounded px-2 py-1" />
              </label>

              <button onClick={synthGoogle} className="px-3 py-1 rounded bg-black text-white">▶ Google TTS 合成</button>
              <button onClick={saveTts} disabled={!ttsBlob} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-60">↑ 保存到库</button>
              <button onClick={speak} className="px-3 py-1 rounded border">回退：Web Speech</button>
            </div>

            {ttsUrl && <audio className="mt-2 w-full" controls src={ttsUrl}></audio>}
          </section>

          <section className="p-4 bg-white rounded-2xl shadow space-y-3">
            <h3 className="font-medium">录音</h3>
            <div className="flex gap-2">
              {recState !== "recording" && <button onClick={startRec} className="px-3 py-1 rounded bg-emerald-600 text-white">● 开始录音</button>}
              {recState === "recording" && <button onClick={stopRec} className="px-3 py-1 rounded bg-red-600 text-white">■ 停止</button>}
              <button onClick={upload} disabled={!localUrl} className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">↑ 上传保存</button>
              {localUrl && <a className="px-3 py-1 rounded border" href={localUrl} download>下载本地录音</a>}
            </div>

            {localUrl && <audio className="mt-2 w-full" controls src={localUrl}></audio>}
          </section>
        </>
      )}
    </main>
  );
}
