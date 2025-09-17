export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { synthesizeTTS } from "@/lib/tts";
import { uploadAudioFile } from "@/lib/storage-upload";

// 解析对话文本，分离不同角色的内容
function parseDialogue(text: string): { speaker: string; content: string }[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const dialogue: { speaker: string; content: string }[] = [];
  
  for (const line of lines) {
    // 匹配 A: 或 B: 格式
    const match = line.match(/^([A-Z]):\s*(.+)$/);
    if (match) {
      dialogue.push({
        speaker: match[1],
        content: match[2].trim()
      });
    }
  }
  
  return dialogue;
}

// 合并音频缓冲区
async function mergeAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error("No audio buffers to merge");
  if (buffers.length === 1) return buffers[0];
  
  try {
    // 尝试使用 ffmpeg 进行音频合并（如果可用）
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // 创建临时目录
    const tempDir = os.tmpdir();
    const inputFiles: string[] = [];
    const outputFile = path.join(tempDir, `merged-${Date.now()}.mp3`);
    
    try {
      // 保存每个音频片段到临时文件
      for (let i = 0; i < buffers.length; i++) {
        const inputFile = path.join(tempDir, `input-${i}-${Date.now()}.mp3`);
        fs.writeFileSync(inputFile, buffers[i]);
        inputFiles.push(inputFile);
      }
      
      // 创建 ffmpeg 命令来合并音频，添加自然间隔
      const inputList = inputFiles.map(file => `file '${file}'`).join('\n');
      const listFile = path.join(tempDir, `list-${Date.now()}.txt`);
      fs.writeFileSync(listFile, inputList);
      
      // 执行 ffmpeg 合并，添加自然间隔
      const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listFile}" -af "apad=pad_len=22050" "${outputFile}" -y`;
      await execAsync(ffmpegCmd);
      
      // 读取合并后的音频
      const mergedBuffer = fs.readFileSync(outputFile);
      
      // 清理临时文件
      [...inputFiles, listFile, outputFile].forEach(file => {
        try { fs.unlinkSync(file); } catch {}
      });
      
      return mergedBuffer;
    } catch (ffmpegError) {
      console.warn('FFmpeg 合并失败，使用简单拼接:', ffmpegError);
      
      // 清理临时文件
      [...inputFiles, outputFile].forEach(file => {
        try { fs.unlinkSync(file); } catch {}
      });
      
      // 回退到简单拼接
      return simpleMerge(buffers);
    }
  } catch (error) {
    console.warn('音频合并失败，使用简单拼接:', error);
    return simpleMerge(buffers);
  }
}

// 简单音频拼接（备用方案）
function simpleMerge(buffers: Buffer[]): Buffer {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const merged = Buffer.alloc(totalLength);
  let offset = 0;
  
  for (const buffer of buffers) {
    buffer.copy(merged, offset);
    offset += buffer.length;
  }
  
  return merged;
}

// 为不同角色分配音色 - 使用更自然的声音
function getVoiceForSpeaker(speaker: string, lang: string): string {
  const voices: Record<string, Record<string, string>> = {
    en: {
      A: "en-US-Neural2-F", // 女性声音 - 更自然
      B: "en-US-Neural2-D", // 男性声音 - 更自然
    },
    ja: {
      A: "ja-JP-Neural2-A", // 女性声音 - 保持原有
      B: "ja-JP-Neural2-D", // 男性声音 - 更自然
    },
    zh: {
      A: "cmn-CN-Neural2-A", // 女性声音 - 使用 Neural2
      B: "cmn-CN-Neural2-B", // 男性声音 - 使用 Neural2
    },
  };
  
  return voices[lang]?.[speaker] || voices[lang]?.A || "en-US-Neural2-F";
}

// 为不同角色分配音色参数
function getVoiceParamsForSpeaker(speaker: string, lang: string): { speakingRate: number; pitch: number } {
  const params: Record<string, Record<string, { speakingRate: number; pitch: number }>> = {
    en: {
      A: { speakingRate: 1.0, pitch: 2.0 }, // 女性声音 - 稍快，音调稍高
      B: { speakingRate: 0.9, pitch: -2.0 }, // 男性声音 - 稍慢，音调稍低
    },
    ja: {
      A: { speakingRate: 1.0, pitch: 1.5 }, // 女性声音
      B: { speakingRate: 0.95, pitch: -1.5 }, // 男性声音
    },
    zh: {
      A: { speakingRate: 1.0, pitch: 1.0 }, // 女性声音
      B: { speakingRate: 0.9, pitch: -1.0 }, // 男性声音
    },
  };
  
  return params[lang]?.[speaker] || params[lang]?.A || { speakingRate: 1.0, pitch: 0 };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { text, lang, speakingRate = 1.0, pitch = 0, volumeGainDb = 0 } = body;

    if (!text || !lang) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 解析对话文本
    const dialogue = parseDialogue(text);
    if (dialogue.length === 0) {
      return NextResponse.json({ error: "无法解析对话内容" }, { status: 400 });
    }

    console.log(`解析到 ${dialogue.length} 段对话`);

    // 为每个角色分别合成音频
    const audioBuffers: Buffer[] = [];
    
    for (const { speaker, content } of dialogue) {
      const voice = getVoiceForSpeaker(speaker, lang);
      console.log(`为角色 ${speaker} 合成音频，使用音色: ${voice}`);
      
      // 为不同角色调整音色参数
      const voiceParams = getVoiceParamsForSpeaker(speaker, lang);
      
      const audioBuffer = await synthesizeTTS({ 
        text: content, 
        lang, 
        voiceName: voice, 
        speakingRate: speakingRate * voiceParams.speakingRate,
        pitch: pitch + voiceParams.pitch
      });
      
      audioBuffers.push(audioBuffer);
    }

    // 合并音频
    console.log(`合并 ${audioBuffers.length} 个音频片段`);
    const mergedAudio = await mergeAudioBuffers(audioBuffers);

    // 上传到 Supabase Storage
    const supabaseAdmin = getServiceSupabase();
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/dialogue-${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;

    const uploadResult = await uploadAudioFile(bucket, filePath, mergedAudio);
    if (!uploadResult.success) {
      return NextResponse.json({ error: `上传失败: ${uploadResult.error}` }, { status: 500 });
    }

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
      bytes: mergedAudio.length, 
      signed: Boolean(signed?.signedUrl),
      dialogue_count: dialogue.length,
      speakers: [...new Set(dialogue.map(d => d.speaker))]
    });

  } catch (error: unknown) {
    console.error("对话音频合成失败:", error);
    const message = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
    return NextResponse.json({ error: message || "服务器错误" }, { status: 500 });
  }
}
