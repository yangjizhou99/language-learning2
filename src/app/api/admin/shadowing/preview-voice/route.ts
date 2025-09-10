import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// 创建 TTS 客户端
function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_TTS_CREDENTIALS missing");

  let credentials: any;
  try {
    credentials = JSON.parse(raw);
  } catch {
    try {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw new Error("File path not supported in production. Use JSON string in GOOGLE_TTS_CREDENTIALS");
      }
      const fs = require('fs');
      const path = require('path');
      const filePath = path.resolve(process.cwd(), raw);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      credentials = JSON.parse(fileContent);
    } catch (fileError: unknown) {
      const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
      throw new Error(`Failed to load credentials: ${errorMessage}`);
    }
  }
  
  return new TextToSpeechClient({
    credentials,
    projectId: process.env.GOOGLE_TTS_PROJECT_ID,
  });
}

// 试听文本配置
const PREVIEW_TEXTS = {
  'en-US': 'Hello! This is a preview of the voice quality.',
  'cmn-CN': '你好！这是音色质量的试听预览。',
  'ja-JP': 'こんにちは！これは音声品質のプレビューです。',
  'multi': 'Hello! 你好！こんにちは！This is a multilingual preview.'
};

// 获取试听文本
function getPreviewText(languageCode: string): string {
  if (languageCode.startsWith('en')) return PREVIEW_TEXTS['en-US'];
  if (languageCode.startsWith('cmn') || languageCode.startsWith('zh')) return PREVIEW_TEXTS['cmn-CN'];
  if (languageCode.startsWith('ja')) return PREVIEW_TEXTS['ja-JP'];
  return PREVIEW_TEXTS['multi'];
}

// 获取音色配置
function getVoiceConfig(voiceName: string, languageCode: string) {
  // 免费音色使用传统 TTS
  if (voiceName.includes('Free')) {
    return {
      languageCode: languageCode === 'multi' ? 'en-US' : languageCode,
      name: 'en-US-Neural2-A', // 使用免费的传统音色
      modelName: undefined
    };
  }
  
  // Gemini 音色
  if (voiceName.includes('Gemini') || voiceName.includes('Kore') || voiceName.includes('Orus')) {
    return {
      languageCode: 'en-US',
      name: voiceName,
      modelName: 'gemini-2.5-flash-preview-tts'
    };
  }
  
  // Chirp3-HD 音色
  if (voiceName.includes('Chirp3-HD')) {
    return {
      languageCode: languageCode === 'multi' ? 'en-US' : languageCode,
      name: voiceName,
      modelName: 'chirp3-hd'
    };
  }
  
  // 其他音色
  return {
    languageCode: languageCode === 'multi' ? 'en-US' : languageCode,
    name: voiceName,
    modelName: undefined
  };
}

export async function POST(req: NextRequest) {
  try {
    const { voiceName, languageCode } = await req.json();
    
    if (!voiceName || !languageCode) {
      return NextResponse.json(
        { success: false, error: 'Missing voiceName or languageCode' },
        { status: 400 }
      );
    }

    const previewText = getPreviewText(languageCode);
    const voiceConfig = getVoiceConfig(voiceName, languageCode);
    
    // 创建 TTS 请求
    const request = {
      input: { text: previewText },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: 1.0,
        pitch: 0.0
      }
    };

    // 添加模型名称（如果需要）
    if (voiceConfig.modelName) {
      (request as any).model = `models/${voiceConfig.modelName}`;
    }

    const client = makeClient();
    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content received');
    }

    // 返回音频数据
    return new NextResponse(response.audioContent, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': response.audioContent.length.toString(),
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
      },
    });

  } catch (error: any) {
    console.error('Voice preview error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate voice preview',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
