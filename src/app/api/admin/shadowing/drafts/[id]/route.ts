export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: NextRequest, { params }:{ params: Promise<{ id:string }> }){
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const { data, error } = await auth.supabase
    .from("shadowing_drafts")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "not found" }, { status: 404 });
  return NextResponse.json({ ok:true, draft: data });
}

export async function PUT(req: NextRequest, { params }:{ params: Promise<{ id:string }> }){
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json();
  const patch:any = {};
  for (const k of ["title","topic","genre","register","text","notes"]) if (k in b) patch[k] = b[k];
  const { id } = await params;
  const { error } = await auth.supabase.from("shadowing_drafts").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok:true });
}

export async function POST(req: NextRequest, { params }:{ params: Promise<{ id:string }> }){
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { action } = await req.json();
  if (action === "publish"){
    const { id } = await params;
    const { data: d, error: e0 } = await auth.supabase.from("shadowing_drafts").select("*").eq("id", id).single();
    if (e0 || !d) return NextResponse.json({ error: "not found" }, { status: 404 });
    const audioUrl = typeof d?.notes?.audio_url === "string" ? d.notes.audio_url : "";
    const { error: e1 } = await auth.supabase.from("shadowing_items").insert([{
      lang: d.lang,
      level: d.level,
      title: d.title,
      text: d.text,
      audio_url: audioUrl,
      meta: { from_draft: d.id, notes: d.notes, published_at: new Date().toISOString() }
    }]);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    await auth.supabase.from("shadowing_drafts").update({ status: "approved" }).eq("id", id);
    return NextResponse.json({ ok:true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }:{ params: Promise<{ id:string }> }){
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  // 优先硬删除；若受 RLS 限制失败，可回退为归档
  const { error } = await auth.supabase.from("shadowing_drafts").delete().eq("id", id);
  if (error) {
    const { error: e2 } = await auth.supabase.from("shadowing_drafts").update({ status: "archived" }).eq("id", id);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}


