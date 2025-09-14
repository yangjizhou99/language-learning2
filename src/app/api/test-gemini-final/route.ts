export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { synthesizeGeminiTTS } from "@/lib/gemini-tts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text = "Hello, this is the final test of Gemini TTS.", voiceName = "Kore" } = body;

    console.log('最终 Gemini TTS 测试:', { text, voiceName });

    const audioBuffer = await synthesizeGeminiTTS({ 
      text, 
      lang: "en", 
      voiceName,
      stylePrompt: "以自然、清晰的风格朗读"
    });

    return NextResponse.json({ 
      success: true, 
      audioSize: audioBuffer.length,
      message: "最终 Gemini TTS 测试成功",
      provider: "gemini-tts",
      model: "gemini-2.5-flash-preview-tts",
      fixes: [
        "✅ modelName 放在 voice 里",
        "✅ REST API 使用正确凭证",
        "✅ FFmpeg 使用 ffmpeg-static 路径"
      ]
    });

  } catch (error: unknown) {
    console.error("最终 Gemini TTS 测试失败:", error);
    const message = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
    return NextResponse.json({ 
      success: false, 
      error: message,
      message: "最终 Gemini TTS 测试失败"
    }, { status: 500 });
  }
}
