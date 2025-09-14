"use client";

import { useState } from "react";
import { Container } from "@/components/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TestUserDetailPage() {
  const [testUserId] = useState("02c3f65f-5b06-433a-a8e0-ad7e245a3748");

  return (
    <Container>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">测试用户详情页面</h1>
          <p className="text-muted-foreground">测试用户详情页面是否能正常工作</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>测试链接</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                你的用户ID: <code className="bg-gray-100 px-2 py-1 rounded">{testUserId}</code>
              </p>
            </div>
            
            <div className="flex gap-4">
              <Link href={`/admin/users/${testUserId}`}>
                <Button>
                  测试用户详情页面
                </Button>
              </Link>
              
              <Link href={`/admin/users/${testUserId}/permissions`}>
                <Button variant="outline">
                  测试权限管理页面
                </Button>
              </Link>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium mb-2">测试步骤：</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>点击上面的按钮测试用户详情页面</li>
                <li>如果显示"用户不存在"，请检查浏览器控制台的错误信息</li>
                <li>如果正常显示，说明用户详情页面工作正常</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
