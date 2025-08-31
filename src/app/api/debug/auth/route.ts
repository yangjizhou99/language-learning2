import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 [DEBUG AUTH] Testing authentication endpoint");
    
    // 获取所有cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // 检查环境变量
    const envVars = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 20) + "...",
    };
    
    // 尝试认证
    const auth = await requireUser();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      cookies: allCookies.map(c => ({ name: c.name, value: c.value?.slice(0, 20) + "..." })),
      environment: envVars,
      authentication: {
        success: !!auth,
        userId: auth?.user?.id,
        userEmail: auth?.user?.email,
        error: auth ? null : "No user found"
      }
    });
  } catch (error) {
    console.error("❌ [DEBUG AUTH] Error in auth test:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
