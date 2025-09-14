"use client";
import Link from "next/link";
import AdminQuickAccess from "@/components/AdminQuickAccess";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const t = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // 获取用户资料
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, bio, goals, native_lang, target_langs, domains')
          .eq('id', user.id)
          .single();
        setProfile(profileData);
      }
    };
    checkUser();
  }, []);

  const isProfileComplete = profile && (
    profile.username || 
    profile.bio || 
    profile.goals || 
    profile.native_lang || 
    (profile.target_langs && profile.target_langs.length > 0) ||
    (profile.domains && profile.domains.length > 0)
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <AdminQuickAccess />
      <h1 className="text-3xl font-semibold">Lang Trainer</h1>
      
      {/* 个人资料提示 */}
      {user && !isProfileComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md text-center">
          <p className="text-blue-800 text-sm mb-2">👋 欢迎使用 Lang Trainer！</p>
          <p className="text-blue-600 text-xs mb-3">完善您的个人资料，获得更好的学习体验</p>
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Link href="/profile">完善个人资料</Link>
          </Button>
        </div>
      )}
      
      <div className="flex gap-3 flex-wrap justify-center">
        <Button asChild>
          <Link href="/practice/cloze">{t.nav.cloze}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/practice/shadowing">{t.nav.shadowing}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/practice/alignment">{t.nav.alignment_practice}</Link>
        </Button>
        {user && (
          <Button asChild variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
            <Link href="/profile">👤 个人资料</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
