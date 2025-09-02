"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DraftsTestFixPage() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const testDirectAPI = async () => {
    setLoading(true);
    setResult("测试中...");
    
    try {
      // 完全模拟草稿箱页面的调用方式
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      console.log("Token:", token ? "存在" : "不存在");
      
      const response = await fetch(`/api/admin/drafts/list?status=pending`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers));
      
      const data = await response.json();
      console.log("Response data:", data);
      
      if (!response.ok) {
        setResult(`❌ API调用失败:\nStatus: ${response.status}\nError: ${JSON.stringify(data, null, 2)}`);
        return;
      }
      
      if (Array.isArray(data)) {
        setResult(`✅ API调用成功!\n找到 ${data.length} 条记录:\n${JSON.stringify(data, null, 2)}`);
      } else {
        setResult(`❌ 返回数据不是数组:\nType: ${typeof data}\nData: ${JSON.stringify(data, null, 2)}`);
      }
      
    } catch (error) {
      console.error("Test error:", error);
      setResult(`❌ 测试失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testDirectSupabase = async () => {
    setLoading(true);
    setResult("直接测试 Supabase...");
    
    try {
      const { data, error } = await supabase
        .from("article_drafts")
        .select("id,source,lang,genre,difficulty,title,created_at,status,ai_provider,ai_model")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) {
        setResult(`❌ Supabase查询失败:\n${JSON.stringify(error, null, 2)}`);
        return;
      }
      
      setResult(`✅ Supabase直接查询成功!\n找到 ${data?.length || 0} 条记录:\n${JSON.stringify(data, null, 2)}`);
      
    } catch (error) {
      console.error("Supabase test error:", error);
      setResult(`❌ Supabase测试失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">草稿列表问题诊断</h1>
      
      <div className="space-x-4">
        <button
          onClick={testDirectAPI}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          🔧 测试API调用
        </button>
        <button
          onClick={testDirectSupabase}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          🗄️ 直接测试Supabase
        </button>
      </div>
      
      {result && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">测试结果:</h3>
          <pre className="text-sm whitespace-pre-wrap overflow-auto">{result}</pre>
        </div>
      )}
      
      <div className="bg-blue-50 p-4 rounded-lg text-sm">
        <h3 className="font-medium mb-2">说明:</h3>
        <ul className="space-y-1">
          <li>• 这个页面用于调试草稿列表显示问题</li>
          <li>• "测试API调用" 完全模拟草稿箱页面的调用方式</li>
          <li>• "直接测试Supabase" 绕过API直接查询数据库</li>
          <li>• 查看浏览器控制台可获得更多调试信息</li>
        </ul>
      </div>
      
      <div className="text-center">
        <a href="/admin/drafts" className="text-blue-600 hover:underline">
          ← 返回草稿箱
        </a>
      </div>
    </main>
  );
}
