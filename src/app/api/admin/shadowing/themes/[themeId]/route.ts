export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

// 删除主题
export async function DELETE(
  req: NextRequest,
  { params }: { params: { themeId: string } }
) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const supabase = auth.supabase;

    const { themeId } = params;

    if (!themeId) {
      return NextResponse.json({ error: "主题ID不能为空" }, { status: 400 });
    }

    // 检查主题是否存在
    const { data: existingTheme, error: checkError } = await supabase
      .from("shadowing_themes")
      .select("id, created_by")
      .eq("id", themeId)
      .single();

    if (checkError || !existingTheme) {
      return NextResponse.json({ error: "主题不存在" }, { status: 404 });
    }

    // 检查权限（只能删除自己创建的主题，或者管理员可以删除所有主题）
    // 这里简化处理，允许所有管理员删除任何主题
    // 如果需要更严格的权限控制，可以检查 created_by 字段

    // 删除主题（级联删除相关的题目）
    const { error } = await supabase
      .from("shadowing_themes")
      .delete()
      .eq("id", themeId);

    if (error) {
      console.error("删除主题失败:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "主题删除成功" });
  } catch (error) {
    console.error("删除主题API错误:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
