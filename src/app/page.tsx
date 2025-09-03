import Link from "next/link";
import AdminQuickAccess from "@/components/AdminQuickAccess";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <AdminQuickAccess />
      <h1 className="text-3xl font-semibold">Lang Trainer</h1>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link href="/practice/cloze" className="px-4 py-2 rounded bg-black text-white">Cloze 练习</Link>
        <Link href="/practice/shadowing" className="px-4 py-2 rounded bg-black text-white">Shadowing</Link>
        <Link href="/practice/alignment" className="px-4 py-2 rounded bg-black text-white">对齐练习</Link>
      </div>
    </main>
  );
}
