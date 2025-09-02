export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

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
      body: JSON.stringify({ text, lang, voice, speakingRate })
    });

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      return NextResponse.json({ error: `TTS 失败: ${error}` }, { status: 500 });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    
    // 将音频数据转换为 base64 字符串，直接返回给前端
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;
    
    return NextResponse.json({
      ok: true,
      message: "音频合成成功",
      audio_url: dataUrl
    });

  } catch (error) {
    console.error("音频合成失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
