"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    checkAdminStatus();
    loadStats();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      
      setUser(session.user);
      
      // 获取用户资料
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      
      setProfile(profileData);
    } catch (error) {
      console.error("检查管理员状态失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // 获取草稿统计
      const draftsRes = await fetch("/api/admin/drafts/list?status=all", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (draftsRes.ok) {
        const draftsData = await draftsRes.json();
        setStats({
          totalDrafts: draftsData.length,
          pendingDrafts: draftsData.filter((d: any) => d.status === 'pending').length,
          publishedDrafts: draftsData.filter((d: any) => d.status === 'published').length
        });
      }
    } catch (error) {
      console.error("加载统计失败:", error);
    }
  };

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center">加载中...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center text-red-600">
          请先登录才能访问管理员控制台
        </div>
      </main>
    );
  }

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">管理员控制台</h1>
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
            <h2 className="text-lg font-medium text-yellow-800 mb-2">需要管理员权限</h2>
            <p className="text-yellow-700 mb-4">
              您当前没有管理员权限。请联系系统管理员或前往设置页面申请权限。
            </p>
            <Link 
              href="/admin/setup" 
              className="inline-block px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              设置管理员权限
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">管理员控制台</h1>
        <div className="text-sm text-gray-600">
          欢迎，{user.email}
        </div>
      </div>

      {/* 统计概览 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* 快速操作 */}
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
            href="/admin/drafts" 
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">📋 草稿箱</h3>
            <p className="text-sm text-gray-600 mt-1">审核、编辑、发布草稿</p>
          </Link>
          
          <Link 
            href="/admin/drafts/batch" 
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-medium text-gray-900">⚡ 批量生成</h3>
            <p className="text-sm text-gray-600 mt-1">批量创建文章草稿</p>
          </Link>
        </div>
      </div>

      {/* 功能模块 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 内容管理 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">内容管理</h2>
          <div className="space-y-3">
            <Link 
              href="/admin/articles" 
              className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
            >
              <div>
                <h3 className="font-medium">题库管理</h3>
                <p className="text-sm text-gray-600">AI生成、手动录入、内容抓取</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
            
            <Link 
              href="/admin/drafts" 
              className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
            >
              <div>
                <h3 className="font-medium">草稿箱</h3>
                <p className="text-sm text-gray-600">审核、编辑、发布草稿</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
            
            <Link 
              href="/admin/drafts/batch" 
              className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
            >
              <div>
                <h3 className="font-medium">批量生成</h3>
                <p className="text-sm text-gray-600">批量创建文章草稿</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          </div>
        </div>

        {/* 系统管理 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">系统管理</h2>
          <div className="space-y-3">
            <Link 
              href="/admin/setup" 
              className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
            >
              <div>
                <h3 className="font-medium">权限设置</h3>
                <p className="text-sm text-gray-600">管理员权限、系统诊断</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
            
            <Link 
              href="/admin/alignment/ai" 
              className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
            >
              <div>
                <h3 className="font-medium">对齐练习管理</h3>
                <p className="text-sm text-gray-600">AI对齐练习内容管理</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
            
            <Link 
              href="/admin/shadowing/ai" 
              className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
            >
              <div>
                <h3 className="font-medium">跟读练习管理</h3>
                <p className="text-sm text-gray-600">AI跟读练习内容管理</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 最近活动 */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-xl font-semibold mb-4">最近活动</h2>
        <div className="text-sm text-gray-600">
          <p>• 最后登录: {new Date().toLocaleString()}</p>
          <p>• 系统状态: 正常运行</p>
          <p>• 数据库连接: 正常</p>
        </div>
      </div>
    </main>
  );
}
