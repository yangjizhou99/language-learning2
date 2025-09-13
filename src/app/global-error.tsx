"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/Container";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到控制台
    console.error("全局错误:", error);
  }, [error]);

  return (
    <html>
      <body>
        <Container className="flex flex-col items-center justify-center min-h-screen text-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-red-600">出现错误</h1>
              <h2 className="text-xl font-semibold">应用程序遇到了意外错误</h2>
              <p className="text-muted-foreground max-w-md">
                抱歉，应用程序遇到了意外错误。请尝试重新加载页面或联系管理员。
              </p>
            </div>
            
            {typeof window !== "undefined" && process.env.NODE_ENV === "development" && error.message && (
              <details className="text-left max-w-2xl">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  查看错误详情（开发模式）
                </summary>
                <pre className="mt-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded text-xs overflow-auto whitespace-pre-wrap">
                  {error.message}
                  {error.stack && `\n\n堆栈跟踪:\n${error.stack}`}
                </pre>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={reset} className="w-full sm:w-auto">
                重试
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = "/"}
                className="w-full sm:w-auto"
              >
                返回首页
              </Button>
            </div>
          </div>
        </Container>
      </body>
    </html>
  );
}
