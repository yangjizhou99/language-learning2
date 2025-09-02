"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { User } from "@supabase/supabase-js";

export default function AuthGate() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // 检查初始会话
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user || null);
          setChecking(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          setChecking(false);
        }
      }
    };

    checkSession();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      setUser(session?.user || null);
      
      // 只在登录/登出时处理路由跳转
      if (event === 'SIGNED_IN' && session?.user) {
        // 用户登录后，确保profile存在
        supabase.from("profiles").upsert({ id: session.user.id }, { onConflict: "id" });
        
        // 如果当前在登录页，跳转到首页
        if (pathname === '/auth') {
          router.replace('/');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // 不依赖 pathname 和 router

  // 等待检查完成
  if (checking) return null;

  // 定义公开路由
  const publicRoutes = ["/auth", "/auth/callback", "/practice"];
  const isPublic = publicRoutes.some(p => pathname?.startsWith(p));

  // 在认证页面隐藏TopNav
  if (isPublic && pathname !== "/") return null;
  
  return <TopNav />;
} 
