export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { synthesizeTTS } from '@/lib/tts';
import { uploadAudioFile } from '@/lib/storage-upload';

// 解析对话文本，分离不同角色的内容
function toAsciiUpperLetter(ch: string): string {
  // 全角Ａ(FF21)-Ｚ(FF3A) 转半角 A-Z
  const code = ch.codePointAt(0) || 0;
  if (code >= 0xff21 && code <= 0xff3a) {
    return String.fromCharCode(0x41 + (code - 0xff21));
  }
  return ch.toUpperCase();
}

function parseDialogue(text: string): { speaker: string; content: string }[] {
  const src = String(text).replace(/\r\n?/g, '\n');
  const labelRE = /[\s\uFEFF\u00A0\u3000"'“”‘’·•\-–—]*([A-Z\uFF21-\uFF3A])\s*[\:\uFF1A]\s*/gi;
  const matches: Array<{ speaker: string; start: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = labelRE.exec(src)) !== null) {
    const speaker = toAsciiUpperLetter(m[1]);
    const start = (m.index || 0) + (m[0]?.length || 0);
    matches.push({ speaker, start });
  }

  const out: { speaker: string; content: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const end = next ? next.start : src.length;
    const segment = src.slice(cur.start, end).trim();
    if (segment) {
      out.push({ speaker: cur.speaker, content: segment });
    }
  }

  return out;
}

