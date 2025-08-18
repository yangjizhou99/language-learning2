"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminArticles() {
  const [url, setUrl] = useState("");
  const [lang, setLang] = useState<"en"|"ja"|"zh">("en");
  const [genre, setGenre] = useState("news");
  const [difficulty, setDifficulty] = useState(3);
  const [log, setLog] = useState("");

  const ingest = async () => {
    setLog("抓取与生成中…");
    try {
      const hasErrorField = (x: unknown): x is { error: string } => {
        if (typeof x !== "object" || x === null) return false;
        const maybe = x as { error?: unknown };
        return typeof maybe.error === "string";
      };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLog("失败：请先登录管理员账号"); return; }
      const r = await fetch("/api/admin/ingest", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ url, lang, genre, difficulty })
      });
      const isJson = (r.headers.get("content-type") || "").includes("application/json");
      let body: unknown = null;
      if (isJson) {
        try { body = await r.json(); } catch { body = null; }
      } else {
        try { body = await r.text(); } catch { body = null; }
      }
      if (!r.ok) {
        const errMsg = (isJson && hasErrorField(body)) ? body.error : (typeof body === "string" && body ? body.slice(0,500) : r.statusText);
        setLog("失败：" + errMsg);
        return;
      }
      type IngestResponse = { ok?: boolean; article_id?: string; title?: string; error?: string };
      const j = (isJson ? (body as IngestResponse) : null);
      setLog("成功：已入库 " + (j?.title ?? "") + "（id=" + (j?.article_id ?? "?") + "）");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setLog("失败：" + msg);
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">题库 · 文章入库</h1>
      <div className="space-y-2">
        <input className="border rounded px-2 py-1 w-full" placeholder="文章URL（Wikipedia / Wikinews / Gutenberg / Tatoeba）"
               value={url} onChange={e=>setUrl(e.target.value)} />
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1" value={lang} onChange={e=>setLang(e.target.value as "en"|"ja"|"zh")}>
            <option value="en">英语</option><option value="ja">日语</option><option value="zh">中文</option>
          </select>
          <select className="border rounded px-2 py-1" value={genre} onChange={e=>setGenre(e.target.value)}>
            <option value="news">新闻</option><option value="science">科普</option><option value="essay">随笔</option><option value="dialogue">对话</option><option value="literature">文学</option>
          </select>
          <input type="number" min={1} max={5} className="border rounded px-2 py-1 w-20" value={difficulty}
                 onChange={e=>setDifficulty(Number(e.target.value)||3)} />
          <button onClick={ingest} className="px-3 py-1 rounded bg-black text-white">入库</button>
        </div>
      </div>
      {log && <pre className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">{log}</pre>}
      <p className="text-xs text-gray-500">提示：需要管理员账号。入库会自动生成三色聚光答案与两套 Cloze。</p>
    </main>
  );
}
