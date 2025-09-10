"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import useIsAdmin from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useTranslation } from "@/contexts/LanguageContext";
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
  const t = useTranslation();

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
      toast.success(t.common.success);
      window.location.assign("/auth");
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(`${t.common.error}: ${t.common.logout}`);
      window.location.assign("/auth");
    }
  };

  return (
    <nav className="w-full border-b bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <Link href="/" className="font-semibold">Lang Trainer</Link>
        <div className="flex items-center gap-3">
          <Link key="cloze" href="/practice/cloze">{t.nav.cloze}</Link>
          <Link key="alignment" href="/practice/alignment">{t.nav.alignment_practice}</Link>
          <Link key="wideread" href="/practice/wideread" prefetch={false}>{t.nav.wide_reading}</Link>
          <Link key="shadowing" href="/practice/shadowing" prefetch={false}>{t.nav.shadowing}</Link>
          <Link key="vocab" href="/vocab">{t.nav.vocabulary}</Link>
          {isAdmin && <Link key="admin" href="/admin" className="text-orange-600">🛠️ {t.nav.admin}</Link>}
          <span className="mx-2 text-gray-400">|</span>
          <LanguageToggle />
          <ThemeToggle />
          {!email ? (
            <Button asChild>
              <Link href="/auth">{t.common.login} / {t.common.register}</Link>
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
                    <span className="text-sm font-medium">{t.common.logged_in}</span>
                    <span className="text-xs text-muted-foreground break-all">{email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">{t.common.enter_admin}</Link>
                  </DropdownMenuItem>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>{t.common.logout}</DropdownMenuItem>
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
                        <Button variant="destructive" onClick={signOut}>{t.common.confirm} {t.common.logout}</Button>
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
