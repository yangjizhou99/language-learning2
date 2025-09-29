export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { checkAPILimits, checkUserAIPermissions } from '@/lib/api-limits-checker';

const PrecheckSchema = z.object({
  provider: z.string(),
  model: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');
    let supabase: any;

    if (hasBearer) {
      // 使用 Authorization 头创建客户端（无状态，不依赖 cookies）
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } },
        },
      );
    } else {
      // 回退：使用 cookies 构建 SSR 客户端
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, reason: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, model } = PrecheckSchema.parse(body);

    // 先检查模型访问权限
    const perm = await checkUserAIPermissions(user.id, provider, model);
    if (!perm.allowed) {
      return NextResponse.json(
        { success: false, type: 'permission', reason: perm.reason },
        { status: 403 },
      );
    }

    // 再检查API使用限制
    const limit = await checkAPILimits(user.id, provider, model);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, type: 'limit', reason: limit.reason },
        { status: 429 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('预检失败:', error);
    return NextResponse.json({ success: false, reason: '服务器错误' }, { status: 500 });
  }
}


