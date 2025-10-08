import textToSpeech from '@google-cloud/text-to-speech';
import { toLocaleCode } from '@/types/lang';

type SynthesizeParams = {
  text: string;
  lang: 'ja' | 'en' | 'zh' | string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
};

async function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error('GOOGLE_TTS_CREDENTIALS missing');

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch {
    try {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw new Error(
          'File path not supported in production. Use JSON string in GOOGLE_TTS_CREDENTIALS',
        );
      }
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), raw);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      credentials = JSON.parse(fileContent);
    } catch (fileError: unknown) {
      const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
      throw new Error(`Failed to parse GOOGLE_TTS_CREDENTIALS: ${raw}. Error: ${errorMessage}`);
    }
  }

  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || (credentials.project_id as string);
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

const DEFAULTS: Record<string, string> = {
  ja: 'ja-JP-Neural2-B',
  en: 'en-US-Neural2-C',
  zh: 'cmn-CN-Standard-A',
  'zh-CN': 'cmn-CN-Standard-A',
};

function extractLanguageCodeFromVoiceName(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name.split('-');
  if (parts.length >= 2) {
    const lang = parts[0];
    const region = parts[1];
    if (lang && region) return `${lang}-${region.toUpperCase()}`;
  }
  return undefined;
}

function splitTextIntoSentences(text: string): string[] {
  const hardDelimiters = new Set(['。', '！', '？', '!', '?', '.', '；', ';', '．']);
  const out: string[] = [];
  let buf = '';
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    if (ch === '\n') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
    if (hardDelimiters.has(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function chunkByBytes(text: string, maxBytes = 800): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of text) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (currentBytes + chBytes > maxBytes) {
      if (current) chunks.push(current);
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function escapeForSsml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 将PCM数据转换为WAV格式
function convertPCMToWAV(pcmData: Buffer, sampleRate: number): Uint8Array {
  const length = pcmData.length;
  console.log(`PCM数据长度: ${length}, 采样率: ${sampleRate}`);

  // 检查PCM数据是否为空
  if (length === 0) {
    console.error('PCM数据为空');
    throw new Error('PCM数据为空');
  }

  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // WAV文件头
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF标识符
  writeString(0, 'RIFF');
  // 文件长度
  view.setUint32(4, 36 + length, true);
  // WAVE标识符
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  // fmt chunk长度
  view.setUint32(16, 16, true);
  // 音频格式 (PCM)
  view.setUint16(20, 1, true);
  // 声道数
  view.setUint16(22, 1, true);
  // 采样率
  view.setUint32(24, sampleRate, true);
  // 字节率
  view.setUint32(28, sampleRate * 2, true);
  // 块对齐
  view.setUint16(32, 2, true);
  // 位深度
  view.setUint16(34, 16, true);
  // data chunk
  writeString(36, 'data');
  // data chunk长度
  view.setUint32(40, length, true);

  // 处理PCM数据
  const uint8Array = new Uint8Array(buffer);

  // 如果PCM数据长度是奇数，说明可能不是16位PCM
  if (length % 2 !== 0) {
    console.log('警告: PCM数据长度不是偶数，可能格式不正确');
    // 直接复制数据，不进行字节序转换
    uint8Array.set(pcmData, 44);
  } else {
    // 尝试不同的字节序转换方法
    try {
      const pcmView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
      const wavPcmView = new DataView(uint8Array.buffer, 44);

      // 方法1: 尝试大端序到小端序转换
      for (let i = 0; i < length; i += 2) {
        const sample = pcmView.getInt16(i, false); // 大端序读取
        wavPcmView.setInt16(i, sample, true); // 小端序写入
      }

      console.log('使用大端序到小端序转换');
    } catch (error) {
      console.log('字节序转换失败，直接复制数据:', error);
      // 如果转换失败，直接复制原始数据
      uint8Array.set(pcmData, 44);
    }
  }

  console.log(`WAV文件总长度: ${uint8Array.length}`);
  return uint8Array;
}

export async function synthesizeTTS({
  text,
  lang,
  voiceName,
  speakingRate = 1.0,
  pitch = 0,
}: SynthesizeParams): Promise<Buffer> {
  const clean = (text || '').trim().slice(0, 4000);
  if (!clean || !lang) throw new Error('missing text/lang');

  // 检查是否是科大讯飞音色
  if (voiceName && voiceName.startsWith('xunfei-')) {
    try {
      const { synthesizeXunfeiTTS, synthesizeXunfeiLongTextTTS } = await import('./xunfei-tts');
      const xunfeiVoiceId = voiceName.replace('xunfei-', '');

      // 转换speakingRate (Google: 0.25-4.0, 科大讯飞: 0-100)
      // 修复：Google默认1.0对应科大讯飞默认50
      const xunfeiSpeed = Math.max(0, Math.min(100, speakingRate * 50));
      const xunfeiPitch = Math.max(0, Math.min(100, ((pitch + 20) / 40) * 100));

      // 检查是否是新闻播报音色，使用长文本TTS
      const isNewsVoice = xunfeiVoiceId.includes('profnews') || xunfeiVoiceId.includes('xiaoguo');

      if (isNewsVoice) {
        const audioBuffer = await synthesizeXunfeiLongTextTTS(clean, xunfeiVoiceId, {
          speed: xunfeiSpeed,
          pitch: xunfeiPitch,
          volume: 50,
          language: 'zh',
        });
        return audioBuffer;
      } else {
        const audioData = await synthesizeXunfeiTTS(clean, xunfeiVoiceId, {
          speed: xunfeiSpeed,
          pitch: xunfeiPitch,
          volume: 50,
        });

        // 直接返回MP3数据，不需要转换
        return audioData;
      }
    } catch (error) {
      throw error;
    }
  }

  // 检查是否是Gemini音色
  if (voiceName && voiceName.startsWith('Gemini-')) {
    try {
      const { synthesizeGeminiTTS } = await import('./gemini-tts');

      console.log('Gemini TTS 合成参数:', {
        originalVoiceName: voiceName,
        text: clean.substring(0, 50) + '...',
        lang: 'en-US',
        speakingRate: speakingRate,
        pitch: pitch,
      });

      // Gemini TTS 只支持英语，传递完整的音色名称让synthesizeGeminiTTS内部处理
      const audioBuffer = await synthesizeGeminiTTS({
        text: clean,
        lang: 'en-US',
        voiceName: voiceName, // 传递完整的音色名称，包括Flash/Pro标识
        speakingRate: speakingRate,
        pitch: pitch,
      });

      console.log('Gemini TTS 合成成功，音频大小:', audioBuffer.length);
      return Buffer.from(audioBuffer);
    } catch (error) {
      console.error('Gemini TTS 合成失败:', error);
      throw error;
    }
  }

  // 使用Google TTS
  const client = await makeClient();
  const selectedName = voiceName || DEFAULTS[lang as keyof typeof DEFAULTS];
  const inferredLanguage = extractLanguageCodeFromVoiceName(selectedName);
  const languageCode = inferredLanguage || toLocaleCode(lang);
  const name = selectedName;
  if (!name) {
    throw new Error(`未提供音色且没有为语言 ${lang} 配置默认音色`);
  }

  // 基于音色名推断所需的模型与能力（对齐试听实现）
  function inferModelFromVoice(name: string | undefined): string | undefined {
    if (!name) return undefined;
    const n = name.toLowerCase();
    if (n.includes('chirp3-hd')) return 'models/chirp3-hd';
    if (n.includes('chirp-hd')) return 'models/chirp-hd';
    if (n.includes('neural2')) return 'models/neural2';
    if (n.includes('wavenet')) return 'models/wavenet';
    if (n.includes('standard')) return 'models/standard';
    // 其他系列（Studio/News/Polyglot/Casual）Google v1 可能存在差异，这里不强制设置
    return undefined;
  }

  const model = inferModelFromVoice(selectedName);

  // 部分模型/音色不支持 pitch，避免 INVALID_ARGUMENT
  function supportsPitchForVoice(name: string | undefined): boolean {
    if (!name) return true;
    const n = name.toLowerCase();
    if (n.includes('chirp3') || n.includes('chirp-hd') || n.includes('chirp3-hd')) return false;
    // 如需更严格可将 Studio/News/Polyglot 也关闭
    return true;
  }

  const canUsePitch = supportsPitchForVoice(selectedName);

  // 调试信息
  console.log('synthesizeTTS 调试信息:');
  console.log('- 输入参数:', {
    text: clean.substring(0, 50) + '...',
    lang,
    voiceName,
    speakingRate,
    pitch,
  });
  console.log('- selectedName:', selectedName);
  console.log('- inferredLanguage:', inferredLanguage);
  console.log('- languageCode:', languageCode);
  console.log('- 最终音色名称:', name);
  console.log('- DEFAULTS[lang]:', DEFAULTS[lang as keyof typeof DEFAULTS]);
  if (model) console.log('- 使用模型:', model);

  // 检查音色是否支持SSML
  const supportsSSML =
    name &&
    !name.includes('Chirp-HD-') &&
    !name.includes('Chirp3-HD-') &&
    !name.includes('News-') &&
    !name.includes('Studio-') &&
    !name.includes('Casual-') &&
    !name.includes('Polyglot-');

  let input: { text: string } | { ssml: string };
  if (supportsSSML) {
    const sentences = splitTextIntoSentences(clean).flatMap((s) => chunkByBytes(s, 800));
    const ssml = `<speak>${sentences.map((s) => `<s>${escapeForSsml(s)}</s>`).join('')}</speak>`;
    input = { ssml };
  } else {
    // 对于不支持SSML的音色，使用纯文本
    input = { text: clean };
  }

  console.log('Google TTS 输入类型:', supportsSSML ? 'SSML' : 'Text');
  console.log('Google TTS 输入内容:', supportsSSML ? 'SSML格式' : clean.substring(0, 100) + '...');

  const request: any = {
    input,
    voice: { languageCode, name },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1.0,
      ...(canUsePitch && Number.isFinite(pitch) ? { pitch } : {}),
    },
  };

  if (model) (request as any).model = model;

  const [resp] = await client.synthesizeSpeech(request);

  const audio = resp.audioContent ? Buffer.from(resp.audioContent as Uint8Array) : undefined;
  if (!audio) throw new Error('no audio');
  return audio;
}

// 解析对话文本
function parseDialogue(text: string): { speaker: string; content: string }[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const dialogue: { speaker: string; content: string }[] = [];

  for (const line of lines) {
    // 匹配 A: 或 B: 格式
    const match = line.match(/^([A-Z]):\s*(.+)$/);
    if (match) {
      dialogue.push({
        speaker: match[1],
        content: match[2].trim(),
      });
    }
  }

  return dialogue;
}

// 为不同角色分配音色
function getVoiceForSpeaker(speaker: string, lang: string): string {
  // 标准化语言代码
  const normalizedLang = lang.toLowerCase();
  let langKey = normalizedLang;

  if (normalizedLang === 'zh' || normalizedLang === 'cmn-cn' || normalizedLang === 'zh-cn') {
    langKey = 'zh';
  } else if (normalizedLang === 'en' || normalizedLang === 'en-us') {
    langKey = 'en';
  } else if (normalizedLang === 'ja' || normalizedLang === 'ja-jp') {
    langKey = 'ja';
  }

  const voices: Record<string, Record<string, string>> = {
    en: {
      A: 'en-US-Neural2-F', // 女性声音
      B: 'en-US-Neural2-D', // 男性声音
    },
    ja: {
      A: 'ja-JP-Neural2-A', // 女性声音
      B: 'ja-JP-Neural2-D', // 男性声音
    },
    zh: {
      A: 'cmn-CN-Standard-A', // 女性声音
      B: 'cmn-CN-Standard-B', // 男性声音
    },
  };

  const voice = voices[langKey]?.[speaker] || voices[langKey]?.A || 'en-US-Neural2-F';
  console.log(
    `getVoiceForSpeaker: speaker=${speaker}, lang=${lang}, normalized=${langKey}, voice=${voice}`,
  );
  return voice;
}

// 合并音频缓冲区
async function mergeAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error('No audio buffers to merge');
  if (buffers.length === 1) return buffers[0];

  try {
    // 尝试使用 ffmpeg 进行音频合并
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const { spawn } = await import('child_process');

    // 尝试使用 ffmpeg-static 提供的路径
    let ffmpegPath: string;
    try {
      const ffmpegStatic = await import('ffmpeg-static');
      ffmpegPath = String(ffmpegStatic.default || ffmpegStatic).replace(/^"+|"+$/g, ''); // 去掉意外的引号

      // 校验文件是否存在
      if (!fs.existsSync(ffmpegPath)) {
        throw new Error(`ffmpeg not found at: ${ffmpegPath}`);
      }
      console.log('使用 ffmpeg-static 路径:', ffmpegPath);
    } catch {
      // 如果 ffmpeg-static 不可用，回退到系统命令
      ffmpegPath = 'ffmpeg';
      console.log('回退到系统 ffmpeg 命令');
    }

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

      // 创建 ffmpeg 命令来合并音频
      const listFile = path.join(tempDir, `list-${Date.now()}.txt`);
      const lines = inputFiles
        .map((f) => `file '${path.resolve(f).replace(/\\/g, '\\\\')}'`)
        .join('\n');
      fs.writeFileSync(listFile, lines, 'utf8');

      // 执行 ffmpeg 合并
      console.log('执行 FFmpeg 命令:', ffmpegPath, 'with args:', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c',
        'copy',
        outputFile,
      ]);

      await new Promise((resolve, reject) => {
        const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputFile];
        const proc = spawn(ffmpegPath, args, { stdio: 'inherit' });
        proc.on('exit', (code: number) =>
          code === 0 ? resolve(undefined) : reject(new Error(`ffmpeg concat failed (${code})`)),
        );
      });

      // 读取合并后的音频
      const mergedBuffer = fs.readFileSync(outputFile);

      // 清理临时文件
      [...inputFiles, listFile, outputFile].forEach((file) => {
        try {
          fs.unlinkSync(file);
        } catch {}
      });

      return mergedBuffer;
    } catch (ffmpegError) {
      console.warn('FFmpeg 合并失败，使用简单拼接:', ffmpegError);

      // 清理临时文件
      [...inputFiles, outputFile].forEach((file) => {
        try {
          fs.unlinkSync(file);
        } catch {}
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

// Google TTS 对话合成
export async function synthesizeDialogue({
  text,
  lang,
  speakingRate = 1.0,
  pitch = 0,
}: {
  text: string;
  lang: string;
  speakingRate?: number;
  pitch?: number;
}): Promise<{ audio: Buffer; speakers: string[]; dialogueCount: number }> {
  if (!text || !lang) throw new Error('missing text/lang');

  console.log(`开始对话合成: lang=${lang}, text=${text.substring(0, 100)}...`);

  // 解析对话文本
  const dialogue = parseDialogue(text);
  if (dialogue.length === 0) {
    throw new Error('无法解析对话内容');
  }

  console.log(`解析到 ${dialogue.length} 段对话:`, dialogue);

  // 为每个角色分别合成音频
  const audioBuffers: Buffer[] = [];
  const uniqueSpeakers = [...new Set(dialogue.map((d) => d.speaker))];

  for (const { speaker, content } of dialogue) {
    const voice = getVoiceForSpeaker(speaker, lang);
    console.log(`为角色 ${speaker} 合成音频，使用音色: ${voice}, 内容: "${content}"`);

    try {
      const audioBuffer = await synthesizeTTS({
        text: content,
        lang,
        voiceName: voice,
        speakingRate,
        pitch,
      });

      console.log(`角色 ${speaker} 音频合成成功，大小: ${audioBuffer.length} bytes`);
      audioBuffers.push(audioBuffer);
    } catch (error) {
      console.error(`角色 ${speaker} 音频合成失败:`, error);
      throw error;
    }
  }

  // 合并音频
  console.log(`开始合并 ${audioBuffers.length} 个音频片段`);
  try {
    const mergedAudio = await mergeAudioBuffers(audioBuffers);
    console.log(`音频合并成功，最终大小: ${mergedAudio.length} bytes`);

    return {
      audio: mergedAudio,
      speakers: uniqueSpeakers,
      dialogueCount: dialogue.length,
    };
  } catch (error) {
    console.error('音频合并失败:', error);
    throw error;
  }
}
