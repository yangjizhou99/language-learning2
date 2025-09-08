"use client";
import Link from "next/link";
import AdminQuickAccess from "@/components/AdminQuickAccess";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Home() {
  const t = useTranslation();
  
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <AdminQuickAccess />
      <h1 className="text-3xl font-semibold">Lang Trainer</h1>
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
      </div>
    </main>
  );
}
