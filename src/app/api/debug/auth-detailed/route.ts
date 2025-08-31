import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const cookies = request.cookies;
    const allCookies = cookies.getAll();
    
    // 创建Supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    // 尝试获取用户
    let authResult = null;
    let authError = null;
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        authError = error.message;
      } else {
        authResult = user;
      }
    } catch (err: any) {
      authError = err.message;
    }

    // 检查环境变量
    const envCheck = {
      supabaseUrl: !!supabaseUrl,
      supabaseAnonKey: !!supabaseAnonKey,
      supabaseUrlValue: supabaseUrl,
      supabaseAnonKeyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + "..." : null
    };

    // 检查所有可能的Supabase cookie
    const supabaseCookies = allCookies.filter(cookie => 
      cookie.name.includes('sb-') || 
      cookie.name.includes('supabase') ||
      cookie.name.includes('auth')
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      requestInfo: {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      },
      cookies: {
        total: allCookies.length,
        all: allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + "..." })),
        supabase: supabaseCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + "..." }))
      },
      environment: envCheck,
      authentication: {
        success: !!authResult,
        user: authResult ? { id: authResult.id, email: authResult.email } : null,
        error: authError
      },
      recommendations: [
        "检查浏览器是否启用了cookie",
        "检查浏览器隐私设置",
        "确认Supabase项目设置",
        "尝试清除浏览器缓存和cookie"
      ]
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
