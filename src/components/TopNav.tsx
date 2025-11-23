'use client';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { applyDefaultPermissionsToUser } from '@/lib/defaultPermissions';
import useIsAdmin from '@/hooks/useIsAdmin';
import useUserPermissions from '@/hooks/useUserPermissions';
import { Button } from '@/components/ui/button';
import LanguageToggle from '@/components/LanguageToggle';
import { useTranslation } from '@/contexts/LanguageContext';
import { useMobile } from '@/contexts/MobileContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { isProfileCompleteStrict } from '@/utils/profile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import MobileToggle from '@/components/MobileToggle';
import {
  Menu,
  X,
  BookOpen,
  Target,
  AlignCenter,
  FileText,
  GraduationCap,
  User,
  Settings,
  LogOut,
  Home,
} from 'lucide-react';

export default function TopNav() {
  const [email, setEmail] = useState<string | undefined>();
  const [profileIncomplete, setProfileIncomplete] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const isAdmin = useIsAdmin();
  const { permissions } = useUserPermissions();
  const {} = useMobile();
  const t = useTranslation();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) console.error('Session error:', error);
      setEmail(session?.user?.email || undefined);

      // 获取资料并计算完整度（实时计算）
      try {
        const userId = session?.user?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, bio, goals, preferred_tone, native_lang, target_langs, domains')
            .eq('id', userId)
            .single();
          setProfileIncomplete(!isProfileCompleteStrict(profile as any));
        } else {
          setProfileIncomplete(false);
        }
      } catch {
        setProfileIncomplete(false);
      }
    };

    // Initial check
    checkSession();

    // Handle auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      setEmail(session?.user?.email || undefined);

      // For OAuth logins, explicitly refresh session
      if (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider) {
        await checkSession();
      }

      // Ensure profiles exists（避免 upsert 依赖主键时失败）
      if (session?.user?.id) {
        const { data: existing, error: selErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single();
        if (selErr && (selErr as any).code === 'PGRST116') {
          await supabase.from('profiles').insert({ id: session.user.id });
        }

        // 为新用户应用默认权限
        try {
          await applyDefaultPermissionsToUser(session.user.id);
        } catch (error) {
          console.error('应用默认权限失败:', error);
          // 不阻止登录流程，只记录错误
        }
      }

      // 会话变化时同步资料完整度状态
      try {
        const userId = session?.user?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, bio, goals, preferred_tone, native_lang, target_langs, domains')
            .eq('id', userId)
            .single();
          setProfileIncomplete(!isProfileCompleteStrict(profile as any));
        } else {
          setProfileIncomplete(false);
        }
      } catch {
        setProfileIncomplete(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 点击外部关闭移动端菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const signOut = async () => {
    try {
      setEmail(undefined);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success(t.common.success);
      window.location.assign('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(`${t.common.error}: ${t.common.logout}`);
      window.location.assign('/auth');
    }
  };

  // 导航菜单项
  const navItems = [
    { href: '/', label: t.nav.home, icon: Home, show: true },
    {
      href: '/practice/shadowing',
      label: t.nav.shadowing,
      icon: GraduationCap,
      show: permissions.can_access_shadowing,
    },
    {
      href: '/practice/cloze-shadowing',
      label: 'Cloze-Shadowing',
      icon: Target,
      show: permissions.can_access_cloze,
    },
    {
      href: '/practice/alignment',
      label: t.nav.alignment_practice,
      icon: AlignCenter,
      show: permissions.can_access_alignment,
    },
    { href: '/vocab', label: t.nav.vocabulary, icon: BookOpen, show: true },
  ];

  // 用户菜单项
  const userMenuItems = [
    { href: '/profile', label: '个人资料', icon: User, show: !!email },
    { href: '/admin', label: t.nav.admin, icon: Settings, show: isAdmin },
  ];

  return (
    <nav className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-sm">LT</span>
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Lang Trainer
              </span>
            </Link>
          </div>

          {/* 桌面端导航 */}
          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map(
              (item) =>
                item.show && (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                ),
            )}
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center space-x-2">
            {/* 语言切换 */}
            <div className="hidden sm:block">
              <LanguageToggle />
            </div>

            {/* 主题切换 */}
            <div className="hidden sm:block">
              {/* Theme toggle removed; always use light mode */}
            </div>

            {/* 移动端切换 */}
            <div className="hidden sm:block">
              <MobileToggle />
            </div>

            {/* 用户区域 */}
            {!email ? (
              <Button asChild className="hidden sm:flex">
                <Link href="/auth">
                  {t.common.login} / {t.common.register}
                </Link>
              </Button>
            ) : (
              <div className="flex items-center space-x-2">
                {/* 桌面端用户菜单 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative rounded-full border-2 border-gray-200 hover:border-blue-300 transition-colors p-0.5">
                      <Avatar className="w-8 h-8">
                        <AvatarImage
                          src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`}
                        />
                        <AvatarFallback className="text-xs font-medium">
                          {email.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {profileIncomplete && (
                        <span className="absolute -top-0.5 -right-0.5 inline-flex h-3 w-3 rounded-full bg-orange-500 ring-2 ring-white animate-pulse" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{t.common.logged_in}</span>
                        <span className="text-xs text-muted-foreground break-all">{email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {userMenuItems.map(
                      (item) =>
                        item.show && (
                          <DropdownMenuItem asChild key={item.href}>
                            <Link href={item.href} className="flex items-center space-x-2">
                              <item.icon className="w-4 h-4" />
                              <span>{item.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        ),
                    )}
                    <DropdownMenuSeparator />
                    <Dialog>
                      <DialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-red-600"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          {t.common.logout}
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t.common.confirm_logout}</DialogTitle>
                          <DialogDescription>{t.common.confirm_logout_desc}</DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 flex justify-end gap-2">
                          <DialogClose asChild>
                            <Button variant="ghost">{t.common.cancel}</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button variant="destructive" onClick={signOut}>
                              {t.common.confirm} {t.common.logout}
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 移动端菜单按钮 */}
                <div className="lg:hidden" ref={mobileMenuRef}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className={`relative ${isMobileMenuOpen ? 'bg-blue-50 text-blue-600' : ''}`}
                  >
                    <Menu className="w-5 h-5" />
                  </Button>

                  {/* 移动端下拉菜单 */}
                  {isMobileMenuOpen && (
                    <>
                      {/* 背景遮罩 */}
                      <div
                        className="fixed inset-0 bg-black/20 z-40 lg:hidden animate-in fade-in duration-200"
                        onClick={() => setIsMobileMenuOpen(false)}
                      />
                      <div className="absolute top-16 right-0 sm:right-4 w-72 sm:w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-[calc(100vh-5rem)] flex flex-col animate-in slide-in-from-top-2 duration-200">
                        {/* 菜单头部 */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                          <h2 className="text-lg font-semibold text-gray-800">菜单</h2>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="h-8 w-8"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        {/* 可滚动内容区域 */}
                        <div className="flex-1 overflow-y-auto p-4">
                          {/* 用户信息 */}
                          {email && (
                            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg mb-4">
                              <Avatar className="w-10 h-10">
                                <AvatarImage
                                  src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`}
                                />
                                <AvatarFallback className="font-medium">
                                  {email.substring(0, 1).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {email}
                                </p>
                                <p className="text-xs text-gray-500">{t.common.logged_in}</p>
                              </div>
                            </div>
                          )}

                          {/* 导航菜单 */}
                          <div className="space-y-1 mb-4">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                              导航
                            </h3>
                            {navItems.map(
                              (item) =>
                                item.show && (
                                  <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  >
                                    <item.icon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                  </Link>
                                ),
                            )}
                          </div>

                          {/* 用户菜单 */}
                          {email && (
                            <div className="space-y-1 mb-4">
                              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                                账户
                              </h3>
                              {userMenuItems.map(
                                (item) =>
                                  item.show && (
                                    <Link
                                      key={item.href}
                                      href={item.href}
                                      onClick={() => setIsMobileMenuOpen(false)}
                                      className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                      <item.icon className="w-5 h-5" />
                                      <span>{item.label}</span>
                                    </Link>
                                  ),
                              )}
                            </div>
                          )}

                          {/* 设置区域 */}
                          <div className="space-y-1 mb-4">
                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                              设置
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">语言</span>
                                <LanguageToggle />
                              </div>
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">设备模式</span>
                                <MobileToggle />
                              </div>
                            </div>
                          </div>

                          {/* 登录/登出按钮 */}
                          <div className="pt-4 border-t">
                            {!email ? (
                              <Button asChild className="w-full">
                                <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                                  {t.common.login} / {t.common.register}
                                </Link>
                              </Button>
                            ) : (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="destructive" className="w-full">
                                    <LogOut className="w-4 h-4 mr-2" />
                                    {t.common.logout}
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>{t.common.confirm_logout}</DialogTitle>
                                    <DialogDescription>
                                      {t.common.confirm_logout_desc}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="mt-4 flex justify-end gap-2">
                                    <DialogClose asChild>
                                      <Button variant="ghost">{t.common.cancel}</Button>
                                    </DialogClose>
                                    <DialogClose asChild>
                                      <Button variant="destructive" onClick={signOut}>
                                        {t.common.confirm} {t.common.logout}
                                      </Button>
                                    </DialogClose>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
