"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthDebugPage() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [cookies, setCookies] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    checkAuth();
    checkCookies();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setError(error.message);
      } else {
        setSession(session);
        setUser(session?.user || null);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const checkCookies = () => {
    const allCookies = document.cookie.split(';');
    setCookies(allCookies);
  };

  const signIn = async () => {
    const email = prompt("请输入邮箱:");
    const password = prompt("请输入密码:");
    
    if (email && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) {
          alert(`登录失败: ${error.message}`);
        } else {
          alert("登录成功!");
          checkAuth();
          checkCookies();
        }
      } catch (err: any) {
        alert(`登录错误: ${err.message}`);
      }
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      checkCookies();
      alert("已登出");
    } catch (err: any) {
      alert(`登出错误: ${err.message}`);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">认证调试页面</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 认证状态 */}
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <h2 className="font-medium">认证状态</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Session:</strong> {session ? "✅ 存在" : "❌ 不存在"}</div>
            <div><strong>User:</strong> {user ? "✅ 存在" : "❌ 不存在"}</div>
            {user && (
              <>
                <div><strong>ID:</strong> {user.id}</div>
                <div><strong>Email:</strong> {user.email}</div>
              </>
            )}
            {error && <div className="text-red-600"><strong>Error:</strong> {error}</div>}
          </div>
          <div className="flex gap-2">
            <button onClick={signIn} className="px-3 py-1 rounded border">测试登录</button>
            <button onClick={signOut} className="px-3 py-1 rounded border">登出</button>
            <button onClick={checkAuth} className="px-3 py-1 rounded border">刷新状态</button>
          </div>
        </section>

        {/* Cookie信息 */}
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
          <h2 className="font-medium">Cookie信息</h2>
          <div className="space-y-2 text-sm">
            <div><strong>总数:</strong> {cookies.length}</div>
            <div className="max-h-40 overflow-y-auto">
              {cookies.map((cookie, index) => (
                <div key={index} className="text-xs break-all">
                  {cookie.trim()}
                </div>
              ))}
            </div>
          </div>
          <button onClick={checkCookies} className="px-3 py-1 rounded border">刷新Cookie</button>
        </section>
      </div>

      {/* 调试信息 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">调试信息</h2>
        <div className="space-y-2 text-sm">
          <div><strong>当前URL:</strong> {typeof window !== "undefined" ? window.location.href : "N/A"}</div>
          <div><strong>User Agent:</strong> {typeof window !== "undefined" ? window.navigator.userAgent : "N/A"}</div>
          <div><strong>Cookie Enabled:</strong> {typeof window !== "undefined" ? window.navigator.cookieEnabled : "N/A"}</div>
        </div>
      </section>

      {/* 操作指南 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">操作指南</h2>
        <div className="space-y-2 text-sm">
          <div>1. 点击"测试登录"按钮，输入你的邮箱和密码</div>
          <div>2. 观察认证状态和Cookie信息的变化</div>
          <div>3. 如果登录成功但Cookie仍然为空，可能是浏览器设置问题</div>
          <div>4. 尝试使用Google登录（如果可用）</div>
        </div>
      </section>
    </main>
  );
}
