import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/Container";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-semibold">页面未找到</h2>
          <p className="text-muted-foreground max-w-md">
            抱歉，您访问的页面不存在或已被移动。请检查 URL 是否正确，或返回首页继续浏览。
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link href="/">
              返回首页
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/practice">
              开始练习
            </Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
