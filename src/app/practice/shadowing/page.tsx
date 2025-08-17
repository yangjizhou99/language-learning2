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
import { transcribeBlob, type TranscribeOutput, getWhisper, type DownloadProgress } from "@/lib/asr/whisper";
import { transcribeBlobWithVosk, warmUpVosk, type VoskProgress } from "@/lib/asr/vosk";
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

  // ASR State
  const [asrBackend, setAsrBackend] = useState<"local-whisper"|"web-speech"|"safari-speech"|"wasm-vosk"|"deepgram">("web-speech");
  const WHISPER_MODELS = [
    { id: "Xenova/whisper-tiny", label: "whisper-tiny（最快）" },
    { id: "Xenova/whisper-base", label: "whisper-base" },
    { id: "Xenova/whisper-small", label: "whisper-small（更准）" },
  ];
  const [whisperModel, setWhisperModel] = useState<string>(WHISPER_MODELS[0].id);
  const [asrText, setAsrText] = useState("");
  const [asrLoading, setAsrLoading] = useState(false);
  const [asrScore, setAsrScore] = useState<{accuracy:number; coverage:number; speed_wpm?:number} | null>(null);
  const [asrDetail, setAsrDetail] = useState<{ref:string[]; hyp:string[]}>({ref:[], hyp:[]});

  // Whisper 预下载/进度
  const [whisperReady, setWhisperReady] = useState(false);
  const [whisperLoading, setWhisperLoading] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState<{ pct: number; status: string; file?: string } | null>(null);
  // Vosk
  const [voskModelUrl, setVoskModelUrl] = useState<string>("");
  const [voskReady, setVoskReady] = useState(false);
  const [voskLoading, setVoskLoading] = useState(false);
  const [voskProgress, setVoskProgress] = useState<{ pct: number; status: string; file?: string } | null>(null);

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

  const warmUpWhisper = async () => {
    try {
      setErr("");
      setWhisperLoading(true);
      setWhisperProgress({ pct: 0, status: "准备中..." });
      await getWhisper(whisperModel, (info: DownloadProgress) => {
        const total = typeof info.total === "number" && info.total > 0 ? info.total : undefined;
        const loaded = typeof info.loaded === "number" ? info.loaded : undefined;
        const pct = total && loaded ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
        setWhisperProgress({ pct, status: info.status || "下载中...", file: info.file });
      });
      setWhisperReady(true);
      setWhisperProgress(p => p ? { ...p, pct: 100, status: "模型已就绪" } : { pct: 100, status: "模型已就绪" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "模型下载失败");
    } finally {
      setWhisperLoading(false);
    }
  };

  const warmUpVoskModel = async () => {
    try {
      setErr("");
      setVoskLoading(true);
      setVoskProgress({ pct: 0, status: "准备中..." });
      await warmUpVosk(voskModelUrl, (info: VoskProgress) => {
        const total = typeof info.total === "number" && info.total > 0 ? info.total : undefined;
        const loaded = typeof info.loaded === "number" ? info.loaded : undefined;
        const pct = total && loaded ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
        setVoskProgress({ pct, status: info.status || "下载中...", file: info.file });
      });
      setVoskReady(true);
      setVoskProgress(p => p ? { ...p, pct: 100, status: "Vosk 模型已就绪" } : { pct: 100, status: "Vosk 模型已就绪" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Vosk 模型下载失败");
    } finally {
      setVoskLoading(false);
    }
  };

  const fillDefaultVoskUrl = () => {
    const defaults: Record<"ja"|"en"|"zh", string> = {
      zh: "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip",
      en: "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
      ja: "https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip",
    };
    setVoskModelUrl(defaults[lang]);
  };

  // 评测入口：优先本地 Whisper
  const evaluate = async () => {
    setErr(""); setAsrLoading(true); setAsrText(""); setAsrScore(null);

    try {
      let hyp = "";
      // 优先使用录音，其次 TTS；若仅有本地 URL，则回退从 URL 读取 Blob
      let blob: Blob | null = recordedBlob || ttsBlob;
      if (!blob && localUrl) {
        try {
          const r = await fetch(localUrl);
          blob = await r.blob();
        } catch {}
      }
      if (!blob || !blob.size) {
        setErr("没有可用的音频，请先录音或合成后再评测");
        return;
      }
      const started = Date.now();

      if (asrBackend === "local-whisper") {
        try {
          const out: TranscribeOutput = await transcribeBlob(blob, lang, whisperModel);
          hyp = Array.isArray(out) ? out[0].text : out?.text || "";
          if (!hyp) throw new Error("ASR 无输出。可能是模型尚未完全加载，请重试");
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`本地 Whisper 识别失败：${msg}。首次使用需要下载模型，请等待加载完成后再试`);
        }
      } else if (asrBackend === "web-speech") {
        // 浏览器内置识别（Chrome 可用；Safari 支持有限）
        // Web Speech 只能实时识别，不支持对已录音文件识别
        hyp = await transcribeWithWebSpeech(lang);
      } else if (asrBackend === "safari-speech") {
        // 仅在 Safari 下可用的 webkitSpeechRecognition
        hyp = await transcribeWithWebKitSpeech(lang);
      } else if (asrBackend === "wasm-vosk") {
        hyp = await transcribeBlobWithVosk(blob, voskModelUrl);
      } else {
        // 可选：云兜底（需配置 Deepgram）
        const txt = await fetch("/api/asr/deepgram", { method: "POST", body: blob });
        hyp = await txt.text();
      }

      setAsrText(hyp);

      // 评分与逐句对齐
      const refText = data?.text || "";
      const dur = Math.round((Date.now()-started)/1000);
      const sc = scorePronunciation(refText, hyp, lang, dur);
      setAsrScore(sc);
      setAsrDetail({ 
        ref: splitSentences(refText, lang), 
        hyp: splitSentences(hyp, lang) 
      });

      // 写入 sessions
      const { data: u } = await supabase.auth.getUser();
      if (u?.user?.id) {
        await supabase.from("sessions").insert({
          user_id: u.user.id,
          task_type: "shadowing",
          lang,
          topic: data?.topic,
          input: { text: refText },
          output: { asr_text: hyp, tts_url: ttsUrl || null },
          ai_feedback: { method: asrBackend, ...sc },
          score: sc.accuracy
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "评测失败");
    } finally {
      setAsrLoading(false);
    }
  };

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
        <button onClick={warmUpWhisper} disabled={whisperLoading} className="px-3 py-1 rounded border disabled:opacity-60">
          {whisperLoading ? "下载模型中..." : (whisperReady ? "模型已就绪" : "下载/预热 Whisper 模型")}
        </button>
        {whisperProgress && (
          <span className="text-sm text-gray-600">
            {whisperProgress.status} {whisperProgress.pct}% {whisperProgress.file ? `· ${whisperProgress.file}` : ""}
          </span>
        )}
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

          <section className="p-4 bg-white rounded-2xl shadow space-y-3">
            <h3 className="font-medium">🗣️ 口语测评（ASR）</h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span>ASR 引擎</span>
                <select 
                  value={asrBackend} 
                  onChange={e => setAsrBackend(e.target.value as "local-whisper"|"web-speech"|"safari-speech"|"wasm-vosk"|"deepgram")}
                  className="border rounded px-2 py-1"
                >
                  <option value="web-speech">Web Speech（Chrome）</option>
                  <option value="local-whisper">本地 Whisper</option>
                  <option value="safari-speech">Safari 语音识别（实验）</option>
                  <option value="wasm-vosk">本地轻量引擎（WASM/Vosk）</option>
                  <option value="deepgram">Deepgram（需配置）</option>
                </select>
              </label>
              {asrBackend === 'local-whisper' && (
                <label className="flex items-center gap-2">
                  <span>Whisper 模型</span>
                  <select value={whisperModel} onChange={e=>setWhisperModel(e.target.value)} className="border rounded px-2 py-1">
                    {WHISPER_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
              )}
              
              {asrBackend === 'wasm-vosk' && (
                <>
                  <label className="flex items-center gap-2">
                    <span>Vosk 模型 URL</span>
                    <input
                      value={voskModelUrl}
                      onChange={e=>setVoskModelUrl(e.target.value)}
                      placeholder="https://.../vosk-model-small-xx.tar.gz"
                      className="border rounded px-2 py-1 w-[380px]"
                    />
                  </label>
                  <button onClick={fillDefaultVoskUrl} className="px-3 py-1 rounded border">一键填默认模型 URL</button>
                  <span className="text-xs text-gray-500">你也可以把模型压缩包放到 public/models 下，填入例如 /models/vosk-model-small-cn-0.22.zip 以走同源加载</span>
                  <button onClick={warmUpVoskModel} disabled={voskLoading || !voskModelUrl} className="px-3 py-1 rounded border disabled:opacity-60">
                    {voskLoading ? "下载 Vosk 中..." : (voskReady ? "Vosk 已就绪" : "下载/预热 Vosk 模型")}
                  </button>
                  {voskProgress && (
                    <span className="text-sm text-gray-600">
                      {voskProgress.status} {voskProgress.pct}% {voskProgress.file ? `· ${voskProgress.file}` : ""}
                    </span>
                  )}
                </>
              )}
              <button 
                onClick={evaluate} 
                disabled={
                  asrLoading || (
                    asrBackend === 'local-whisper' ? (!recordedBlob && !ttsBlob) || !whisperReady :
                    asrBackend === 'deepgram' ? (!recordedBlob && !ttsBlob) :
                    asrBackend === 'wasm-vosk' ? (!recordedBlob && !ttsBlob) || !voskReady || !voskModelUrl :
                    false
                  )
                }
                className="px-3 py-1 rounded bg-black text-white disabled:opacity-60"
              >
                {asrLoading ? "评测中..." : "开始评测"}
              </button>
              {asrBackend === 'wasm-vosk' && (
                <span className="text-sm text-gray-500">请先填写模型 URL 并点击“下载/预热 Vosk 模型”</span>
              )}
              {asrBackend === 'local-whisper' && !whisperReady && (
                <span className="text-sm text-gray-500">请先点击“下载/预热 Whisper 模型”并等待至 100%</span>
              )}
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
                  {asrDetail.ref.map((sentence, i) => (
                    <div key={i} className="p-2 rounded border">
                      <div className="text-gray-500">参考</div>
                      <div>{sentence}</div>
                      <div className="text-gray-500 mt-1">识别</div>
                      <div>{asrDetail.hyp[i] || "(未识别)"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
