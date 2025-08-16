"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback`;

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [isAnon, setIsAnon] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const anon = (u?.user as any)?.is_anonymous === true;
      setIsAnon(!!anon);
    })();
  }, []);

  const signUp = async () => {
    setMsg("");
    const { data, error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: redirectTo }
    });
    setMsg(error ? `注册失败：${error.message}` : "注册成功，请到邮箱完成验证（若开启了 Confirm Email）。");
  };

  const signIn = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setMsg(error ? `登录失败：${error.message}` : "登录成功！");
  };

  const magicLink = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setMsg(error ? `发送失败：${error.message}` : "魔法链接已发送到邮箱，请查收。");
  };

  const oauth = async (provider: "google" | "github") => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });
    if (error) setMsg(`OAuth 启动失败：${error.message}`);
  };

  // ✨ 升级匿名账号为正式账号（保留同一个 user_id，不丢数据）
  const upgradeAnon = async () => {
    setMsg("");
    const { data: u } = await supabase.auth.getUser();
    const anon = (u?.user as any)?.is_anonymous === true;
    if (!anon) { setMsg("当前并非匿名会话，无需升级。"); return; }
    const { error } = await supabase.auth.updateUser({ email, password: pw });
    setMsg(error ? `升级失败：${error.message}` : "升级成功！请收邮箱验证邮件（如启用），完成后本账号将成为正式账号。");
  };

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">登录 / 注册</h1>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">邮箱 + 密码</h2>
        <input className="border rounded px-2 py-1 w-full" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-2 py-1 w-full" type="password" placeholder="密码（≥6位）" value={pw} onChange={e=>setPw(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={signIn} className="px-3 py-1 rounded border">登录</button>
          <button onClick={signUp} className="px-3 py-1 rounded bg-black text-white">注册</button>
        </div>
      </section>

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">魔法链接（免密码）</h2>
        <input className="border rounded px-2 py-1 w-full" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <button onClick={magicLink} className="px-3 py-1 rounded bg-black text-white">发送魔法链接</button>
        <div className="text-xs text-gray-500">回调地址：{redirectTo}</div>
      </section>

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">OAuth 登录</h2>
        <div className="flex gap-2">
          <button onClick={()=>oauth("google")} className="px-3 py-1 rounded border">用 Google 登录</button>
          <button onClick={()=>oauth("github")} className="px-3 py-1 rounded border">用 GitHub 登录</button>
        </div>
      </section>

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">将匿名账号升级为正式账号</h2>
        <div className="text-sm text-gray-600">当前：{isAnon ? "匿名会话（可升级）" : "已是正式账号或未登录"}</div>
        <input className="border rounded px-2 py-1 w-full" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-2 py-1 w-full" type="password" placeholder="设置一个新密码" value={pw} onChange={e=>setPw(e.target.value)} />
        <button onClick={upgradeAnon} className="px-3 py-1 rounded bg-emerald-600 text-white">升级我的匿名账号</button>
        <div className="text-xs text-gray-500">说明：升级走的是 <code>updateUser</code> 流程，保留同一个 <code>user_id</code>，你之前的 sessions/phrases/glossary 不会丢失。</div>
      </section>
    </main>
  );
}
