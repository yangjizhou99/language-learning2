"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/Empty";

export default function SimpleDraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        console.log("开始加载草稿...");
        
        // 获取认证token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        console.log("Token:", token ? "存在" : "不存在");

        // 调用API
        const key = `drafts:lastSync:pending`;
        const since = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        const qs = new URLSearchParams({ status: 'pending' });
        if (since) qs.set('since', since);
        const response = await fetch(`/api/admin/drafts/list?${qs.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Response data:", data);

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (Array.isArray(data)) {
          // 合并增量
          const byId: Record<string, any> = {} as any;
          for (const d of [...drafts, ...data]) byId[d.id] = d;
          const merged = Object.values(byId).sort((a:any,b:any)=>
            new Date(b.updated_at||b.created_at).getTime() - new Date(a.updated_at||a.created_at).getTime()
          );
          setDrafts(merged);
          const maxUpdated = data.reduce((m:any, d:any)=>{
            const t = new Date(d.updated_at||d.created_at).toISOString();
            return m && m>t ? m : t;
          }, since || null);
          if (maxUpdated && typeof window !== 'undefined') localStorage.setItem(key, maxUpdated);
        } else if (data && data.data) {
          setDrafts(data.data);
          const maxUpdated = (data.data as any[]).reduce((m:any, d:any)=>{
            const t = new Date(d.updated_at||d.created_at).toISOString();
            return m && m>t ? m : t;
          }, null);
          if (maxUpdated && typeof window !== 'undefined') localStorage.setItem(key, maxUpdated);
        } else {
          throw new Error("返回的数据不是数组");
        }

      } catch (err) {
        console.error("加载失败:", err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadDrafts();
  }, []);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">简化版草稿箱</h1>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">简化版草稿箱</h1>
        <div className="p-4 border rounded text-red-600 bg-red-50">错误: {error}</div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">简化版草稿箱</h1>
      
      <div className="bg-blue-50 p-3 rounded border text-sm">
        <strong>状态:</strong> 找到 {drafts.length} 个pending状态的草稿
      </div>

      {drafts.length === 0 ? (
        <Empty title="没有找到 pending 状态的草稿" />
      ) : (
        <div className="space-y-3">
          {drafts.map((draft, index) => (
            <div key={draft.id} className="p-4 border rounded bg-white">
              <h3 className="font-medium">
                {index + 1}. {draft.title}
              </h3>
              <div className="text-sm text-gray-600 mt-1">
                ID: {draft.id}
              </div>
              <div className="text-sm text-gray-600">
                状态: {draft.status} | 来源: {draft.source} | 模型: {draft.ai_model}
              </div>
              <div className="text-sm text-gray-600">
                创建时间: {new Date(draft.created_at).toLocaleString()}
              </div>
              <div className="mt-2">
                <Button asChild>
                  <Link href={`/admin/drafts/${draft.id}`}>查看详情 →</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <Button asChild variant="link">
          <Link href="/admin/drafts">← 返回正常草稿箱</Link>
        </Button>
      </div>
    </main>
  );
}
