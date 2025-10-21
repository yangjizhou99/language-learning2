import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const cookieStore = await cookies();
    
    // 检查环境变量
    if (!supabaseServiceRole) {
      return NextResponse.json({
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY 环境变量未设置'
      });
    }
    
    // 创建认证客户端
    const authSupabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });

    // 获取当前用户
    const {
      data: { user },
      error: userError
    } = await authSupabase.auth.getUser();

    if (userError) {
      return NextResponse.json({
        success: false,
        error: '获取用户信息失败',
        details: userError.message
      });
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '未登录',
        user: null
      });
    }

    // 获取用户权限信息
    const supabase = getServiceSupabase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({
        success: false,
        error: '获取用户权限信息失败',
        details: profileError.message,
        user: {
          id: user.id,
          email: user.email
        }
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: profile?.role || 'user',
        isAdmin: profile?.role === 'admin'
      },
      profile: profile,
      debug: {
        hasServiceRole: !!supabaseServiceRole,
        hasUser: !!user,
        hasProfile: !!profile,
        profileRole: profile?.role
      }
    });

  } catch (error) {
    console.error('检查权限失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
