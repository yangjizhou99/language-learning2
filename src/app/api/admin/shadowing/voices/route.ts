export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import textToSpeech from '@google-cloud/text-to-speech';

function makeClient() {
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

  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || credentials.project_id;
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

// 音色价格信息（基于 Google Cloud TTS 2024年定价）
const VOICE_PRICING = {
  // Chirp3-HD 系列 - 最高质量，最新AI模型
  'Chirp3-HD': {
    pricePerMillionChars: 16.0, // $16 per million characters
    quality: '最高质量',
    description: '最新 AI 模型，自然度最高，适合专业播报',
  },
  // Neural2 系列 - 高质量神经网络模型
  Neural2: {
    pricePerMillionChars: 16.0, // $16 per million characters
    quality: '高质量',
    description: '神经网络模型，质量优秀，适合教育内容',
  },
  // Wavenet 系列 - 高质量WaveNet模型
  Wavenet: {
    pricePerMillionChars: 16.0, // $16 per million characters
    quality: '高质量',
    description: 'WaveNet 模型，质量良好，适合商务应用',
  },
  // Standard 系列 - 基础质量，成本较低
  Standard: {
    pricePerMillionChars: 4.0, // $4 per million characters
    quality: '基础质量',
    description: '标准模型，成本较低，适合简单应用',
  },
};

function getVoicePricing(voiceName: string) {
  if (voiceName.includes('Chirp3-HD')) return VOICE_PRICING['Chirp3-HD'];
  if (voiceName.includes('Neural2')) return VOICE_PRICING['Neural2'];
  if (voiceName.includes('Wavenet')) return VOICE_PRICING['Wavenet'];
  if (voiceName.includes('Standard')) return VOICE_PRICING['Standard'];
  return VOICE_PRICING['Standard']; // 默认使用Standard定价
}

// 生成音色特征信息
function generateVoiceCharacteristics(voice: any) {
  const name = voice.name;
  const gender = voice.ssmlGender;
  const languageCode = voice.languageCode;

  // 基础特征
  let voiceType = gender === 'FEMALE' ? '女性' : gender === 'MALE' ? '男性' : '中性';
  let tone = '清晰自然';
  let accent = '标准';
  let speed = '中等';
  let pitch = '中音';
  let emotion = '中性';
  let useCase = '通用';
  let ageRange = '20-50岁';
  let personality = '专业';

  // 根据音色名称和语言调整特征
  if (languageCode.startsWith('zh') || languageCode.startsWith('cmn')) {
    accent = '标准普通话';
  } else if (languageCode.startsWith('ja')) {
    accent = '标准日语';
  } else if (languageCode.startsWith('en')) {
    accent = '美式英语';
  }

  // 根据音色质量调整特征
  if (name.includes('Chirp3-HD')) {
    tone = '自然流畅';
    useCase = '专业播报、高质量内容、媒体制作';
    personality = '专业、自然、可信、高端';
    ageRange = '25-45岁';
  } else if (name.includes('Neural2')) {
    tone = '清晰自然';
    useCase = '教育内容、商务应用、培训材料';
    personality = '专业、友好、亲和';
    ageRange = '20-50岁';
  } else if (name.includes('Wavenet')) {
    tone = '清晰标准';
    useCase = '通用内容、客服语音、自动化播报';
    personality = '专业、可靠、稳定';
    ageRange = '25-55岁';
  } else if (name.includes('Standard')) {
    tone = '基础清晰';
    useCase = '基础应用、简单播报、测试用途';
    personality = '简单、直接、实用';
    ageRange = '20-60岁';
  }

  // 根据性别调整音调（年龄范围已在质量分类中设置）
  if (gender === 'FEMALE') {
    pitch = '中高音';
  } else if (gender === 'MALE') {
    pitch = '中低音';
  }

  return {
    voiceType,
    tone,
    accent,
    speed,
    pitch,
    emotion,
    useCase,
    ageRange,
    personality,
  };
}

function categorizeVoices(voices: any[]) {
  const categories: any = {
    'Chirp3-HD': [],
    Neural2: [],
    Wavenet: [],
    Standard: [],
    Other: [],
  };

  voices.forEach((voice) => {
    const name = voice.name;
    if (name.includes('Chirp3-HD')) {
      categories['Chirp3-HD'].push(voice);
    } else if (name.includes('Neural2')) {
      categories['Neural2'].push(voice);
    } else if (name.includes('Wavenet')) {
      categories['Wavenet'].push(voice);
    } else if (name.includes('Standard')) {
      categories['Standard'].push(voice);
    } else {
      categories['Other'].push(voice);
    }
  });

  return categories;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang') || 'all';
    const category = searchParams.get('category') || 'all';

    // 获取 Google Cloud TTS 音色 - 总是获取所有音色，然后筛选
    const client = makeClient();
    const [res] = await client.listVoices({});
    let allVoices = res.voices || [];

    // 根据语言筛选
    let voices = allVoices;
    if (lang !== 'all') {
      voices = allVoices.filter((voice: any) => {
        const voiceLang = voice.languageCode || voice.languageCodes?.[0];
        // 处理语言代码的大小写问题
        if (lang === 'cmn-cn') {
          return voiceLang === 'cmn-CN';
        } else if (lang === 'en-us') {
          return voiceLang === 'en-US';
        } else if (lang === 'ja-jp') {
          return voiceLang === 'ja-JP';
        }
        return voiceLang === lang;
      });
    }

    // 处理音色数据
    const processedVoices = voices.map((voice: any) => {
      const voiceName = voice.name;
      const languageCode = voice.languageCode || voice.languageCodes?.[0] || 'unknown';
      const pricing = getVoicePricing(voiceName);

      return {
        name: voiceName,
        displayName: voice.displayName, // 添加显示名称
        languageCode,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
        supportedEngines: voice.supportedEngines,
        supportedModels: voice.supportedModels,
        pricing: {
          pricePerMillionChars: pricing.pricePerMillionChars,
          quality: pricing.quality,
          description: pricing.description,
        },
        // 计算示例价格（基于1000字符）
        examplePrice: ((pricing.pricePerMillionChars / 1000000) * 1000).toFixed(4),
        // 计算示例价格（基于10000字符，更实用的参考）
        examplePrice10k: ((pricing.pricePerMillionChars / 1000000) * 10000).toFixed(2),
        // 使用原始特征信息（如果存在）或生成新的
        characteristics:
          voice.characteristics ||
          generateVoiceCharacteristics({
            name: voiceName,
            ssmlGender: voice.ssmlGender,
            languageCode,
          }),
      };
    });

    // 按语言分组
    const groupedByLanguage = processedVoices.reduce((acc: any, voice: any) => {
      const langCode = voice.languageCode;
      if (!acc[langCode]) acc[langCode] = [];
      acc[langCode].push(voice);
      return acc;
    }, {});

    // 按质量分类
    const categorizedVoices = categorizeVoices(processedVoices);

    // 如果指定了分类，只返回该分类
    if (category !== 'all' && categorizedVoices[category]) {
      return NextResponse.json({
        success: true,
        voices: categorizedVoices[category],
        groupedByLanguage,
        categorizedVoices,
        totalVoices: categorizedVoices[category].length,
        category,
        pricing: VOICE_PRICING,
      });
    }

    return NextResponse.json({
      success: true,
      voices: processedVoices,
      groupedByLanguage,
      categorizedVoices,
      totalVoices: voices.length,
      pricing: VOICE_PRICING,
    });
  } catch (error: unknown) {
    console.error('获取音色列表失败:', error);
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
      },
      { status: 500 },
    );
  }
}
