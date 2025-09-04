"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Item = { id:string; lang:"en"|"ja"|"zh"; level:number; genre:string; title:string; status:string; created_at:string; notes?: any };

export default function ShadowingReviewList(){
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"all"|"en"|"ja"|"zh">("all");
  const [genre, setGenre] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ttsLoading, setTtsLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [ttsTotal, setTtsTotal] = useState(0);
  const [ttsDone, setTtsDone] = useState(0);
  const [ttsCurrent, setTtsCurrent] = useState("");

  useEffect(()=>{ (async()=>{
    const params = new URLSearchParams({ status:"draft" });
    if (lang !== 'all') params.set('lang', lang);
    if (genre !== 'all') params.set('genre', genre);
    if (q.trim()) params.set('q', q.trim());
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts?${params}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
    const j = await r.json();
    setItems(j.items||[]);
  })(); }, [q, lang, genre]);

  function isAllSelected(): boolean {
    if (items.length === 0) return false;
    return items.every(it => selected.has(it.id));
  }
  function toggleSelectAll(){
    setSelected(prev => {
      if (items.length === 0) return new Set();
      const all = new Set<string>();
      if (!isAllSelected()) items.forEach(it => all.add(it.id));
      return isAllSelected() ? new Set() : all;
    });
  }
  function toggleSelect(id: string){
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function synthOne(id: string){
    const it = items.find(x => x.id === id);
    if (!it) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const detail = await fetch(`/api/admin/shadowing/drafts/${id}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
      if (!detail.ok) throw new Error(`获取草稿失败(${detail.status})`);
      const dj = await detail.json();
      const draft = dj.draft;
      const r = await fetch('/api/admin/shadowing/synthesize', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) }, body: JSON.stringify({ text: draft.text, lang: draft.lang, voice: draft?.notes?.voice || null, speakingRate: draft?.notes?.speakingRate || 1.0 }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "TTS 失败");
      // 写入 notes.audio_url 并保存
      const next = { ...draft, notes: { ...(draft.notes||{}), audio_url: j.audio_url } };
      const save = await fetch(`/api/admin/shadowing/drafts/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) }, body: JSON.stringify({ notes: next.notes }) });
      if (!save.ok) throw new Error(`保存音频地址失败(${save.status})`);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async function synthSelected(){
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setTtsLoading(true);
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;
    try {
      for (const id of ids) {
        const it = items.find(x => x.id === id);
        setTtsCurrent(it?.title || "");
        const ok = await synthOne(id);
        if (!ok) fail += 1;
        setTtsDone(v => v + 1);
      }
      toast.success(`TTS 合成完成：${ids.length - fail}/${ids.length}`);
      // 触发刷新
      setQ(q => q);
    } catch (e) {
      toast.error("批量合成失败，请重试");
    } finally {
      setTtsCurrent("");
      setTtsLoading(false);
    }
  }

  async function deleteOne(id: string){
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`/api/admin/shadowing/drafts/${id}`, { method:'DELETE', headers: token? { Authorization: `Bearer ${token}` } : undefined });
  }

  async function deleteSelected(){
    if (selected.size === 0) return;
    for (const id of Array.from(selected)) await deleteOne(id);
    setSelected(new Set());
    // 刷新
    setQ(q => q);
  }

  async function publishOne(id: string){
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`/api/admin/shadowing/drafts/${id}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: "publish" }) });
  }

  async function publishSelected(){
    if (selected.size === 0) return;
    setPublishing(true);
    try {
      for (const id of Array.from(selected)) {
        await publishOne(id);
      }
      setSelected(new Set());
      // 刷新
      setQ(q => q);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shadowing 草稿审核</h1>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1" placeholder="搜索标题" value={q} onChange={e=> setQ(e.target.value)} />
        <select className="border rounded px-2 py-1" value={lang} onChange={e=> setLang(e.target.value as any)}>
          <option value="all">全部语言</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="zh">简体中文</option>
        </select>
        <select className="border rounded px-2 py-1" value={genre} onChange={e=> setGenre(e.target.value)}>
          <option value="all">全部体裁</option>
          <option value="monologue">monologue</option>
          <option value="dialogue">dialogue</option>
          <option value="news">news</option>
          <option value="lecture">lecture</option>
        </select>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={isAllSelected()} onChange={toggleSelectAll} /> 全选</label>
        <button className="px-2 py-1 rounded border disabled:opacity-50" onClick={synthSelected} disabled={ttsLoading || selected.size===0}>批量合成 TTS</button>
        <button className="px-2 py-1 rounded border disabled:opacity-50" onClick={publishSelected} disabled={publishing || selected.size===0}>批量发布选中</button>
        <button className="px-2 py-1 rounded border text-red-600 disabled:opacity-50" onClick={deleteSelected} disabled={selected.size===0}>删除选中</button>
      </div>
      {ttsLoading && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div>
            合成中（{ttsDone}/{ttsTotal}）{ttsCurrent ? `· 当前：${ttsCurrent}` : ""}
          </div>
          <div className="h-2 bg-gray-200 rounded w-64 overflow-hidden">
            <div
              className="h-2 bg-blue-500"
              style={{ width: `${ttsTotal > 0 ? Math.round((ttsDone/ttsTotal)*100) : 0}%` }}
            />
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow divide-y">
        {items.map(it=> (
          <div key={it.id} className="p-4 flex items-center justify-between">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selected.has(it.id)} onChange={()=> toggleSelect(it.id)} className="mt-1"/>
              <div>
                <div className="text-sm text-gray-500">{it.lang} · L{it.level} · {it.genre}</div>
                <div className="font-medium">{it.title}</div>
                {it?.notes?.audio_url && (
                  <div className="mt-2">
                    <audio controls src={it.notes.audio_url} className="h-8" />
                  </div>
                )}
              </div>
            </div>
            <Link className="px-3 py-1 rounded bg-blue-600 text-white" href={`/admin/shadowing/review/${it.id}`}>查看</Link>
          </div>
        ))}
        {items.length===0 && <div className="p-6 text-center text-gray-500">暂无草稿</div>}
      </div>
    </div>
  );
}


