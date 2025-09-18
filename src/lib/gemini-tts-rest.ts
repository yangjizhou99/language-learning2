import { GoogleAuth } from 'google-auth-library';

type GeminiTTSParams = {
  text: string;
  lang: 'ja' | 'en' | 'zh' | string;
  voiceName?: string;
  stylePrompt?: string;
  speakingRate?: number;
  pitch?: number;
};

// 创建 REST API 客户端
async function makeRestClient() {
  // 使用现有的 Google TTS 凭证
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error('GOOGLE_TTS_CREDENTIALS missing');

  let credentials: any;
  try {
    credentials = JSON.parse(raw);
  } catch {
    try {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw new Error(
          'File path not supported in production. Use JSON string in GOOGLE_TTS_CREDENTIALS',
        );
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

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  return client;
}

// 使用 REST API 调用 Gemini TTS
export async function synthesizeGeminiTTSRest({
  text,
  lang,
  voiceName = 'Kore',
  stylePrompt = '以自然、清晰的风格朗读，注意自然停连、口语化',
  speakingRate = 1.0,
  pitch = 0,
}: GeminiTTSParams): Promise<Buffer> {
  const clean = (text || '').trim().slice(0, 4000);
  if (!clean || !lang) throw new Error('missing text/lang');

  const modelName = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';

  const client = await makeRestClient();
  const url = 'https://texttospeech.googleapis.com/v1/text:synthesize';

  const body = {
    input: {
      text: clean,
      prompt: stylePrompt,
    },
    voice: {
      languageCode: 'en-US', // Gemini TTS 目前主要支持英语
      name: voiceName,
      model_name: modelName, // 👈 REST API 使用下划线格式
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1.0,
      pitch: Number.isFinite(pitch) ? pitch : 0,
    },
  };

  console.log('Gemini TTS REST 请求参数:', JSON.stringify(body, null, 2));

  try {
    const res = await client.request({
      url,
      method: 'POST',
      headers: process.env.GOOGLE_TTS_PROJECT_ID
        ? { 'x-goog-user-project': process.env.GOOGLE_TTS_PROJECT_ID }
        : undefined,
      data: body,
    });
    const audioB64 = (res.data as any).audioContent;

    if (!audioB64) throw new Error('no audio content in response');

    const audio = Buffer.from(audioB64, 'base64');
    console.log('Gemini TTS REST 调用成功，音频大小:', audio.length);
    return audio;
  } catch (error) {
    console.error('Gemini TTS REST 调用失败:', error);
    throw error;
  }
}
