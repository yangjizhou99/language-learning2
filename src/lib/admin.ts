import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export async function requireAdmin(req?: NextRequest) {
  // 仅管理员可访问，移除备份 API 放行
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // 优先使用前端传来的 Authorization 头（Bearer token）
  const authHeader = req?.headers.get('authorization') || '';
  const hasBearer = /^Bearer\s+/.test(authHeader);

  const cookieStore = await cookies();

  // 用于认证的客户端（使用 anon key）
  const authSupabase = hasBearer
    ? createClient(supabaseUrl, supabaseAnon, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      })
    : createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      });

  // 用于数据查询的客户端（使用 service role key）
  if (!supabaseServiceRole) {
    console.error('SUPABASE_SERVICE_ROLE_KEY 环境变量未设置');
    return { ok: false as const, reason: 'server_error' };
  }

  const dataSupabase = createClient(supabaseUrl, supabaseServiceRole);

  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) return { ok: false as const, reason: 'unauthorized' };

  // 直接查询用户角色，不依赖is_admin函数
  const { data, error } = await dataSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !data || data.role !== 'admin') {
    return { ok: false as const, reason: 'forbidden' };
  }
  return { ok: true as const, supabase: dataSupabase, user };
}
