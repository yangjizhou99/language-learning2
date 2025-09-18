export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// 浏览器 TTS 音色列表（通过 browser-voices API 获取）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang') || 'all';
    const gender = searchParams.get('gender') || 'all';

    // 获取浏览器 TTS 音色
    let browserVoices: Array<Voice> = [];
    try {
      // 转换语言代码：cmn-CN -> zh-CN
      const browserLang = lang === 'cmn-CN' ? 'zh-CN' : lang;
      const browserVoicesResponse = await fetch(
        `${req.nextUrl.origin}/api/admin/shadowing/browser-voices?lang=${browserLang}`,
      );
      const browserVoicesData = await browserVoicesResponse.json();
      browserVoices = browserVoicesData.success ? browserVoicesData.voices : [];

      // 转换浏览器音色的语言代码：zh-CN -> cmn-CN
      browserVoices = browserVoices.map((voice) => ({
        ...voice,
        languageCode: voice.languageCode === 'zh-CN' ? 'cmn-CN' : voice.languageCode,
      }));
    } catch (error) {
      console.warn('Failed to fetch browser voices:', error);
    }

    // 过滤音色
    let filteredVoices = browserVoices;

    if (lang !== 'all') {
      filteredVoices = filteredVoices.filter((voice) => voice.languageCode === lang);
    }

    if (gender !== 'all') {
      filteredVoices = filteredVoices.filter((voice) => voice.ssmlGender === gender.toUpperCase());
    }

    // 按语言分组
    const groupedByLanguage = filteredVoices.reduce((acc: { [key: string]: Voice[] }, voice) => {
      const lang = voice.languageCode;
      if (!acc[lang]) {
        acc[lang] = [];
      }
      acc[lang].push(voice);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      voices: filteredVoices,
      groupedByLanguage,
      totalVoices: filteredVoices.length,
      languages: Object.keys(groupedByLanguage),
      message: '浏览器 TTS 音色列表获取成功',
    });
  } catch (error: unknown) {
    console.error('Error fetching free voices:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取免费音色列表失败',
        details:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : String(error),
      },
      { status: 500 },
    );
  }
}

// 音色接口定义
interface Voice {
  name: string;
  languageCode: string;
  ssmlGender: string;
  naturalSampleRateHertz: number;
  supportedEngines: string[];
  supportedModels: string[];
  pricing: {
    pricePerMillionChars: number;
    quality: string;
    description: string;
  };
  examplePrice: string;
  characteristics: {
    voiceType: string;
    tone: string;
    accent: string;
    speed: string;
    pitch: string;
    emotion: string;
    useCase: string;
    ageRange: string;
    personality: string;
  };
  source: string;
  model: string;
}
