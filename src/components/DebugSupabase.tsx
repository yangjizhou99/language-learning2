"use client";

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DebugSupabase() {
  useEffect(() => {
    // 在开发环境中暴露 Supabase 客户端到全局作用域
    if (process.env.NODE_ENV === 'development') {
      (window as any).supabase = supabase;
      console.log('🔧 Supabase 客户端已暴露到 window.supabase');
    }
  }, []);

  return null; // 这个组件不渲染任何内容
}
