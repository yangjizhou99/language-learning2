import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    console.log('恢复所有音色API调用');
    
    const supabase = getServiceSupabase();
    
    // 1. 先清空所有音色
    console.log('清空所有音色...');
    const { error: deleteError } = await supabase
      .from('voices')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('清空音色失败:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: '清空音色失败', 
        details: deleteError.message 
      }, { status: 500 });
    }
    
    console.log('音色清空成功');
    
    // 2. 重新获取Google Cloud TTS音色
    console.log('获取Google Cloud TTS音色...');
    const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
    
    let credentials;
    if (process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
      credentials = {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };
    } else if (process.env.GOOGLE_TTS_CREDENTIALS) {
      const fs = require('fs');
      const path = require('path');
      const serviceAccountPath = path.resolve(process.env.GOOGLE_TTS_CREDENTIALS);
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      credentials = {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      };
    } else {
      throw new Error('Google Cloud TTS credentials not found');
    }
    
    const client = new TextToSpeechClient({
      credentials,
      projectId: process.env.GOOGLE_TTS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    
    const [res] = await client.listVoices({});
    const allVoices = res.voices || [];
    
    console.log(`从Google Cloud TTS获取到 ${allVoices.length} 个音色`);
    
    // 3. 筛选中英日音色
    const targetLanguages = ['cmn-CN', 'cmn-TW', 'en-US', 'ja-JP'];
    const filteredVoices = allVoices.filter((voice: any) => {
      const voiceLang = voice.languageCode || voice.languageCodes?.[0];
      return targetLanguages.includes(voiceLang);
    });
    
    console.log(`筛选出 ${filteredVoices.length} 个目标语言音色`);
    
    // 4. 准备Google音色数据
    const voiceData = filteredVoices.map((voice: any) => {
      const voiceLang = voice.languageCode || voice.languageCodes?.[0];
      const pricing = getVoicePricing(voice.name);
      const characteristics = generateVoiceCharacteristics(voice);
      const category = getVoiceCategory(voice.name, voice.ssmlGender);
      const displayName = generateDisplayName(voice.name, voiceLang);
      const useCase = generateUseCase(voice.name);
      
      return {
        name: voice.name,
        language_code: voiceLang,
        ssml_gender: voice.ssmlGender,
        natural_sample_rate_hertz: voice.naturalSampleRateHertz,
        pricing: {
          pricePerMillionChars: pricing.pricePerMillionChars,
          examplePrice: (pricing.pricePerMillionChars / 1000).toFixed(4),
          examplePrice10k: (pricing.pricePerMillionChars / 100).toFixed(2)
        },
        characteristics,
        display_name: displayName,
        category,
        provider: 'google',
        is_active: true
      };
    });
    
    // 5. 准备Gemini音色数据（只保留真正的英语Gemini音色）
    const geminiVoices = [
      // 英语 Gemini TTS 音色（真正的AI增强音色）
      { name: 'Gemini-Kore', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Orus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Callirrhoe', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Puck', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 }
    ];
    
    const geminiVoiceData = geminiVoices.map((voice: any) => {
      const pricing = getVoicePricing(voice.name);
      const characteristics = generateVoiceCharacteristics(voice);
      const category = getVoiceCategory(voice.name, voice.ssml_gender);
      const displayName = generateDisplayName(voice.name, voice.language_code);
      const useCase = generateUseCase(voice.name);
      
      return {
        name: voice.name,
        language_code: voice.language_code,
        ssml_gender: voice.ssml_gender,
        natural_sample_rate_hertz: voice.natural_sample_rate_hertz,
        pricing: {
          pricePerMillionChars: pricing.pricePerMillionChars,
          examplePrice: (pricing.pricePerMillionChars / 1000).toFixed(4),
          examplePrice10k: (pricing.pricePerMillionChars / 100).toFixed(2)
        },
        characteristics,
        display_name: displayName,
        category,
        provider: 'gemini',
        is_active: true
      };
    });
    
    // 6. 合并所有音色数据
    const allVoiceData = [...voiceData, ...geminiVoiceData];
    
    console.log(`准备插入 ${allVoiceData.length} 个音色 (Google: ${voiceData.length}, Gemini: ${geminiVoiceData.length})`);
    
    // 7. 批量插入所有音色（使用upsert避免重复键冲突）
    const { data: insertData, error: insertError } = await supabase
      .from('voices')
      .upsert(allVoiceData, { onConflict: 'name' })
      .select();
    
    if (insertError) {
      console.error('插入音色失败:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: '插入音色失败', 
        details: insertError.message 
      }, { status: 500 });
    }
    
    console.log(`成功插入 ${insertData?.length || 0} 个音色`);
    
    // 8. 统计结果
    const stats = allVoiceData.reduce((acc: any, voice: any) => {
      const lang = voice.language_code;
      if (!acc[lang]) acc[lang] = 0;
      acc[lang]++;
      return acc;
    }, {});
    
    const providerStats = allVoiceData.reduce((acc: any, voice: any) => {
      const provider = voice.provider;
      if (!acc[provider]) acc[provider] = 0;
      acc[provider]++;
      return acc;
    }, {});
    
    return NextResponse.json({
      success: true,
      message: `成功恢复 ${allVoiceData.length} 个音色`,
      stats,
      providerStats,
      totalVoices: allVoiceData.length,
      googleVoices: voiceData.length,
      geminiVoices: geminiVoiceData.length
    });
    
  } catch (error) {
    console.error('恢复音色失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '恢复音色失败', 
      details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)
    }, { status: 500 });
  }
}

