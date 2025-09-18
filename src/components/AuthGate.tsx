'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { applyDefaultPermissionsToUser } from '@/lib/defaultPermissions';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopNav from '@/components/TopNav';
import type { User } from '@supabase/supabase-js';

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
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user || null);
          setChecking(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          setUser(null);
          setChecking(false);
        }
      }
    };

    checkSession();

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setUser(session?.user || null);

      // 只在登录/登出时处理路由跳转
      if (event === 'SIGNED_IN' && session?.user) {
        // 用户登录后，确保profile存在
        supabase.from('profiles').upsert({ id: session.user.id }, { onConflict: 'id' });

        // 为新用户应用默认权限
        try {
          await applyDefaultPermissionsToUser(session.user.id);
        } catch (error) {
          console.error('应用默认权限失败:', error);
          // 不阻止登录流程，只记录错误
        }

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
  }, [pathname, router]);

  // 等待检查完成
  if (checking) return null;

  // 定义需要认证的页面
  const protectedPaths = ['/vocab', '/practice'];
  const needsAuth = protectedPaths.some((path) => pathname?.startsWith(path));

  // 如果页面需要认证但用户未登录，重定向到登录页
  if (needsAuth && !user) {
    router.replace('/auth');
    return null;
  }

  // 仅在认证页与管理员区域隐藏 TopNav（管理员区域自带导航）
  const onAuthPage = pathname?.startsWith('/auth');
  const inAdmin = pathname?.startsWith('/admin');
  if (inAdmin) return null;
  if (onAuthPage) {
    return (
      <div className="fixed left-3 top-3 z-50">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 返回首页
        </Link>
      </div>
    );
  }

  return <TopNav />;
}
