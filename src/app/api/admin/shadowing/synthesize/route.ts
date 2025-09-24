export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { synthesizeTTS } from '@/lib/tts';
import { uploadAudioFile } from '@/lib/storage-upload';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { text, lang, voice, speakingRate = 1.0, pitch = 0 } = body;

    console.log('合成API接收到的参数:', {
      text: text.substring(0, 50) + '...',
      lang,
      voice,
      speakingRate,
      pitch,
    });

    if (!text || !lang || !voice) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 直接调用合成函数，借鉴成功的 /api/tts 实现
    console.log('直接调用synthesizeTTS:', {
      text: text.substring(0, 50) + '...',
      lang,
      voiceName: voice,
      speakingRate,
      pitch,
    });

    // 在单声道合成中，移除说话者标识（A:/B:/全角/前置空白或符号）避免读出
    // 兼容 CRLF、前导不可见空白(\uFEFF/\u00A0/\u3000)、引号/点/项目符号等
    const speakerPrefix = /^[\s\uFEFF\u00A0\u3000"'“”‘’·•\-–—]*([A-Za-z\uFF21-\uFF3A])\s*[\:\uFF1A]\s*/i;
    const cleanedText = String(text)
      .split(/\r?\n/)
      .map((line) => line.replace(speakerPrefix, '').trim())
      .join('\n');

    const audioBuffer = await synthesizeTTS({ text: cleanedText, lang, voiceName: voice, speakingRate, pitch });

    // 上传到 Supabase Storage（使用新的上传函数）
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;

    const uploadResult = await uploadAudioFile(bucket, filePath, audioBuffer);
    if (!uploadResult.success) {
      return NextResponse.json({ error: `上传失败: ${uploadResult.error}` }, { status: 500 });
    }

    // 优先使用代理路由 URL（推荐）
    const audioUrl = uploadResult.proxyUrl || uploadResult.url;
    if (!audioUrl) return NextResponse.json({ error: '获取音频地址失败' }, { status: 500 });

    return NextResponse.json({
      ok: true,
      audio_url: audioUrl,
      bytes: audioBuffer.length,
      proxy_url: uploadResult.proxyUrl,
      direct_url: uploadResult.url,
    });
  } catch (error: unknown) {
    console.error('音频合成失败:', error);
    const message =
      error instanceof Error
        ? error instanceof Error
          ? error.message
          : String(error)
        : String(error);
    return NextResponse.json({ error: message || '服务器错误' }, { status: 500 });
  }
}
