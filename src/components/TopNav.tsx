"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import useIsAdmin from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TopNav() {
  const [email, setEmail] = useState<string|undefined>();
  const isAdmin = useIsAdmin();

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
      toast.success("已登出");
      window.location.assign("/auth");
    } catch (error) {
      console.error('Logout error:', error);
      toast.error("登出失败，已跳转登录页");
      window.location.assign("/auth");
    }
  };

  return (
    <nav className="w-full border-b bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <Link href="/" className="font-semibold">Lang Trainer</Link>
        <div className="flex items-center gap-3">
          <Link href="/practice/cloze">Cloze</Link>
          {/* SFT 已移除 */}
          <Link href="/practice/alignment">对齐练习</Link>
          <Link href="/practice/wideread" prefetch={false}>广读</Link>
          {/* 短语库已移除 */}
          <Link href="/practice/shadowing" prefetch={false}>Shadowing</Link>
          <Link href="/vocab">生词本</Link>
          {/* 复盘已移除 */}
          {/* 术语库已移除 */}
          {/* 我的资料已移除 */}
          {isAdmin && <Link href="/admin" className="text-orange-600">🛠️ 管理员</Link>}
          <span className="mx-2 text-gray-400">|</span>
          <ThemeToggle />
          {!email ? (
            <Button asChild>
              <Link href="/auth">登录 / 注册</Link>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full border p-0.5">
                  <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`} />
                    <AvatarFallback>{email.substring(0,1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">已登录</span>
                    <span className="text-xs text-muted-foreground break-all">{email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">进入后台</Link>
                  </DropdownMenuItem>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>登出</DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>确认登出</DialogTitle>
                      <DialogDescription>你将退出当前账号，是否继续？</DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex justify-end gap-2">
                      <DialogClose asChild>
                        <Button variant="ghost">取消</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button variant="destructive" onClick={signOut}>确定登出</Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
}
