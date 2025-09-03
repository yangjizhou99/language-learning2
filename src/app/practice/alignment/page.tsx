"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AlignmentPack {
  id: string;
  lang: "en" | "ja" | "zh";
  topic: string;
  tags: string[];
  status: string;
  created_at: string;
}

export default function AlignmentListPage() {
  const [packs, setPacks] = useState<AlignmentPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/alignment/packs")
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setPacks(data.packs);
        } else {
          setError(data.error || "加载失败");
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-gray-600">加载中...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-red-600">错误：{error}</div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-semibold mb-4">对齐练习训练包</h1>
        <p className="text-gray-600 mb-6">
          选择训练包开始练习，从简单对话到复杂写作，逐步提升语言能力
        </p>
        
        {packs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>暂无可用的训练包</p>
            <p className="text-sm mt-2">请先在管理端生成训练包</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map((pack) => (
              <div key={pack.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    pack.lang === "en" ? "bg-blue-100 text-blue-700" :
                    pack.lang === "ja" ? "bg-red-100 text-red-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {pack.lang === "en" ? "英语" : pack.lang === "ja" ? "日语" : "中文"}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    pack.status === "published" ? "bg-green-100 text-green-700" :
                    pack.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {pack.status === "published" ? "已发布" : pack.status === "draft" ? "草稿" : "已归档"}
                  </span>
                </div>
                
                <h3 className="font-medium text-lg mb-2">{pack.topic}</h3>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {pack.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                
                <div className="text-xs text-gray-500 mb-4">
                  创建时间：{new Date(pack.created_at).toLocaleDateString()}
                </div>
                
                <Link
                  href={`/practice/alignment/${pack.id}`}
                  className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  开始练习
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 rounded-2xl p-6">
        <h3 className="font-medium text-blue-900 mb-2">关于对齐练习</h3>
        <p className="text-blue-800 text-sm">
          对齐练习采用"范例→仿写"的方式，通过 6 个递进步骤帮助学习者掌握特定场景的语言表达：
          <br />
          D1(简单对话) → D2(复杂对话) → T3(讨论) → W4(短文) → T5(邮件) → W6(长文)
        </p>
      </div>
    </main>
  );
}
