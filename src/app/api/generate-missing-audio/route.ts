import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { synthesizeTTS } from '@/lib/tts';
import { uploadAudioFile } from '@/lib/storage-upload';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 获取所有没有音频的shadowing_items
    const { data: items, error } = await supabase
      .from('shadowing_items')
      .select('id, lang, title, text, audio_url, audio_bucket, audio_path')
      .or('audio_url.is.null,audio_url.eq.')
      .limit(10); // 限制处理数量
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!items || items.length === 0) {
      return NextResponse.json({ message: '没有需要生成音频的项目' });
    }
    
    const results = [];
    
    for (const item of items) {
      try {
        // 根据语言选择语音
        let voice = 'alloy'; // 默认英语语音
        if (item.lang === 'zh') voice = 'nova';
        else if (item.lang === 'ja') voice = 'nova';
        else if (item.lang === 'ko') voice = 'nova';
        
        console.log(`为项目 ${item.id} 生成音频...`);
        
        // 生成TTS音频
        const audioBuffer = await synthesizeTTS({
          text: item.text,
          lang: item.lang,
          voiceName: voice,
          speakingRate: 1.0,
          pitch: 0
        });
        
        // 上传音频文件
        const audioPath = `shadowing/${item.id}.mp3`;
        const uploadResult = await uploadAudioFile('tts', audioPath, audioBuffer);
        
        if (!uploadResult.success || !uploadResult.url) {
          throw new Error(uploadResult.error || '音频上传失败');
        }
        
        const audioUrl = uploadResult.url;
        
        // 更新数据库
        const { error: updateError } = await supabase
          .from('shadowing_items')
          .update({
            audio_url: audioUrl,
            audio_bucket: 'tts',
            audio_path: audioPath
          })
          .eq('id', item.id);
        
        if (updateError) {
          results.push({ id: item.id, error: updateError.message });
        } else {
          results.push({ id: item.id, success: true, audioUrl });
        }
        
      } catch (error) {
        results.push({ 
          id: item.id, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
