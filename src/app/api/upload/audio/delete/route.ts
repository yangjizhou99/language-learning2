export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function DELETE(req: NextRequest) {
  try {
    console.log('录音删除API被调用');

    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    console.log('认证方式:', hasBearer ? 'Bearer' : 'Cookie');

    let supabase: any;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      });
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log('用户认证结果:', { user: user?.id, error: authError?.message });

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the file path from query parameters
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    console.log('准备删除录音文件:', filePath);

    // 验证文件路径是否属于当前用户
    const pathParts = filePath.split('/');
    if (pathParts.length < 2 || pathParts[0] !== user.id) {
      return NextResponse.json({ error: 'Unauthorized: File does not belong to user' }, { status: 403 });
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from('recordings')
      .remove([filePath]);

    if (deleteError) {
      console.error('Error deleting audio file:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log('录音文件删除成功:', filePath);

    return NextResponse.json({
      success: true,
      message: 'Recording deleted successfully',
    });
  } catch (error) {
    console.error('Error in audio delete API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
