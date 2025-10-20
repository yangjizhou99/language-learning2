'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PerformanceTestReminder from '@/components/PerformanceTestReminder';

export default function AdminDashboard() {
  const [stats, setStats] = useState<{
    totalDrafts: number;
    pendingDrafts: number;
    publishedDrafts: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers = new Headers();
        if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
        const draftsRes = await fetch('/api/admin/drafts/list?status=all', { headers });

        const nextStats: {
          totalDrafts: number;
          pendingDrafts: number;
          publishedDrafts: number;
        } = {
          totalDrafts: 0,
          pendingDrafts: 0,
          publishedDrafts: 0,
        };

        if (draftsRes.ok) {
          const drafts = await draftsRes.json();
          nextStats.totalDrafts = drafts.length;
          nextStats.pendingDrafts = drafts.filter((d: { status: string }) => d.status === 'pending').length;
          nextStats.publishedDrafts = drafts.filter((d: { status: string }) => d.status === 'published').length;
        }

        setStats(nextStats);
      } catch (e) {
        console.error('加载统计失败:', e);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">管理员控制台</h1>
      </div>

      {/* 性能测试提醒 */}
      <PerformanceTestReminder />

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">总草稿数</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalDrafts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">待审核</h3>
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingDrafts}</p>
          </div>
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">已发布</h3>
            <p className="text-3xl font-bold text-green-600">{stats.publishedDrafts}</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-xl font-semibold mb-4">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/admin/articles"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">📝 题库管理</h3>
            <p className="text-sm text-gray-600 mt-1">AI生成、手动录入、内容抓取</p>
          </Link>
          <Link
            href="/admin/drafts/batch"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">⚡ 批量生成</h3>
            <p className="text-sm text-gray-600 mt-1">批量创建文章草稿</p>
          </Link>
          <Link
            href="/admin/api-usage"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">📈 API用量统计</h3>
            <p className="text-sm text-gray-600 mt-1">监控和管理用户的API使用情况</p>
          </Link>
          <Link
            href="/admin/alignment/themes"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">🧭 对齐主题管理</h3>
            <p className="text-sm text-gray-600 mt-1">维护大主题、多语言翻译与生成结果</p>
          </Link>
          <Link
            href="/admin/alignment/subtopics-gen"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">🧱 对齐小主题生成</h3>
            <p className="text-sm text-gray-600 mt-1">批量生成小主题并管理目标列表</p>
          </Link>
          <Link
            href="/admin/alignment/materials"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">🗂️ 对齐训练包审核</h3>
            <p className="text-sm text-gray-600 mt-1">审核并发布生成的对齐练习包</p>
          </Link>
          <Link
            href="/admin/database-sync"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">🔄 数据库同步</h3>
            <p className="text-sm text-gray-600 mt-1">将本地数据库数据覆盖到云端</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
