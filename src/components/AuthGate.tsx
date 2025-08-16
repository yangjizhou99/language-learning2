"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthGate() {
  const [status, setStatus] = useState<"checking"|"ok"|"error">("checking");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setStatus("error"); setMsg("未配置 Supabase：请在 .env.local 填写 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
        return;
      }
      // 已有会话？
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        // 匿名登录（需在后台开启 Allow anonymous sign-ins）
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          setStatus("error");
          setMsg("匿名登录失败：请在 Supabase 控制台开启 Allow anonymous sign-ins");
          return;
        }
      }
      // 准备 profiles
      const { data: uRes } = await supabase.auth.getUser();
      const uid = uRes?.user?.id;
      if (uid) {
        await supabase.from("profiles").upsert({ id: uid }, { onConflict: "id" });
        setStatus("ok");
      } else {
        setStatus("error"); setMsg("无法获取用户信息");
      }
    })();
  }, []);

  if (status === "checking") return null;
  if (status === "error") return <div className="text-red-600 text-sm p-2">{msg}</div>;
  return null;
}
