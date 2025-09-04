import Link from "next/link";
import AdminQuickAccess from "@/components/AdminQuickAccess";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <AdminQuickAccess />
      <h1 className="text-3xl font-semibold">Lang Trainer</h1>
      <div className="flex gap-3 flex-wrap justify-center">
        <Button asChild>
          <Link href="/practice/cloze">Cloze 练习</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/practice/shadowing">Shadowing</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/practice/alignment">对齐练习</Link>
        </Button>
      </div>
      {/* 示例卡片已移除 */}
    </main>
  );
}
