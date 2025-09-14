import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const runtime="nodejs"; 
export const dynamic="force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req); 
  if (!auth.ok) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") || "pending";
  const { data, error } = await auth.supabase
    .from("article_drafts")
    .select("id,source,lang,genre,difficulty,title,created_at,status,ai_provider,ai_model")
    .eq("status", status)
    .order("created_at", { ascending:false })
    .limit(100);
  if (error) return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status:400 });
  return NextResponse.json(data || []);
}
