'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  AudioLines,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Volume2,
  Waves,
} from 'lucide-react';

type AssessMode = 'batch' | 'stream';

type AzureWordPhoneme = {
  Phoneme?: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    NBestPhonemes?: Array<{
      Phoneme?: string;
      Score?: number;
    }>;
  };
};

type AzureWordSyllable = {
  Syllable?: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
  };
};

type AzureWordDetail = {
  Word?: string;
  Offset?: number; // 单位：100纳秒
  Duration?: number; // 单位：100纳秒
  PronunciationAssessment?: {
    AccuracyScore?: number;
    ErrorType?: string;
  };
  Phonemes?: AzureWordPhoneme[];
  Syllables?: AzureWordSyllable[];
};

type AzurePronunciationDetail = {
  Words?: AzureWordDetail[];
  PronunciationAssessment?: {
    AccuracyScore?: number;
    CompletenessScore?: number;
    FluencyScore?: number;
    PronScore?: number;
    ProsodyScore?: number;
  };
  // NBest 结构（从 Azure rawJson 返回）
  Confidence?: number;
  Display?: string;
  ITN?: string;
  Lexical?: string;
  MaskedITN?: string;
};

type AggregateScores = {
  overall?: number | null;
  accuracy?: number | null;
  fluency?: number | null;
  completeness?: number | null;
  prosody?: number | null;
};

type BatchApiResponse = {
  success: boolean;
  runId?: string;
  recognizedText?: string | null;
  scores?: AggregateScores;
  detail?: AzurePronunciationDetail | null;
  azureJson?: unknown;
  storage?: {
    path?: string | null;
    publicUrl?: string | null;
    proxyUrl?: string | null;
  };
  durationMs?: number | null;
  error?: string;
};

type StreamChunk = {
  text: string;
  offsetMs?: number | null;
  durationMs?: number | null;
  scores?: AggregateScores;
  detail?: AzurePronunciationDetail | null;
  raw?: unknown;
};

const LOCALE_OPTIONS = [
  { value: 'en-US', label: '英语 (en-US)' },
  { value: 'zh-CN', label: '中文 (zh-CN)' },
  { value: 'ja-JP', label: '日语 (ja-JP)' },
];

const DEFAULT_REFERENCES: Record<string, string> = {
  'en-US':
    'The quick brown fox jumps over the lazy dog. Please read this passage clearly to test the pronunciation evaluation.',
  'zh-CN':
    '今天的天气很好，我们一起去公园散步吧。这段文本用于测试发音评测能力，请尽量清晰朗读。',
  'ja-JP':
    '昨日は新しい発音練習を試してみました。こちらの文章をはっきりと読み上げて、発音評価を体験してください。',
};

const scoreColor = (score?: number | null) => {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return 'text-muted-foreground';
  }
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

const scoreBg = (score?: number | null) => {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return 'bg-muted text-muted-foreground';
  }
  if (score >= 90) return 'bg-emerald-100 text-emerald-700';
  if (score >= 75) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
};

function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return '—';
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
}

// 浏览器发音功能
function speakText(text: string, locale?: string) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('浏览器不支持语音合成');
    return;
  }

  // 取消当前正在播放的语音
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // 根据 locale 设置语言
  if (locale) {
    if (locale.startsWith('ja')) {
      utterance.lang = 'ja-JP';
    } else if (locale.startsWith('zh')) {
      utterance.lang = 'zh-CN';
    } else if (locale.startsWith('en')) {
      utterance.lang = 'en-US';
    } else {
      utterance.lang = locale;
    }
  }
  
  // 设置语音参数
  utterance.rate = 0.9; // 稍慢一点，便于听清
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  window.speechSynthesis.speak(utterance);
}

// 播放音频片段
async function playAudioSegment(audioUrl: string, offsetIn100ns: number, durationIn100ns: number) {
  if (!audioUrl || typeof window === 'undefined') {
    console.warn('无法播放音频片段');
    return;
  }

  try {
    // 将 100 纳秒转换为秒
    const startTime = offsetIn100ns / 10_000_000; // 100ns -> seconds
    const duration = durationIn100ns / 10_000_000; // 100ns -> seconds

    // 获取音频数据
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();

    // 创建音频上下文
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 创建音频源
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    // 播放指定片段
    source.start(0, startTime, duration);

    // 播放完成后清理
    source.onended = () => {
      audioContext.close();
    };
  } catch (error) {
    console.error('播放音频片段失败:', error);
  }
}

