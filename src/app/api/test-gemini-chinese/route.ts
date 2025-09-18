export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { synthesizeGeminiTTS } from '@/lib/gemini-tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text = '你好，这是中文语音合成测试', lang = 'zh' } = body;

    console.log('测试中文 Gemini TTS:', { text, lang });

    const audioBuffer = await synthesizeGeminiTTS({
      text,
      lang,
      voiceName: 'cmn-CN-Neural2-A', // 中文音色
      stylePrompt: '以自然、清晰的中文风格朗读',
    });

    return NextResponse.json({
      success: true,
      audioSize: audioBuffer.length,
      message: '中文 Gemini TTS 测试成功',
      provider: 'gemini-tts',
      language: lang,
      voice: 'cmn-CN-Neural2-A',
    });
  } catch (error: unknown) {
    console.error('中文 Gemini TTS 测试失败:', error);
    const message =
      error instanceof Error
        ? error instanceof Error
          ? error.message
          : String(error)
        : String(error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        message: '中文 Gemini TTS 测试失败',
      },
      { status: 500 },
    );
  }
}
