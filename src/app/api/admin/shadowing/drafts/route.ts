export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: NextRequest){
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = auth.supabase;

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") || "draft"; // draft|approved
  const lang = sp.get("lang") as ("en"|"ja"|"zh"|null);
  const level = sp.get("level");
  const genre = sp.get("genre");
  const q = sp.get("q")?.trim() || "";

  let query = supabase
    .from("shadowing_drafts")
    .select("id, lang, level, genre, title, text, status, created_at, notes, translations, trans_updated_at")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (lang) query = query.eq("lang", lang);
  if (level) query = query.eq("level", Number(level));
  if (genre) query = query.eq("genre", genre);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  return NextResponse.json({ ok:true, items: data||[] });
}


