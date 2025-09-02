export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: NextRequest){
  const auth = await requireAdmin(req); if (!auth.ok) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const { lang, topic, tags=[], style={}, pack, provider, model, usage } = await req.json();
  if (!pack?.order) return NextResponse.json({ error:"invalid pack" }, { status:400 });
  // 目前仅校验管理员并回显参数；如需入库，可启用 Supabase 插入逻辑
  return NextResponse.json({ ok:true, lang, topic, tags, provider, model });
}
