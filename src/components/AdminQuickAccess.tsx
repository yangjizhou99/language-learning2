"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminQuickAccess() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      
      setIsAdmin(profileData?.role === "admin");
    } catch (error) {
      console.error("检查管理员状态失败:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-blue-900">管理员快速访问</h3>
          <p className="text-xs text-blue-700">常用管理功能</p>
        </div>
        <div className="flex space-x-2">
          <Link 
            href="/admin" 
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            控制台
          </Link>
          <Link 
            href="/admin/drafts" 
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            草稿箱
          </Link>
          <Link 
            href="/admin/articles" 
            className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            题库管理
          </Link>
        </div>
      </div>
    </div>
  );
}
