import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Lang Trainer</h1>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link href="/practice/cloze" className="px-4 py-2 rounded bg-black text-white">Cloze 练习</Link>
        <Link href="/practice/sft" className="px-4 py-2 rounded bg-black text-white">SFT & RLHF</Link>
        <Link href="/phrase-bank" className="px-4 py-2 rounded bg-black text-white">短语库</Link>
        <Link href="/practice/shadowing" className="px-4 py-2 rounded bg-black text-white">Shadowing</Link>
        <Link href="/review" className="px-4 py-2 rounded bg-black text-white">周复盘</Link>
        <Link href="/settings/profile" className="px-4 py-2 rounded bg-black text-white">个人资料</Link>
        <Link href="/glossary" className="px-4 py-2 rounded bg-black text-white">术语库</Link>
      </div>
    </main>
  );
}
