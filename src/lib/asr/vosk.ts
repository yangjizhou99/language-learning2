// 浏览器端 Vosk WASM 集成（基于 CDN 加载）

export type VoskProgress = {
  status?: string;
  loaded?: number;
  total?: number;
  file?: string;
};

interface VoskBrowserApi {
  createModel: (
    url: string,
    opts?: {
      progress_callback?: (info: {
        status?: string;
        loaded?: number;
        total?: number;
        file?: string;
      }) => void;
    },
  ) => Promise<VoskModel>;
}

interface VoskModel {
  KaldiRecognizer: new (sampleRate: number) => VoskRecognizer;
}

interface VoskRecognizer {
  acceptWaveform: (pcm: Int16Array) => boolean;
  result?: () => { text?: string } | undefined;
  finalResult?: () => { text?: string } | undefined;
  free?: () => void;
}

declare global {
  interface Window {
    Vosk?: VoskBrowserApi;
  }
}

const VOSK_CDN = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.5/dist/vosk.js';

const modelCache: Record<string, VoskModel> = {};

async function loadVoskScript(): Promise<VoskBrowserApi> {
  if (typeof window === 'undefined') throw new Error('Vosk 仅能在浏览器环境使用');
  if (window.Vosk) return window.Vosk;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = VOSK_CDN;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Vosk 脚本加载失败'));
    document.head.appendChild(s);
  });
  if (!window.Vosk) throw new Error('Vosk 未初始化');
  return window.Vosk;
}

export async function warmUpVosk(
  modelUrl: string,
  onProgress?: (p: VoskProgress) => void,
): Promise<void> {
  if (!modelUrl) throw new Error('请先填写 Vosk 模型 URL（.zip 或 .tar.gz）');
  if (modelCache[modelUrl]) return; // 已缓存
  const Vosk = await loadVoskScript();
  const model = await Vosk.createModel(
    modelUrl,
    onProgress ? { progress_callback: onProgress } : undefined,
  );
  modelCache[modelUrl] = model;
}

export async function transcribeBlobWithVosk(blob: Blob, modelUrl: string): Promise<string> {
  if (!modelUrl) throw new Error('缺少 Vosk 模型 URL');
  await warmUpVosk(modelUrl);
  const model = modelCache[modelUrl];
  if (!model) throw new Error('Vosk 模型未就绪');

  // 解码并重采样到 16kHz Int16 PCM
  const { data, sampleRate } = await decodeToFloat32Mono(blob);
  const pcm16 = floatToPCM16(resampleFloat32(data, sampleRate, 16000));

  const recognizer = new model.KaldiRecognizer(16000);
  try {
    const frameSize = 1600; // 0.1s @16k
    for (let i = 0; i < pcm16.length; i += frameSize) {
      const slice = pcm16.subarray(i, Math.min(i + frameSize, pcm16.length));
      recognizer.acceptWaveform(slice);
    }
    const finalObj = recognizer.finalResult ? recognizer.finalResult() : undefined;
    const txt = finalObj && typeof finalObj.text === 'string' ? finalObj.text : '';
    return txt.trim();
  } finally {
    if (recognizer.free) recognizer.free();
  }
}

async function decodeToFloat32Mono(
  blob: Blob,
): Promise<{ data: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext | undefined =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error('AudioContext 不可用');
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
    const d = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mixed[i] += d[i] / channels;
  }
  return { data: mixed, sampleRate: sr };
}

function resampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = toRate / fromRate;
  const outLen = Math.round(input.length * ratio);
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

function floatToPCM16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
