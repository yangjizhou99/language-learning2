import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const runtime="nodejs"; 
export const dynamic="force-dynamic";

export async function GET(req: NextRequest, { params }:{params: Promise<{id:string}>}) {
  const auth = await requireAdmin(req); 
  if (!auth.ok) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const { id } = await params;
  const { data, error } = await auth.supabase.from("article_drafts").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status:400 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }:{params: Promise<{id:string}>}) {
  const auth = await requireAdmin(req); 
  if (!auth.ok) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const body = await req.json();
  const { id } = await params;
  const { error } = await auth.supabase.from("article_drafts").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status:400 });
  return NextResponse.json({ ok:true });
}
