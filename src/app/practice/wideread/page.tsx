"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LANG_LABEL, type Lang } from "@/types/lang";
import type { Voice } from "@/lib/voices";

type ArticleMeta = {
  author?: string;
  publish_date?: string;
  word_count?: number;
  tags?: string[];
};

type Article = {
  id: string; lang: Lang; genre: string; difficulty: number;
  title: string; text: string; source_url: string | null; license: string | null;
  meta: ArticleMeta;
};
type KeyPass1 = { span:[number,number]; tag:"connective"|"time"; surface:string }[];
type KeyPass2 = { pron:[number,number]; antecedents:[number,number][] }[];
type KeyPass3 = { s:[number,number]; v:[number,number]; o:[number,number] }[];
type ClozeItem = { start:number; end:number; answer:string; hint:string; type:string };
type ClozeSet = { id:string; version:"short"|"long"; items:ClozeItem[] };

function sub(text:string, span?:[number,number]) { if (!span) return ""; return text.slice(span[0], span[1]); }
function fmtSpan(text:string, span?:[number,number]) { return span ? `"${sub(text, span).slice(0,24)}"` : "—"; }

function paint(text:string, spans: {span:[number,number], className:string, title?:string}[]) {
  // 将 text 切分成片段并包裹样式（保证 key 唯一）
  const marks = spans.slice().sort((a,b)=>a.span[0]-b.span[0]);
  const out: React.ReactNode[] = [];
  let cur = 0;
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (cur < m.span[0]) out.push(<span key={`g-${i}-${cur}`}>{text.slice(cur, m.span[0])}</span>);
    out.push(
      <mark key={`m-${i}-${m.span[0]}-${m.span[1]}`} className={m.className} title={m.title}>
        {text.slice(m.span[0], m.span[1])}
      </mark>
    );
    cur = m.span[1];
  }
  if (cur < text.length) out.push(<span key={`tail-${cur}`}>{text.slice(cur)}</span>);
  return out;
}

function P1Preview({text, items, onRemove}:{
  text: string;
  items: {span:[number,number]; tag:"connective"|"time"}[];
  onRemove: (i:number)=>void;
}) {
  const spans = items.map((it)=> ({ span: it.span, className: it.tag==="connective"?"bg-yellow-200":"bg-amber-300" }));
  return (
    <div>
      <div className="text-sm font-medium mb-1">我的标注</div>
      <div className="p-3 bg-gray-50 rounded leading-7">{paint(text, spans)}</div>
      <div className="flex flex-wrap gap-2 mt-2 text-xs">
        {items.map((it, i)=>(
          <button key={i} onClick={()=>onRemove(i)} className="px-2 py-0.5 border rounded">
            删除 {it.tag} {i+1}
          </button>
        ))}
      </div>
    </div>
  );
}

function P1Truth({text, keys}:{text:string; keys:KeyPass1}) {
  const spans = keys.map(k=> ({ span:k.span, className:"bg-green-200", title:k.surface }));
  return (
    <div>
      <div className="text-sm font-medium mb-1">参考答案</div>
      <div className="p-3 bg-gray-50 rounded leading-7">{paint(text, spans)}</div>
    </div>
  );
}

function ScoreBarP1({res}:{res:{prec:number;rec:number;f1:number;tp:number;fp:number;fn:number}}) {
  return (
    <div className="text-sm text-gray-700">
      Precision {(res.prec*100|0)}% · Recall {(res.rec*100|0)}% · F1 {(res.f1*100|0)}% （TP {res.tp} / FP {res.fp} / FN {res.fn}）
    </div>
  );
}

