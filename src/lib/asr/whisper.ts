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
  const float32 = await decodeToFloat32Mono(blob);
  const out: unknown = await pipe(float32, {
    chunk_length_s: 15,
    stride_length_s: 5,
    language: langHint,
    return_timestamps: true,
  });
  // out.text; out.chunks: [{text, timestamp: [start,end]}]
  return out as unknown as TranscribeOutput;
}

async function decodeToFloat32Mono(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext | undefined = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    // 无法解码时回退为空数组，交由上层报错
    return new Float32Array();
  }
  const audioCtx = new AC();
  const audioBuffer: AudioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
    // 使用带回调的重载，兼容性更好
    audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
  });
  const channels = Math.max(1, audioBuffer.numberOfChannels);
  if (channels === 1) return audioBuffer.getChannelData(0);
  const length = audioBuffer.length;
  const mixed = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mixed[i] += data[i] / channels;
  }
  return mixed;
}
