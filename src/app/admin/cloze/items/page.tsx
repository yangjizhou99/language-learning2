"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ClozeItemsAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any|null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [newItem, setNewItem] = useState<any>({ lang:'en', level:3, topic:'', title:'', passage:'', blanksText:'[{"id":1,"answer":"...","acceptable":[],"distractors":[],"explanation":"","type":"vocabulary"}]' });

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/admin/cloze/items', { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
      const j = await r.json();
      if (Array.isArray(j)) setItems(j);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); },[]);

  const remove = async (id:string) => {
    if (!confirm('确定删除该题目？')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`/api/admin/cloze/items?id=${encodeURIComponent(id)}`, { method:'DELETE', headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
    if (r.ok) load(); else alert('删除失败');
  };

  const save = async () => {
    if (!editing) return;
    const { id, title, passage, blanks, topic } = editing;
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/admin/cloze/items', {
      method:'PUT',
      headers: { 'Content-Type':'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ id, title, passage, blanks, topic })
    });
    if (r.ok) { setEditing(null); load(); } else { alert('保存失败'); }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Cloze 题库管理</h1>
      <div>
        <a href="/admin/cloze/ai" className="px-3 py-1 rounded bg-black text-white">新增题目 → 生成页</a>
      </div>
      {/* 搜索与筛选 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input className="border rounded px-2 py-1" placeholder="搜索标题/主题" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="border rounded px-2 py-1" value={lang} onChange={e=>setLang(e.target.value)}>
          <option value="all">所有语言</option><option value="en">英语</option><option value="ja">日语</option><option value="zh">中文</option>
        </select>
        <select className="border rounded px-2 py-1" value={level} onChange={e=>setLevel(e.target.value)}>
          <option value="all">所有难度</option><option value="1">L1</option><option value="2">L2</option><option value="3">L3</option><option value="4">L4</option><option value="5">L5</option>
        </select>
        <button onClick={async()=>{
          const ids = Object.keys(selected).filter(k=>selected[k]);
          if (ids.length===0) return;
          if (!confirm(`确定批量删除 ${ids.length} 条？`)) return;
          const { data: { session } } = await supabase.auth.getSession();
          const h = new Headers({ 'Content-Type':'application/json' });
          if (session?.access_token) h.set('Authorization', `Bearer ${session.access_token}`);
          const r = await fetch('/api/admin/cloze/items', { method:'DELETE', headers: h, body: JSON.stringify({ ids }) });
          if (r.ok) { setSelected({}); load(); } else { alert('批量删除失败'); }
        }} className="px-3 py-1 rounded bg-red-600 text-white">批量删除</button>
      </div>

      {loading ? <div>加载中…</div> : (
        <div className="grid gap-3">
          {items
            .filter(it => (q? (it.title?.toLowerCase().includes(q.toLowerCase()) || it.topic?.toLowerCase().includes(q.toLowerCase())) : true))
            .filter(it => (lang==='all'? true : it.lang===lang))
            .filter(it => (level==='all'? true : String(it.level)===level))
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
              <div className="text-xs text-gray-500 mt-1">{it.lang} · L{it.level} · {it.topic}</div>
            </div>
          ))}
          {items.length===0 && <div className="text-sm text-gray-500">暂无题目</div>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl p-4 rounded shadow space-y-3">
            <div className="text-lg font-semibold">编辑题目</div>
            <input className="w-full border rounded px-2 py-1" value={editing.title||''} onChange={e=>setEditing({...editing, title:e.target.value})} />
            <textarea className="w-full border rounded px-2 py-1 h-40" value={editing.passage||''} onChange={e=>setEditing({...editing, passage:e.target.value})} />
            <div className="text-xs text-gray-500">暂支持整体编辑；如需分 blank 编辑，可在 Cloze 生成页处理。</div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setEditing(null)} className="px-3 py-1 rounded border">取消</button>
              <button onClick={save} className="px-3 py-1 rounded bg-blue-600 text-white">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增改为跳转到生成页，不再内嵌表单 */}
    </main>
  );
}