// 合并音频缓冲区（优先使用 ffmpeg-static；不可用时回退简单拼接并插入静音）
async function mergeAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error('No audio buffers to merge');
  if (buffers.length === 1) return buffers[0];

  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const { spawn } = await import('child_process');

    // 解析 ffmpeg 可执行路径（优先 ffmpeg-static）
    let ffmpegPath: string | null = null;
    try {
      type FfmpegStaticModule = { default?: string } | string;
      const ffm = (await import('ffmpeg-static')) as unknown as FfmpegStaticModule;
      const v = (typeof ffm === 'string' ? ffm : ffm.default) as string | undefined;
      if (v) ffmpegPath = String(v).replace(/^"+|"+$/g, '');
    } catch {}

    // 候选路径（兼容 Windows/Linux）
    const candidates = [
      ffmpegPath,
      process.env.FFMPEG_PATH,
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    ].filter(Boolean) as string[];

    let resolvedFfmpeg = '';
    for (const p of candidates) {
      try {
        const abs = path.resolve(p);
        if (fs.existsSync(abs)) {
          resolvedFfmpeg = abs;
          break;
        }
      } catch {}
    }

    if (!resolvedFfmpeg) {
      // 最后尝试系统路径
      resolvedFfmpeg = 'ffmpeg';
    }

    // 创建临时目录与输入清单
    const tempDir = os.tmpdir();
    const inputFiles: string[] = [];
    const outputFile = path.join(tempDir, `merged-${Date.now()}.mp3`);

    try {
      // 写入片段为临时文件
      for (let i = 0; i < buffers.length; i++) {
        const inputFile = path.join(tempDir, `input-${i}-${Date.now()}.mp3`);
        fs.writeFileSync(inputFile, buffers[i]);
        inputFiles.push(inputFile);
      }

      // 生成输入列表（统一正斜杠路径，避免 Windows 反斜杠转义问题）
      const listFile = path.join(tempDir, `list-${Date.now()}.txt`);
      const inputList = inputFiles
        .map((file) => `file '${path.resolve(file).replace(/\\/g, '/')}'`)
        .join('\n');
      fs.writeFileSync(listFile, inputList, 'utf8');

      // 统一重编码为 MP3，避免 concat copy 因参数不一致失败
      const args = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        outputFile,
      ];

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(resolvedFfmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
        let stderr = '';
        proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.on('error', (err: unknown) => reject(err));
        proc.on('exit', (code: number) => (code === 0 ? resolve() : reject(new Error(`ffmpeg concat failed (${code})\n${stderr}`))));
      });

      const mergedBuffer = fs.readFileSync(outputFile);

      // 清理临时文件
      try {
        [...inputFiles, listFile, outputFile].forEach((f) => {
          try { fs.unlinkSync(f); } catch {}
        });
      } catch {}

      return mergedBuffer;
    } catch (ffmpegError) {
      console.error('FFmpeg 合并失败，回退简单拼接:', ffmpegError);
      try {
        [...inputFiles, outputFile].forEach((f) => {
          try { fs.unlinkSync(f); } catch {}
        });
      } catch {}
      return simpleMerge(buffers);
    }
  } catch (error) {
    console.warn('音频合并失败（外层），回退简单拼接:', error);
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

// 为不同角色分配音色 - 使用存在的音色
function getVoiceForSpeaker(speaker: string, lang: string): string {
  const voices: Record<string, Record<string, string>> = {
    en: {
      A: 'en-US-Standard-A', // 女性声音
      B: 'en-US-Standard-B', // 男性声音
    },
    ja: {
      A: 'ja-JP-Standard-A', // 女性声音
      B: 'ja-JP-Standard-C', // 男性声音
    },
    zh: {
      A: 'cmn-CN-Standard-A', // 女性声音
      B: 'cmn-CN-Standard-B', // 男性声音
    },
  };

  return voices[lang]?.[speaker] || voices[lang]?.A || 'en-US-Standard-A';
}

// 为不同角色分配音色参数
function getVoiceParamsForSpeaker(
  speaker: string,
  lang: string,
): { speakingRate: number; pitch: number } {
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

function isFatalTtsError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return false;
  const fatalHints = [
    'GOOGLE_TTS_CREDENTIALS',
    'Failed to parse GOOGLE_TTS_CREDENTIALS',
    'Permission denied',
    'PERMISSION_DENIED',
    'UNAUTHENTICATED',
    'unauthorized',
  ];
  return fatalHints.some((hint) => message.includes(hint));
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { text, lang, speakingRate = 1.0, pitch = 0, volumeGainDb = 0, speakerVoices } = body as {
      text: string;
      lang: string;
      speakingRate?: number;
      pitch?: number;
      volumeGainDb?: number;
      speakerVoices?: Record<string, string> | null;
    };

    if (!text || !lang) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析对话文本
    const dialogue = parseDialogue(text);
    if (dialogue.length === 0) {
      return NextResponse.json({ error: '无法解析对话内容' }, { status: 400 });
    }

    console.log(`解析到 ${dialogue.length} 段对话`);

    // 为每个角色分别合成音频（只在内存中处理，不上传独立音频）
    const audioBuffers: Buffer[] = [];
    const segmentTexts: string[] = [];
    const segmentSpeakers: string[] = [];

    // 二次清洗规则：移除片段内部残留的说话者标识（如同一行混入下一位标识）
    const innerLabelRE = /[\s\uFEFF\u00A0\u3000"'“”‘’·•\-–—]*([A-Z\uFF21-\uFF3A])\s*[\:\uFF1A]\s*/g;

    const appliedSpeakerVoices: Record<string, string> = {};

    for (const { speaker, content } of dialogue) {
      const sKey = toAsciiUpperLetter(speaker);
      const preferred =
        (speakerVoices &&
          (speakerVoices[sKey] ||
            speakerVoices[String(sKey).toUpperCase()] ||
            speakerVoices[String(sKey).toLowerCase()])) ||
        null;
      const fallbackVoice = getVoiceForSpeaker(sKey, lang);
      const voiceParams = getVoiceParamsForSpeaker(sKey, lang);
      const cleaned = content.replace(innerLabelRE, ' ').trim();

      if (!cleaned) {
        console.warn(`跳过空对白片段: speaker=${sKey}`);
        continue;
      }

      const candidates: (string | null)[] = [];
      const normalizedPreferred = preferred?.trim();
      if (normalizedPreferred) candidates.push(normalizedPreferred);
      if (fallbackVoice?.trim()) candidates.push(fallbackVoice.trim());
      candidates.push(null); // 允许使用库内默认音色

      const uniqueCandidates: (string | null)[] = [];
      const seen = new Set<string>();
      for (const candidate of candidates) {
        const key = candidate ? candidate.toLowerCase() : '__default__';
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueCandidates.push(candidate);
      }

      let audioBuffer: Buffer | null = null;
      let usedVoice: string | null = null;
      let lastError: unknown = null;

      for (const candidate of uniqueCandidates) {
        const attemptVoice = candidate || undefined;
        const label = candidate ?? '(library-default)';
        try {
          console.log(`为角色 ${sKey} 合成音频，尝试音色: ${label}`);
          const buffer = await synthesizeTTS({
            text: cleaned,
            lang,
            voiceName: attemptVoice,
            speakingRate: speakingRate * voiceParams.speakingRate,
            pitch: pitch + voiceParams.pitch,
          });
          audioBuffer = buffer;
          usedVoice = attemptVoice ?? fallbackVoice ?? '';
          break;
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          console.error('音色合成失败，尝试回退', {
            speaker: sKey,
            attemptedVoice: label,
            message,
          });
          if (isFatalTtsError(err)) {
            throw err;
          }
        }
      }

      if (!audioBuffer) {
        const message =
          lastError instanceof Error ? lastError.message : String(lastError || '未知错误');
        throw new Error(`无法为角色 ${sKey} 合成音频: ${message}`);
      }

      appliedSpeakerVoices[sKey] = usedVoice || '';
      audioBuffers.push(audioBuffer);
      segmentTexts.push(cleaned);
      segmentSpeakers.push(sKey);
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json({ error: '对话中没有可用的语音片段' }, { status: 400 });
    }

    // 合并音频（在内存中完成，不保存独立音频）
    console.log(`合并 ${audioBuffers.length} 个音频片段`);
    const mergedAudio = await mergeAudioBuffers(audioBuffers);

    // 使用 ffprobe 获取精确时长，回退轻量估计
    const { getMp3DurationSeconds } = await import('@/lib/media-probe');
    const durations: number[] = [];
    for (const b of audioBuffers) {
      try {
        const d = await getMp3DurationSeconds(b);
        durations.push(Number.isFinite(d) && d > 0 ? d : Math.max(0.2, b.length / 16000));
      } catch {
        durations.push(Math.max(0.2, b.length / 16000));
      }
    }
    const sentenceTimeline = durations.map((d, i) => ({
      index: i,
      text: segmentTexts[i] || '',
      start: durations.slice(0, i).reduce((a, b) => a + b, 0),
      end: durations.slice(0, i + 1).reduce((a, b) => a + b, 0),
      speaker: segmentSpeakers[i] || undefined,
    }));

    // 上传到 Supabase Storage
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/dialogue-${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;

    const uploadResult = await uploadAudioFile(bucket, filePath, mergedAudio);
    if (!uploadResult.success) {
      return NextResponse.json({ error: `上传失败: ${uploadResult.error}` }, { status: 500 });
    }

    // 优先返回代理URL（带CDN缓存）
    const audioUrl = uploadResult.proxyUrl || uploadResult.url;
    if (!audioUrl) return NextResponse.json({ error: '获取音频地址失败' }, { status: 500 });

    return NextResponse.json({
      ok: true,
      audio_url: audioUrl,
      bytes: mergedAudio.length,
      proxy_url: uploadResult.proxyUrl,
      direct_url: uploadResult.url,
      dialogue_count: dialogue.length,
      speakers: [...new Set(dialogue.map((d) => d.speaker))],
      sentence_timeline: sentenceTimeline,
      duration_ms: Math.round((durations.reduce((a, b) => a + b, 0)) * 1000),
      applied_speaker_voices: appliedSpeakerVoices,
    });
  } catch (error: unknown) {
    console.error('对话音频合成失败:', error);
    const message =
      error instanceof Error
        ? error instanceof Error
          ? error.message
          : String(error)
        : String(error);
    return NextResponse.json({ error: message || '服务器错误' }, { status: 500 });
  }
}
