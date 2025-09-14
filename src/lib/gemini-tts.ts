import textToSpeech from "@google-cloud/text-to-speech";
import { toLocaleCode } from "@/types/lang";
import voices from "./gemini-voices.json";

type GeminiTTSParams = {
  text: string;
  lang: "ja" | "en" | "zh" | string;
  voiceName?: string;
  stylePrompt?: string;
  speakingRate?: number;
  pitch?: number;
};

type GeminiDialogueParams = {
  text: string;
  lang: "ja" | "en" | "zh" | string;
  speakers?: string[];
  stylePrompts?: Record<string, string>;
  speakingRate?: number;
  pitch?: number;
};

// 创建 Gemini TTS 客户端
function makeGeminiClient() {
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
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

// 获取可用的 Gemini TTS 音色
export function getGeminiVoices() {
  return voices;
}

// 根据语言和角色推荐音色
export function recommendVoiceForSpeaker(speaker: string, lang: string): { voiceName: string; stylePrompt: string } {
  const langVoices = {
    en: {
      A: { voiceName: "Kore", stylePrompt: "以女性、清晰、自然的风格朗读，注意自然停连、口语化" },
      B: { voiceName: "Orus", stylePrompt: "以男性、中性、随意的风格朗读，注意自然停连、口语化" },
      C: { voiceName: "Callirrhoe", stylePrompt: "以女性、明亮、友好的风格朗读，注意自然停连、口语化" },
      D: { voiceName: "Puck", stylePrompt: "以男性、年轻、活泼的风格朗读，注意自然停连、口语化" }
    },
    ja: {
      A: { voiceName: "ja-JP-Neural2-A", stylePrompt: "以女性、清晰、自然的风格朗读，注意自然停连、口语化" },
      B: { voiceName: "ja-JP-Neural2-D", stylePrompt: "以男性、中性、随意的风格朗读，注意自然停连、口语化" },
      C: { voiceName: "ja-JP-Neural2-C", stylePrompt: "以女性、明亮、友好的风格朗读，注意自然停连、口语化" },
      D: { voiceName: "ja-JP-Neural2-B", stylePrompt: "以男性、年轻、活泼的风格朗读，注意自然停连、口语化" }
    },
    zh: {
      A: { voiceName: "cmn-CN-Chirp3-HD-Kore", stylePrompt: "以女性、清晰、自然的风格朗读，注意自然停连、口语化" },
      B: { voiceName: "cmn-CN-Chirp3-HD-Orus", stylePrompt: "以男性、中性、随意的风格朗读，注意自然停连、口语化" },
      C: { voiceName: "cmn-CN-Chirp3-HD-Callirrhoe", stylePrompt: "以女性、明亮、友好的风格朗读，注意自然停连、口语化" },
      D: { voiceName: "cmn-CN-Chirp3-HD-Puck", stylePrompt: "以男性、年轻、活泼的风格朗读，注意自然停连、口语化" }
    }
  };

  const defaultVoice = { 
    voiceName: lang === 'en' ? "Kore" : (lang === 'ja' ? "ja-JP-Neural2-A" : "cmn-CN-Chirp3-HD-Kore"), 
    stylePrompt: "以自然、清晰的风格朗读，注意自然停连、口语化" 
  };
  const langConfig = langVoices[lang as keyof typeof langVoices];
  if (langConfig && speaker in langConfig) {
    return (langConfig as any)[speaker] || defaultVoice;
  }
  return defaultVoice;
}

// 分割文本为句子
function splitTextIntoSentences(text: string): string[] {
  const hardDelimiters = new Set(["。", "！", "？", "!", "?", ".", "；", ";", "．"]);
  const out: string[] = [];
  let buf = "";
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    if (ch === "\n") {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
    if (hardDelimiters.has(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// 按字节数分块
function chunkByBytes(text: string, maxBytes = 800): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of text) {
    const chBytes = Buffer.byteLength(ch, "utf8");
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

// 转义SSML
function escapeForSsml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Gemini TTS 单句合成
export async function synthesizeGeminiTTS({ 
  text, 
  lang, 
  voiceName = "Kore", 
  stylePrompt = "以自然、清晰的风格朗读，注意自然停连、口语化",
  speakingRate = 1.0, 
  pitch = 0 
}: GeminiTTSParams): Promise<Buffer> {
  const clean = (text || "").trim().slice(0, 4000);
  if (!clean || !lang) throw new Error("missing text/lang");

  const client = makeGeminiClient();
  const languageCode = toLocaleCode(lang);

  // 分割文本并处理
  const sentences = splitTextIntoSentences(clean).flatMap(s => chunkByBytes(s, 800));
  
  // 根据音色名称确定模型类型
  let modelName = 'gemini-2.5-flash-preview-tts'; // 默认Flash模型
  if (voiceName.includes('Gemini-Pro-')) {
    modelName = 'gemini-2.5-pro-preview-tts';
  } else if (voiceName.includes('Gemini-Flash-')) {
    modelName = 'gemini-2.5-flash-preview-tts';
  } else {
    modelName = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
  }
  
  // 根据语言选择合适的语言代码和音色
  const getLanguageConfig = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'zh':
      case 'zh-cn':
        return {
          languageCode: "cmn-CN", // 中文
          voiceName: "cmn-CN-Chirp3-HD-Kore", // 使用 Chirp3-HD 系列，质量更高
          modelName: undefined // 中文使用传统模型
        };
      case 'ja':
        return {
          languageCode: "ja-JP", // 日语
          voiceName: "ja-JP-Neural2-A", // 日语音色
          modelName: undefined // 日语使用传统模型
        };
      case 'en':
      default:
        // 从音色名称中提取实际的Gemini音色名称
        let geminiVoiceName = voiceName;
        if (voiceName.includes('Gemini-Pro-')) {
          geminiVoiceName = voiceName.replace('Gemini-Pro-', '');
        } else if (voiceName.includes('Gemini-Flash-')) {
          geminiVoiceName = voiceName.replace('Gemini-Flash-', '');
        }
        
        return {
          languageCode: "en-US", // 英语
          voiceName: geminiVoiceName, // Gemini TTS 音色
          modelName: modelName // Gemini TTS 模型
        };
    }
  };

  const langConfig = getLanguageConfig(lang);
  
  // 为多音色对话优化：使用更稳定的prompt来保证音色一致性
  const stablePrompt = "以稳定、一致的风格朗读文本，保持音色特征不变";
  
  // Gemini TTS 需要特殊的配置方式 - 根据 Google Cloud 文档
  // 注意：modelName 字段应该放在 voice 里，而不是顶层
  const request = {
    input: { 
      text: clean,
      prompt: stablePrompt // 使用稳定的prompt而不是动态的stylePrompt
    },
    voice: {
      languageCode: langConfig.languageCode,
      name: langConfig.voiceName || (langConfig as any).name,
      ...(langConfig.modelName && { modelName: langConfig.modelName })
    },
    audioConfig: {
      audioEncoding: "MP3" as const,
      speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1.0,
      pitch: Number.isFinite(pitch) ? pitch : 0,
    }
  };

  console.log('Gemini TTS 请求参数:', JSON.stringify(request, null, 2));

  let resp;
  try {
    [resp] = await client.synthesizeSpeech(request);
    console.log('Gemini TTS SDK 调用成功');
  } catch (error) {
    console.error('Gemini TTS SDK 调用失败，尝试 REST API:', error);
    
    // 尝试 REST API 作为备用方案
    try {
      const { synthesizeGeminiTTSRest } = await import('./gemini-tts-rest');
      const audioBuffer = await synthesizeGeminiTTSRest({ 
        text: clean, 
        lang, 
        voiceName, 
        stylePrompt, 
        speakingRate, 
        pitch 
      });
      console.log('Gemini TTS REST API 调用成功');
      return audioBuffer;
    } catch (restError) {
      console.error('Gemini TTS REST API 也失败，回退到传统 Google TTS:', restError);
      
      // 最后回退到传统 Google TTS
      const fallbackRequest = {
        input: { text: clean },
        voice: {
          languageCode: "en-US",
          name: "en-US-Neural2-F"
        },
        audioConfig: {
          audioEncoding: "MP3" as const,
          speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1.0,
          pitch: Number.isFinite(pitch) ? pitch : 0,
        }
      };
      [resp] = await client.synthesizeSpeech(fallbackRequest);
      console.log('回退到传统 Google TTS 成功');
    }
  }

  const audio = resp.audioContent ? Buffer.from(resp.audioContent as Uint8Array) : undefined;
  if (!audio) throw new Error("no audio generated");
  return audio;
}

// 解析对话文本
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
    // 尝试使用 ffmpeg 进行音频合并
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { spawn } = require('child_process');
    
    // 尝试使用 ffmpeg-static 提供的路径
    let ffmpegPath: string;
    try {
      const ffmpegStatic = require('ffmpeg-static');
      ffmpegPath = ffmpegStatic.replace(/^"+|"+$/g, ''); // 去掉意外的引号
      
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
    const outputFile = path.join(tempDir, `merged-gemini-${Date.now()}.mp3`);
    
    try {
      // 保存每个音频片段到临时文件
      for (let i = 0; i < buffers.length; i++) {
        const inputFile = path.join(tempDir, `input-gemini-${i}-${Date.now()}.mp3`);
        fs.writeFileSync(inputFile, buffers[i]);
        inputFiles.push(inputFile);
      }
      
      // 创建 ffmpeg 命令来合并音频
      const listFile = path.join(tempDir, `list-gemini-${Date.now()}.txt`);
      const lines = inputFiles.map(f => `file '${path.resolve(f).replace(/\\/g, '\\\\')}'`).join('\n');
      fs.writeFileSync(listFile, lines, 'utf8');
      
      // 执行 ffmpeg 合并
      console.log('执行 FFmpeg 命令:', ffmpegPath, 'with args:', ['-y','-f','concat','-safe','0','-i', listFile, '-c','copy', outputFile]);
      
      await new Promise((resolve, reject) => {
        const args = ['-y','-f','concat','-safe','0','-i', listFile, '-c','copy', outputFile];
        const proc = spawn(ffmpegPath, args, { stdio: 'inherit' });
        proc.on('exit', (code: number) => code === 0 ? resolve(undefined) : reject(new Error(`ffmpeg concat failed (${code})`)));
      });
      
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

// Gemini TTS 对话合成
export async function synthesizeGeminiDialogue({ 
  text, 
  lang, 
  speakers = [],
  stylePrompts = {},
  speakingRate = 1.0, 
  pitch = 0 
}: GeminiDialogueParams): Promise<{ audio: Buffer; speakers: string[]; dialogueCount: number }> {
  if (!text || !lang) throw new Error("missing text/lang");

  // 解析对话文本
  const dialogue = parseDialogue(text);
  if (dialogue.length === 0) {
    throw new Error("无法解析对话内容");
  }

  console.log(`解析到 ${dialogue.length} 段对话`);

  // 为每个角色分别合成音频
  const audioBuffers: Buffer[] = [];
  const uniqueSpeakers = [...new Set(dialogue.map(d => d.speaker))];
  
  for (const { speaker, content } of dialogue) {
    // 获取推荐音色或使用提供的音色
    const voiceConfig = speakers.includes(speaker) 
      ? { voiceName: speakers[speakers.indexOf(speaker) + 1] || "Kore", stylePrompt: stylePrompts[speaker] || "以自然、清晰的风格朗读" }
      : recommendVoiceForSpeaker(speaker, lang);
    
    console.log(`为角色 ${speaker} 合成音频，使用音色: ${voiceConfig.voiceName}`);
    
    const audioBuffer = await synthesizeGeminiTTS({ 
      text: content, 
      lang, 
      voiceName: voiceConfig.voiceName,
      stylePrompt: voiceConfig.stylePrompt,
      speakingRate,
      pitch
    });
    
    audioBuffers.push(audioBuffer);
  }

  // 合并音频
  console.log(`合并 ${audioBuffers.length} 个音频片段`);
  const mergedAudio = await mergeAudioBuffers(audioBuffers);

  return {
    audio: mergedAudio,
    speakers: uniqueSpeakers,
    dialogueCount: dialogue.length
  };
}
