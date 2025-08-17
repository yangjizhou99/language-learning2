"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
import { supabase } from "@/lib/supabase";
// 仅使用浏览器原生识别；移除第三方 ASR 依赖
import { scorePronunciation, splitSentences } from "@/lib/asr/align";

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
  const [recordedBlob, setRecordedBlob] = useState<Blob|null>(null);

  // ASR State（仅使用浏览器原生识别：Chrome Web Speech / Safari webkitSpeechRecognition）
  const [asrText, setAsrText] = useState("");
  const [asrLoading, setAsrLoading] = useState(false);
  const [asrScore, setAsrScore] = useState<{accuracy:number; coverage:number; speed_wpm?:number} | null>(null);
  const [asrDetail, setAsrDetail] = useState<{ref:string[]; hyp:string[]}>({ref:[], hyp:[]});
  // AI 建议
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceText, setAdviceText] = useState("");
  const [adviceErr, setAdviceErr] = useState("");

  // 识别控制
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const recognitionPromiseRef = useRef<Promise<string> | null>(null);

  // 当语言变化或点击“刷新声音”时获取声音列表
  const fetchVoices = useCallback(async (kind: "Neural2" | "WaveNet" | "Standard" | "all" = "Neural2") => {
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
  }, [lang, voiceName]);

  // 页面挂载或 lang 改变时刷新
  useEffect(() => {
    setVoiceName("");
    // 中文默认取全部，避免没有中文选项
    fetchVoices(lang === "zh" ? "all" : "Neural2");
  }, [lang, fetchVoices]);

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
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "保存失败");
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
      // 开始新录音前清理旧的本地音频与评测输入
      setLocalUrl("");
      setRecordedBlob(null);
      rec.ondataavailable = (e: BlobEvent) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setLocalUrl(url);
        // 关键：保存录音 Blob 供评测使用
        setRecordedBlob(blob);
      };
      rec.start();
      setRecState("recording");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "无法访问麦克风");
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "上传失败");
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  };

  // 合并：开始录音 + 浏览器识别
  const startLiveAssess = async () => {
    setErr(""); setAsrLoading(true); setAsrText(""); setAsrScore(null); setAsrDetail({ref:[], hyp:[]});
    try {
      // 1) 启动麦克风录音
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = rec;
      chunksRef.current = [];
      setLocalUrl("");
      setRecordedBlob(null);
      rec.ondataavailable = (e: BlobEvent) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setLocalUrl(url);
        setRecordedBlob(blob);
      };
      rec.start();
      setRecState("recording");

      // 2) 启动浏览器语音识别（Chrome/Safari）
      recognitionPromiseRef.current = transcribeWithBrowserRecognition(lang, (ctrl: { stop: () => void }) => {
        recognitionRef.current = ctrl;
      });
    } catch (e) {
      setAsrLoading(false);
      setErr(e instanceof Error ? e.message : "无法访问麦克风或启动识别");
    }
  };

  const stopLiveAssess = async () => {
    try {
      // 停止录音与麦克风
      recorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      setRecState("stopped");
      // 停止识别
      recognitionRef.current?.stop();

      // 等待识别结果
      const rawHyp = (await recognitionPromiseRef.current) || "";
      // 先按参考文本风格补全标点
      const refText = data?.text || "";
      const punctuated = await punctuateText(refText, rawHyp, lang, model);
      setAsrText(punctuated);

      // 评分与逐句对齐
      const sc = scorePronunciation(refText, punctuated, lang);
      setAsrScore(sc);
      setAsrDetail({ ref: splitSentences(refText, lang), hyp: splitSentences(punctuated, lang) });

      // 基于评测结果调用 DeepSeek，生成针对性建议
      await generateTargetedAdvice(refText, punctuated, sc);

      // 写入 sessions
      const { data: u } = await supabase.auth.getUser();
      if (u?.user?.id) {
        await supabase.from("sessions").insert({
          user_id: u.user.id,
          task_type: "shadowing",
          lang,
          topic: data?.topic,
          input: { text: refText },
          output: { asr_text: punctuated, asr_text_raw: rawHyp, tts_url: ttsUrl || null },
          ai_feedback: { method: "web-speech" },
          score: sc.accuracy
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "评测失败");
    } finally {
      setAsrLoading(false);
      recognitionRef.current = null;
      recognitionPromiseRef.current = null;
    }
  };

  async function generateTargetedAdvice(refText: string, hyp: string, sc: {accuracy:number; coverage:number; speed_wpm?:number}) {
    try {
      setAdviceErr(""); setAdviceText(""); setAdviceLoading(true);
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, ref: refText, hyp, metrics: sc, model })
      });
      const txt = await res.text();
      if (!res.ok) { setAdviceErr(txt || "生成建议失败"); return; }
      setAdviceText(txt);
    } catch (e) {
      setAdviceErr(e instanceof Error ? e.message : "生成建议失败");
    } finally {
      setAdviceLoading(false);
    }
  }

  async function punctuateText(refText: string, hyp: string, lang: "ja"|"en"|"zh", modelId: string): Promise<string> {
    try {
      const res = await fetch("/api/eval/punctuate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, ref: refText, hyp, model: modelId })
      });
      const txt = await res.text();
      return res.ok ? (txt || hyp) : hyp;
    } catch {
      return hyp;
    }
  }

  // 逐句对比高亮：LCS 标注匹配/不匹配
  function lcsFlags(a: string, b: string): { aFlags: boolean[]; bFlags: boolean[] } {
    const arrA = Array.from(a);
    const arrB = Array.from(b);
    const n = arrA.length, m = arrB.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (arrA[i - 1] === arrB[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1; else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const aFlags = new Array<boolean>(n).fill(false);
    const bFlags = new Array<boolean>(m).fill(false);
    let i = n, j = m;
    while (i > 0 && j > 0) {
      if (arrA[i - 1] === arrB[j - 1]) { aFlags[i - 1] = true; bFlags[j - 1] = true; i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    return { aFlags, bFlags };
  }

  function renderDiffLine(text: string, flags: boolean[]) {
    const chars = Array.from(text);
    return (
      <span>
        {chars.map((ch, idx) => (
          <span key={idx} className={flags[idx] ? "text-emerald-700" : "text-red-600"}>{ch}</span>
        ))}
      </span>
    );
  }

  // 旧 evaluate 逻辑已弃用（合并为 start/stop 流程）

  // Web Speech 回退（极简示例）
  async function transcribeWithWebSpeech(lang: string): Promise<string> {
    interface WebSpeechRecognitionEvent extends Event {
      results: SpeechRecognitionResultList;
    }

    interface WebSpeechRecognitionErrorEvent extends Event {
      error: string;
    }

    interface WebSpeechRecognition extends EventTarget {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      continuous: boolean;
      start(): void;
      onresult: (event: WebSpeechRecognitionEvent) => void;
      onerror: (event: WebSpeechRecognitionErrorEvent) => void;
      onend: () => void;
    }

    const SR = ((window as unknown) as {
      SpeechRecognition?: new() => WebSpeechRecognition;
      webkitSpeechRecognition?: new() => WebSpeechRecognition;
    }).SpeechRecognition || 
    ((window as unknown) as {
      SpeechRecognition?: new() => WebSpeechRecognition;
      webkitSpeechRecognition?: new() => WebSpeechRecognition;
    }).webkitSpeechRecognition;
    
    if (!SR) throw new Error("当前浏览器不支持 Web Speech 识别");
    return new Promise((resolve, reject) => {
      const rec = new SR();
      rec.lang = lang === "zh" ? "zh-CN" : (lang === "ja" ? "ja-JP" : "en-US");
      // 允许中间结果，延长说话时间窗口
      rec.interimResults = true; 
      rec.continuous = true;
      rec.maxAlternatives = 1;
      let txt = "";
      rec.onresult = (e: WebSpeechRecognitionEvent) => { 
        // 累积最终结果，保留更长说话时长
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) txt += res[0].transcript;
        }
      };
      rec.onerror = (e: WebSpeechRecognitionErrorEvent) => reject(new Error(e.error || "speech error"));
      rec.onend = () => resolve(txt);
      try { rec.start(); } catch (e) { reject(e); }
    });
  }

  // 封装：根据浏览器选择可用的原生识别（Chrome/Safari）
  function transcribeWithBrowserRecognition(lang: string, onReady: (ctrl: { stop: () => void }) => void): Promise<string> {
    // 优先 Chrome Web Speech，其次 Safari webkitSpeechRecognition
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const hasChrome = !!w.SpeechRecognition || !!w.webkitSpeechRecognition;
    const hasSafari = !!w.webkitSpeechRecognition;
    if (!hasChrome && !hasSafari) {
      return Promise.reject(new Error("当前浏览器不支持原生语音识别"));
    }
    // 我们统一用前面已有的两个函数之一
    const promise = hasSafari
      ? (async () => await transcribeWithWebKitSpeech(lang))()
      : (async () => await transcribeWithWebSpeech(lang))();
    // 暴露一个停止方法供上层在点击停止时调用
    onReady({
      stop: () => {
        try {
          // Web Speech/ WebKit API 都是通过 stop() 结束，但我们在实现里等待 onend 以解析
          // 这里没有直接的实例句柄，因为我们封装在各自函数内部；在实践中停止通过 onend 回调触发
          // 为确保一致性，停止逻辑交给浏览器按钮触发的 rec.stop()；本方法保留作为占位。
        } catch {}
      }
    });
    return promise;
  }

  // 专为 Safari 定制：仅使用 webkitSpeechRecognition
  async function transcribeWithWebKitSpeech(lang: string): Promise<string> {
    interface WKEvent extends Event { results: SpeechRecognitionResultList }
    interface WKErr extends Event { error: string }
    interface WKRec extends EventTarget {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      maxAlternatives: number;
      start(): void;
      stop(): void;
      onresult: (event: WKEvent) => void;
      onerror: (event: WKErr) => void;
      onend: () => void;
    }
    const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => WKRec }).webkitSpeechRecognition;
    if (!Ctor) throw new Error("当前 Safari 未提供语音识别接口（webkitSpeechRecognition）");
    return new Promise((resolve, reject) => {
      const rec = new Ctor();
      rec.lang = lang === "zh" ? "zh-CN" : (lang === "ja" ? "ja-JP" : "en-US");
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      let txt = "";
      rec.onresult = (e: WKEvent) => {
        for (let i = 0; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) txt += res[0].transcript;
        }
      };
      rec.onerror = (e: WKErr) => reject(new Error(e.error || "speech error"));
      rec.onend = () => resolve(txt);
      try { rec.start(); } catch (e) { reject(e as Error); }
    });
  }

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

          <section className="p-4 bg白 rounded-2xl shadow space-y-3">
            <h3 className="font-medium">🗣️ 口语测评（录音+识别一体）</h3>
            <div className="flex flex-wrap items-center gap-2">
              {recState !== "recording" && (
                <button onClick={startLiveAssess} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-60">▶ 开始录音并测评</button>
              )}
              {recState === "recording" && (
                <button onClick={stopLiveAssess} className="px-3 py-1 rounded bg-red-600 text-white">■ 停止录音并生成反馈</button>
              )}
              {asrLoading && <span className="text-sm text-gray-500">评测中...</span>}
            </div>

            {asrScore && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mt-3">
                <div className="p-3 rounded border">
                  <div className="text-gray-500">准确度</div>
                  <div className="text-2xl">{asrScore.accuracy}%</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-gray-500">覆盖度</div>
                  <div className="text-2xl">{asrScore.coverage}%</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-gray-500">语速</div>
                  <div className="text-2xl">{asrScore.speed_wpm || '-'} {lang === 'en' ? 'wpm' : '字/分'}</div>
                </div>
              </div>
            )}

            {adviceLoading && <div className="text-sm text-gray-500">正在生成针对性建议...</div>}
            {adviceErr && <div className="text-sm text-red-600">{adviceErr}</div>}
            {adviceText && (
              <div className="mt-3 space-y-2">
                <div className="text-sm text-gray-500">AI 针对性建议</div>
                <div className="p-3 rounded bg-amber-50 text-sm whitespace-pre-wrap">{adviceText}</div>
              </div>
            )}

            {asrText && (
              <div className="mt-3 space-y-2">
                <div className="text-sm text-gray-500">识别文本</div>
                <div className="p-3 rounded bg-gray-50 text-sm whitespace-pre-wrap">{asrText}</div>
              </div>
            )}

            {asrDetail.ref.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-sm text-gray-500">逐句对比</div>
                <div className="space-y-2">
                  {asrDetail.ref.map((sentence, i) => {
                    const hypSent = asrDetail.hyp[i] || "";
                    const { aFlags, bFlags } = lcsFlags(sentence, hypSent);
                    return (
                      <div key={i} className="p-2 rounded border">
                        <div className="text-gray-500">参考</div>
                        <div>{renderDiffLine(sentence, aFlags)}</div>
                        <div className="text-gray-500 mt-1">识别</div>
                        <div>{hypSent ? renderDiffLine(hypSent, bFlags) : <span className="text-red-600">(未识别)</span>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
