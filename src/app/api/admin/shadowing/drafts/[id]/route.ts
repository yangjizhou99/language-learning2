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
  for (const k of ["title","topic","genre","register","text","notes","translations","trans_updated_at"]) if (k in b) patch[k] = b[k];
  const { id } = await params;
  const { error } = await auth.supabase.from("shadowing_drafts").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
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
      translations: d.translations || {},
      trans_updated_at: d.trans_updated_at,
      meta: { from_draft: d.id, notes: d.notes, published_at: new Date().toISOString() }
    }]);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    await auth.supabase.from("shadowing_drafts").update({ status: "approved" }).eq("id", id);
    return NextResponse.json({ ok:true });
  }
  
  if (action === "revert"){
    const { id } = await params;
    // 将草稿状态从 approved 改回 draft
    const { error: e1 } = await auth.supabase.from("shadowing_drafts").update({ status: "draft" }).eq("id", id);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    
    // 从 shadowing_items 表中删除对应的项目
    const { error: e2 } = await auth.supabase.from("shadowing_items").delete().eq("meta->>from_draft", id);
    if (e2) {
      console.warn("Failed to delete from shadowing_items:", e2.message);
      // 不返回错误，因为主要操作（撤回草稿）已经成功
    }
    
    return NextResponse.json({ ok:true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }:{ params: Promise<{ id:string }> }){
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  
  try {
    // 1. 先获取草稿信息，包括音频URL
    const { data: draft, error: fetchError } = await auth.supabase
      .from("shadowing_drafts")
      .select("id, title, audio_url")
      .eq("id", id)
      .single();
    
    if (fetchError) {
      console.error("获取草稿信息失败:", fetchError);
    }
    
    // 2. 删除草稿记录
    const { error } = await auth.supabase.from("shadowing_drafts").delete().eq("id", id);
    if (error) {
      // 如果硬删除失败，尝试归档
      const { error: e2 } = await auth.supabase.from("shadowing_drafts").update({ status: "archived" }).eq("id", id);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
    }
    
    // 3. 删除关联的音频文件
    if (draft && draft.audio_url) {
      try {
        // 从URL中提取文件路径
        const url = new URL(draft.audio_url);
        const pathParts = url.pathname.split('/');
        const bucketName = pathParts[pathParts.length - 2]; // 倒数第二个部分是bucket名
        const fileName = pathParts[pathParts.length - 1]; // 最后一个是文件名
        
        // 构建完整的文件路径
        const filePath = `${draft.lang || 'zh'}/${fileName}`;
        
        console.log(`尝试删除音频文件: ${filePath}`);
        
        // 删除Supabase Storage中的文件
        const { error: deleteError } = await auth.supabase.storage
          .from(bucketName)
          .remove([filePath]);
        
        if (deleteError) {
          console.warn(`删除音频文件失败: ${filePath} - ${deleteError.message}`);
        } else {
          console.log(`成功删除音频文件: ${filePath}`);
        }
      } catch (urlError) {
        console.warn(`解析音频URL失败: ${draft.audio_url} - ${urlError}`);
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("删除草稿时发生错误:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}


