"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
// import { useRouter } from "next/navigation";

export default function TopNav() {
  const [email, setEmail] = useState<string|undefined>();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) console.error('Session error:', error);
      setEmail(session?.user?.email || undefined);
    };

    // Initial check
    checkSession();

    // Handle auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      setEmail(session?.user?.email || undefined);
      
      // For OAuth logins, explicitly refresh session
      if (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider) {
        await checkSession();
      }

      // Ensure profiles exists
      if (session?.user?.id) {
        await supabase.from("profiles").upsert({ id: session.user.id }, { onConflict: "id" });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // const router = useRouter();
  const signOut = async () => {
    try {
      setEmail(undefined);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.assign("/auth");
    } catch (error) {
      console.error('Logout error:', error);
      window.location.assign("/auth");
    }
  };

  return (
    <nav className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <Link href="/" className="font-semibold">Lang Trainer</Link>
        <div className="flex items-center gap-3">
          <Link href="/practice/cloze">Cloze</Link>
          <Link href="/practice/sft">SFT</Link>
          <Link href="/practice/wideread" prefetch={false}>广读</Link>
          <Link href="/phrase-bank">短语库</Link>
          <Link href="/practice/shadowing" prefetch={false}>Shadowing</Link>
          <Link href="/review">复盘</Link>
          <Link href="/glossary">术语库</Link>
          <Link href="/settings/profile">我的资料</Link>
          <Link href="/admin/drafts" prefetch={false}>草稿箱</Link>
          <Link href="/admin/setup" className="text-orange-600">🔧 管理员</Link>
          <span className="mx-2 text-gray-400">|</span>
          {!email ? (
            <Link href="/auth" className="px-3 py-1 rounded bg-black text-white">登录 / 注册</Link>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{email}</span>
              <button onClick={signOut} className="px-3 py-1 rounded border">登出</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
