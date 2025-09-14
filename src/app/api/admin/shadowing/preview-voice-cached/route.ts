import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { createHash } from 'crypto';
import { synthesizeGeminiTTS } from '@/lib/gemini-tts';
import { synthesizeXunfeiTTS } from '@/lib/xunfei-tts';

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
      throw new Error(`Failed to parse GOOGLE_TTS_CREDENTIALS: ${raw}. Error: ${errorMessage}`);
    }
  }

  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || credentials.project_id;
  return new TextToSpeechClient({ credentials, projectId });
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

// 将简化音色名称映射为完整的Google Cloud TTS音色名称
function mapToFullVoiceName(voiceName: string, languageCode: string): string {
  // 如果已经是完整名称，直接返回
  if (voiceName.includes('-') && voiceName.split('-').length >= 3) {
    return voiceName;
  }
  
  // 简化名称映射到完整的Google Cloud TTS音色名称
  const simplifiedToFull: Record<string, string> = {
    // Chirp3-HD 音色
    'Achernar': 'en-US-Chirp3-HD-Achernar',
    'Achird': 'en-US-Chirp3-HD-Achird', 
    'Algenib': 'en-US-Chirp3-HD-Algenib',
    'Algieba': 'en-US-Chirp3-HD-Algieba',
    'Alnilam': 'en-US-Chirp3-HD-Alnilam',
    'Aoede': 'en-US-Chirp3-HD-Aoede',
    'Autonoe': 'en-US-Chirp3-HD-Autonoe',
    'Callirrhoe': 'en-US-Chirp3-HD-Callirrhoe',
    'Charon': 'en-US-Chirp3-HD-Charon',
    'Despina': 'en-US-Chirp3-HD-Despina',
    'Enceladus': 'en-US-Chirp3-HD-Enceladus',
    'Erinome': 'en-US-Chirp3-HD-Erinome',
    'Fenrir': 'en-US-Chirp3-HD-Fenrir',
    'Gacrux': 'en-US-Chirp3-HD-Gacrux',
    'Iapetus': 'en-US-Chirp3-HD-Iapetus',
    'Laomedeia': 'en-US-Chirp3-HD-Laomedeia',
    'Leda': 'en-US-Chirp3-HD-Leda',
    'Pulcherrima': 'en-US-Chirp3-HD-Pulcherrima',
    'Rasalgethi': 'en-US-Chirp3-HD-Rasalgethi',
    'Sadachbia': 'en-US-Chirp3-HD-Sadachbia',
    'Sadaltager': 'en-US-Chirp3-HD-Sadaltager',
    'Schedar': 'en-US-Chirp3-HD-Schedar',
    'Sulafat': 'en-US-Chirp3-HD-Sulafat',
    'Umbriel': 'en-US-Chirp3-HD-Umbriel',
    'Vindemiatrix': 'en-US-Chirp3-HD-Vindemiatrix',
    'Zephyr': 'en-US-Chirp3-HD-Zephyr',
    'Zubenelgenubi': 'en-US-Chirp3-HD-Zubenelgenubi',
    
    // 其他音色
    'Orus': 'en-US-Chirp3-HD-Orus',
    'Puck': 'en-US-Chirp3-HD-Puck',
    'Kore': 'en-US-Chirp3-HD-Kore',
  };
  
  return simplifiedToFull[voiceName] || voiceName;
}

// 获取音色配置
function getVoiceConfig(voiceName: string, languageCode: string) {
  // 映射简化名称为完整名称
  const fullVoiceName = mapToFullVoiceName(voiceName, languageCode);
  
  const ttsLanguageCode = languageCode === 'cmn-CN' ? 'cmn-cn' : 
                         languageCode === 'multi' ? 'en-US' : languageCode;
  
  // 根据音色类型确定模型
  let modelName = undefined;
  if (fullVoiceName.includes('Chirp3-HD')) {
    modelName = 'chirp3-hd';
  } else if (fullVoiceName.includes('Neural2')) {
    modelName = 'neural2';
  } else if (fullVoiceName.includes('Wavenet')) {
    modelName = 'wavenet';
  } else if (fullVoiceName.includes('Standard')) {
    modelName = 'standard';
  }
  
  return {
    languageCode: ttsLanguageCode,
    name: fullVoiceName,
    modelName: modelName
  };
}

// 生成Gemini TTS预览
async function generateGeminiPreview(voiceName: string, text: string, languageCode: string): Promise<Uint8Array> {
  // 正确处理Gemini音色名称，支持Flash和Pro版本
  let actualVoiceName: string;
  
  if (voiceName.includes('Gemini-Pro-')) {
    actualVoiceName = voiceName.replace('Gemini-Pro-', '');
  } else if (voiceName.includes('Gemini-Flash-')) {
    actualVoiceName = voiceName.replace('Gemini-Flash-', '');
  } else {
    // 兼容旧格式
    actualVoiceName = voiceName.replace('Gemini-', '');
  }
  
  console.log(`Generating Gemini preview: ${voiceName} -> ${actualVoiceName}`);
  
  // Gemini TTS 只支持英语
  const audioBuffer = await synthesizeGeminiTTS({
    text,
    lang: 'en-US',
    voiceName: voiceName, // 传递完整的音色名称，让synthesizeGeminiTTS内部处理
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
  } else if (voiceName.startsWith('Gemini-')) {
    return { provider: 'gemini' };
  } else {
    return { provider: 'google' };
  }
}

// 生成缓存键
function generateCacheKey(voiceName: string, languageCode: string): string {
  const previewText = getPreviewText(languageCode);
  
  // 获取音色数据以确定TTS提供商
  const voiceData = getVoiceData(voiceName);
  
  const keyData = {
    voiceName: voiceName, // 使用完整的音色名称，包括Flash/Pro标识
    languageCode: languageCode,
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
        throw new Error(`科大讯飞TTS试听失败: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`);
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
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
