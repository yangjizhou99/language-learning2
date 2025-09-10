export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// 预览文本
const PREVIEW_TEXTS = {
  'cmn-CN': '你好，这是一个免费的中文语音合成测试。',
  'en-US': 'Hello, this is a free English text-to-speech test.',
  'ja-JP': 'こんにちは、これは無料の日本語音声合成テストです。',
  'multi': 'Hello, this is a multilingual text-to-speech test.'
};

function getPreviewText(languageCode: string): string {
  return PREVIEW_TEXTS[languageCode as keyof typeof PREVIEW_TEXTS] || PREVIEW_TEXTS['multi'];
}

// 浏览器 TTS 音色映射
const BROWSER_VOICE_MAP: { [key: string]: { voice: string; lang: string; gender: string } } = {
  // 浏览器 TTS 音色
  'Browser-CN-Female-1': { voice: 'Microsoft Huihui - Chinese (Simplified, PRC)', lang: 'zh-CN', gender: 'female' },
  'Browser-CN-Male-1': { voice: 'Microsoft Kangkang - Chinese (Simplified, PRC)', lang: 'zh-CN', gender: 'male' },
  'Browser-CN-Female-2': { voice: 'Microsoft Yaoyao - Chinese (Simplified, PRC)', lang: 'zh-CN', gender: 'female' },
  'Browser-CN-Male-2': { voice: 'Microsoft Yunyang - Chinese (Simplified, PRC)', lang: 'zh-CN', gender: 'male' },
  'Browser-CN-Female-3': { voice: 'Microsoft Xiaoxiao - Chinese (Simplified, PRC)', lang: 'zh-CN', gender: 'female' },
  'Browser-CN-Male-3': { voice: 'Microsoft Yunxi - Chinese (Simplified, PRC)', lang: 'zh-CN', gender: 'male' },
  'Browser-EN-Female-1': { voice: 'Microsoft Aria - English (United States)', lang: 'en-US', gender: 'female' },
  'Browser-EN-Male-1': { voice: 'Microsoft Davis - English (United States)', lang: 'en-US', gender: 'male' },
  'Browser-EN-Female-2': { voice: 'Microsoft Jenny - English (United States)', lang: 'en-US', gender: 'female' },
  'Browser-EN-Male-2': { voice: 'Microsoft Guy - English (United States)', lang: 'en-US', gender: 'male' },
  'Browser-JA-Female-1': { voice: 'Microsoft Nanami - Japanese (Japan)', lang: 'ja-JP', gender: 'female' },
  'Browser-JA-Male-1': { voice: 'Microsoft Keita - Japanese (Japan)', lang: 'ja-JP', gender: 'male' }
};

// OPTIONS 处理 CORS 预检请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { voiceName, languageCode } = await req.json();

    if (!voiceName || !languageCode) {
      return NextResponse.json({
        success: false,
        error: "Missing required parameters: voiceName and languageCode"
      }, { status: 400 });
    }

    const previewText = getPreviewText(languageCode);
    
    // 获取浏览器 TTS 配置
    const voiceConfig = BROWSER_VOICE_MAP[voiceName];
    if (!voiceConfig) {
      return NextResponse.json({
        success: false,
        error: "Unsupported voice: " + voiceName
      }, { status: 400 });
    }

    // 返回文本数据，让前端使用浏览器 TTS
    const responseData = {
      success: true,
      text: previewText,
      voiceName: voiceName,
      languageCode: languageCode,
      browserVoice: voiceConfig.voice,
      browserLang: voiceConfig.lang,
      gender: voiceConfig.gender,
      useBrowserTTS: true
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
    });

  } catch (error: unknown) {
    console.error('Free voice preview generation failed:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to generate free voice preview",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}