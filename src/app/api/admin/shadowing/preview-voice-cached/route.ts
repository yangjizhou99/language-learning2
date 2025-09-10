import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import { synthesizeGeminiTTS } from '@/lib/gemini-tts';
import { synthesizeXunfeiTTS } from '@/lib/xunfei-tts';

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
      throw new Error(`Failed to load service account file: ${error instanceof Error ? error.message : String(error)}`);
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

// 生成Gemini TTS预览
async function generateGeminiPreview(voiceName: string, text: string, languageCode: string): Promise<Uint8Array> {
  // 将Gemini音色名称映射到实际的Gemini音色
  const actualVoiceName = voiceName.replace('Gemini-', '');
  
  // Gemini TTS 只支持英语
  const audioBuffer = await synthesizeGeminiTTS({
    text,
    lang: 'en-US',
    voiceName: actualVoiceName,
    speakingRate: 1.0,
    pitch: 0.0
  });

  return new Uint8Array(audioBuffer);
}

// 生成科大讯飞TTS预览
async function generateXunfeiPreview(voiceName: string, text: string, languageCode: string): Promise<Uint8Array> {
  // 将科大讯飞音色名称映射到实际的科大讯飞音色ID
  const actualVoiceId = voiceName.replace('xunfei-', '');
  
  const audioBuffer = await synthesizeXunfeiTTS(text, actualVoiceId, {
    speed: 50,
    volume: 50,
    pitch: 50
  });
  
  // 将PCM数据转换为WAV格式
  return convertPCMToWAV(audioBuffer, 16000);
}

// 将PCM数据转换为WAV格式
function convertPCMToWAV(pcmData: Buffer, sampleRate: number): Uint8Array {
  const length = pcmData.length;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  
  // WAV文件头
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // RIFF标识符
  writeString(0, 'RIFF');
  // 文件长度
  view.setUint32(4, 36 + length, true);
  // WAVE标识符
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  // fmt chunk长度
  view.setUint32(16, 16, true);
  // 音频格式 (PCM)
  view.setUint16(20, 1, true);
  // 声道数
  view.setUint16(22, 1, true);
  // 采样率
  view.setUint32(24, sampleRate, true);
  // 字节率
  view.setUint32(28, sampleRate * 2, true);
  // 块对齐
  view.setUint16(32, 2, true);
  // 位深度
  view.setUint16(34, 16, true);
  // data chunk
  writeString(36, 'data');
  // data chunk长度
  view.setUint32(40, length, true);
  
  // 复制PCM数据
  const uint8Array = new Uint8Array(buffer);
  uint8Array.set(pcmData, 44);
  
  return uint8Array;
}

// 获取音色数据
function getVoiceData(voiceName: string) {
  // 根据音色名称判断TTS提供商
  if (voiceName.startsWith('xunfei-')) {
    return { provider: 'xunfei' };
  } else if (voiceName.startsWith('gemini-')) {
    return { provider: 'gemini' };
  } else {
    return { provider: 'google' };
  }
}

// 生成缓存键
function generateCacheKey(voiceName: string, languageCode: string): string {
  const voiceConfig = getVoiceConfig(voiceName, languageCode);
  const previewText = getPreviewText(languageCode);
  
  // 获取音色数据以确定TTS提供商
  const voiceData = getVoiceData(voiceName);
  
  const keyData = {
    voiceName: voiceConfig.name,
    languageCode: voiceConfig.languageCode,
    modelName: voiceConfig.modelName,
    provider: voiceData?.provider || 'google', // 添加提供商信息
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

    const supabaseAdmin = getServiceSupabase();
    
    // 从数据库获取音色信息，包括provider
    const { data: voiceData, error: voiceError } = await supabaseAdmin
      .from('voices')
      .select('name, provider, language_code, ssml_gender')
      .eq('name', voiceName)
      .single();

    if (voiceError || !voiceData) {
      return NextResponse.json(
        { success: false, error: 'Voice not found in database' },
        { status: 404 }
      );
    }

    const cacheKey = generateCacheKey(voiceName, languageCode);
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
    let audioContent: Uint8Array;

    if (voiceData.provider === 'gemini') {
      // 使用真正的Gemini TTS（只支持英语）
      audioContent = await generateGeminiPreview(voiceName, previewText, languageCode);
    } else if (voiceData.provider === 'xunfei') {
      // 使用科大讯飞TTS
      try {
        audioContent = await generateXunfeiPreview(voiceName, previewText, languageCode);
      } catch (error) {
        // 如果科大讯飞TTS失败，返回一个详细的错误消息
        console.error('科大讯飞TTS试听失败:', error);
        throw new Error(`科大讯飞TTS试听失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      // 使用Google Cloud TTS
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
      
      audioContent = response.audioContent as Uint8Array;
    }

    // 上传到 Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, audioContent, {
        contentType: 'audio/mpeg',
        upsert: true // 允许覆盖
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // 即使上传失败，也返回音频内容
    }

    // 根据TTS提供商确定Content-Type
    let contentType = 'audio/mpeg'; // 默认MP3
    if (voiceData.provider === 'xunfei') {
      contentType = 'audio/wav';
    } else if (voiceData.provider === 'gemini') {
      contentType = 'audio/mpeg';
    }

    // 返回音频数据
    return new NextResponse(audioContent as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioContent.length.toString(),
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
