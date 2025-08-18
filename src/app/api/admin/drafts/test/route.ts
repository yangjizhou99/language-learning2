import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    console.log("Testing drafts list API...");
    
    // 测试权限检查
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ 
        error: "权限检查失败", 
        reason: auth.reason,
        step: "auth_check"
      }, { status: 403 });
    }

    console.log("Auth check passed, user:", auth.user.id);

    // 测试数据库查询
    const { data, error } = await auth.supabase
      .from("article_drafts")
      .select("id,source,lang,genre,difficulty,title,created_at,status,ai_provider,ai_model")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json({
        error: "数据库查询失败",
        db_error: error.message,
        step: "db_query"
      }, { status: 500 });
    }

    console.log("Database query successful, found", data?.length || 0, "records");

    return NextResponse.json({
      success: true,
      message: "草稿列表API测试成功",
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json({
      error: "测试失败",
      details: String(error),
      step: "general_error"
    }, { status: 500 });
  }
}
