"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DraftDetail({ params }:{ params:{ id:string }}) {
  const id = params.id;
  const [d, setD] = useState<any>(null);
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const load = async () => { 
    try {
      setLoading(true);
      setError("");
      
      // 获取认证token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const r = await fetch(`/api/admin/drafts/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }); 
      
      if (!r.ok) {
        const errorData = await r.json();
        throw new Error(errorData.error || `HTTP ${r.status}`);
      }
      
      const data = await r.json();
      console.log("草稿详情数据:", data);
      setD(data);
    } catch (err) {
      console.error("加载草稿详情失败:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(()=>{ load(); }, [id]);

  const update = async (patch:any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const r = await fetch(`/api/admin/drafts/${id}`, { 
        method:"PATCH", 
        headers:{ 
          "Content-Type":"application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }, 
        body: JSON.stringify(patch) 
      });
      
      if (!r.ok) {
        const errorData = await r.json();
        setLog(`更新失败: ${errorData.error}`);
        return;
      }
      
      await load();
      setLog("更新成功");
    } catch (err) {
      setLog(`更新失败: ${err}`);
    }
  };
  
  const publish = async () => {
    try {
      setLog("发布中…");
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const r = await fetch(`/api/admin/drafts/${id}/publish`, { 
        method:"POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const j = await r.json();
      setLog(r.ok ? `发布成功：article_id=${j.article_id}` : `失败：${j.error}`);
      if (r.ok) await load();
    } catch (err) {
      setLog(`发布失败: ${err}`);
    }
  };

  if (loading) return <main className="p-6">加载中…</main>;
  if (error) return (
    <main className="p-6">
      <div className="bg-red-50 p-4 rounded border text-red-800">
        <strong>错误:</strong> {error}
        <div className="mt-2">
          <button 
            onClick={load} 
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            重试
          </button>
        </div>
      </div>
    </main>
  );
  if (!d) return <main className="p-6">数据为空</main>;
  
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">草稿详情</h1>
      
      {/* 调试信息 */}
      <div className="bg-yellow-50 p-3 rounded border text-sm">
        <strong>调试信息:</strong> ID={id}, 数据存在={!!d}, 标题="{d?.title}", 状态="{d?.status}"
      </div>
      
      <div className="space-y-2">
        <input 
          className="border rounded px-2 py-1 w-full" 
          value={d.title} 
          onChange={e=>setD({...d,title:e.target.value})}
        />
        <textarea 
          className="border rounded px-2 py-1 w-full h-72" 
          value={d.text} 
          onChange={e=>setD({...d,text:e.target.value})}
        />
        <div className="text-xs text-gray-500">
          AI: {d.ai_provider||"-"} {d.ai_model||""} · usage: {JSON.stringify(d.ai_usage||{})}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={()=>update({ title:d.title, text:d.text, status:"approved" })} 
            className="px-3 py-1 rounded border"
          >
            标记为已审
          </button>
          <button 
            onClick={()=>update({ status:"needs_fix" })} 
            className="px-3 py-1 rounded border"
          >
            需要修改
          </button>
          <button 
            onClick={()=>update({ status:"rejected" })} 
            className="px-3 py-1 rounded border"
          >
            拒绝
          </button>
          <button 
            onClick={publish} 
            className="px-3 py-1 rounded bg-black text-white"
          >
            发布 → 正式题库
          </button>
        </div>
        {log && <pre className="text-sm p-2 bg-gray-50 rounded">{log}</pre>}
      </div>

      {/* 参考答案预览（简版） */}
      <section className="p-3 bg-white rounded border space-y-2">
        <h3 className="font-medium">预生成答案键摘要</h3>
        <div className="text-sm text-gray-600">
          Pass1: {d?.keys?.pass1?.length||0} · Pass2: {d?.keys?.pass2?.length||0} · Pass3: {d?.keys?.pass3?.length||0}
        </div>
        <details className="text-xs">
          <summary>展开 JSON</summary>
          <pre className="overflow-auto">{JSON.stringify(d.keys, null, 2)}</pre>
        </details>
        <h4 className="font-medium">Cloze</h4>
        <div className="text-sm">
          短版空格数：{(d.cloze_short||[]).length}；长版空格数：{(d.cloze_long||[]).length}
        </div>
      </section>
    </main>
  );
}
