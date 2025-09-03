"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ShadowingItemsAdmin(){
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any|null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<string>("all");

  const authHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const load = async ()=>{
    setLoading(true);
    const r = await fetch('/api/admin/shadowing/items', { headers: await authHeader() });
    const j = await r.json();
    if (Array.isArray(j)) setItems(j);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const save = async ()=>{
    if (!editing) return;
    const r = await fetch('/api/admin/shadowing/items', { method:'PUT', headers:{ 'Content-Type':'application/json', ...(await authHeader()) }, body: JSON.stringify(editing) });
    if (r.ok) { setEditing(null); load(); } else alert('保存失败');
  };
  const remove = async (id:string)=>{
    if (!confirm('确定删除该素材？')) return;
    const r = await fetch(`/api/admin/shadowing/items?id=${encodeURIComponent(id)}`, { method:'DELETE', headers: await authHeader() });
    if (r.ok) load(); else alert('删除失败');
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Shadowing 素材管理</h1>
      <div>
        <a href="/admin/shadowing/ai" className="px-3 py-1 rounded bg-black text-white">新增素材 → 生成页</a>
      </div>
      {/* 搜索与筛选 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input className="border rounded px-2 py-1" placeholder="搜索标题" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="border rounded px-2 py-1" value={lang} onChange={e=>setLang(e.target.value)}>
          <option value="all">所有语言</option><option value="en">英语</option><option value="ja">日语</option><option value="zh">中文</option>
        </select>
        <button onClick={async()=>{
          const ids = Object.keys(selected).filter(k=>selected[k]);
          if (ids.length===0) return;
          if (!confirm(`确定批量删除 ${ids.length} 条？`)) return;
          const r = await fetch('/api/admin/shadowing/items', { method:'DELETE', headers:{ 'Content-Type':'application/json', ...(await authHeader()) }, body: JSON.stringify({ ids }) });
          if (r.ok) { setSelected({}); load(); } else alert('批量删除失败');
        }} className="px-3 py-1 rounded bg-red-600 text-white">批量删除</button>
      </div>
      {loading ? <div>加载中…</div> : (
        <div className="grid gap-3">
          {items
            .filter(it => (q? (String(it.title||'').toLowerCase().includes(q.toLowerCase())) : true))
            .filter(it => (lang==='all'? true : it.lang===lang))
            .map(it => (
            <div key={it.id} className="border rounded p-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 mr-2 min-w-0">
                  <input type="checkbox" checked={!!selected[it.id]} onChange={e=>setSelected(s=>({ ...s, [it.id]: e.target.checked }))} />
                  <div className="font-medium truncate">{it.title}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setEditing(it)} className="px-2 py-1 text-xs rounded border">编辑</button>
                  <button onClick={()=>remove(it.id)} className="px-2 py-1 text-xs rounded bg-red-600 text-white">删除</button>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{it.lang}</div>
            </div>
          ))}
          {items.length===0 && <div className="text-sm text-gray-500">暂无素材</div>}
        </div>
      )}

      {/* 新增改为跳转到生成页，不再内嵌表单 */}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl p-4 rounded shadow space-y-3">
            <div className="text-lg font-semibold">编辑素材</div>
            <div className="flex gap-2">
              <select className="border rounded px-2 py-1" value={editing.lang} onChange={e=>setEditing({...editing, lang:e.target.value})}>
                <option value="en">英语</option><option value="ja">日语</option><option value="zh">中文</option>
              </select>
              <input className="flex-1 border rounded px-2 py-1" value={editing.title||''} onChange={e=>setEditing({...editing, title:e.target.value})} />
            </div>
            <textarea className="w-full border rounded px-2 py-1 h-36" value={editing.text||''} onChange={e=>setEditing({...editing, text:e.target.value})} />
            <input className="w-full border rounded px-2 py-1" value={editing.audio_url||''} onChange={e=>setEditing({...editing, audio_url:e.target.value})} />
            <div className="flex justify-end gap-2">
              <button onClick={()=>setEditing(null)} className="px-3 py-1 rounded border">取消</button>
              <button onClick={save} className="px-3 py-1 rounded bg-blue-600 text-white">保存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


