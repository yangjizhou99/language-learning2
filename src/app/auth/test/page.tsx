"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthTestPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    if (!email || !password) {
      setMessage("请输入邮箱和密码");
      return;
    }

    setLoading(true);
    setMessage("正在登录...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setMessage(`❌ 登录失败: ${error.message}`);
        console.error("Login error:", error);
      } else {
        setMessage(`✅ 登录成功! 用户ID: ${data.user?.id}`);
        console.log("Login success:", data);
        
        // 检查session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("Session data:", sessionData);
        
        // 检查cookies
        const cookies = document.cookie.split(';');
        console.log("All cookies:", cookies);
        
        setMessage(`✅ 登录成功! 用户ID: ${data.user?.id}\nSession: ${sessionData.session ? '存在' : '不存在'}\nCookies: ${cookies.length}个`);
      }
    } catch (err: any) {
      setMessage(`❌ 登录错误: ${err.message}`);
      console.error("Login exception:", err);
    } finally {
      setLoading(false);
    }
  };

  const testSignUp = async () => {
    if (!email || !password) {
      setMessage("请输入邮箱和密码");
      return;
    }

    setLoading(true);
    setMessage("正在注册...");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        setMessage(`❌ 注册失败: ${error.message}`);
        console.error("Signup error:", error);
      } else {
        setMessage(`✅ 注册成功! 用户ID: ${data.user?.id}`);
        console.log("Signup success:", data);
      }
    } catch (err: any) {
      setMessage(`❌ 注册错误: ${err.message}`);
      console.error("Signup exception:", err);
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setMessage(`❌ 检查session失败: ${error.message}`);
      } else {
        setMessage(`Session状态: ${session ? '存在' : '不存在'}\n用户: ${session?.user?.email || '无'}`);
      }
    } catch (err: any) {
      setMessage(`❌ 检查session错误: ${err.message}`);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setMessage("✅ 已登出");
    } catch (err: any) {
      setMessage(`❌ 登出错误: ${err.message}`);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">认证测试页面</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">邮箱:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="your@email.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">密码:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="密码（至少6位）"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={testLogin}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {loading ? "登录中..." : "测试登录"}
          </button>
          
          <button
            onClick={testSignUp}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            {loading ? "注册中..." : "测试注册"}
          </button>
          
          <button
            onClick={checkSession}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            检查Session
          </button>
          
          <button
            onClick={signOut}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            登出
          </button>
        </div>
      </div>
      
      {message && (
        <div className="p-4 bg-gray-100 rounded whitespace-pre-line">
          {message}
        </div>
      )}
      
      <div className="text-sm text-gray-600">
        <p>请先尝试注册，然后登录。</p>
        <p>如果仍然失败，请检查浏览器控制台的错误信息。</p>
      </div>
    </main>
  );
}
