"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Draft = { 
  id:string; 
  source:string; 
  lang:string; 
  genre:string; 
  difficulty:number; 
  title:string; 
  created_at:string; 
  status:string; 
  ai_provider?:string; 
  ai_model?:string 
};

export default function DraftsPage(){
  const [status, setStatus] = useState("pending");
  const [list, setList] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  
  const load = async () => {
    try {
      setLoading(true);
      setError("");
      
      // 添加认证头
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const r = await fetch(`/api/admin/drafts/list?status=${status}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }); 
      const j = await r.json(); 
      
      if (!r.ok) {
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      
      // 确保返回的是数组
      console.log("API响应状态:", r.status);
      console.log("API响应数据:", j);
      console.log("数据类型:", typeof j, Array.isArray(j));
      
      if (Array.isArray(j)) {
        console.log("设置列表数据，长度:", j.length);
        setList(j);
      } else {
        console.error("API返回的不是数组:", j);
        setList([]);
        setError("数据格式错误");
      }
    } catch (err) {
      console.error("加载草稿列表失败:", err);
      setError(String(err));
      setList([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(()=>{ load(); }, [status]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">草稿箱</h1>
      <div className="flex gap-2 items-center">
        {["pending","needs_fix","approved","published","rejected"].map(s =>
          <button 
            key={s} 
            onClick={()=>setStatus(s)} 
            className={`px-3 py-1 border rounded ${status===s?"bg-black text-white":""}`}
          >
            {s}
          </button>
        )}
        <button 
          onClick={load}
          disabled={loading}
          className="px-3 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 ml-4"
        >
          {loading ? "加载中..." : "🔄 刷新"}
        </button>
      </div>
      
      {loading && (
        <div className="text-center py-8 text-gray-500">
          加载中...
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
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
      )}
      
      {/* 调试信息 */}
      <div className="bg-yellow-50 p-3 rounded border text-sm">
        <strong>调试信息:</strong> loading={String(loading)}, error="{error}", list.length={list.length}, status="{status}"
      </div>

      {!loading && !error && (
        <ul className="space-y-2">
          {list.length === 0 ? (
            <li className="p-6 text-center text-gray-500 border rounded">
              暂无 {status} 状态的草稿
            </li>
          ) : (
            list.map(d =>
              <li key={d.id} className="p-3 border rounded">
                <a className="font-medium underline" href={`/admin/drafts/${d.id}`}>
                  {d.title}
                </a>
                <div className="text-xs text-gray-500">
                  {d.lang} · {d.genre}/L{d.difficulty} · {new Date(d.created_at).toLocaleString()} · {d.source} {d.ai_model?`· ${d.ai_model}`:""}
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </main>
  );
}
