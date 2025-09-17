export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { synthesizeGeminiTTS } from "@/lib/gemini-tts";
import { uploadAudioFile } from "@/lib/storage-upload";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { text, lang, voiceName, stylePrompt, speakingRate = 1.0, pitch = 0 } = body;

    if (!text || !lang) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 调用 Gemini TTS 合成
    const audioBuffer = await synthesizeGeminiTTS({ 
      text, 
      lang, 
      voiceName, 
      stylePrompt,
      speakingRate, 
      pitch 
    });

    // 上传到 Supabase Storage
    const supabaseAdmin = getServiceSupabase();
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/gemini-${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;

    const uploadResult = await uploadAudioFile(bucket, filePath, audioBuffer);
    if (!uploadResult.success) {
      return NextResponse.json({ error: `上传失败: ${uploadResult.error}` }, { status: 500 });
    }

    // 尝试生成长期签名 URL
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
      bytes: audioBuffer.length, 
      signed: Boolean(signed?.signedUrl),
      provider: 'gemini-tts',
      voice: voiceName || 'Kore'
    });

  } catch (error: unknown) {
    console.error("Gemini TTS 音频合成失败:", error);
    const message = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
    return NextResponse.json({ error: message || "服务器错误" }, { status: 500 });
  }
}
