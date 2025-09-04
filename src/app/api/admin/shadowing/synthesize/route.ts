export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { text, lang, voice, speakingRate = 1.0 } = body;

    if (!text || !lang) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 调用现有的 TTS API
    const ttsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, voiceName: voice, speakingRate })
    });

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      return NextResponse.json({ error: `TTS 失败: ${error}` }, { status: 500 });
    }

    // 使用 Node Buffer，避免以 ArrayBuffer 形式上传导致文件为 0 字节或不可播放
    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBuffer = Buffer.from(new Uint8Array(audioArrayBuffer));

    // 上传到 Supabase Storage
    const supabaseAdmin = getServiceSupabase();
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: false });
    if (upErr) return NextResponse.json({ error: `上传失败: ${upErr.message}` }, { status: 500 });

    // 尝试生成长期签名 URL（即使桶非 public 也可访问）
    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30 天

    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = pub?.publicUrl;
    const audioUrl = signed?.signedUrl || publicUrl;
    if (!audioUrl) return NextResponse.json({ error: '获取音频地址失败' }, { status: 500 });

    return NextResponse.json({ ok: true, audio_url: audioUrl, bytes: audioBuffer.length, signed: Boolean(signed?.signedUrl) });

  } catch (error) {
    console.error("音频合成失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
