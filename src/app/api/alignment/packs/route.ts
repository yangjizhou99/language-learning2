export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

// 公共列表接口：返回已发布的训练包
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("alignment_packs")
      .select("id, lang, topic, tags, status, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("alignment packs list error:", error);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, packs: data || [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}


