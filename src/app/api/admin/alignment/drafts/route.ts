export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: NextRequest){
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = auth.supabase;

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") || "draft"; // draft|published|archived
  const lang = sp.get("lang") as ("en"|"ja"|"zh"|null);
  const q = sp.get("q")?.trim() || "";
  const page = Math.max(1, Number(sp.get("page")||"1"));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size")||"20")));

  let query = supabase
    .from("alignment_packs")
    .select("id, lang, topic, tags, status, created_at", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (lang) query = query.eq("lang", lang);
  if (q) query = query.ilike("topic", `%${q}%`);

  const from = (page-1)*pageSize; const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok:true, items: data || [], total: count || 0, page, page_size: pageSize });
}


