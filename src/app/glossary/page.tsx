"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Term = { id?: string; lang: "en"|"ja"; term: string; definition: string; aliases: string[]; tags: string[] };

export default function GlossaryPage() {
  const [uid, setUid] = useState<string>();
  const [lang, setLang] = useState<"en"|"ja">("ja");
  const [list, setList] = useState<Term[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Term>({ lang: "ja", term: "", definition: "", aliases: [], tags: [] });
  const [msg, setMsg] = useState("");

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user?.id) return;
    setUid(u.user.id);
    await load();
  })(); }, [lang, q]);

  const load = async () => {
    const like = `%${q}%`;
    let query = supabase.from("glossary").select("*").eq("lang", lang).order("updated_at", { ascending: false });
    if (q) query = query.or(`term.ilike.${like},definition.ilike.${like}`);
    const { data, error } = await query;
    if (error) setMsg(error.message);
    else setList((data || []) as any);
  };

  const add = async () => {
    if (!uid) return;
    const row = { ...form, user_id: uid, aliases: form.aliases.filter(Boolean), tags: form.tags.filter(Boolean) };
    const { error } = await supabase.from("glossary").insert(row);
    if (error) setMsg(error.message);
    else { setForm({ lang, term: "", definition: "", aliases: [], tags: [] }); setMsg("已添加"); await load(); }
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("glossary").delete().eq("id", id);
    if (error) setMsg(error.message);
    else { setMsg("已删除"); setList(list.filter(x => x.id !== id)); }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">术语库（Glossary）</h1>
      {msg && <div className="text-sm text-gray-600">{msg}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="flex items-center gap-2">
          <span className="w-20">语言</span>
          <select value={lang} onChange={e=>{setLang(e.target.value as any); setForm(f=>({...f, lang: e.target.value as any}))}} className="border rounded px-2 py-1">
            <option value="ja">日语</option><option value="en">英语</option>
          </select>
        </label>
        <label className="md:col-span-2 flex items-center gap-2">
          <span className="w-20">搜索</span>
          <input value={q} onChange={e=>setQ(e.target.value)} className="border rounded px-2 py-1 w-full" placeholder="按术语或定义搜索"/>
        </label>
      </div>

      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <h2 className="font-medium">新增术语</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={form.term} onChange={e=>setForm({...form, term: e.target.value})} placeholder="术语 term" className="border rounded px-2 py-1"/>
          <input value={form.definition} onChange={e=>setForm({...form, definition: e.target.value})} placeholder="定义 definition" className="border rounded px-2 py-1"/>
          <input value={form.aliases.join(",")} onChange={e=>setForm({...form, aliases: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} placeholder="别名, 以逗号分隔" className="border rounded px-2 py-1"/>
          <input value={form.tags.join(",")} onChange={e=>setForm({...form, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} placeholder="标签, 以逗号分隔" className="border rounded px-2 py-1"/>
        </div>
        <button onClick={add} className="px-4 py-2 rounded bg-black text-white">添加</button>
      </section>

      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <h2 className="font-medium">我的术语</h2>
        <ul className="space-y-2">
          {list.map((t:any)=>(
            <li key={t.id} className="p-3 border rounded flex justify-between gap-2">
              <div>
                <div className="text-xs text-gray-500">{t.lang} · {t.tags?.join(", ")}</div>
                <div className="font-medium">{t.term} {t.aliases?.length?`（别名：${t.aliases.join(", ")}）`:""}</div>
                <div className="text-gray-700">{t.definition}</div>
              </div>
              <button onClick={()=>del(t.id)} className="px-2 py-1 rounded border">删除</button>
            </li>
          ))}
          {list.length===0 && <li className="text-sm text-gray-500">暂无术语。</li>}
        </ul>
      </section>
    </main>
  );
}
