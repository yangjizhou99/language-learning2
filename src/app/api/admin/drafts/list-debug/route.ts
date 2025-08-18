import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    console.log("=== 草稿列表调试 ===");
    console.log("Request URL:", req.url);
    console.log("Request headers:", Object.fromEntries(req.headers));

    // 权限检查
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      console.log("权限检查失败:", auth.reason);
      return NextResponse.json({ 
        error: "forbidden", 
        reason: auth.reason,
        step: "auth_check"
      }, { status: 403 });
    }

    console.log("权限检查通过，用户ID:", auth.user.id);

    // 解析查询参数
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") || "pending";
    console.log("查询状态:", status);

    // 数据库查询
    console.log("开始数据库查询...");
    const { data, error } = await auth.supabase
      .from("article_drafts")
      .select("id,source,lang,genre,difficulty,title,created_at,status,ai_provider,ai_model")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("数据库查询错误:", error);
      return NextResponse.json({ 
        error: error.message, 
        step: "db_query",
        status_filter: status
      }, { status: 400 });
    }

    console.log("查询成功，找到记录数:", data?.length || 0);
    console.log("返回的数据:", data);

    // 检查数据格式
    if (!Array.isArray(data)) {
      console.error("返回的数据不是数组:", typeof data, data);
      return NextResponse.json({ 
        error: "数据格式错误：不是数组", 
        data_type: typeof data,
        actual_data: data
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      status_filter: status,
      count: data.length,
      data: data || [],
      user_id: auth.user.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("草稿列表调试失败:", error);
    return NextResponse.json({
      error: "调试失败",
      details: String(error),
      step: "general_error"
    }, { status: 500 });
  }
}