const sanitizeDetail = <T,>(value: T): T => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeDetail(item)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === undefined) continue;
      out[key] = sanitizeDetail(val);
    }
    return out as T;
  }
  return value;
};

export default function AdminPronunciationTestPage() {
  const [mode, setMode] = useState<AssessMode>('batch');
  const [locale, setLocale] = useState<string>('en-US');
  const [referenceText, setReferenceText] = useState<string>(DEFAULT_REFERENCES['en-US']);
  const [sessionLabel, setSessionLabel] = useState<string>('');
  const [azureReady, setAzureReady] = useState<boolean>(false);
  const [statusChecking, setStatusChecking] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const lastLocaleRef = useRef<string>('en-US');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/admin/pronunciation-test/status', {
          cache: 'no-store',
          headers,
          credentials: 'same-origin',
        });
        if (cancelled) return;
        if (res.status === 401) {
          setAzureReady(false);
          setStatusError('未通过管理员认证，请刷新页面或重新登录管理员账号');
          return;
        }
        if (!res.ok) throw new Error(`状态检查失败: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setAzureReady(Boolean(data.azureConfigured));
        setStatusError(null);
      } catch (error) {
        if (cancelled) return;
        setAzureReady(false);
        setStatusError(error instanceof Error ? error.message : '未知错误');
      } finally {
        if (!cancelled) setStatusChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previousLocale = lastLocaleRef.current;
    const previousDefault = DEFAULT_REFERENCES[previousLocale];
    if (
      previousDefault &&
      referenceText.trim() === previousDefault.trim() &&
      DEFAULT_REFERENCES[locale]
    ) {
      setReferenceText(DEFAULT_REFERENCES[locale]);
    }
    lastLocaleRef.current = locale;
  }, [locale, referenceText]);

  return (
    <div className="space-y-6 pb-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-purple-500" />
            发音评测实验台
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            该页面用于在管理员环境下验证 Azure Speech Pronunciation Assessment 的评测效果。支持一次性和流式两种模式，并把结果写入
            <code>pronunciation_test_runs</code> 实验表。
          </p>
          <p>
            开始前请在 <code>.env.local</code> 中设置 <code>AZURE_SPEECH_KEY</code> 和{' '}
            <code>AZURE_SPEECH_REGION</code>。更多配置参考
            <code>docs/features/PRONUNCIATION_ASSESSMENT_GUIDE.md</code>。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">评测参数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">目标语言 / locale</label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger>
                  <SelectValue placeholder="选择语言" />
                </SelectTrigger>
                <SelectContent>
                  {LOCALE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">会话标签（可选）</label>
              <Input
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                placeholder="例如：样例脚本A / QA测试 / 2025Q4回归"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">参考原文（可空）</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReferenceText(DEFAULT_REFERENCES[locale] ?? '')}
              >
                使用示例文本
              </Button>
            </div>
            <Textarea
              rows={4}
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="粘贴需要朗读的原文。留空则按无脚本模式评测。"
            />
            <p className="text-xs text-muted-foreground">
              Azure 会启用 <code>PronunciationAssessmentGranularity.Phoneme</code>，返回音素级别错误。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={azureReady ? 'default' : 'secondary'}>
              {statusChecking ? '正在检测 Azure 配置...' : azureReady ? 'Azure 已就绪' : 'Azure 未配置'}
            </Badge>
            {statusError && <span className="text-xs text-red-500">{statusError}</span>}
          </div>
        </CardContent>
      </Card>

      {!azureReady && !statusChecking && (
        <Alert variant="destructive">
          <AlertDescription>
            未检测到 Azure Speech 配置，请设置 <code>AZURE_SPEECH_KEY</code> 和{' '}
            <code>AZURE_SPEECH_REGION</code> 后再进行评测。
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={mode} className="space-y-4" onValueChange={(value) => setMode(value as AssessMode)}>
        <TabsList>
          <TabsTrigger value="batch">读完一次性评测</TabsTrigger>
          <TabsTrigger value="stream">流式实时评测</TabsTrigger>
        </TabsList>

        <TabsContent value="batch">
          <BatchAssessmentPanel
            locale={locale}
            referenceText={referenceText}
            sessionLabel={sessionLabel}
            azureReady={azureReady && !statusChecking}
          />
        </TabsContent>

        <TabsContent value="stream">
          <StreamingAssessmentPanel
            locale={locale}
            referenceText={referenceText}
            sessionLabel={sessionLabel}
            azureReady={azureReady && !statusChecking}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type BatchAssessmentPanelProps = {
  locale: string;
  referenceText: string;
  sessionLabel: string;
  azureReady: boolean;
};

function BatchAssessmentPanel({
  locale,
  referenceText,
  sessionLabel,
  azureReady,
}: BatchAssessmentPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMime, setAudioMime] = useState<string>('audio/webm');
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [batchResult, setBatchResult] = useState<BatchApiResponse | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const resetRecording = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setDurationMs(null);
  }, []);

  useEffect(() => {
    // 同步 audioUrl 到 ref
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);


  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setBatchResult(null);
      resetRecording();

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持麦克风录音');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const MR = typeof window !== 'undefined' ? (window as any).MediaRecorder : undefined;
      if (!MR) throw new Error('MediaRecorder API 不可用');

      const isMimeSupported = (type: string) => {
        try {
          return typeof MR.isTypeSupported === 'function' ? MR.isTypeSupported(type) : false;
        } catch {
          return false;
        }
      };

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];
      const chosenMime = mimeCandidates.find(isMimeSupported) || 'audio/webm';
      const recorder: MediaRecorder = new MR(stream, { mimeType: chosenMime });
      mediaRecorderRef.current = recorder;
      setAudioMime(recorder.mimeType || chosenMime);
      chunksRef.current = [];
      startTimeRef.current = performance.now();

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || chosenMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        if (blob.size === 0) {
          setError('录音失败：未收集到音频数据，请检查麦克风权限或尝试重新录音');
          stream.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          return;
        }
        
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioBlob(blob);
        setAudioUrl(url);
        
        if (startTimeRef.current) {
          const duration = Math.max(0, Math.round(performance.now() - startTimeRef.current));
          setDurationMs(duration);
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      // 开始录音
      try {
        recorder.start(250);
      } catch {
        try {
          recorder.start();
        } catch (err2) {
          throw new Error('无法开始录音: ' + (err2 instanceof Error ? err2.message : '未知错误'));
        }
      }
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法启动录音');
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, [resetRecording]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      // 请求最后的数据
      if (typeof recorder.requestData === 'function') {
        try {
          recorder.requestData();
        } catch {
          // 忽略错误
        }
      }
      recorder.stop();
    }
    setIsRecording(false);
  }, []);

  const handleAssess = useCallback(async () => {
    if (!audioBlob) {
      setError('请先录制音频');
      return;
    }
    if (!azureReady) {
      setError('Azure 配置未就绪，无法调用评测');
      return;
    }
    setIsAssessing(true);
    setError(null);
    try {
      const form = new FormData();
      const ext = audioMime.includes('wav') ? 'wav' : 'webm';
      form.append('audio', audioBlob, `pron-assess.${ext}`);
      form.append('locale', locale);
      form.append('referenceText', referenceText);
      form.append('mode', 'batch');
      if (durationMs) form.append('durationMs', String(durationMs));
      if (sessionLabel) form.append('sessionLabel', sessionLabel);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/pronunciation-test/assess', {
        method: 'POST',
        body: form,
        headers,
        credentials: 'same-origin',
      });
      const data: BatchApiResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `评测失败（${res.status}）`);
      }
      data.detail = data.detail ? sanitizeDetail(data.detail) : null;
      setBatchResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '评测失败');
    } finally {
      setIsAssessing(false);
    }
  }, [audioBlob, audioMime, azureReady, durationMs, locale, referenceText, sessionLabel]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <AudioLines className="h-5 w-5 text-blue-500" />
          一次性评测流程
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">
              1. 使用浏览器录音（生成 WebM/WAV）
            </div>
            <p className="text-xs text-muted-foreground">
              停止录音后可试听一次，随后提交后台。服务器会用 ffmpeg 转码为 16k PCM，再调用 Azure Pronunciation
              Assessment。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button onClick={startRecording} disabled={isAssessing}>
                <Mic className="mr-2 h-4 w-4" />
                开始录音
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopRecording}>
                <Square className="mr-2 h-4 w-4" />
                停止
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={resetRecording}
              disabled={isRecording || (!audioUrl && !audioBlob)}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              重置
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">录音信息</div>
            <div className="flex justify-between">
              <span>状态</span>
              <span>{isRecording ? '录音中...' : audioBlob ? '已录制' : '待录音'}</span>
            </div>
            <div className="flex justify-between">
              <span>格式</span>
              <span>{audioMime}</span>
            </div>
            <div className="flex justify-between">
              <span>时长</span>
              <span>{formatDuration(durationMs)}</span>
            </div>
            {audioBlob && (
              <div className="flex justify-between">
                <span>大小</span>
                <span>{(audioBlob.size / 1024).toFixed(2)} KB</span>
              </div>
            )}
            {audioUrl ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">音频播放器：</div>
                <audio src={audioUrl} controls className="w-full" preload="metadata">
                  浏览器不支持音频播放
                </audio>
              </div>
            ) : audioBlob ? (
              <div className="text-xs text-amber-600">
                ⚠️ 音频已录制但 URL 未生成
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">
                2. 提交 Azure Pronunciation Assessment
              </div>
              <Button onClick={handleAssess} disabled={!audioBlob || isAssessing || !azureReady}>
                {isAssessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    调用中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    发送评测
                  </>
                )}
              </Button>
            </div>
            {!azureReady && (
              <Alert variant="destructive">
                <AlertDescription>Azure 未配置，无法执行评测。</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {batchResult?.success && (
              <BatchResultView
                response={batchResult}
                durationMs={durationMs ?? batchResult.durationMs ?? null}
                locale={locale}
                audioUrl={audioUrl}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type BatchResultViewProps = {
  response: BatchApiResponse;
  durationMs: number | null;
  locale?: string;
  audioUrl?: string | null;
};

function BatchResultView({ response, durationMs, locale, audioUrl }: BatchResultViewProps) {
  const scores = response.scores || {};
  const words = response.detail?.Words ?? [];
  const overall = scores.overall ?? response.detail?.PronunciationAssessment?.PronScore ?? null;

  return (
    <div className="space-y-4 rounded-lg border bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Badge variant="outline">RUN ID: {response.runId ?? '—'}</Badge>
        <Badge variant="secondary">存储路径: {response.storage?.path ?? '未上传'}</Badge>
        <Badge variant="secondary">识别文本: {response.recognizedText || '（空）'}</Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <ScoreTile title="Pron Score" value={overall} />
        <ScoreTile title="Accuracy" value={scores.accuracy} />
        <ScoreTile title="Fluency" value={scores.fluency} />
        <ScoreTile title="Completeness" value={scores.completeness} />
        <ScoreTile title="Prosody" value={scores.prosody} />
      </div>
      <div className="text-xs text-muted-foreground">
        评测时长：{formatDuration(durationMs)} · 返回音素级别错误，颜色越接近红色表示越需要关注
      </div>
      <WordPronunciationList words={words} locale={locale} audioUrl={audioUrl} />
    </div>
  );
}

function ScoreTile({ title, value }: { title: string; value?: number | null }) {
  const display = value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(1);
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className={cn('mt-1 text-lg font-semibold', scoreColor(value))}>{display}</div>
    </div>
  );
}

function WordPronunciationList({ 
  words, 
  locale, 
  audioUrl 
}: { 
  words: AzureWordDetail[]; 
  locale?: string; 
  audioUrl?: string | null;
}) {
  if (!words.length) {
    return (
      <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
        Azure 未返回单词级诊断信息
      </div>
    );
  }
  
  return (
    <div className="grid gap-3">
      {words.map((word, idx) => {
        const accuracy = word.PronunciationAssessment?.AccuracyScore;
        const errorType = word.PronunciationAssessment?.ErrorType;
        
        return (
          <div key={`${word.Word}-${idx}`} className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold">{word.Word || `词段 ${idx + 1}`}</div>
                <div className="flex items-center gap-1">
                  {word.Word && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => speakText(word.Word || '', locale)}
                      title="TTS 朗读"
                    >
                      <Volume2 className="h-3 w-3" />
                    </Button>
                  )}
                  {audioUrl && word.Offset !== undefined && word.Duration !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => playAudioSegment(audioUrl, word.Offset!, word.Duration!)}
                      title="播放录音片段"
                    >
                      <Play className="h-3 w-3 text-blue-500" />
                    </Button>
                  )}
                </div>
              </div>
              <div className={cn('text-sm font-semibold', scoreColor(accuracy))}>
                {accuracy === undefined || accuracy === null ? '—' : accuracy.toFixed(1)}
              </div>
            </div>
            {errorType && errorType !== 'None' && (
              <Badge variant="destructive" className="text-xs uppercase tracking-wide">
                {errorType === 'Mispronunciation' && '发音错误'}
                {errorType === 'Omission' && '漏读'}
                {errorType === 'Insertion' && '多读'}
                {!['Mispronunciation', 'Omission', 'Insertion'].includes(errorType) && errorType}
              </Badge>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              {(() => {
                const phonemes = word.Phonemes ?? [];
                const syllables = word.Syllables ?? [];
                const isJapanese = locale?.startsWith('ja');
                
                // 优先使用 Phonemes，如果为空则回退到 Syllables
                const items = phonemes.length > 0 ? phonemes : syllables;
                
                return items.map((item, itemIndex) => {
                  const pScore = item.PronunciationAssessment?.AccuracyScore;
                  const itemText = (item as any).Phoneme || (item as any).Syllable;
                  
                  // 日语显示序号，其他语言显示实际音素文本
                  const displayText = isJapanese 
                    ? `#${itemIndex + 1}` 
                    : (itemText && itemText !== '' ? itemText : `#${itemIndex + 1}`);
                  
                  // 获取实际发音（最可能的音素，主要对英语有效）
                  const nBestPhonemes = (item as any).PronunciationAssessment?.NBestPhonemes;
                  const actualPhoneme = nBestPhonemes?.[0]?.Phoneme;
                  const expectedPhoneme = itemText;
                  
                  // 如果有实际发音且与预期不同，显示提示（主要对英语有效）
                  const showActualPhoneme = 
                    !isJapanese && // 非日语才显示实际音素
                    actualPhoneme && 
                    expectedPhoneme && 
                    actualPhoneme !== expectedPhoneme &&
                    pScore !== undefined &&
                    pScore < 85; // 分数低于85时显示
                  
                  // 构建 tooltip 文本
                  let tooltipText = itemText || `音素 ${itemIndex + 1}`;
                  if (nBestPhonemes && nBestPhonemes.length > 0) {
                    const candidates = nBestPhonemes
                      .slice(0, 3)
                      .map((p: any) => `${p.Phoneme}(${p.Score?.toFixed(0)}%)`)
                      .join(', ');
                    tooltipText = showActualPhoneme
                      ? `预期: ${expectedPhoneme} → 实际: ${actualPhoneme}\n候选: ${candidates}`
                      : `实际: ${actualPhoneme}\n候选: ${candidates}`;
                  }
                  
                  return (
                    <span
                      key={`${word.Word}-${itemIndex}`}
                      className={cn('rounded-md px-2 py-1 font-mono text-xs shadow-sm', scoreBg(pScore))}
                      title={tooltipText}
                    >
                      {displayText}
                      {pScore !== undefined && pScore !== null && !Number.isNaN(pScore)
                        ? ` · ${pScore.toFixed(1)}`
                        : ''}
                      {showActualPhoneme && (
                        <span className="ml-1 text-[10px] text-red-600">
                          →{actualPhoneme}
                        </span>
                      )}
                    </span>
                  );
                });
              })()}
              {!(word.Phonemes?.length || word.Syllables?.length) && (
                <span className="text-xs text-muted-foreground">未返回音素级结果</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type StreamingAssessmentPanelProps = {
  locale: string;
  referenceText: string;
  sessionLabel: string;
  azureReady: boolean;
};

function StreamingAssessmentPanel({
  locale,
  referenceText,
  sessionLabel,
  azureReady,
}: StreamingAssessmentPanelProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const [recognizedText, setRecognizedText] = useState('');
  const [aggregate, setAggregate] = useState<AggregateScores | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  const recognizerRef = useRef<any>(null);
  const sdkRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const chunkBufferRef = useRef<StreamChunk[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stopContinuousRecognitionAsync?.(() => {
            recognizerRef.current?.close?.();
          });
        } catch {}
      }
    };
  }, []);

  const computeAggregate = useCallback((segments: StreamChunk[]): AggregateScores => {
    let totalWeight = 0;
    let overallSum = 0;
    let accuracySum = 0;
    let completenessSum = 0;
    let fluencySum = 0;
    let prosodySum = 0;

    for (const chunk of segments) {
      const duration = chunk.durationMs ?? chunk.text.length * 40;
      if (!duration || duration <= 0) continue;
      totalWeight += duration;
      const scores = chunk.scores || {};
      if (scores.overall ?? null) overallSum += (scores.overall ?? 0) * duration;
      if (scores.accuracy ?? null) accuracySum += (scores.accuracy ?? 0) * duration;
      if (scores.completeness ?? null) completenessSum += (scores.completeness ?? 0) * duration;
      if (scores.fluency ?? null) fluencySum += (scores.fluency ?? 0) * duration;
      if (scores.prosody ?? null) prosodySum += (scores.prosody ?? 0) * duration;
    }

    if (!totalWeight) return {};
    const safe = (sum: number) => Math.round((sum / totalWeight) * 10) / 10;
    return {
      overall: overallSum ? safe(overallSum) : null,
      accuracy: accuracySum ? safe(accuracySum) : null,
      completeness: completenessSum ? safe(completenessSum) : null,
      fluency: fluencySum ? safe(fluencySum) : null,
      prosody: prosodySum ? safe(prosodySum) : null,
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Math.round(performance.now() - startTimeRef.current));
      }
    }, 200);
  }, [stopTimer]);

  const startStreaming = useCallback(async () => {
    if (!azureReady) {
      setError('Azure 未配置，无法进行流式评测');
      return;
    }
    if (isStreaming || isStarting) return;

    setIsStarting(true);
    setError(null);
    setChunks([]);
    setRecognizedText('');
    setAggregate(null);
    setLastRunId(null);
    setElapsedMs(0);
    chunkBufferRef.current = [];

    try {
      if (!sdkRef.current) {
        const sdkModule = await import('microsoft-cognitiveservices-speech-sdk');
        sdkRef.current = (sdkModule.default || sdkModule) as typeof import('microsoft-cognitiveservices-speech-sdk');
      }
      const sdk = sdkRef.current as typeof import('microsoft-cognitiveservices-speech-sdk');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = {};
      if (session?.access_token) {
        authHeaders.Authorization = `Bearer ${session.access_token}`;
      }

      const tokenRes = await fetch('/api/admin/pronunciation-test/token', {
        cache: 'no-store',
        headers: authHeaders,
        credentials: 'same-origin',
      });
      const tokenPayload = await tokenRes.json();
      if (!tokenRes.ok || !tokenPayload.success) {
        throw new Error(tokenPayload.error || '获取 Azure token 失败');
      }

      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(tokenPayload.token, tokenPayload.region);
      speechConfig.speechRecognitionLanguage = locale;
      speechConfig.outputFormat = sdk.OutputFormat.Detailed;
      speechConfig.requestWordLevelTimestamps();

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      // 创建发音评估配置（按官方示例的方式）
      const pronConfig = new sdk.PronunciationAssessmentConfig(
        referenceText,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      
      // 根据语言设置音素字母表（中文必须用 SAPI）
      const alphabet = locale.toLowerCase().startsWith('zh') ? 'SAPI' : 'IPA';
      (pronConfig as any).phonemeAlphabet = alphabet;
      (pronConfig as any)._phonemeAlphabet = alphabet;
      (pronConfig as any).PhonemeAlphabet = alphabet;
      
      // 设置 NBestPhonemeCount
      (pronConfig as any).nBestPhonemeCount = 5;
      (pronConfig as any).NBestPhonemeCount = 5;
      (pronConfig as any).privNBestPhonemeCount = 5;
      
      // 英语启用韵律评测
      if (locale.toLowerCase().startsWith('en')) {
        try {
          if (typeof (pronConfig as any).enableProsodyAssessment === 'function') {
            (pronConfig as any).enableProsodyAssessment();
          }
        } catch {
          // 忽略错误
        }
      }
      
      pronConfig.applyTo(recognizer);

      recognizer.recognizing = (_s: unknown, e: any) => {
        const text = e?.result?.text;
        if (text) setLiveText(text);
      };

      recognizer.recognized = (_s: unknown, e: any) => {
        const result = e?.result as import('microsoft-cognitiveservices-speech-sdk').SpeechRecognitionResult | undefined;
        if (!result) return;
        const sdk = sdkRef.current as typeof import('microsoft-cognitiveservices-speech-sdk');
        if (result.reason === sdk.ResultReason.NoMatch) return;
        if (result.reason === sdk.ResultReason.Canceled) {
          const cancellation = sdk.CancellationDetails.fromResult(result);
          setError(`Azure 取消: ${cancellation.reason} ${cancellation.errorDetails || ''}`);
          return;
        }
        if (result.reason !== sdk.ResultReason.RecognizedSpeech) return;

        const pronResult = sdk.PronunciationAssessmentResult.fromResult(result);
        const detail = sanitizeDetail(pronResult.detailResult) as AzurePronunciationDetail | null;
        const chunk: StreamChunk = {
          text: result.text || '',
          offsetMs: typeof result.offset === 'number' ? Math.round(result.offset / 10000) : null,
          durationMs: typeof result.duration === 'number' ? Math.round(result.duration / 10000) : null,
          scores: {
            overall: pronResult.pronunciationScore ?? null,
            accuracy: pronResult.accuracyScore ?? null,
            completeness: pronResult.completenessScore ?? null,
            fluency: pronResult.fluencyScore ?? null,
            prosody: pronResult.prosodyScore ?? null,
          },
          detail,
          raw: (() => {
            try {
              return JSON.parse(
                result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult) || 'null',
              );
            } catch {
              return null;
            }
          })(),
        };

        chunkBufferRef.current = [...chunkBufferRef.current, chunk];
        setChunks(chunkBufferRef.current);
        setRecognizedText((prev) => (prev ? `${prev} ${result.text}` : result.text || ''));
        setAggregate(computeAggregate(chunkBufferRef.current));
      };

      recognizer.canceled = (_s: unknown, e: any) => {
        const details = e?.errorDetails || '';
        setError(details ? `Azure 取消: ${details}` : 'Azure 取消了会话');
      };

      recognizer.sessionStarted = () => {
        chunkBufferRef.current = [];
        setLiveText('');
        setError(null);
        startTimer();
        setIsStreaming(true);
      };

      recognizer.sessionStopped = () => {
        stopTimer();
        setIsStreaming(false);
        setLiveText('');
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          setIsStarting(false);
          setIsStreaming(true);
        },
        (err: unknown) => {
          setIsStarting(false);
          setError(err instanceof Error ? err.message : '启动流式评测失败');
        },
      );
    } catch (err) {
      setIsStarting(false);
      setError(err instanceof Error ? err.message : '启动流式评测失败');
    }
  }, [azureReady, computeAggregate, locale, referenceText, startTimer, isStreaming, isStarting]);

  const finalizeStreaming = useCallback(
    async (segments: StreamChunk[], finalText: string, elapsed: number) => {
      const aggregateScores = computeAggregate(segments);
      setAggregate(aggregateScores);
      if (!segments.length) return;
      setIsSaving(true);
      try {
        const mergedDetail: AzurePronunciationDetail | null = (() => {
          const words = segments.flatMap((chunk) => chunk.detail?.Words ?? []);
          const hasScores = Object.values(aggregateScores).some((score) => typeof score === 'number');
          if (!words.length && !hasScores) return null;
          return sanitizeDetail({
            Words: words,
            PronunciationAssessment: {
              PronScore: aggregateScores.overall ?? undefined,
              AccuracyScore: aggregateScores.accuracy ?? undefined,
              CompletenessScore: aggregateScores.completeness ?? undefined,
              FluencyScore: aggregateScores.fluency ?? undefined,
              ProsodyScore: aggregateScores.prosody ?? undefined,
            },
          });
        })();

        const payload = {
          locale,
          referenceText,
          sessionLabel,
          recognizedText: finalText,
          aggregate: aggregateScores,
          detail: mergedDetail,
          raw: segments,
          extra: {
            livePreview: liveText,
          },
          audioDurationMs: elapsed,
        };

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/admin/pronunciation-test/stream-log', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || '保存流式结果失败');
        }
        setLastRunId(data.runId ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存流式结果失败');
      } finally {
        setIsSaving(false);
      }
    },
    [computeAggregate, liveText, locale, referenceText, sessionLabel],
  );

  const stopStreaming = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (!recognizer || (!isStreaming && !isStarting)) return;
    setIsStopping(true);
    stopTimer();
    recognizer.stopContinuousRecognitionAsync(
      () => {
        recognizer.close?.();
        recognizerRef.current = null;
        setIsStopping(false);
        setIsStreaming(false);
        setLiveText('');
        finalizeStreaming(chunkBufferRef.current, recognizedText, elapsedMs);
      },
      (err: unknown) => {
        setIsStopping(false);
        setIsStreaming(false);
        setError(err instanceof Error ? err.message : '停止失败');
      },
    );
  }, [elapsedMs, finalizeStreaming, isStarting, isStreaming, recognizedText, stopTimer]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Waves className="h-5 w-5 text-sky-500" />
          流式实时评测
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">
              在浏览器端调用 Azure Speech SDK，边读边收到评测反馈
            </div>
            <p className="text-xs text-muted-foreground">
              点击「开始流式评测」后会申请麦克风并持续发送音频。停止后会把本次 session 汇总保存到 Supabase。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={startStreaming} disabled={isStreaming || isStarting || !azureReady}>
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在连接...
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  开始流式评测
                </>
              )}
            </Button>
            <Button variant="destructive" onClick={stopStreaming} disabled={!isStreaming || isStopping}>
              {isStopping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  停止中...
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  停止
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">实时状态</div>
              <div className="mt-1 text-sm">
                {isStreaming ? (
                  <span className="text-green-600">Streaming...</span>
                ) : isStarting ? (
                  <span className="text-blue-600">准备中...</span>
                ) : (
                  <span className="text-muted-foreground">等待开始</span>
                )}
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>已识别文本长度</span>
                <span>{recognizedText.length}</span>
              </div>
              <div className="flex justify-between">
                <span>已识别分段数量</span>
                <span>{chunks.length}</span>
              </div>
              <div className="flex justify-between">
                <span>流式时长</span>
                <span>{formatDuration(elapsedMs)}</span>
              </div>
            </div>
            <div className="rounded-md bg-background p-3 text-sm text-muted-foreground">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                实时识别
              </div>
              <div className="min-h-[52px] whitespace-pre-wrap break-words text-muted-foreground">
                {liveText || '（等待识别）'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {recognizedText && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">最终识别文本</div>
                <div className="mt-2 whitespace-pre-wrap break-words text-sm">{recognizedText}</div>
              </div>
            )}

            {(aggregate || lastRunId) && (
              <div className="rounded-lg border bg-card/60 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
                  <Badge variant="outline">RUN ID: {lastRunId ?? '（尚未保存）'}</Badge>
                  <Badge variant="secondary">流式分段: {chunks.length}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  <ScoreTile title="Pron Score" value={aggregate?.overall ?? null} />
                  <ScoreTile title="Accuracy" value={aggregate?.accuracy ?? null} />
                  <ScoreTile title="Fluency" value={aggregate?.fluency ?? null} />
                  <ScoreTile title="Completeness" value={aggregate?.completeness ?? null} />
                  <ScoreTile title="Prosody" value={aggregate?.prosody ?? null} />
                </div>
              </div>
            )}

            {chunks.length > 0 && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-muted-foreground">分段详细反馈（音素级）</div>
                  {isSaving && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      保存中...
                    </div>
                  )}
                </div>
                {chunks.map((chunk, idx) => (
                  <div key={`${chunk.text}-${idx}`} className="space-y-2 rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-muted-foreground">
                        分段 {idx + 1} · {formatDuration(chunk.durationMs)}
                      </div>
                      <div className={cn('text-sm font-semibold', scoreColor(chunk.scores?.overall ?? null))}>
                        {chunk.scores?.overall ?? chunk.scores?.accuracy
                          ? (chunk.scores?.overall ?? chunk.scores?.accuracy ?? 0).toFixed(1)
                          : '—'}
                      </div>
                    </div>
                    <div className="text-sm">{chunk.text || '（空）'}</div>
                    {chunk.detail?.Words && (
                      <WordPronunciationList 
                        words={chunk.detail.Words} 
                        locale={locale}
                        audioUrl={null}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