function P2Preview({text, items}:{text:string; items:{pron:[number,number]; ants:[number,number][]}[]}) {
  const spans = [
    ...items.map(i=>({span:i.pron, className:"bg-blue-200"})),
    ...items.flatMap(i=> i.ants.map(a=>({span:a, className:"bg-cyan-100"})))
  ];
  return (
    <div>
      <div className="text-sm font-medium mb-1">我的标注（蓝：代词；浅蓝：先行词）</div>
      <div className="p-3 bg-gray-50 rounded leading-7">{paint(text, spans)}</div>
    </div>
  );
}

function P2Truth({text, keys}:{text:string; keys:KeyPass2}) {
  const spans = [
    ...keys.map(k=>({span:k.pron, className:"bg-blue-300"})),
    ...keys.flatMap(k=> k.antecedents.map(a=>({span:a, className:"bg-green-200"})))
  ];
  return (
    <div>
      <div className="text-sm font-medium mb-1">参考答案（深蓝：代词；绿：先行词）</div>
      <div className="p-3 bg-gray-50 rounded leading-7">{paint(text, spans)}</div>
    </div>
  );
}

function ScoreBarP2({res}:{res:{acc:number;tp:number;fp:number;fn:number}}) {
  return <div className="text-sm text-gray-700">正确率 {(res.acc*100|0)}% （TP {res.tp} / FP {res.fp} / FN {res.fn}）</div>;
}

type ConnectivePayload = { text: string };
type CollocationPayload = { text: string };
type TriplePayload = {
  s: string;
  v: string;
  o: string;
};

type CardPayload = ConnectivePayload | CollocationPayload | TriplePayload;

