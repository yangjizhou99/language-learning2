"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/contexts/LanguageContext";

export default function AuthPage() {
  const router = useRouter();
  const t = useTranslation();
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
    setMsg(error ? `${t.auth.signup_failed}：${error.message}` :
      t.auth.signup_success_email);
  };

  const signIn = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setMsg(`${t.auth.login_failed}：${error.message}`);
    else router.replace("/");
  };

  const signInWithGoogle = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) setMsg(`${t.auth.google_login_failed}：${error.message}`);
  };

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t.auth.login_title}</h1>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}

      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">{t.auth.email_password}</h2>
        <input className="border rounded px-2 py-1 w-full"
               placeholder="email@example.com" value={email}
               onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-2 py-1 w-full" type="password"
               placeholder={t.form.password_min} value={pw}
               onChange={e=>setPw(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={signIn} className="px-3 py-1 rounded border">{t.common.login}</button>
          <button onClick={signUp} className="px-3 py-1 rounded bg-black text-white">{t.common.register}</button>
        </div>
      </section>

      {/* Temporarily disabled Google login */}
      {/* <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">{t.auth.google_login}</h2>
        <button onClick={signInWithGoogle}
                className="px-3 py-1 rounded border">{t.auth.use_google_login}</button>
      </section> */}
    </main>
  );
}
