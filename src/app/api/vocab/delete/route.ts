export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const DeleteVocabSchema = z.object({
  entry_ids: z.array(z.string().uuid()),
});

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // 检查是否有 Authorization header
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');

    let supabase: any;

    if (hasBearer) {
      // 使用 Authorization header
      console.log('删除生词使用 Authorization header 认证');
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } },
        },
      );
    } else {
      // 使用 cookie 认证
      console.log('删除生词使用 Cookie 认证');
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {
              // no-op for Route Handler
            },
            remove() {
              // no-op for Route Handler
            },
          },
        },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    console.log('接收到的删除请求:', body);

    try {
      const { entry_ids } = DeleteVocabSchema.parse(body);
      console.log('验证通过的生词ID:', entry_ids);
    } catch (parseError) {
      console.error('数据验证失败:', parseError);
      if (parseError instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: '请求格式错误',
            details:
              parseError.issues
                ?.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ') || '未知验证错误',
          },
          { status: 400 },
        );
      }
      throw parseError;
    }

    const { entry_ids } = DeleteVocabSchema.parse(body);

    // 删除生词条目
    const { data, error } = await supabase
      .from('vocab_entries')
      .delete()
      .in('id', entry_ids)
      .eq('user_id', user.id) // 确保只能删除自己的生词
      .select();

    if (error) {
      console.error('删除生词失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      deleted_entries: data,
    });
  } catch (error) {
    console.error('删除生词API错误:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: '请求格式错误',
          details:
            error.issues?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') ||
            '验证错误',
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