function P3Preview({text, items, onSave}:{
  text: string;
  items: {s:[number,number]; v:[number,number]; o:[number,number]}[];
  onSave: (t: {s:[number,number]; v:[number,number]; o:[number,number]}) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">我的三元组</div>
      {items.length===0 && <div className="text-sm text-gray-500">尚未添加</div>}
      <ul className="space-y-1 text-sm">
        {items.map((t, i)=>(
          <li key={i} className="p-2 border rounded">
            <span className="bg-red-200 px-1 rounded">{sub(text,t.s)}</span> ·
            <span className="bg-orange-200 px-1 rounded">{sub(text,t.v)}</span> ·
            <span className="bg-red-200 px-1 rounded">{sub(text,t.o)}</span>
            <button onClick={()=>onSave(t)} className="ml-2 px-2 py-0.5 border rounded text-xs">保存为卡片</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function P3Truth({text, keys}:{text:string; keys:KeyPass3}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">参考三元组</div>
      <ul className="space-y-1 text-sm">
        {keys.map((t, i)=>(
          <li key={i} className="p-2 border rounded">
            <span className="bg-green-200 px-1 rounded">{sub(text,t.s)}</span> ·
            <span className="bg-green-200 px-1 rounded">{sub(text,t.v)}</span> ·
            <span className="bg-green-200 px-1 rounded">{sub(text,t.o)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreBarP3({res}:{res:{score:number; detail:number[]}}) {
  return <div className="text-sm text-gray-700">匹配度 {(res.score*100|0)}% （按 S/V/O 三段计分）</div>;
}

function ClozeView({text, items, answers, onChange}:{
  text: string;
  items: ClozeItem[];
  answers: Record<number,string>;
  onChange: (i:number, v:string)=>void;
}) {
  if (!items.length) return <div className="text-sm text-gray-500">当前文章暂无 Cloze 版本</div>;
  const parts: React.ReactNode[] = [];
  let cur = 0;
  items.forEach((it, idx) => {
    if (cur < it.start) parts.push(<span key={cur+"t"}>{text.slice(cur, it.start)}</span>);
    parts.push(<input key={idx}
      className="mx-1 px-1 border-b border-gray-400 focus:outline-none focus:border-black"
      style={{minWidth: Math.min(160, Math.max(60, it.answer.length*10))}}
      placeholder={`(${it.hint||"填空"})`}
      value={answers[idx]||""}
      onChange={e=>onChange(idx, e.target.value)} />);
    cur = it.end;
  });
  if (cur < text.length) parts.push(<span key={"tail"}>{text.slice(cur)}</span>);
  return <div className="p-3 bg-gray-50 rounded leading-7">{parts}</div>;
}

export default function WideReadPage() {
  // ---------- 选文与过滤 ----------
  const [lang, setLang] = useState<Lang>("ja");
  const [genre, setGenre] = useState("news");
  const [difficulty, setDifficulty] = useState(3);
  const [articles, setArticles] = useState<Article[]>([]);
  const [cur, setCur] = useState<Article|null>(null);
  const [keys, setKeys] = useState<{pass1:KeyPass1; pass2:KeyPass2; pass3:KeyPass3} | null>(null);
  const [clozeSets, setClozeSets] = useState<ClozeSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetchList = useCallback(async () => {
    setErr(""); setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("id,lang,genre,difficulty,title,text,source_url,license,meta")
        .eq("lang", lang).eq("genre", genre)
        .gte("difficulty", Math.max(1, difficulty-1)).lte("difficulty", Math.min(5, difficulty+1))
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setArticles((data||[]) as Article[]);
      setCur(((data?.[0] as unknown) as Article) ?? null);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "加载失败"); }
    finally { setLoading(false); }
  }, [lang, genre, difficulty]);

  const pickRandom = () => {
    if (!articles.length) return;
    const idx = Math.floor(Math.random() * articles.length);
    setCur(articles[idx]);
  };

  // 拉取答案键 + Cloze
  useEffect(() => {
    (async () => {
      if (!cur?.id) { setKeys(null); setClozeSets([]); return; }
      const [k, c] = await Promise.all([
        supabase.from("article_keys").select("*").eq("article_id", cur.id).single(),
        supabase.from("article_cloze").select("*").eq("article_id", cur.id)
      ]);
      if (k.error) setErr(k.error.message);
      else setKeys({ pass1: (k.data?.pass1||[]) as KeyPass1, pass2: (k.data?.pass2||[]) as KeyPass2, pass3: (k.data?.pass3||[]) as KeyPass3 });
      if (c.error) setErr(c.error.message);
      else setClozeSets((c.data||[]) as ClozeSet[]);
      // 重置练习状态
      resetAll();
    })();
  }, [cur?.id]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ---------- Google TTS ----------
  const [voices, setVoices] = useState<{name:string;type?:string;ssmlGender?:string}[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [ttsUrl, setTtsUrl] = useState("");
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);

  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const loadVoices = async (kind:"Neural2"|"WaveNet"|"all"="Neural2") => {
    const { getVoicesCached } = await import("@/lib/voices");
    const j = await getVoicesCached(lang, kind);
    setVoices(j);
    setVoicesLoaded(true);
    const pref = j.find((v: Voice)=> v.name.startsWith(lang==="zh"?"zh-CN-Neural2": lang==="ja"?"ja-JP-Neural2":"en-US-Neural2"))
              || j[0];
    setVoiceName(prev => prev || pref?.name || "");
  };
  useEffect(()=>{ setVoices([]); setVoiceName(""); setVoicesLoaded(false); }, [lang]);

    const synth = async () => {
    if (!cur?.text) return;
    const res = await fetch("/api/tts", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ text: cur.text.slice(0, 1600), lang, voiceName, speakingRate: rate, pitch })
    });
    if (!res.ok) { setErr("TTS 失败"); return; }
    const ab = await res.arrayBuffer();
    const blob = new Blob([ab], { type: "audio/mpeg" });
    setTtsUrl(URL.createObjectURL(blob));
  };

  // ---------- 高亮渲染与选择（字符粒度，稳） ----------
  const containerRef = useRef<HTMLDivElement>(null);
  const text = cur?.text || "";
  const chars = useMemo(()=> Array.from(text), [text]);

  // 把浏览器的选择转为全局 [start,end)
  function getSelectionRange(): [number, number] | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const rng = sel.getRangeAt(0);
    const startNode = rng.startContainer.parentElement as HTMLElement;
    const endNode = rng.endContainer.parentElement as HTMLElement;
    if (!startNode?.dataset?.idx || !endNode?.dataset?.idx) return null;
    let s = Number(startNode.dataset.idx) + rng.startOffset;
    let e = Number(endNode.dataset.idx) + rng.endOffset;
    if (s > e) [s,e] = [e,s];
    if (s === e) return null;
    return [s,e];
  }

  // 工具：区间是否重叠 & 合并
  const overlap = (a:[number,number], b:[number,number]) => !(a[1] <= b[0] || b[1] <= a[0]);

  // ---------- 一号练习（三色聚光）状态 ----------
  type Tag1 = "connective"|"time";
  const [curTag, setCurTag] = useState<Tag1>("connective");
  const [userP1, setUserP1] = useState<{span:[number,number]; tag:Tag1}[]>([]);
  const addP1 = () => {
    const r = getSelectionRange(); if (!r) return;
    // 去重/不重叠
    setUserP1(prev => prev.some(x=> overlap(x.span, r)) ? prev : [...prev, { span:r, tag:curTag }]);
    window.getSelection()?.removeAllRanges();
  };
  const delP1 = (i:number) => setUserP1(prev => prev.filter((_,idx)=>idx!==i));

  function scoreP1() {
    if (!keys) return {prec:0, rec:0, f1:0, tp:0, fp:0, fn:0};
    const truth = keys.pass1.filter(k=>k.tag===curTag).map(k=>k.span);
    const pred  = userP1.filter(k=>k.tag===curTag).map(k=>k.span);
    let tp=0, fp=0;
    pred.forEach(p => truth.some(t=>overlap(t,p)) ? tp++ : fp++);
    const fn = truth.filter(t => !pred.some(p=>overlap(p,t))).length;
    const prec = tp + fp === 0 ? 0 : tp/(tp+fp);
    const rec  = truth.length===0 ? 0 : tp/(tp+fn);
    const f1 = (prec+rec) ? 2*prec*rec/(prec+rec) : 0;
    return {prec,rec,f1,tp,fp,fn};
  }

  // ---------- 二号（指代/先行） ----------
  const [userP2, setUserP2] = useState<{pron:[number,number]; ants:[number,number][]}[]>([]);
  const [modeP2, setModeP2] = useState<"pron"|"ant">("pron");
  const [focusedPron, setFocusedPron] = useState<number|null>(null);
  const addP2 = () => {
    const r = getSelectionRange(); if (!r) return;
    if (modeP2 === "pron") {
      setUserP2(prev => [...prev, { pron:r, ants:[] }]);
      setFocusedPron(userP2.length);
    } else {
      if (focusedPron===null) return;
      setUserP2(prev => prev.map((x,idx)=> idx===focusedPron ? {...x, ants:[...x.ants, r]} : x));
    }
    window.getSelection()?.removeAllRanges();
  };
  const scoreP2 = () => {
    if (!keys) return {acc:0, tp:0, fp:0, fn:0};
    let tp=0, fp=0; const truth = keys.pass2;
    const matchedTruth = new Set<number>();
    userP2.forEach(u => {
      // 找到一个重叠 pron 的 truth
      const idx = truth.findIndex(t => overlap(t.pron, u.pron));
      if (idx>=0) {
        const ok = u.ants.some(a => truth[idx].antecedents.some(b => overlap(a,b)));
        if (ok) { tp++; matchedTruth.add(idx); } else { fp++; }
      } else fp++;
    });
    const fn = truth.length - matchedTruth.size;
    const acc = (tp + fp + fn) ? tp / (tp + fp + fn) : 0;
    return {acc,tp,fp,fn};
  };

  // ---------- 三号（三元组 SVO） ----------
  const [userP3, setUserP3] = useState<{s:[number,number]; v:[number,number]; o:[number,number]}[]>([]);
  const [curTriple, setCurTriple] = useState<Partial<{s:[number,number]; v:[number,number]; o:[number,number]}>>({});
  const addSeg = (slot:"s"|"v"|"o") => {
    const r = getSelectionRange(); if (!r) return;
    setCurTriple(prev => ({ ...prev, [slot]: r }));
    window.getSelection()?.removeAllRanges();
  };
  const commitTriple = () => {
    if (!curTriple.s || !curTriple.v || !curTriple.o) return;
    setUserP3(prev => [...prev, {
      s: curTriple.s,
      v: curTriple.v, 
      o: curTriple.o
    } as {s:[number,number]; v:[number,number]; o:[number,number]}]); 
    setCurTriple({});
  };
  const scoreP3 = () => {
    if (!keys) return {score:0, detail:[] as number[]};
    let total = 0;
    const hits: number[] = [];
    const truth = keys.pass3;
    userP3.forEach(u => {
      // 与任意 truth 局部对齐计分：S/V/O 各 0/1
      let best = 0;
      for (const t of truth) {
        let s = 0;
        if (overlap(u.s, t.s)) s+=1;
        if (overlap(u.v, t.v)) s+=1;
        if (overlap(u.o, t.o)) s+=1;
        if (s>best) best = s;
      }
      total += best; hits.push(best);
    });
    const max = truth.length * 3; // 满分
    return {score: max? (total/max):0, detail: hits};
  };

  // ---------- Cloze ----------
  const [clozeVersion, setClozeVersion] = useState<"short"|"long">("short");
  const cloze = useMemo(()=> clozeSets.find(s=>s.version===clozeVersion)?.items || [], [clozeSets, clozeVersion]);
  const [answers, setAnswers] = useState<Record<number,string>>({});
  const norm = (s:string) => (s||"").normalize("NFKC").replace(/\s+/g," ").trim().toLowerCase();
  const clozeScore = () => {
    let ok=0;
    cloze.forEach((it, idx) => { if (norm(answers[idx])===norm(it.answer)) ok++; });
    const acc = cloze.length? ok/cloze.length : 0;
    return {ok, total: cloze.length, acc};
  };

  // ---------- 保存卡片 ----------
  const saveCard = async (type:"connective"|"collocation"|"triple", payload:CardPayload) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user?.id || !cur) { alert("未登录/无文章"); return; }
    const { error } = await supabase.from("study_cards").insert({
      user_id: u.user.id, lang: cur.lang, type, value: payload, article_id: cur.id
    });
    if (error) alert(error.message); else alert("已保存到卡片库");
  };

  // ---------- 记分写入 ----------
  const submitScores = async () => {
    const { data: u } = await supabase.auth.getUser(); if (!u?.user?.id || !cur) return;
    const p1 = scoreP1(), p2 = scoreP2(), p3 = scoreP3(), cz = clozeScore();
    const payload = {
      user_id: u.user.id, lang: cur.lang, task_type: "wideread",
      topic: `${cur.genre}/L${cur.difficulty}`,
      input: { article_id: cur.id, title: cur.title },
      output: {
        p1, p2, p3, cloze: cz,
        p1_user: userP1, p2_user: userP2, p3_user: userP3
      },
      score: Math.round(((p1.f1||0)*100 + (p2.acc||0)*100 + (p3.score||0)*100 + (cz.acc||0)*100)/4)
    };
    await supabase.from("sessions").insert(payload);
    alert("成绩已记录到 sessions");
  };

  const resetAll = () => { setUserP1([]); setUserP2([]); setUserP3([]); setCurTriple({}); setAnswers({}); setTtsUrl(""); };

  // ---------- 渲染 ----------
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">广读练习</h1>

      {/* 过滤与选文 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <select value={lang} onChange={e=>setLang(e.target.value as Lang)} className="border rounded px-2 py-1">
            <option value="ja">{LANG_LABEL.ja}</option>
            <option value="en">{LANG_LABEL.en}</option>
            <option value="zh">{LANG_LABEL.zh}</option>
          </select>
          <select value={genre} onChange={e=>setGenre(e.target.value)} className="border rounded px-2 py-1">
            <option value="news">新闻/时事</option>
            <option value="science">科普/说明</option>
            <option value="essay">随笔/评论</option>
            <option value="dialogue">对话</option>
            <option value="literature">文学</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            难度
            <input type="number" min={1} max={5} value={difficulty}
                   onChange={e=>setDifficulty(Number(e.target.value)||3)}
                   className="w-16 border rounded px-2 py-1" />
          </label>
          <button onClick={fetchList} className="px-3 py-1 rounded border">刷新列表</button>
          <button onClick={pickRandom} className="px-3 py-1 rounded border">随机来一篇</button>
        </div>
        {loading && <div className="text-sm text-gray-500">加载中…</div>}
        <div className="flex flex-wrap gap-2">
          {articles.map(a=>(
            <button key={a.id}
              onClick={()=>setCur(a)}
              className={`px-2 py-1 border rounded text-sm ${cur?.id===a.id?"bg-black text-white":""}`}>
              {a.title.slice(0,24)} · {a.genre}/L{a.difficulty}
            </button>
          ))}
        </div>
      </section>

      {/* 文章 + TTS */}
      {cur && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-medium">{cur.title}</div>
            <div className="text-xs text-gray-500">
              来源：{cur.source_url ? <a className="underline" href={cur.source_url} target="_blank">原文</a> : "—"} · 许可：{cur.license||"—"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={()=>loadVoices("Neural2")} className="px-2 py-1 border rounded text-sm">Neural2 声音</button>
            <button onClick={()=>loadVoices("WaveNet")} className="px-2 py-1 border rounded text-sm">WaveNet 声音</button>
            <select onFocus={()=>{ if (!voicesLoaded) loadVoices("Neural2"); }} value={voiceName} onChange={e=>setVoiceName(e.target.value)} className="border rounded px-2 py-1 min-w-[260px]">
              {voices.map(v=> <option key={v.name} value={v.name}>{v.name} · {(v.ssmlGender||"").replace("SSML_VOICE_GENDER_","")}</option>)}
            </select>
            <label className="text-sm flex items-center gap-1">速率
              <input type="number" step="0.1" min="0.25" max="4" value={rate}
                     onChange={e=>setRate(Number(e.target.value)||1)} className="w-20 border rounded px-2 py-1" />
            </label>
            <label className="text-sm flex items-center gap-1">音高
              <input type="number" step="1" min="-20" max="20" value={pitch}
                     onChange={e=>setPitch(Number(e.target.value)||0)} className="w-20 border rounded px-2 py-1" />
            </label>
            <button onClick={synth} className="px-3 py-1 rounded bg-black text-white">▶ 合成 TTS</button>
          </div>
          {ttsUrl && <audio controls className="w-full" src={ttsUrl}></audio>}

          <div ref={containerRef} className="p-3 bg-gray-50 rounded text-[15px] leading-7">
            {/* 字符粒度渲染，便于选择与高亮 */}
            {chars.map((ch, i) => <span key={i} data-idx={i}>{ch}</span>)}
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
        </section>
      )}

      {/* 一号：三色聚光（Pass1） */}
      {cur && keys && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <h3 className="font-medium">一号练习：三色聚光 · Pass1（连接词/时间）</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <input type="radio" checked={curTag==="connective"} onChange={()=>setCurTag("connective")} />
              <span className="px-2 py-0.5 rounded bg-yellow-200">连接词</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={curTag==="time"} onChange={()=>setCurTag("time")} />
              <span className="px-2 py-0.5 rounded bg-amber-300">时间表达</span>
            </label>
            <button onClick={addP1} className="px-3 py-1 rounded border">标注选区</button>
          </div>
          <P1Preview text={text} items={userP1} onRemove={delP1} />
          <P1Truth text={text} keys={keys.pass1.filter(k=>k.tag===curTag)} />
          <ScoreBarP1 res={scoreP1()} />
          <div className="text-xs text-gray-500">说明：拖拽选择一段文字后点“标注选区”。系统用<span className="px-1 bg-yellow-200 rounded">黄色</span>表示你标注的片段；下方“参考答案”来自题库。</div>
        </section>
      )}

      {/* 二号：指代（Pass2） */}
      {cur && keys && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <h3 className="font-medium">一号练习：三色聚光 · Pass2（指代 → 先行词）</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <input type="radio" checked={modeP2==="pron"} onChange={()=>setModeP2("pron")} /> 选“代词”
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={modeP2==="ant"} onChange={()=>setModeP2("ant")} /> 选“先行词”（会链接到最近一次选的代词）
            </label>
            <button onClick={addP2} className="px-3 py-1 rounded border">添加</button>
          </div>
          <P2Preview text={text} items={userP2} />
          <P2Truth text={text} keys={keys.pass2} />
          <ScoreBarP2 res={scoreP2()} />
        </section>
      )}

      {/* 三号：三元组（Pass3） */}
      {cur && keys && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <h3 className="font-medium">一号练习：三色聚光 · Pass3（三元组 S-V-O）</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={()=>addSeg("s")} className="px-3 py-1 rounded border">选择主语(S)</button>
            <button onClick={()=>addSeg("v")} className="px-3 py-1 rounded border">选择关系/谓词(V)</button>
            <button onClick={()=>addSeg("o")} className="px-3 py-1 rounded border">选择宾语(O)</button>
            <button onClick={commitTriple} className="px-3 py-1 rounded bg-black text-white">提交一条三元组</button>
          </div>
          <div className="text-sm text-gray-600">当前：S={fmtSpan(text, curTriple.s)}，V={fmtSpan(text, curTriple.v)}，O={fmtSpan(text, curTriple.o)}</div>
            <P3Preview text={text} items={userP3} onSave={(t)=>saveCard("triple", { 
              s: sub(text, t.s), 
              v: sub(text, t.v), 
              o: sub(text, t.o) 
            } as TriplePayload)} />
          <P3Truth text={text} keys={keys.pass3} />
          <ScoreBarP3 res={scoreP3()} />
        </section>
      )}

      {/* Cloze */}
      {cur && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <h3 className="font-medium">二号练习：Cloze 填空</h3>
          <div className="flex items-center gap-2">
            <select value={clozeVersion} onChange={e=>setClozeVersion(e.target.value as "short"|"long")} className="border rounded px-2 py-1">
              <option value="short">短版</option>
              <option value="long">长版</option>
            </select>
          </div>
          <ClozeView text={text} items={cloze} answers={answers} onChange={(i,v)=>setAnswers(p=>({...p,[i]:v}))} />
          <div className="text-sm">分数：{Math.round(clozeScore().acc*100)}%（{clozeScore().ok}/{clozeScore().total}）</div>
          <div className="flex gap-2">
            <button onClick={()=>{ // 保存命中的连接词/搭配为卡片
              cloze.forEach((it)=> saveCard(it.type==="connective"?"connective":"collocation", { text: it.answer }));
            }} className="px-3 py-1 rounded border">将空格答案保存为卡片</button>
          </div>
        </section>
      )}

      {/* 总结与落库 */}
      {cur && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <div className="flex gap-2">
            <button onClick={submitScores} className="px-3 py-1 rounded bg-emerald-600 text-white">提交成绩到 sessions</button>
            <button onClick={resetAll} className="px-3 py-1 rounded border">重置本篇练习</button>
          </div>
        </section>
      )}
    </main>
  );
}
