export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

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
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

// 音色价格信息（基于 Google Cloud TTS 定价）
const VOICE_PRICING = {
  // Chirp3-HD 系列 - 最高质量，最贵
  'Chirp3-HD': {
    pricePerMillionChars: 16.00, // $16 per million characters
    quality: '最高质量',
    description: '最新 AI 模型，自然度最高'
  },
  // Neural2 系列 - 高质量
  'Neural2': {
    pricePerMillionChars: 16.00, // $16 per million characters
    quality: '高质量',
    description: '神经网络模型，质量很好'
  },
  // Wavenet 系列 - 高质量
  'Wavenet': {
    pricePerMillionChars: 16.00, // $16 per million characters
    quality: '高质量',
    description: 'WaveNet 模型，质量良好'
  },
  // Standard 系列 - 基础质量
  'Standard': {
    pricePerMillionChars: 4.00, // $4 per million characters
    quality: '基础质量',
    description: '标准模型，成本较低'
  },
  // 免费音色系列 - 完全免费
  'Free': {
    pricePerMillionChars: 0.00, // 完全免费
    quality: '免费质量',
    description: '开源免费音色，无使用限制'
  }
};

function getVoicePricing(voiceName: string) {
  if (voiceName.includes('Free') || voiceName.includes('free') || voiceName.includes('Browser-')) return VOICE_PRICING['Free'];
  if (voiceName.includes('Chirp3-HD')) return VOICE_PRICING['Chirp3-HD'];
  if (voiceName.includes('Neural2')) return VOICE_PRICING['Neural2'];
  if (voiceName.includes('Wavenet')) return VOICE_PRICING['Wavenet'];
  if (voiceName.includes('Standard')) return VOICE_PRICING['Standard'];
  return VOICE_PRICING['Standard']; // 默认
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
    useCase = '专业播报、高质量内容';
    personality = '专业、自然、可信';
  } else if (name.includes('Neural2')) {
    tone = '清晰自然';
    useCase = '教育内容、商务应用';
    personality = '专业、友好';
  } else if (name.includes('Wavenet')) {
    tone = '清晰标准';
    useCase = '通用内容、客服语音';
    personality = '专业、可靠';
  } else if (name.includes('Standard')) {
    tone = '基础清晰';
    useCase = '基础应用、简单播报';
    personality = '简单、直接';
  }
  
  // 根据性别调整音调和年龄范围
  if (gender === 'FEMALE') {
    pitch = '中高音';
    ageRange = '20-40岁';
  } else if (gender === 'MALE') {
    pitch = '中低音';
    ageRange = '25-50岁';
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
    personality
  };
}

function categorizeVoices(voices: any[]) {
  const categories: any = {
    'Free': [],
    'Chirp3-HD': [],
    'Neural2': [],
    'Wavenet': [],
    'Standard': [],
    'Other': []
  };

  voices.forEach(voice => {
    const name = voice.name;
    if (name.includes('Free') || name.includes('free') || name.includes('Browser-')) {
      categories['Free'].push(voice);
    } else if (name.includes('Chirp3-HD')) {
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
    const lang = searchParams.get("lang") || "all";
    const category = searchParams.get("category") || "all";

    let voices = [];
    
    // 获取音色数据
    if (category === "Free") {
      // 获取免费音色
      const freeVoicesResponse = await fetch(`${req.nextUrl.origin}/api/admin/shadowing/free-voices?lang=${lang}`);
      const freeVoicesData = await freeVoicesResponse.json();
      if (freeVoicesData.success) {
        voices = freeVoicesData.voices;
      }
    } else {
      // 获取 Google Cloud TTS 音色
      const client = makeClient();
      
      if (lang === "all") {
        const [res] = await client.listVoices({});
        voices = res.voices || [];
      } else {
        const [res] = await client.listVoices({ languageCode: lang });
        voices = res.voices || [];
      }
    }

    // 处理音色数据
    const processedVoices = voices.map((voice: any) => {
      const voiceName = voice.name;
      // 对于免费音色，使用正确的语言代码
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
          description: pricing.description
        },
        // 计算示例价格（基于1000字符）
        examplePrice: (pricing.pricePerMillionChars / 1000000 * 1000).toFixed(4),
        // 使用原始特征信息（如果存在）或生成新的
        characteristics: voice.characteristics || generateVoiceCharacteristics({
          name: voiceName,
          ssmlGender: voice.ssmlGender,
          languageCode
        })
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
    if (category !== "all" && categorizedVoices[category]) {
      return NextResponse.json({ 
        success: true,
        voices: categorizedVoices[category],
        groupedByLanguage,
        categorizedVoices,
        totalVoices: categorizedVoices[category].length,
        category,
        pricing: VOICE_PRICING
      });
    }

    return NextResponse.json({ 
      success: true,
      voices: processedVoices,
      groupedByLanguage,
      categorizedVoices,
      totalVoices: voices.length,
      pricing: VOICE_PRICING
    });

  } catch (error: unknown) {
    console.error("获取音色列表失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: message
    }, { status: 500 });
  }
}
