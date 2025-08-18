"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminArticles() {
  const [tab, setTab] = useState<"fetch"|"manual"|"ai">("fetch");

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">题库 · 管理</h1>
      <div className="flex gap-2">
        <button className={btn(tab==="fetch")} onClick={()=>setTab("fetch")}>A 路抓取</button>
        <button className={btn(tab==="manual")} onClick={()=>setTab("manual")}>手动录入</button>
        <button className={btn(tab==="ai")} onClick={()=>setTab("ai")}>AI 生成</button>
      </div>

      {tab==="fetch" && <FetchForm/>}
      {tab==="manual" && <ManualForm/>}
      {tab==="ai" && <AIForm/>}
      <p className="text-xs text-gray-500">写入权限：仅管理员（profiles.role=admin）。</p>
    </main>
  );
}

const btn = (on:boolean)=> `px-3 py-1 rounded border ${on?"bg-black text-white":""}`;

function Row({label, children}:{label:string; children: React.ReactNode}) {
  return (
    <div className="flex gap-3 items-center">
      <div className="w-28 text-sm text-gray-600">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function LangGenre({lang,setLang,genre,setGenre}:{lang:string; setLang:(v:string)=>void; genre:string; setGenre:(v:string)=>void}) {
  return (
    <div className="flex gap-2">
      <select className="border rounded px-2 py-1" value={lang} onChange={e=>setLang(e.target.value)}>
        <option value="en">英语</option><option value="ja">日语</option><option value="zh">中文</option>
      </select>
      <select className="border rounded px-2 py-1" value={genre} onChange={e=>setGenre(e.target.value)}>
        <option value="news">新闻</option><option value="science">科普</option><option value="essay">随笔</option>
        <option value="dialogue">对话</option><option value="literature">文学</option>
      </select>
    </div>
  );
}

/* ===== A 路抓取（保留你已有的逻辑） ===== */
function FetchForm() {
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState("en");
  const [genre, setGenre] = useState("news");
  const [difficulty, setDifficulty] = useState(3);
  const [log, setLog] = useState("");

  const ingest = async () => {
    setLog("抓取与生成中…");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({ url, lang, genre, difficulty })
    });
    const j = await r.json();
    setLog(r.ok ? `成功：${j.title || ""}（id=${j.article_id}）` : `失败：${j.error}`);
  };

  return (
    <section className="p-4 bg-white rounded-2xl shadow space-y-3">
      <Row label="来源 URL">
        <input className="border rounded px-2 py-1 w-full" value={url} onChange={e=>setUrl(e.target.value)}
               placeholder="Wikipedia / Wikinews / Gutenberg / Tatoeba 链接" />
      </Row>
      <Row label="语言/体裁">
        <LangGenre lang={lang} setLang={setLang} genre={genre} setGenre={setGenre}/>
      </Row>
      <Row label="难度">
        <input type="number" min={1} max={5} className="border rounded px-2 py-1 w-24"
               value={difficulty} onChange={e=>setDifficulty(Number(e.target.value)||3)} />
      </Row>
      <div className="flex gap-2">
        <button onClick={ingest} className="px-3 py-1 rounded bg-black text-white">入库</button>
      </div>
      {log && <pre className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{log}</pre>}
    </section>
  );
}

/* ===== 手动录入 ===== */
function ManualForm() {
  const [lang, setLang] = useState("en");
  const [genre, setGenre] = useState("news");
  const [difficulty, setDifficulty] = useState(3);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [license, setLicense] = useState("User-Provided");
  const [log, setLog] = useState("");

  const submit = async () => {
    setLog("入库中…");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/ingest/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        lang, genre, difficulty, title, text,
        source_url: sourceUrl || null, license: license || null
      })
    });
    const j = await r.json();
    setLog(r.ok ? `成功：id=${j.article_id}` : `失败：${j.error}`);
  };

  return (
    <section className="p-4 bg-white rounded-2xl shadow space-y-3">
      <Row label="语言/体裁"><LangGenre lang={lang} setLang={setLang} genre={genre} setGenre={setGenre}/></Row>
      <Row label="难度"><input type="number" min={1} max={5} className="border rounded px-2 py-1 w-24"
        value={difficulty} onChange={e=>setDifficulty(Number(e.target.value)||3)} /></Row>
      <Row label="标题"><input className="border rounded px-2 py-1 w-full" value={title} onChange={e=>setTitle(e.target.value)} /></Row>
      <Row label="正文（≥200）">
        <textarea className="border rounded px-2 py-1 w-full h-56" value={text} onChange={e=>setText(e.target.value)} />
      </Row>
      <Row label="来源/许可">
        <input className="border rounded px-2 py-1 flex-1" placeholder="source url (可空)" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} />
        <input className="border rounded px-2 py-1 w-48" placeholder="license" value={license} onChange={e=>setLicense(e.target.value)} />
      </Row>
      <div className="flex gap-2">
        <button onClick={submit} className="px-3 py-1 rounded bg-black text-white">生成答案键并入库</button>
      </div>
      {log && <pre className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{log}</pre>}
    </section>
  );
}

/* ===== AI 生成 ===== */
function AIForm() {
  const [lang, setLang] = useState("en");
  const [genre, setGenre] = useState("news");
  const [difficulty, setDifficulty] = useState(3);
  const [topic, setTopic] = useState("");
  const [words, setWords] = useState(300);
  const [model, setModel] = useState("deepseek-chat");
  const [temperature, setTemperature] = useState(0.6);
  const [log, setLog] = useState("");

  const submit = async () => {
    setLog("生成与入库中…");
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/admin/ingest/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({ lang, genre, difficulty, topic: topic||undefined, words, model, temperature })
    });
    const j = await r.json();
    setLog(r.ok ? `成功：${j.title}（id=${j.article_id}）` : `失败：${j.error}`);
  };

  return (
    <section className="p-4 bg-white rounded-2xl shadow space-y-3">
      <Row label="语言/体裁"><LangGenre lang={lang} setLang={setLang} genre={genre} setGenre={setGenre} /></Row>
      <Row label="难度"><input type="number" min={1} max={5} className="border rounded px-2 py-1 w-24"
        value={difficulty} onChange={e=>setDifficulty(Number(e.target.value)||3)} /></Row>
      <Row label="主题"><input className="border rounded px-2 py-1 w-full" placeholder="可选：主题/场景/话题" value={topic} onChange={e=>setTopic(e.target.value)} /></Row>
      <Row label="目标长度"><input type="number" className="border rounded px-2 py-1 w-28" value={words} onChange={e=>setWords(Number(e.target.value)||300)} /></Row>
      <Row label="模型/温度">
        <select className="border rounded px-2 py-1" value={model} onChange={e=>setModel(e.target.value)}>
          <option value="deepseek-chat">deepseek-chat</option>
          <option value="deepseek-reasoner">deepseek-reasoner</option>
          {/* 如果你还有别的模型，可继续追加 */}
        </select>
        <input type="number" step="0.1" min={0} max={1} className="border rounded px-2 py-1 w-24"
          value={temperature} onChange={e=>setTemperature(Number(e.target.value)||0.6)} />
      </Row>
      <div className="flex gap-2">
        <button onClick={submit} className="px-3 py-1 rounded bg-black text-white">AI 生成并入库</button>
      </div>
      {log && <pre className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{log}</pre>}
      <p className="text-xs text-gray-500">说明：只生成原创正文；答案键与 Cloze 由规则自动提取，保证可复核。</p>
    </section>
  );
}
