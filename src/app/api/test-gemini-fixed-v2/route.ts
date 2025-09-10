export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { synthesizeGeminiTTS } from "@/lib/gemini-tts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text = "Hello, this is a test of fixed Gemini TTS v2.", voiceName = "Kore" } = body;

    console.log('测试修复后的 Gemini TTS v2:', { text, voiceName });

    const audioBuffer = await synthesizeGeminiTTS({ 
      text, 
      lang: "en", 
      voiceName,
      stylePrompt: "以自然、清晰的风格朗读"
    });

    return NextResponse.json({ 
      success: true, 
      audioSize: audioBuffer.length,
      message: "修复后的 Gemini TTS v2 测试成功",
      provider: "gemini-tts",
      model: "models/gemini-2.5-flash-preview-tts"
    });

  } catch (error: unknown) {
    console.error("修复后的 Gemini TTS v2 测试失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: message,
      message: "修复后的 Gemini TTS v2 测试失败"
    }, { status: 500 });
  }
}
