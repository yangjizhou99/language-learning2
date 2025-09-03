"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Stats = {
  clozeItems: number;
  clozeDrafts: number;
  alignmentPacks: number;
  articles: number;
  shadowingItems: number;
};

export default function BanksOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = new Headers();
        if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);

        // 后端已有的端点：cloze drafts/items；alignment packs；文章（广读使用 articles）与 shadowing items
        const [clozeDraftsRes, clozeItemsRes, packsRes, articlesRes, shadowingItemsRes] = await Promise.all([
          fetch("/api/admin/cloze/drafts", { headers }),
          fetch("/api/admin/cloze/items", { headers }),
          fetch("/api/admin/alignment/packs", { headers }),
          fetch("/api/admin/articles/items", { headers }) /* 精准统计广读文章 */,
          fetch("/api/shadowing/recommended", { headers }) /* 如需精确总数，未来可加 /api/admin/shadowing/items */,
        ]);

        const next: Stats = {
          clozeItems: clozeItemsRes.ok ? (await clozeItemsRes.json()).length : 0,
          clozeDrafts: clozeDraftsRes.ok ? (await clozeDraftsRes.json()).length : 0,
          alignmentPacks: packsRes.ok ? (await packsRes.json())?.length || 0 : 0,
          articles: articlesRes.ok ? (await articlesRes.json())?.length || 0 : 0,
          shadowingItems: shadowingItemsRes.ok ? (await shadowingItemsRes.json())?.items?.length || 0 : 0,
        };
        setStats(next);
      } catch (e) {
        console.error("加载题库统计失败:", e);
      }
    })();
  }, []);

  const deleteClozeItem = async (id: string) => {
    try {
      setBusy(id);
      const { data: { session } } = await supabase.auth.getSession();
      const h = new Headers();
      if (session?.access_token) h.set('Authorization', `Bearer ${session.access_token}`);
      const r = await fetch(`/api/admin/cloze/items?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: h });
      if (!r.ok) throw new Error('删除失败');
      // 重新加载统计
      location.reload();
    } catch (e) {
      console.error(e);
      alert('删除失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">题库 · 总览</h1>

      {/* 概览统计 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card title="Cloze 题目" value={stats.clozeItems} color="indigo" />
          <Card title="Cloze 草稿" value={stats.clozeDrafts} color="purple" />
          <Card title="对齐训练包" value={stats.alignmentPacks} color="blue" />
          <Card title="广读文章" value={stats.articles} color="green" />
          <Card title="Shadowing 素材" value={stats.shadowingItems} color="orange" />
        </div>
      )}

      {/* 管理入口 */}
      <section className="bg-white p-6 rounded-2xl border shadow-sm">
        <h2 className="text-xl font-semibold mb-2">管理入口</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Entry href="/admin/cloze/ai" title="Cloze 管理" desc="生成、审核、发布挖空练习" emoji="🎯" />
          <Entry href="/admin/alignment/ai" title="对齐练习管理" desc="训练包与步骤内容管理" emoji="🤝" />
          <Entry href="/admin/articles" title="广读题库管理" desc="文章抓取、手动录入、AI 生成" emoji="📄" />
          <Entry href="/admin/shadowing/ai" title="Shadowing 管理" desc="素材生成、保存与合成" emoji="🎙️" />
          <Entry href="/admin/drafts" title="草稿箱" desc="统一审核与发布入口" emoji="📋" />
        </div>
        <h3 className="text-lg font-medium mt-6 mb-2">快捷删除（示例：Cloze 最新条目）</h3>
        <LatestClozeList onDelete={deleteClozeItem} busyId={busy} />
      </section>
    </main>
  );
}

function Card({ title, value, color }:{ title:string; value:number; color:"indigo"|"purple"|"blue"|"green"|"orange" }){
  const colorMap:any = {
    indigo: "text-indigo-600",
    purple: "text-purple-600",
    blue: "text-blue-600",
    green: "text-green-600",
    orange: "text-orange-600",
  };
  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className={`text-3xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

function Entry({ href, title, desc, emoji }:{ href:string; title:string; desc:string; emoji:string }){
  return (
    <Link href={href} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
      <h3 className="font-medium text-gray-900">{emoji} {title}</h3>
      <p className="text-sm text-gray-600 mt-1">{desc}</p>
    </Link>
  );
}
function LatestClozeList({ onDelete, busyId }:{ onDelete:(id:string)=>void; busyId:string|null }){
  const [items, setItems] = useState<any[]>([]);
  useEffect(()=>{ (async()=>{
    const { data: { session } } = await supabase.auth.getSession();
    const h = new Headers();
    if (session?.access_token) h.set('Authorization', `Bearer ${session.access_token}`);
    const r = await fetch('/api/admin/cloze/items', { headers: h });
    const j = await r.json();
    if (Array.isArray(j)) setItems(j.slice(0, 10));
  })(); },[]);
  return (
    <div className="mt-2 grid grid-cols-1 gap-2">
      {items.map(it => (
        <div key={it.id} className="flex items-center justify-between p-2 border rounded">
          <div className="text-sm truncate max-w-[70%]">{it.title}</div>
          <button onClick={()=>onDelete(it.id)} disabled={busyId===it.id} className="px-2 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-50">
            {busyId===it.id? '删除中…':'删除'}
          </button>
        </div>
      ))}
      {items.length===0 && <div className="text-sm text-gray-500">暂无数据</div>}
    </div>
  );
}


