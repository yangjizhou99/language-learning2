export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { synthesizeTTS } from "@/lib/tts";
import { synthesizeGeminiTTS } from "@/lib/gemini-tts";

// 检测是否为对话格式
function isDialogueFormat(text: string): boolean {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  return lines.some(line => /^[A-Z]:\s/.test(line));
}

// 根据音色名称确定提供商
function getProviderFromVoice(voiceName: string): 'google' | 'gemini' {
  // Gemini TTS 音色
  const geminiVoices = [
    'Kore', 'Orus', 'Callirrhoe', 'Puck',
    'cmn-CN-Chirp3-HD-Kore', 'cmn-CN-Chirp3-HD-Orus', 
    'cmn-CN-Chirp3-HD-Callirrhoe', 'cmn-CN-Chirp3-HD-Puck',
    'ja-JP-Neural2-A', 'ja-JP-Neural2-B', 'ja-JP-Neural2-C', 'ja-JP-Neural2-D'
  ];
  
  return geminiVoices.includes(voiceName) ? 'gemini' : 'google';
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { text, lang, voice, speakingRate = 1.0, pitch = 0 } = body;

    if (!text || !lang) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 检查是否为对话格式
    const isDialogue = isDialogueFormat(text);
    
    // 根据音色确定提供商
    const provider = getProviderFromVoice(voice);
    
    console.log(`使用 ${provider} ${isDialogue ? '对话' : '普通'} TTS 合成: ${voice}`);

    let audioBuffer: Buffer;
    let result: any = {};

    if (provider === 'gemini') {
      // 使用 Gemini TTS
      if (isDialogue) {
        // 对话格式使用 Gemini 对话合成
        const { synthesizeGeminiDialogue } = await import('@/lib/gemini-tts');
        const dialogueResult = await synthesizeGeminiDialogue({
          text,
          lang,
          speakingRate,
          pitch
        });
        audioBuffer = dialogueResult.audio;
        result = {
          dialogue_count: dialogueResult.dialogueCount,
          speakers: dialogueResult.speakers,
          is_dialogue: true
        };
      } else {
        // 普通格式使用 Gemini 单句合成
        audioBuffer = await synthesizeGeminiTTS({
          text,
          lang,
          voiceName: voice,
          speakingRate,
          pitch
        });
      }
    } else {
      // 使用 Google TTS
      if (isDialogue) {
        // 对话格式使用 Google 对话合成
        const { synthesizeDialogue } = await import('@/lib/tts');
        const dialogueResult = await synthesizeDialogue({
          text,
          lang,
          speakingRate,
          pitch
        });
        audioBuffer = dialogueResult.audio;
        result = {
          dialogue_count: dialogueResult.dialogueCount,
          speakers: dialogueResult.speakers,
          is_dialogue: true
        };
      } else {
        // 普通格式使用 Google 单句合成
        audioBuffer = await synthesizeTTS({ 
          text, 
          lang, 
          voiceName: voice, 
          speakingRate 
        });
      }
    }

    // 上传到 Supabase Storage
    const supabaseAdmin = getServiceSupabase();
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/${provider}-${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: false });
    if (upErr) return NextResponse.json({ error: `上传失败: ${upErr.message}` }, { status: 500 });

    // 生成签名 URL
    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30 天

    const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = pub?.publicUrl;
    const audioUrl = signed?.signedUrl || publicUrl;
    if (!audioUrl) return NextResponse.json({ error: '获取音频地址失败' }, { status: 500 });

    return NextResponse.json({ 
      ok: true, 
      audio_url: audioUrl, 
      bytes: audioBuffer.length, 
      signed: Boolean(signed?.signedUrl),
      provider,
      voice,
      ...result
    });

  } catch (error: unknown) {
    console.error("统一TTS合成失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message || "服务器错误" }, { status: 500 });
  }
}
