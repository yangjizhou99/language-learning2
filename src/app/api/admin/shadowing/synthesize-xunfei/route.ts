import { NextRequest, NextResponse } from 'next/server';
import { synthesizeXunfeiTTS, isValidXunfeiVoice } from '@/lib/xunfei-tts';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, speed = 50, volume = 50, pitch = 50 } = await request.json();

    if (!text || !voiceId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: text 和 voiceId' },
        { status: 400 }
      );
    }

    // 验证音色ID
    if (!isValidXunfeiVoice(voiceId)) {
      return NextResponse.json(
        { success: false, error: '无效的科大讯飞音色ID' },
        { status: 400 }
      );
    }

    console.log(`开始科大讯飞TTS合成: ${voiceId}, 文本长度: ${text.length}`);

    // 调用科大讯飞TTS
    const audioBuffer = await synthesizeXunfeiTTS(text, voiceId, {
      speed,
      volume,
      pitch
    });

    console.log(`科大讯飞TTS合成完成，音频大小: ${audioBuffer.length} bytes`);

    // 生成文件名
    const timestamp = Date.now();
    const fileName = `xunfei-${voiceId}-${timestamp}.wav`;

    // 上传到Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('tts-audio')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/wav',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('上传音频失败:', uploadError);
      return NextResponse.json(
        { success: false, error: '上传音频失败', details: uploadError.message },
        { status: 500 }
      );
    }

    // 生成访问URL
    const { data: urlData } = await supabaseAdmin.storage
      .from('tts-audio')
      .createSignedUrl(fileName, 7 * 24 * 60 * 60); // 7天有效期

    if (!urlData?.signedUrl) {
      return NextResponse.json(
        { success: false, error: '生成访问URL失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audioUrl: urlData.signedUrl,
      fileName,
      provider: 'xunfei',
      voiceId,
      duration: Math.round(audioBuffer.length / 32000), // 估算时长
      size: audioBuffer.length
    });

  } catch (error) {
    console.error('科大讯飞TTS合成失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '科大讯飞TTS合成失败', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
