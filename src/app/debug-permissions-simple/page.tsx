'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserPermissions } from '@/lib/user-permissions-server';

export default function DebugPermissionsSimplePage() {
  const [user, setUser] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          // 使用服务端函数获取权限
          const response = await fetch('/api/debug-permissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          });

          if (response.ok) {
            const data = await response.json();
            setPermissions(data.permissions);
            setTestResult(data.testResult);
          }
        }
      } catch (error) {
        console.error('检查用户失败:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const testCatalogAPI = async () => {
    try {
      const response = await fetch('/api/shadowing/catalog?lang=zh&level=2');
      const data = await response.json();
      console.log('Catalog API 响应:', data);
      alert(`API 状态: ${response.status}\n响应: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('API 调用失败:', error);
      alert('API 调用失败，请查看控制台');
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">权限调试页面（简化版）</h1>

      <div className="space-y-6">
        {/* 用户信息 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">用户信息</h2>
          <p>
            <strong>用户ID:</strong> {user?.id}
          </p>
          <p>
            <strong>邮箱:</strong> {user?.email}
          </p>
        </div>

        {/* 权限信息 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">权限信息</h2>
          <pre className="text-sm">{JSON.stringify(permissions, null, 2)}</pre>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div className="bg-green-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">测试结果</h2>
            <pre className="text-sm">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}

        {/* 测试按钮 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">测试 Shadowing Catalog API</h2>
          <button
            onClick={testCatalogAPI}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            测试获取题目列表
          </button>
        </div>
      </div>
    </div>
  );
}
