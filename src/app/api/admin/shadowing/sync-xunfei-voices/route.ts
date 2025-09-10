import { NextRequest, NextResponse } from 'next/server';
import { getXunfeiVoices } from '@/lib/xunfei-tts';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('开始同步科大讯飞音色到数据库...');

    const voices = getXunfeiVoices();
    console.log(`找到 ${voices.length} 个科大讯飞音色`);

    // 准备音色数据
    const voiceData = voices.map(voice => ({
      name: `xunfei-${voice.voiceId}`, // 使用name作为唯一标识
      display_name: voice.displayName,
      language_code: voice.language,
      ssml_gender: voice.gender,
      natural_sample_rate_hertz: 16000, // 科大讯飞默认采样率
      pricing: {
        pricePerMillionChars: 0, // 科大讯飞按服务量计费，这里设为0
        examplePrice: "按服务量计费"
      },
      characteristics: {
        voiceType: voice.gender === 'male' ? '男声' : '女声',
        tone: voice.description,
        pitch: '标准'
      },
      category: `Xunfei-${voice.gender === 'male' ? 'Male' : 'Female'}`,
      provider: 'xunfei',
      is_active: true
    }));

    // 批量插入到数据库
    const { data, error } = await supabaseAdmin
      .from('voices')
      .upsert(voiceData, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('插入科大讯飞音色失败:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: '插入科大讯飞音色失败', 
          details: error.message 
        },
        { status: 500 }
      );
    }

    console.log(`成功同步 ${voiceData.length} 个科大讯飞音色到数据库`);

    return NextResponse.json({
      success: true,
      message: `成功同步 ${voiceData.length} 个科大讯飞音色`,
      count: voiceData.length,
      voices: voiceData
    });

  } catch (error) {
    console.error('同步科大讯飞音色失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '同步科大讯飞音色失败', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
