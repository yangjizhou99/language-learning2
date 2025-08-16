"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const [uid, setUid] = useState<string>();
  const [form, setForm] = useState<any>({
    username: "", native_lang: "", target_langs: [], bio: "", goals: "", preferred_tone: "", domains: []
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) { setMsg("未登录"); return; }
      setUid(u.user.id);
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (data) setForm({
        username: data.username || "",
        native_lang: data.native_lang || "",
        target_langs: data.target_langs || [],
        bio: data.bio || "",
        goals: data.goals || "",
        preferred_tone: data.preferred_tone || "",
        domains: data.domains || []
      });
    })();
  }, []);

  const save = async () => {
    if (!uid) return;
    const { error } = await supabase.from("profiles").update(form).eq("id", uid);
    setMsg(error ? error.message : "已保存");
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">个人画像（RAG）</h1>
      {msg && <div className="text-sm text-gray-600">{msg}</div>}
      <div className="space-y-2">
        <label className="block">
          <div className="text-sm">昵称</div>
          <input value={form.username} onChange={e=>setForm({...form, username: e.target.value})} className="border rounded px-2 py-1 w-full"/>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="block">
            <div className="text-sm">母语</div>
            <input value={form.native_lang} onChange={e=>setForm({...form, native_lang: e.target.value})} className="border rounded px-2 py-1 w-full"/>
          </label>
          <label className="block">
            <div className="text-sm">目标语言（逗号分隔）</div>
            <input value={(form.target_langs||[]).join(",")} onChange={e=>setForm({...form, target_langs: e.target.value.split(",").map((s)=>s.trim()).filter(Boolean)})} className="border rounded px-2 py-1 w-full"/>
          </label>
        </div>
        <label className="block">
          <div className="text-sm">语气偏好（如：礼貌/冷静/活泼）</div>
          <input value={form.preferred_tone} onChange={e=>setForm({...form, preferred_tone: e.target.value})} className="border rounded px-2 py-1 w-full"/>
        </label>
        <label className="block">
          <div className="text-sm">擅长/目标领域（逗号分隔）</div>
          <input value={(form.domains||[]).join(",")} onChange={e=>setForm({...form, domains: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)})} className="border rounded px-2 py-1 w-full"/>
        </label>
        <label className="block">
          <div className="text-sm">个人简介（中文写即可）</div>
          <textarea value={form.bio} onChange={e=>setForm({...form, bio: e.target.value})} className="border rounded p-2 w-full min-h-[100px]"/>
        </label>
        <label className="block">
          <div className="text-sm">学习目标（越具体越好）</div>
          <textarea value={form.goals} onChange={e=>setForm({...form, goals: e.target.value})} className="border rounded p-2 w-full min-h-[100px]"/>
        </label>
        <button onClick={save} className="px-4 py-2 rounded bg-black text-white">保存</button>
      </div>
    </main>
  );
}
