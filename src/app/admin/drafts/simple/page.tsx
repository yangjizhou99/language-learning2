"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
        const response = await fetch("/api/admin/drafts/list?status=pending", {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Response data:", data);

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (Array.isArray(data)) {
          setDrafts(data);
          console.log("成功设置草稿列表，数量:", data.length);
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
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">简化版草稿箱</h1>
        <div className="text-center py-8">加载中...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">简化版草稿箱</h1>
        <div className="bg-red-50 p-4 rounded border text-red-800">
          错误: {error}
        </div>
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
        <div className="text-center py-8 text-gray-500 border rounded">
          没有找到pending状态的草稿
        </div>
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
                <a 
                  href={`/admin/drafts/${draft.id}`}
                  className="text-blue-600 hover:underline"
                >
                  查看详情 →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <a href="/admin/drafts" className="text-blue-600 hover:underline">
          ← 返回正常草稿箱
        </a>
      </div>
    </main>
  );
}
