"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/Empty";

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
          <Button
            key={s}
            onClick={()=>setStatus(s)}
            variant={status===s?"default":"outline"}
          >
            {s}
          </Button>
        )}
        <Button onClick={load} disabled={loading} className="ml-2">
          {loading ? "加载中..." : "🔄 刷新"}
        </Button>
      </div>
      
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}
      
      {error && (
        <div className="p-4 border rounded text-red-600 border-red-300 bg-red-50">
          <strong>错误:</strong> {error}
          <div className="mt-2">
            <Button size="sm" variant="destructive" onClick={load}>重试</Button>
          </div>
        </div>
      )}
      
      {/* 调试信息 */}
      <div className="bg-yellow-50 p-3 rounded border text-sm text-yellow-900">
        <strong>调试信息:</strong> loading={String(loading)}, error="{error}", list.length={list.length}, status="{status}"
      </div>

      {!loading && !error && (
        <ul className="space-y-2">
          {list.length === 0 ? (
            <li>
              <Empty title={`暂无 ${status} 状态的草稿`} onRetry={load} />
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
