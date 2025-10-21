import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    // 检查环境变量
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ 
        error: 'Missing environment variables',
        supabaseUrl: !!supabaseUrl,
        serviceKey: !!serviceKey
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, serviceKey);
    
    // 查询shadowing_items表，只获取音频相关字段
    const { data, error } = await supabase
      .from('shadowing_items')
      .select('id, lang, title, audio_url, audio_bucket, audio_path, notes')
      .limit(5);
    
    if (error) {
      return NextResponse.json({ 
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      count: data?.length || 0,
      items: data?.map(item => ({
        id: item.id,
        lang: item.lang,
        title: item.title,
        audio_url: item.audio_url,
        audio_bucket: item.audio_bucket,
        audio_path: item.audio_path,
        notes_audio_url: item.notes?.audio_url,
        has_audio: !!(item.audio_url || item.notes?.audio_url || (item.audio_bucket && item.audio_path))
      })) || []
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
