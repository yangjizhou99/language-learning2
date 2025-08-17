"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback`;

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (s?.session?.user) router.replace("/");
    })();
  }, [router]);

  const signUp = async () => {
    setMsg("");
    const { error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: redirectTo }
    });
    setMsg(error ? `注册失败：${error.message}` :
      "注册成功。如启用邮箱验证，请前往邮箱完成确认。");
  };

  const signIn = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setMsg(`登录失败：${error.message}`);
    else router.replace("/");
  };

  const signInWithGoogle = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) setMsg(`Google 登录启动失败：${error.message}`);
  };

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">登录到 Lang Trainer</h1>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">邮箱 + 密码</h2>
        <input className="border rounded px-2 py-1 w-full"
               placeholder="email@example.com" value={email}
               onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-2 py-1 w-full" type="password"
               placeholder="密码（≥6位）" value={pw}
               onChange={e=>setPw(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={signIn} className="px-3 py-1 rounded border">登录</button>
          <button onClick={signUp} className="px-3 py-1 rounded bg-black text-white">注册</button>
        </div>
      </section>

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">使用 Google 登录</h2>
        <button onClick={signInWithGoogle}
                className="px-3 py-1 rounded border">用 Google 登录</button>
      </section>
    </main>
  );
}
