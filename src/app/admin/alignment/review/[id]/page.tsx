"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AlignmentReviewDetail(){
  const { id } = useParams<{ id:string }>();
  const router = useRouter();
  const [pack, setPack] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState("");

  useEffect(()=>{ (async()=>{
    // 添加认证头
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const r = await fetch(`/api/admin/alignment/drafts/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const j = await r.json();
    setPack(j.pack);
  })(); }, [id]);

  async function save(){
    if (!pack) return;
    setSaving(true);
    
    // 添加认证头
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const r = await fetch(`/api/admin/alignment/drafts/${id}`, { 
      method:"PUT", 
      headers:{
        "Content-Type":"application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }, 
      body: JSON.stringify({ topic: pack.topic, tags: pack.tags, preferred_style: pack.preferred_style, steps: pack.steps }) 
    });
    setSaving(false);
    setLog(r.ok? "已保存" : `保存失败: ${r.status}`);
  }

  async function publish(){
    // 添加认证头
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const r = await fetch(`/api/admin/alignment/drafts/${id}`, { 
      method:"POST", 
      headers:{
        "Content-Type":"application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }, 
      body: JSON.stringify({ action:"publish" }) 
    });
    if (r.ok) router.push("/admin/alignment/review");
    else setLog(`发布失败: ${r.status}`);
  }

  if (!pack) return <div>加载中…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">对齐草稿详情</h1>
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-gray-500">主题</div>
            <input className="w-full border rounded px-2 py-1" value={pack.topic||""} onChange={e=> setPack({ ...pack, topic: e.target.value })} />
          </div>
          <div>
            <div className="text-sm text-gray-500">标签（逗号分隔）</div>
            <input className="w-full border rounded px-2 py-1" value={(pack.tags||[]).join(", ")} onChange={e=> setPack({ ...pack, tags: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean) })} />
          </div>
          <div>
            <div className="text-sm text-gray-500">风格 JSON</div>
            <textarea className="w-full border rounded px-2 py-1" rows={4} value={JSON.stringify(pack.preferred_style||{}, null, 2)} onChange={e=>{ try{ setPack({ ...pack, preferred_style: JSON.parse(e.target.value) }); } catch {} }} />
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Steps JSON</div>
          <textarea className="w-full border rounded px-2 py-1 font-mono" rows={16} value={JSON.stringify(pack.steps||{}, null, 2)} onChange={e=>{ try{ setPack({ ...pack, steps: JSON.parse(e.target.value) }); } catch {} }} />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={save} disabled={saving}>保存</button>
          <button className="px-4 py-2 rounded border" onClick={publish}>发布</button>
          <div className="text-sm text-gray-500">{log}</div>
        </div>
      </div>
    </div>
  );
}


