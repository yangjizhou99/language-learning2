import Link from "next/link";
import AdminQuickAccess from "@/components/AdminQuickAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
      <Card className="max-w-md w-full mt-6">
        <CardHeader>
          <CardTitle>Shadcn + Radix 组件示例</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="试试输入..." />
          <div className="flex gap-2">
            <Button>主按钮</Button>
            <Button variant="secondary">次按钮</Button>
            <Button variant="ghost">幽灵</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
