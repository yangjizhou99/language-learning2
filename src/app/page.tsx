import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Lang Trainer</h1>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link href="/practice/cloze" className="px-4 py-2 rounded bg-black text-white">Cloze 练习</Link>
        <Link href="/practice/sft" className="px-4 py-2 rounded bg-black text-white">SFT & RLHF</Link>
        <Link href="/phrase-bank" className="px-4 py-2 rounded bg-black text-white">短语库</Link>
        <Link href="/new-page" className="px-4 py-2 rounded bg-black text-white">新页面</Link>
      </div>
    </main>
  );
}
