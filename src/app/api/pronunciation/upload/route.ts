// =====================================================
// 发音音频上传 API
// 上传录音文件到 Supabase Storage
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/pronunciation/upload
 * 上传音频文件到 Storage
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      }) as unknown as SupabaseClient;
    } else {
      if (cookieHeader) {
        const cookieMap = new Map<string, string>();
        cookieHeader.split(';').forEach((pair) => {
          const [k, ...rest] = pair.split('=');
          const key = k.trim();
          const value = rest.join('=').trim();
          if (key) cookieMap.set(key, value);
        });
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() {},
            remove() {},
          },
        }) as unknown as SupabaseClient;
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
        }) as unknown as SupabaseClient;
      }
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 2. 解析表单数据
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const ext = (formData.get('ext') as string) || 'webm';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        { success: false, error: '没有文件' },
        { status: 400 }
      );
    }

    // 3. 上传到 Supabase Storage
    const supabaseAdmin = getServiceSupabase();
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    
    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    // 路径格式：{userId}/{timestamp}-{random}.{ext}
    const objectPath = `${user.id}/${now}-${rand}.${ext}`;

    // 确保 pronunciation-audio bucket 存在
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('pronunciation-audio')
      .upload(objectPath, bytes, {
        contentType: file.type || `audio/${ext}`,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`上传失败: ${uploadError.message}`);
    }

    return NextResponse.json({
      success: true,
      path: uploadData?.path ?? objectPath,
    });
  } catch (error) {
    console.error('[pronunciation/upload] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

