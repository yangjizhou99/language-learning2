// 轻量封装：自动选择多语种模型，返回文本+时间戳
import type { AutomaticSpeechRecognitionPipeline } from "@xenova/transformers";

export type TranscribeOutput =
  | { text: string; chunks?: { text: string; timestamp: [number, number] }[] }
  | Array<{ text: string }>;

// 单例缓存
// 为不同模型维持单例缓存
const pipePromiseMap: Record<string, Promise<AutomaticSpeechRecognitionPipeline>> = {};

export type DownloadProgress = {
  status?: string;
  loaded?: number;
  total?: number;
  file?: string;
};

export async function getWhisper(modelId = "Xenova/whisper-tiny", progressCallback?: (info: DownloadProgress) => void): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!pipePromiseMap[modelId]) {
    pipePromiseMap[modelId] = (async (): Promise<AutomaticSpeechRecognitionPipeline> => {
      const { pipeline } = await import("@xenova/transformers");
      const pipe = await pipeline(
        "automatic-speech-recognition",
        modelId,
        progressCallback ? { progress_callback: (x: { status?: string; loaded?: number; total?: number; file?: string }) => progressCallback(x) } : undefined
      );
      return pipe as unknown as AutomaticSpeechRecognitionPipeline;
    })();
  }
  return pipePromiseMap[modelId];
}

/** 
 * transcribeBlob: 传入麦克风 Blob，得到转写结果
 * @param blob 录音 blob（webm/mp3）
 * @param lang 'ja'|'en'|'zh'（Whisper会自动检测，但指定更稳）
 */
export async function transcribeBlob(blob: Blob, lang: string, modelId = "Xenova/whisper-tiny"): Promise<TranscribeOutput> {
  const pipe = await getWhisper(modelId);
  const langHint = lang === "zh" ? "zh" : lang; // zh-CN -> zh
  const { data: audioF32, sampleRate } = await decodeToFloat32MonoWithRate(blob);
  const targetRate = 16000;
  const audio16k = sampleRate === targetRate ? audioF32 : resampleFloat32(audioF32, sampleRate, targetRate);
  const out: unknown = await pipe(audio16k, {
    chunk_length_s: 15,
    stride_length_s: 5,
    language: langHint,
    task: "transcribe",
    return_timestamps: true,
  });
  // out.text; out.chunks: [{text, timestamp: [start,end]}]
  return out as unknown as TranscribeOutput;
}

async function decodeToFloat32MonoWithRate(blob: Blob): Promise<{ data: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext | undefined = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error("AudioContext 不可用");
  const audioCtx = new AC();
  const audioBuffer: AudioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
    audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
  });
  const channels = Math.max(1, audioBuffer.numberOfChannels);
  const sr = audioBuffer.sampleRate;
  if (channels === 1) return { data: audioBuffer.getChannelData(0), sampleRate: sr };
  const length = audioBuffer.length;
  const mixed = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mixed[i] += data[i] / channels;
  }
  return { data: mixed, sampleRate: sr };
}

function resampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = toRate / fromRate;
  const outLen = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}
