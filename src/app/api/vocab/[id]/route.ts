export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const UpdateVocabEntrySchema = z.object({
  status: z.enum(['new', 'starred', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  explanation: z.any().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();

    // 检查是否有 Authorization header
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');

    let supabase: any;

    if (hasBearer) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } },
        },
      );
    } else {
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
    const updates = UpdateVocabEntrySchema.parse(body);

    // 更新生词
    const { data, error } = await supabase
      .from('vocab_entries')
      .update(updates)
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('更新生词失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('更新生词API错误:', error);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();

    // 检查是否有 Authorization header
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');

    let supabase: any;

    if (hasBearer) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } },
        },
      );
    } else {
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

    // 删除生词
    const { error } = await supabase
      .from('vocab_entries')
      .delete()
      .eq('id', resolvedParams.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('删除生词失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除生词API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
