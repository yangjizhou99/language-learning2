"use client";

import { useState, useEffect } from "react";
import { Container } from "@/components/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function DebugUserDetailPage() {
  const [testUserId] = useState("02c3f65f-5b06-433a-a8e0-ad7e245a3748");
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testUserDetail = async () => {
    setLoading(true);
    try {
      console.log('测试用户详情页面，用户ID:', testUserId);
      
      // 测试用户查询
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          role,
          bio,
          goals,
          preferred_tone,
          domains,
          native_lang,
          target_langs,
          created_at
        `)
        .eq('id', testUserId)
        .single();

      console.log('用户查询结果:', { user, userError });

      setDebugInfo({
        userId: testUserId,
        user,
        userError,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('测试失败:', error);
      setDebugInfo({
        userId: testUserId,
        error: String(error),
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">调试用户详情页面</h1>
          <p className="text-muted-foreground">测试用户详情页面的数据获取</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>测试信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                测试用户ID: <code className="bg-gray-100 px-2 py-1 rounded">{testUserId}</code>
              </p>
            </div>
            
            <div className="flex gap-4">
              <Button onClick={testUserDetail} disabled={loading}>
                {loading ? '测试中...' : '测试用户查询'}
              </Button>
              
              <Link href={`/admin/users/${testUserId}`}>
                <Button variant="outline">
                  直接访问用户详情页面
                </Button>
              </Link>
            </div>

            {debugInfo && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">调试结果：</h3>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
