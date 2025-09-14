export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { synthesizeGeminiDialogue } from "@/lib/gemini-tts";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { text, lang, speakers = [], stylePrompts = {}, speakingRate = 1.0, pitch = 0 } = body;

    if (!text || !lang) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 调用 Gemini TTS 对话合成
    const result = await synthesizeGeminiDialogue({ 
      text, 
      lang, 
      speakers,
      stylePrompts,
      speakingRate, 
      pitch 
    });

    // 上传到 Supabase Storage
    const supabaseAdmin = getServiceSupabase();
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/gemini-dialogue-${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, result.audio, { contentType: 'audio/mpeg', upsert: false });
    if (upErr) return NextResponse.json({ error: `上传失败: ${upErr.message}` }, { status: 500 });

    // 生成签名 URL
    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30 天

    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = pub?.publicUrl;
    const audioUrl = signed?.signedUrl || publicUrl;
    if (!audioUrl) return NextResponse.json({ error: '获取音频地址失败' }, { status: 500 });

    return NextResponse.json({ 
      ok: true, 
      audio_url: audioUrl, 
      bytes: result.audio.length, 
      signed: Boolean(signed?.signedUrl),
      provider: 'gemini-tts',
      dialogue_count: result.dialogueCount,
      speakers: result.speakers,
      is_dialogue: true
    });

  } catch (error: unknown) {
    console.error("Gemini TTS 对话音频合成失败:", error);
    const message = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
    return NextResponse.json({ error: message || "服务器错误" }, { status: 500 });
  }
}
