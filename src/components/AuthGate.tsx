"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";

export default function AuthGate() {
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const publicRoutes = ["/auth", "/auth/callback"];
    const isPublic = publicRoutes.some(p => pathname?.startsWith(p));

    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const user = s?.session?.user;
      if (!user) {
        if (!isPublic) router.replace("/auth");
      } else {
        await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });
        if (isPublic) router.replace("/");
      }
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, sess) => {
      const user = sess?.user;
      const isPublicNow = publicRoutes.some(p => pathname?.startsWith(p));
      if (!user) {
        if (!isPublicNow) router.replace("/auth");
      } else {
        await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });
        if (isPublicNow) router.replace("/");
      }
    });

    return () => { sub.subscription.unsubscribe(); };
  }, [pathname, router]);

  if (checking) return null;
  
  const publicRoutes = ["/auth", "/auth/callback"];
  const isPublic = publicRoutes.some(p => pathname?.startsWith(p));
  
  if (isPublic) return null;
  return <TopNav />;
}
