export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { synthesizeGeminiTTS } from "@/lib/gemini-tts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text = "你好，这是Chirp3-HD音色测试", voiceName = "cmn-CN-Chirp3-HD-Kore" } = body;

    console.log('测试 Chirp3-HD 音色:', { text, voiceName });

    const audioBuffer = await synthesizeGeminiTTS({ 
      text, 
      lang: "zh", 
      voiceName,
      stylePrompt: "以自然、清晰的中文风格朗读"
    });

    return NextResponse.json({ 
      success: true, 
      audioSize: audioBuffer.length,
      message: "Chirp3-HD 音色测试成功",
      provider: "google-tts",
      language: "zh",
      voice: voiceName,
      quality: "Chirp3-HD (最高质量)"
    });

  } catch (error: unknown) {
    console.error("Chirp3-HD 音色测试失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: message,
      message: "Chirp3-HD 音色测试失败"
    }, { status: 500 });
  }
}
