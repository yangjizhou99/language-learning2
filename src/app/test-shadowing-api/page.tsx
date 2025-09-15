"use client";
import { useEffect, useState } from 'react';

export default function TestShadowingAPI() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    try {
      // 测试用户权限
      const permissionsResponse = await fetch('/api/debug-user-permissions');
      const permissionsData = await permissionsResponse.json();
      
      // 测试数据库数据
      const dataResponse = await fetch('/api/debug-shadowing-data');
      const dataResult = await dataResponse.json();
      
      // 测试 catalog API
      const catalogResponse = await fetch('/api/shadowing/catalog?lang=zh&level=2');
      const catalogData = await catalogResponse.json();
      
      // 测试 themes API
      const themesResponse = await fetch('/api/admin/shadowing/themes?lang=zh&level=2');
      const themesData = await themesResponse.json();
      
      // 测试 subtopics API
      const subtopicsResponse = await fetch('/api/admin/shadowing/subtopics?theme_id=all');
      const subtopicsData = await subtopicsResponse.json();
      
      setResult({
        userPermissions: {
          status: permissionsResponse.status,
          data: permissionsData
        },
        databaseData: {
          status: dataResponse.status,
          data: dataResult
        },
        catalog: {
          status: catalogResponse.status,
          data: catalogData
        },
        themes: {
          status: themesResponse.status,
          data: themesData
        },
        subtopics: {
          status: subtopicsResponse.status,
          data: subtopicsData
        }
      });
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">测试 Shadowing API</h1>
      
      <button 
        onClick={testAPI}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? '测试中...' : '测试所有API'}
      </button>
      
      {result && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4">测试结果</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
