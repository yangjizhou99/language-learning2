"use client";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null);
  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      
      setUser(session.user);
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      
      setProfile(profileData);
    } catch (error) {
      console.error("检查管理员状态失败:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          请先登录才能访问管理员页面
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";
  const isSetupPage = pathname === "/admin/setup";

  // 如果不是管理员且不是设置页面，显示权限提示
  if (!isAdmin && !isSetupPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">需要管理员权限</h1>
          <p className="text-gray-600 mb-4">您当前没有管理员权限</p>
          <Link 
            href="/admin/setup" 
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            设置管理员权限
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "控制台", icon: "🏠" },
    { href: "/admin/articles", label: "题库管理", icon: "📝" },
    { href: "/admin/drafts", label: "草稿箱", icon: "📋" },
    { href: "/admin/drafts/batch", label: "批量生成", icon: "⚡" },
    { href: "/admin/alignment/ai", label: "对齐练习", icon: "🤝" },
    { href: "/admin/shadowing/ai", label: "跟读练习", icon: "👂" },
    { href: "/admin/drafts/simple", label: "草稿箱（简）", icon: "🧪" },
    { href: "/admin/drafts/test-fix", label: "草稿诊断", icon: "🔧" },
    { href: "/admin/setup", label: "系统设置", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/admin" className="text-xl font-semibold text-gray-900">
                🛠️ 管理员控制台
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Link 
                href="/" 
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* 侧边栏 */}
          <div className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        pathname === item.href
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <span className="mr-3">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* 主内容区 */}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
