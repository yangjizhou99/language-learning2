"use client";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS, AdminNavItem } from "@/config/adminNav";
import { Container } from "@/components/Container";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null);
  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setLoading(false); return; }
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
    })();
  }, []);

  const isAdmin = profile?.role === "admin";
  const isSetupPage = pathname === "/admin/setup";

  const isActive = (item: AdminNavItem) => {
    if (!pathname) return false;
    if (item.match === "exact") return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const flatNav = useMemo(
    () => ADMIN_SECTIONS.flatMap(s => s.items.filter(i => !i.hidden)),
    []
  );

  const breadcrumb = useMemo(() => {
    if (!pathname) return [];
    const segments = pathname.split("/").filter(Boolean);
    const nodes: { href: string; label: string }[] = [];
    let acc = "";
    segments.forEach(seg => {
      acc += `/${seg}`;
      const match = flatNav
        .filter(i => acc.startsWith(i.href))
        .sort((a, b) => b.href.length - a.href.length)[0];
      if (match && !nodes.find(n => n.href === match.href)) {
        nodes.push({ href: match.href, label: match.label });
      }
    });
    if (!nodes.find(n => n.href === "/admin")) {
      nodes.unshift({ href: "/admin", label: "控制台" });
    }
    return nodes;
  }, [pathname, flatNav]);

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
        <div className="text-center text-red-600">请先登录才能访问管理员页面</div>
      </div>
    );
  }

  if (!isAdmin && !isSetupPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">需要管理员权限</h1>
          <p className="text-gray-600 mb-4">您当前没有管理员权限</p>
          <Link href="/admin/setup" className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            设置管理员权限
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="bg-background border-b">
        <Container>
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link href="/admin" className="text-xl font-semibold">
                🛠️ 管理员控制台
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button asChild variant="outline" size="sm"><Link href="/">返回首页</Link></Button>
            </div>
          </div>
        </Container>
      </nav>

      <Container>
        <div className="py-6 flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <nav className="rounded-lg border p-4 bg-card text-card-foreground">
              {ADMIN_SECTIONS.filter(section => section.items.some(i => !i.hidden)).map((section, si) => {
                const items = section.items.filter(i => !i.hidden);
                return (
                  <div key={`admin-section-${section.title}-${si}`} className="mb-4">
                    <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground">{section.title}</div>
                    <ul className="space-y-2">
                      {items.map((item, ii) => (
                        <li key={`admin-nav-item-${item.href}-${ii}`}>
                          <Link
                            href={item.href}
                            prefetch={false}
                            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                              isActive(item)
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            {item.icon && <span className="mr-3">{item.icon}</span>}
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1">
            <Breadcrumbs items={breadcrumb} />
            {children}
          </main>
        </div>
      </Container>
    </div>
  );
}