// 辅助函数
const VOICE_PRICING = {
  'Chirp3-HD': { pricePerMillionChars: 16 },
  'Neural2': { pricePerMillionChars: 8 },
  'Wavenet': { pricePerMillionChars: 4 },
  'Standard': { pricePerMillionChars: 4 },
  'Gemini': { pricePerMillionChars: 20 },
  'Other': { pricePerMillionChars: 4 }
};

function getVoicePricing(voiceName: string) {
  if (voiceName.includes('Chirp3-HD')) return VOICE_PRICING['Chirp3-HD'];
  if (voiceName.includes('Neural2')) return VOICE_PRICING['Neural2'];
  if (voiceName.includes('Wavenet')) return VOICE_PRICING['Wavenet'];
  if (voiceName.includes('Standard')) return VOICE_PRICING['Standard'];
  if (voiceName.includes('Gemini') || voiceName === 'Kore' || voiceName === 'Orus' || voiceName === 'Callirrhoe' || voiceName === 'Puck') return VOICE_PRICING['Gemini'];
  return VOICE_PRICING['Other'];
}

function generateVoiceCharacteristics(voice: any) {
  const gender = voice.ssmlGender === 'MALE' ? '男性' : '女性';
  return {
    voiceType: gender,
    tone: voice.ssmlGender === 'MALE' ? '男声' : '女声',
    pitch: voice.ssmlGender === 'MALE' ? '中低音' : '中高音'
  };
}

// 生成使用场景描述
function generateUseCase(voiceName: string) {
  if (voiceName.includes('Chirp3-HD')) {
    return '专业播报、高质量';
  } else if (voiceName.includes('Neural2')) {
    return '自然流畅、高质量';
  } else if (voiceName.includes('Wavenet')) {
    return '平衡性能、中高质量';
  } else if (voiceName.includes('Standard')) {
    return '基础应用、成本优化';
  } else if (voiceName.includes('Gemini')) {
    return 'AI增强、创新应用';
  } else {
    return '通用场景';
  }
}

function getVoiceCategory(voiceName: string, gender: string): string {
  const isFemale = gender === 'FEMALE';
  const genderPrefix = isFemale ? 'Female' : 'Male';
  
  if (voiceName.includes('Chirp3-HD')) {
    return `Chirp3HD-${genderPrefix}`;
  } else if (voiceName.includes('Neural2')) {
    return `Neural2-${genderPrefix}`;
  } else if (voiceName.includes('Wavenet')) {
    return `Wavenet-${genderPrefix}`;
  } else if (voiceName.includes('Standard')) {
    return `Standard-${genderPrefix}`;
  } else if (voiceName.includes('Gemini') || voiceName === 'Kore' || voiceName === 'Orus' || voiceName === 'Callirrhoe' || voiceName === 'Puck') {
    return `Gemini-${genderPrefix}`;
  } else {
    return `Other-${genderPrefix}`;
  }
}

function generateDisplayName(voiceName: string, languageCode: string): string {
  return voiceName;
}
