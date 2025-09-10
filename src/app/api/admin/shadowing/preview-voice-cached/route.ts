import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';

// 创建 TTS 客户端
function makeClient() {
  // 尝试从环境变量或服务账户文件获取凭据
  let credentials;
  
  if (process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
    // 使用环境变量
    credentials = {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
  } else if (process.env.GOOGLE_TTS_CREDENTIALS) {
    // 使用服务账户文件
    try {
      const fs = require('fs');
      const path = require('path');
      const serviceAccountPath = path.resolve(process.env.GOOGLE_TTS_CREDENTIALS);
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      credentials = {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      };
    } catch (error) {
      throw new Error(`Failed to load service account file: ${error.message}`);
    }
  } else {
    throw new Error('Google Cloud TTS credentials not found. Please set GOOGLE_CLOUD_CLIENT_EMAIL and GOOGLE_CLOUD_PRIVATE_KEY, or GOOGLE_TTS_CREDENTIALS');
  }
  
  const client = new TextToSpeechClient({
    credentials,
    projectId: process.env.GOOGLE_TTS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID,
  });
  return client;
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
  // 所有音色现在都是Google Cloud TTS的真实音色，直接使用音色名称
  const ttsLanguageCode = languageCode === 'cmn-CN' ? 'cmn-cn' : 
                         languageCode === 'multi' ? 'en-US' : languageCode;
  
  // 根据音色类型确定模型
  let modelName = undefined;
  if (voiceName.includes('Chirp3-HD')) {
    modelName = 'chirp3-hd';
  } else if (voiceName.includes('Neural2')) {
    modelName = 'neural2';
  } else if (voiceName.includes('Wavenet')) {
    modelName = 'wavenet';
  } else if (voiceName.includes('Standard')) {
    modelName = 'standard';
  }
  
  return {
    languageCode: ttsLanguageCode,
    name: voiceName,
    modelName: modelName
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
