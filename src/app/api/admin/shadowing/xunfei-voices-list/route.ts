import { NextRequest, NextResponse } from 'next/server';
import { getXunfeiVoices, getXunfeiVoicesByLanguage, getXunfeiVoicesByGender } from '@/lib/xunfei-tts';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language');
    const gender = searchParams.get('gender') as 'male' | 'female' | null;

    let voices = getXunfeiVoices();

    // 根据语言筛选
    if (language && language !== 'all') {
      voices = getXunfeiVoicesByLanguage(language);
    }

    // 根据性别筛选
    if (gender) {
      voices = voices.filter(voice => voice.gender === gender);
    }

    // 转换为数据库格式
    const voiceData = voices.map(voice => ({
      id: `xunfei-${voice.voiceId}`,
      name: voice.displayName,
      voice_name: voice.voiceId,
      language_code: voice.language,
      gender: voice.gender,
      provider: 'xunfei',
      description: voice.description,
      useCase: `科大讯飞${voice.gender === 'male' ? '男声' : '女声'}，${voice.description}`,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    return NextResponse.json({
      success: true,
      voices: voiceData,
      totalVoices: voiceData.length,
      provider: 'xunfei',
      message: `找到 ${voiceData.length} 个科大讯飞音色`
    });

  } catch (error) {
    console.error('获取科大讯飞音色失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取科大讯飞音色失败', 
        details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)
      },
      { status: 500 }
    );
  }
}