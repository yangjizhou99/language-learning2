'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopNav from '@/components/TopNav';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthGate() {
  const { user, authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // 受保护路由：未登录时跳转登录页（等待全局鉴权完成）
  useEffect(() => {
    if (authLoading) return;
    const protectedPaths = ['/vocab', '/practice'];
    const needsAuth = protectedPaths.some((path) => pathname?.startsWith(path));
    if (needsAuth && !user) {
      router.replace('/auth');
    }
  }, [authLoading, user, pathname, router]);

  // 全局鉴权加载中时不渲染顶部导航，避免闪烁
  if (authLoading) return null;

  // 仅在认证页与管理员区域隐藏 TopNav（管理员区域自带导航）
  const onAuthPage = pathname?.startsWith('/auth');
  const inAdmin = pathname?.startsWith('/admin');
  if (inAdmin) return null;
  if (onAuthPage) {
    return (
      <div className="固定 left-3 top-3 z-50">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 返回首页
        </Link>
      </div>
    );
  }

  return <TopNav />;
}
