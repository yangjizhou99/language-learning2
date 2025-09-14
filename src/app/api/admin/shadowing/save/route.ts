export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { lang, level, items, theme_id, subtopic_id } = body;

    if (!lang || !level || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "缺少必要的参数：lang, level, items" }, { status: 400 });
    }

    // 使用 Supabase 客户端
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 直接插入数据到 shadowing_items 表
    const insertedIds = [];
    for (const item of items) {
      const { data, error } = await supabase
        .from('shadowing_items')
        .insert({
          lang,
          level,
          title: item.title,
          text: item.text,
          audio_url: item.audio_url,
          duration_ms: item.duration_ms || null,
          tokens: item.tokens || null,
          theme_id: theme_id || null,
          subtopic_id: subtopic_id || null
        })
        .select('id')
        .single();

      if (error) {
        console.error("插入项目失败:", error);
        return NextResponse.json({ error: `插入失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
      }

      insertedIds.push(data.id);
    }

    return NextResponse.json({
      ok: true,
      message: `成功保存 ${items.length} 个项目`,
      inserted: items.length,
      inserted_ids: insertedIds
    });

  } catch (error) {
    console.error("保存失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
