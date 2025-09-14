import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    console.log('Simple setup database API called');
    
    const supabase = getServiceSupabase();
    
    console.log('开始设置数据库...');
    
    // 1. 添加provider字段
    console.log('添加provider字段...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.voices 
        ADD COLUMN IF NOT EXISTS provider text default 'google' 
        CHECK (provider in ('google', 'gemini'));
      `
    });
    
    if (alterError) {
      console.log('Provider字段可能已存在:', alterError.message);
    } else {
      console.log('Provider字段添加成功');
    }
    
    // 2. 添加索引
    console.log('添加provider索引...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `CREATE INDEX IF NOT EXISTS idx_voices_provider ON public.voices(provider);`
    });
    
    if (indexError) {
      console.log('索引可能已存在:', indexError.message);
    } else {
      console.log('Provider索引添加成功');
    }
    
    // 3. 更新现有音色
    console.log('更新现有音色...');
    const { error: updateError } = await supabase
      .from('voices')
      .update({ provider: 'google' })
      .is('provider', null);
    
    if (updateError) {
      console.log('更新现有音色失败:', updateError.message);
    } else {
      console.log('现有音色更新成功');
    }
    
        // 4. 添加Gemini音色（只保留真正的英语Gemini音色）
        console.log('添加Gemini音色...');
        const geminiVoices = [
          // 英语 Gemini TTS 音色（真正的AI增强音色）
          { name: 'Gemini-Kore', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000, pricing: { pricePerMillionChars: 20, examplePrice: "0.0200", examplePrice10k: "2.00" }, characteristics: { voiceType: "女性", tone: "女声", pitch: "中高音" }, display_name: 'Kore (Gemini)', category: 'Gemini-Female', provider: 'gemini', useCase: 'AI增强、创新应用', is_active: true },
          { name: 'Gemini-Orus', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000, pricing: { pricePerMillionChars: 20, examplePrice: "0.0200", examplePrice10k: "2.00" }, characteristics: { voiceType: "男性", tone: "男声", pitch: "中低音" }, display_name: 'Orus (Gemini)', category: 'Gemini-Male', provider: 'gemini', useCase: 'AI增强、创新应用', is_active: true },
          { name: 'Gemini-Callirrhoe', language_code: 'en-US', ssml_gender: 'FEMALE', natural_sample_rate_hertz: 24000, pricing: { pricePerMillionChars: 20, examplePrice: "0.0200", examplePrice10k: "2.00" }, characteristics: { voiceType: "女性", tone: "女声", pitch: "中高音" }, display_name: 'Callirrhoe (Gemini)', category: 'Gemini-Female', provider: 'gemini', useCase: 'AI增强、创新应用', is_active: true },
          { name: 'Gemini-Puck', language_code: 'en-US', ssml_gender: 'MALE', natural_sample_rate_hertz: 24000, pricing: { pricePerMillionChars: 20, examplePrice: "0.0200", examplePrice10k: "2.00" }, characteristics: { voiceType: "男性", tone: "男声", pitch: "中低音" }, display_name: 'Puck (Gemini)', category: 'Gemini-Male', provider: 'gemini', useCase: 'AI增强、创新应用', is_active: true }
        ];
    
    const { data: insertData, error: insertError } = await supabase
      .from('voices')
      .upsert(geminiVoices, { onConflict: 'name' })
      .select();
    
    if (insertError) {
      console.error('插入Gemini音色失败:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: '插入Gemini音色失败', 
        details: insertError.message 
      }, { status: 500 });
    }
    
    console.log(`成功添加 ${insertData?.length || 0} 个Gemini音色`);
    
    // 5. 检查最终结果
    const { data: allVoices, error: countError } = await supabase
      .from('voices')
      .select('id, name, provider, category')
      .eq('is_active', true);
    
    if (countError) {
      console.error('查询音色失败:', countError);
    } else {
      console.log(`数据库中共有 ${allVoices?.length || 0} 个音色`);
      const providerCounts = allVoices?.reduce((acc: any, voice: any) => {
        acc[voice.provider] = (acc[voice.provider] || 0) + 1;
        return acc;
      }, {}) || {};
      console.log('提供商分布:', providerCounts);
    }
    
    return NextResponse.json({
      success: true,
      message: '数据库设置完成',
      geminiVoicesAdded: insertData?.length || 0,
      totalVoices: allVoices?.length || 0,
      providerCounts: allVoices?.reduce((acc: any, voice: any) => {
        acc[voice.provider] = (acc[voice.provider] || 0) + 1;
        return acc;
      }, {}) || {}
    });
    
  } catch (error) {
    console.error('数据库设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '数据库设置失败', 
      details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)
    }, { status: 500 });
  }
}
