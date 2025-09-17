"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { applyDefaultPermissionsToUser } from "@/lib/defaultPermissions";
import Link from "next/link";

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("正在处理登录…");
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) setMsg(`登录失败：${error.message}`);
      else {
        // 确保 profiles 行
        const { data: u } = await supabase.auth.getUser();
        if (u?.user?.id) {
          await supabase.from("profiles").upsert({ id: u.user.id }, { onConflict: "id" });
          
          // 为新用户应用默认权限
          try {
            await applyDefaultPermissionsToUser(u.user.id);
          } catch (error) {
            console.error('应用默认权限失败:', error);
            // 不阻止登录流程，只记录错误
          }
        }
        setMsg("登录成功！");
      }
    })();
  }, []);
  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Auth Callback</h1>
      <p className="mb-4">{msg}</p>
      <Link href="/" className="px-3 py-1 rounded bg-black text-white">返回首页</Link>
    </main>
  );
}
