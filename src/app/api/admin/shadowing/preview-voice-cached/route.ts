import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';

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
  // 免费音色 - 使用浏览器 TTS
  if (voiceName.includes('Browser-')) {
    // 这些是真正的免费音色，使用浏览器 TTS
    // 暂时返回错误，提示使用专门的免费音色试听 API
    throw new Error('Please use /api/admin/shadowing/preview-free-voice for free voices');
  }
  
  // 标准音色 - 为不同音色分配不同的Google Cloud TTS音色
  if (voiceName.includes('Free') || voiceName.includes('Standard') || voiceName.includes('Wavenet')) {
    const ttsLanguageCode = languageCode === 'cmn-CN' ? 'cmn-cn' : 
                           languageCode === 'multi' ? 'en-US' : languageCode;
    
    // 根据音色名称分配不同的Google Cloud TTS音色
    let actualVoiceName;
    if (ttsLanguageCode === 'cmn-cn') {
      // 中文音色分配
      if (voiceName.includes('Standard-CN-Female-1')) {
        actualVoiceName = 'cmn-CN-Standard-A'; // 女性标准音色A
      } else if (voiceName.includes('Standard-CN-Male-1')) {
        actualVoiceName = 'cmn-CN-Standard-B'; // 男性标准音色B
      } else if (voiceName.includes('Standard-CN-Female-2')) {
        actualVoiceName = 'cmn-CN-Standard-C'; // 女性标准音色C
      } else if (voiceName.includes('Standard-CN-Male-2')) {
        actualVoiceName = 'cmn-CN-Standard-D'; // 男性标准音色D
      } else if (voiceName.includes('Wavenet-CN-Female-1')) {
        actualVoiceName = 'cmn-CN-Wavenet-A'; // 女性Wavenet音色A
      } else if (voiceName.includes('Wavenet-CN-Male-1')) {
        actualVoiceName = 'cmn-CN-Wavenet-B'; // 男性Wavenet音色B
      } else if (voiceName.includes('Wavenet-CN-Female-2')) {
        actualVoiceName = 'cmn-CN-Wavenet-C'; // 女性Wavenet音色C
      } else if (voiceName.includes('Wavenet-CN-Male-2')) {
        actualVoiceName = 'cmn-CN-Wavenet-D'; // 男性Wavenet音色D
      } else if (voiceName.includes('Standard') && voiceName.includes('Female')) {
        actualVoiceName = 'cmn-CN-Standard-A'; // 女性标准音色
      } else if (voiceName.includes('Standard') && voiceName.includes('Male')) {
        actualVoiceName = 'cmn-CN-Standard-B'; // 男性标准音色
      } else if (voiceName.includes('Wavenet') && voiceName.includes('Female')) {
        actualVoiceName = 'cmn-CN-Wavenet-A'; // 女性Wavenet音色
      } else if (voiceName.includes('Wavenet') && voiceName.includes('Male')) {
        actualVoiceName = 'cmn-CN-Wavenet-B'; // 男性Wavenet音色
      } else if (voiceName.includes('Female-1')) {
        actualVoiceName = 'cmn-CN-Standard-A'; // 女性标准音色
      } else if (voiceName.includes('Male-1')) {
        actualVoiceName = 'cmn-CN-Standard-B'; // 男性标准音色
      } else if (voiceName.includes('Female-2')) {
        actualVoiceName = 'cmn-CN-Wavenet-A'; // 女性Wavenet音色
      } else if (voiceName.includes('Male-2')) {
        actualVoiceName = 'cmn-CN-Wavenet-B'; // 男性Wavenet音色
      } else {
        actualVoiceName = 'cmn-CN-Standard-A'; // 默认
      }
    } else if (ttsLanguageCode === 'en-US') {
      // 英文音色分配 - 使用实际存在的音色
      if (voiceName.includes('Female-1')) {
        actualVoiceName = 'en-US-Standard-A'; // 女性标准音色
      } else if (voiceName.includes('Male-1')) {
        actualVoiceName = 'en-US-Standard-B'; // 男性标准音色
      } else if (voiceName.includes('Female-2')) {
        actualVoiceName = 'en-US-Wavenet-A'; // 女性Wavenet音色
      } else if (voiceName.includes('Male-2')) {
        actualVoiceName = 'en-US-Wavenet-B'; // 男性Wavenet音色
      } else {
        actualVoiceName = 'en-US-Standard-A'; // 默认
      }
    } else if (ttsLanguageCode === 'ja-JP') {
      // 日语音色分配
      if (voiceName.includes('Female-1')) {
        actualVoiceName = 'ja-JP-Neural2-A'; // 女性Neural2音色
      } else if (voiceName.includes('Male-1')) {
        actualVoiceName = 'ja-JP-Neural2-B'; // 男性Neural2音色
      } else {
        actualVoiceName = 'ja-JP-Neural2-A'; // 默认
      }
    } else {
      // 多语言音色
      actualVoiceName = 'en-US-Neural2-A';
    }
    
    return {
      languageCode: ttsLanguageCode,
      name: actualVoiceName,
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
    const ttsLanguageCode = languageCode === 'cmn-CN' ? 'cmn-cn' : 
                           languageCode === 'multi' ? 'en-US' : languageCode;
    return {
      languageCode: ttsLanguageCode,
      name: voiceName,
      modelName: 'chirp3-hd'
    };
  }
  
  // 其他音色
  const ttsLanguageCode = languageCode === 'cmn-CN' ? 'cmn-cn' : 
                         languageCode === 'multi' ? 'en-US' : languageCode;
  return {
    languageCode: ttsLanguageCode,
    name: voiceName,
    modelName: undefined
  };
}

// 生成缓存键
function generateCacheKey(voiceName: string, languageCode: string): string {
  const voiceConfig = getVoiceConfig(voiceName, languageCode);
  const previewText = getPreviewText(languageCode);
  
  const keyData = {
    voiceName: voiceConfig.name,
    languageCode: voiceConfig.languageCode,
    modelName: voiceConfig.modelName,
    text: previewText,
    speakingRate: 1.0,
    pitch: 0.0
  };
  
  return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
}

export async function OPTIONS(req: NextRequest) {
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
      return NextResponse.json(
        { success: false, error: 'Missing voiceName or languageCode' },
        { status: 400 }
      );
    }

    const cacheKey = generateCacheKey(voiceName, languageCode);
    const supabaseAdmin = getServiceSupabase();
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const filePath = `previews/${cacheKey}.mp3`;

    // 检查缓存是否存在
    const { data: existingFile } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (existingFile) {
      // 返回缓存的音频
      const audioBuffer = await existingFile.arrayBuffer();
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=31536000', // 缓存1年
          'X-Cache': 'HIT',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
      });
    }

    // 缓存不存在，生成新的音频
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

    // 上传到 Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, response.audioContent, {
        contentType: 'audio/mpeg',
        upsert: true // 允许覆盖
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // 即使上传失败，也返回音频内容
    }

    // 返回音频数据
    return new NextResponse(response.audioContent, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': response.audioContent.length.toString(),
        'Cache-Control': 'public, max-age=31536000', // 缓存1年
        'X-Cache': 'MISS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
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
