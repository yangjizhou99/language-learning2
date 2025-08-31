"use client";
import { useState } from "react";

export default function SimpleTestPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const testBasic = async () => {
    setLoading(true);
    setMessage("开始测试...");
    
    try {
      // 测试1: 基本JavaScript功能
      setMessage("测试1: JavaScript功能正常");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 测试2: 网络连接
      setMessage("测试2: 检查网络连接...");
      const response = await fetch("https://httpbin.org/get");
      if (response.ok) {
        setMessage("测试2: 网络连接正常");
      } else {
        setMessage("测试2: 网络连接异常");
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 测试3: Supabase环境变量
      setMessage("测试3: 检查环境变量...");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        setMessage(`测试3: 环境变量正常\nURL: ${supabaseUrl.substring(0, 30)}...\nKey: ${supabaseKey.substring(0, 20)}...`);
      } else {
        setMessage("测试3: 环境变量缺失");
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 测试4: 尝试导入Supabase
      setMessage("测试4: 尝试导入Supabase...");
      try {
        const { createClient } = await import("@supabase/supabase-js");
        setMessage("测试4: Supabase导入成功");
      } catch (err: any) {
        setMessage(`测试4: Supabase导入失败: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 测试5: 创建Supabase客户端
      setMessage("测试5: 创建Supabase客户端...");
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          setMessage("测试5: Supabase客户端创建成功");
          
          // 测试6: 尝试连接
          setMessage("测试6: 尝试连接Supabase...");
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              setMessage(`测试6: 连接失败: ${error.message}`);
            } else {
              setMessage("测试6: 连接成功，但无session");
            }
          } catch (err: any) {
            setMessage(`测试6: 连接异常: ${err.message}`);
          }
        } else {
          setMessage("测试5: 无法创建客户端，环境变量缺失");
        }
      } catch (err: any) {
        setMessage(`测试5: 创建客户端失败: ${err.message}`);
      }
      
    } catch (err: any) {
      setMessage(`测试过程中出错: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = () => {
    setMessage("");
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">简单测试页面</h1>
      
      <div className="space-y-4">
        <button
          onClick={testBasic}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? "测试中..." : "开始测试"}
        </button>
        
        <button
          onClick={clearMessage}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          清除消息
        </button>
      </div>
      
      {message && (
        <div className="p-4 bg-gray-100 rounded whitespace-pre-line font-mono text-sm">
          {message}
        </div>
      )}
      
      <div className="text-sm text-gray-600">
        <p>这个页面会逐步测试各个组件，帮助诊断问题。</p>
        <p>请点击"开始测试"按钮，然后观察结果。</p>
      </div>
    </main>
  );
}
