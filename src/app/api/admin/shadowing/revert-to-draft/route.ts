export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const db = getServiceSupabase();

    // 获取要退回的素材信息
    const { data: items, error: fetchError } = await db
      .from('shadowing_items')
      .select('*')
      .in('id', ids);

    if (fetchError) {
      return NextResponse.json({ error: `获取素材失败: ${fetchError.message}` }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "未找到指定的素材" }, { status: 404 });
    }

    // 将素材转换为草稿格式
    const drafts = items.map(item => ({
      lang: item.lang,
      level: item.level,
      title: item.title,
      text: item.text,
      notes: {
        ...item.meta,
        audio_url: item.audio_url,
        duration_ms: item.duration_ms,
        tokens: item.tokens,
        cefr: item.cefr,
        reverted_from_item_id: item.id, // 记录原始素材ID
        reverted_at: new Date().toISOString()
      },
      status: 'draft',
      created_by: null // 系统操作
    }));

    // 批量插入草稿
    const { data: insertedDrafts, error: insertError } = await db
      .from('shadowing_drafts')
      .insert(drafts)
      .select();

    if (insertError) {
      return NextResponse.json({ error: `创建草稿失败: ${insertError.message}` }, { status: 500 });
    }

    // 删除原始素材
    const { error: deleteError } = await db
      .from('shadowing_items')
      .delete()
      .in('id', ids);

    if (deleteError) {
      return NextResponse.json({ error: `删除原始素材失败: ${deleteError.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      reverted_count: insertedDrafts?.length || 0,
      draft_ids: insertedDrafts?.map(d => d.id) || []
    });

  } catch (error: unknown) {
    console.error("退回草稿失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message || "服务器错误" }, { status: 500 });
  }
}
