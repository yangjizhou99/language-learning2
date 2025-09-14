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
    
    // 使用与试听API相同的认证逻辑
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
      const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
      return new TextToSpeechClient({ credentials, projectId });
    }
    
    const client = makeClient();
    
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
    
    // 5. 准备Gemini音色数据（60个音色：30个Flash + 30个Pro）
    const geminiVoices = [
      // 英语 Gemini TTS Flash音色（经济实惠、日常应用）
      { name: 'Gemini-Flash-Achernar', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Achird', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Algenib', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Algieba', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Alnilam', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Aoede', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Autonoe', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Callirrhoe', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Charon', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Despina', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Enceladus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Erinome', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Fenrir', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Gacrux', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Iapetus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Kore', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Laomedeia', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Leda', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Orus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Pulcherrima', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Puck', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Rasalgethi', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Sadachbia', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Sadaltager', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Schedar', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Sulafat', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Umbriel', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Vindemiatrix', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Zephyr', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Flash-Zubenelgenubi', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      
      // 英语 Gemini TTS Pro音色（专业应用、高质量控制）
      { name: 'Gemini-Pro-Achernar', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Achird', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Algenib', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Algieba', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Alnilam', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Aoede', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Autonoe', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Callirrhoe', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Charon', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Despina', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Enceladus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Erinome', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Fenrir', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Gacrux', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Iapetus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Kore', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Laomedeia', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Leda', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Orus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Pulcherrima', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Puck', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Rasalgethi', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Sadachbia', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Sadaltager', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Schedar', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Sulafat', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Umbriel', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Vindemiatrix', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Zephyr', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000 },
      { name: 'Gemini-Pro-Zubenelgenubi', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000 }
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
  'Gemini-Flash': { pricePerMillionChars: 10 }, // Neural2的1.25倍: 8 * 1.25 = 10
  'Gemini-Pro': { pricePerMillionChars: 20 }, // Neural2的2.5倍: 8 * 2.5 = 20
  'Other': { pricePerMillionChars: 4 }
};

function getVoicePricing(voiceName: string) {
  if (voiceName.includes('Chirp3-HD')) return VOICE_PRICING['Chirp3-HD'];
  if (voiceName.includes('Neural2')) return VOICE_PRICING['Neural2'];
  if (voiceName.includes('Wavenet')) return VOICE_PRICING['Wavenet'];
  if (voiceName.includes('Standard')) return VOICE_PRICING['Standard'];
  if (voiceName.includes('Gemini-Flash')) return VOICE_PRICING['Gemini-Flash'];
  if (voiceName.includes('Gemini-Pro')) return VOICE_PRICING['Gemini-Pro'];
  if (voiceName.includes('Gemini') || voiceName === 'Kore' || voiceName === 'Orus' || voiceName === 'Callirrhoe' || voiceName === 'Puck') return VOICE_PRICING['Gemini-Flash']; // 默认为Flash
  return VOICE_PRICING['Other'];
}

function generateVoiceCharacteristics(voice: any) {
  // 兼容不同的字段名
  const ssmlGender = voice.ssml_gender || voice.ssmlGender;
  const gender = ssmlGender === 'MALE' ? '男性' : '女性';
  return {
    voiceType: gender,
    tone: ssmlGender === 'MALE' ? '男声' : '女声',
    pitch: ssmlGender === 'MALE' ? '中低音' : '中高音'
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
  } else if (voiceName.includes('Gemini-Pro')) {
    return 'AI增强、专业应用、高质量控制';
  } else if (voiceName.includes('Gemini-Flash')) {
    return 'AI增强、经济实惠、日常应用';
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
  } else if (voiceName.includes('Gemini-Pro')) {
    return `Gemini-Pro-${genderPrefix}`;
  } else if (voiceName.includes('Gemini-Flash')) {
    return `Gemini-Flash-${genderPrefix}`;
  } else if (voiceName.includes('Gemini') || voiceName === 'Kore' || voiceName === 'Orus' || voiceName === 'Callirrhoe' || voiceName === 'Puck') {
    return `Gemini-Flash-${genderPrefix}`; // 默认为Flash
  } else {
    return `Other-${genderPrefix}`;
  }
}

function generateDisplayName(voiceName: string, languageCode: string): string {
  return voiceName;
}
