"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ShadowingReviewDetail(){
  const { id } = useParams<{ id:string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [ttsLoading, setTtsLoading] = useState(false);

  useEffect(()=>{ (async()=>{
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
    const j = await r.json();
    setDraft(j.draft);
  })(); }, [id]);

  async function save(){
    if (!draft) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, { method:"PUT", headers:{"Content-Type":"application/json", ...(token? { Authorization: `Bearer ${token}` }: {})}, body: JSON.stringify({ title:draft.title, topic:draft.topic, genre:draft.genre, register:draft.register, text:draft.text, notes:draft.notes }) });
    setSaving(false);
    setLog(r.ok? "已保存" : `保存失败: ${r.status}`);
  }

  async function publish(){
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, { method:"POST", headers:{"Content-Type":"application/json", ...(token? { Authorization: `Bearer ${token}` }: {})}, body: JSON.stringify({ action:"publish" }) });
    if (r.ok) router.push("/admin/shadowing/review");
    else setLog(`发布失败: ${r.status}`);
  }

  async function synthAndAttach(){
    try {
      setTtsLoading(true); setLog("合成中…");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/synthesize', {
        method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) },
        body: JSON.stringify({ text: draft.text, lang: draft.lang, voice: draft?.notes?.voice || null, speakingRate: draft?.notes?.speakingRate || 1.0 })
      });
      const j = await r.json();
      if (!r.ok) { setLog('合成失败：' + (j.error||r.statusText)); setTtsLoading(false); return; }
      setAudioUrl(j.audio_url);
      // 将音频 URL 写入 notes.audio_url，保存草稿
      const next = { ...draft, notes: { ...(draft.notes||{}), audio_url: j.audio_url } };
      setDraft(next);
      await save();
      setLog('已合成并保存到草稿 Notes');
      setTtsLoading(false);
    } catch (e:any) {
      setTtsLoading(false); setLog('合成异常：' + (e.message||String(e)));
    }
  }

  if (!draft) return <div>加载中…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shadowing 草稿详情</h1>
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-gray-500">标题</div>
            <input className="w-full border rounded px-2 py-1" value={draft.title||""} onChange={e=> setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <div className="text-sm text-gray-500">主题</div>
            <input className="w-full border rounded px-2 py-1" value={draft.topic||""} onChange={e=> setDraft({ ...draft, topic: e.target.value })} />
          </div>
          <div>
            <div className="text-sm text-gray-500">体裁 / 语域</div>
            <div className="flex gap-2">
              <select className="border rounded px-2 py-1" value={draft.genre||"monologue"} onChange={e=> setDraft({ ...draft, genre: e.target.value })}>
                <option value="monologue">monologue</option>
                <option value="dialogue">dialogue</option>
                <option value="news">news</option>
                <option value="lecture">lecture</option>
              </select>
              <select className="border rounded px-2 py-1" value={draft.register||"neutral"} onChange={e=> setDraft({ ...draft, register: e.target.value })}>
                <option value="casual">casual</option>
                <option value="neutral">neutral</option>
                <option value="formal">formal</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">正文</div>
          <textarea className="w-full border rounded px-2 py-1" rows={12} value={draft.text||""} onChange={e=> setDraft({ ...draft, text: e.target.value })} />
        </div>
        <div>
          <div className="text-sm text-gray-500">Notes JSON</div>
          <textarea className="w-full border rounded px-2 py-1 font-mono" rows={10} value={JSON.stringify(draft.notes||{}, null, 2)} onChange={e=> { try{ setDraft({ ...draft, notes: JSON.parse(e.target.value) }); } catch {} }} />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={save} disabled={saving}>保存</button>
          <button className="px-4 py-2 rounded border" onClick={synthAndAttach} disabled={ttsLoading}>生成语音并写入</button>
          <button className="px-4 py-2 rounded border" onClick={publish}>发布</button>
          <div className="text-sm text-gray-500">{log}</div>
        </div>
        {audioUrl && (
          <audio controls src={audioUrl} className="w-full" />
        )}
      </div>
    </div>
  );
}


