"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Container } from "@/components/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DebugUsersPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkDatabase();
  }, []);

  const checkDatabase = async () => {
    setLoading(true);
    try {
      console.log('开始检查数据库...');
      
      // 检查当前用户
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('当前用户:', { user, userError });

      // 检查profiles表
      const { data: profiles, error: profilesError, count: profilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .limit(5);
      
      console.log('Profiles表查询结果:', { profiles, profilesError, profilesCount });

      // 检查auth.users表（如果可能）
      const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers();
      console.log('Auth用户查询结果:', { authUsers, authUsersError });

      // 检查是否有任何练习数据
      const { data: shadowingData, error: shadowingError } = await supabase
        .from('shadowing_attempts')
        .select('user_id, created_at')
        .limit(5);
      
      console.log('Shadowing数据:', { shadowingData, shadowingError });

      setDebugInfo({
        currentUser: user,
        userError,
        profiles: {
          data: profiles,
          error: profilesError,
          count: profilesCount
        },
        authUsers: {
          data: authUsers,
          error: authUsersError
        },
        shadowingData: {
          data: shadowingData,
          error: shadowingError
        }
      });

    } catch (error) {
      console.error('检查数据库失败:', error);
      setDebugInfo({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">用户数据调试</h1>
            <p className="text-muted-foreground">检查数据库中的用户数据</p>
          </div>
          <Button onClick={checkDatabase}>
            重新检查
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>调试信息</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
