import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 检查管理员权限
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ 
        error: "权限检查失败", 
        reason: auth.reason,
        step: "admin_check"
      }, { status: 403 });
    }

    // 检查环境变量
    const envCheck = {
      DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };

    // 尝试测试 AI 客户端导入
    let aiClientStatus = "unknown";
    try {
      const { chatJSON } = await import("@/lib/ai/client");
      aiClientStatus = "imported_successfully";
    } catch (error) {
      aiClientStatus = `import_error: ${error}`;
    }

    // 检查数据库连接
    let dbTestStatus = "unknown";
    try {
      const { data, error } = await auth.supabase
        .from("article_drafts")
        .select("count")
        .limit(1);
      
      if (error) {
        dbTestStatus = `db_error: ${error.message}`;
      } else {
        dbTestStatus = "db_connection_ok";
      }
    } catch (error) {
      dbTestStatus = `db_connection_error: ${error}`;
    }

    return NextResponse.json({
      admin_check: "✅ 通过",
      user_id: auth.user.id,
      env_variables: envCheck,
      ai_client_status: aiClientStatus,
      db_test_status: dbTestStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: "调试检查失败",
      details: String(error),
      step: "general_error"
    }, { status: 500 });
  }
}
