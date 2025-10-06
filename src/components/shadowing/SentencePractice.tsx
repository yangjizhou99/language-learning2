'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, Volume2 } from 'lucide-react';

type Lang = 'ja' | 'en' | 'zh';

type WebSpeechRecognitionEvent = {
  resultIndex: number;
  results: Array<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
};

type WebSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart?: () => void;
  onresult?: (event: WebSpeechRecognitionEvent) => void;
  onerror?: (event: { error?: string }) => void;
  onend?: () => void;
  start: () => void;
  stop: () => void;
};

interface SentencePracticeProps {
  originalText: string | undefined | null;
  language: Lang;
  className?: string;
}

function splitSentences(text: string, language: Lang): string[] {
  if (!text || !text.trim()) return [];
  try {
    // Use Intl.Segmenter when available
    const SegClass = (Intl as unknown as { Segmenter?: new (loc: string, opts: { granularity: 'sentence' }) => any }).Segmenter;
    if (SegClass) {
      const seg = new SegClass(language, { granularity: 'sentence' });
      const parts: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      for (const { segment } of seg.segment(text) as any) {
        const s = String(segment).trim();
        if (s) parts.push(s);
      }
      if (parts.length) return parts;
    }
  } catch {}

  // Fallback regex by language
  if (language === 'en') {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // zh/ja punctuation
  return text
    .split(/[。！？!?…]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokenize(text: string, language: Lang): string[] {
  if (!text) return [];
  if (language === 'en') {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !EN_STOPWORDS.has(w));
  }
  // For zh/ja: simple char-based with basic punctuation removal
  return Array.from(text.replace(/[\p{P}\p{S}\s]/gu, '')).filter(Boolean);
}

function levenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

const EN_STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','when','at','by','for','in','of','on','to','with','as','is','are','was','were','be','been','being','do','does','did','have','has','had','i','you','he','she','it','we','they','them','me','my','your','his','her','its','our','their','this','that','these','those','from'
]);

export default function SentencePractice({ originalText, language, className = '' }: SentencePracticeProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [finalText, setFinalText] = useState('');
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastResultAtRef = useRef<number>(0);

  const sentences = useMemo(() => splitSentences(originalText || '', language), [originalText, language]);
  const total = sentences.length;
  const currentSentence = sentences[activeIndex] || '';

  // 是否为对话类型（存在 A: / B: / A： / B： 行首标签）
  const isConversation = useMemo(() => {
    const t = originalText || '';
    return /(?:^|\n)\s*[ABＡＢ][：:]/.test(t);
  }, [originalText]);

  // metrics
  const { coverage, similarity, missing, extra } = useMemo(() => {
    const targetRaw = tokenize(currentSentence, language);
    const saidRaw = tokenize(finalText, language);

    const filterSpeaker = (arr: string[]) =>
      isConversation ? arr.filter((w) => w.toLowerCase() !== 'a' && w.toLowerCase() !== 'b') : arr;

    const targetTokens = filterSpeaker(targetRaw);
    const saidTokens = filterSpeaker(saidRaw);
    const cov = targetTokens.length > 0 ? Math.min(1, saidTokens.length / targetTokens.length) : 0;
    const dist = levenshtein(targetTokens, saidTokens);
    const maxLen = Math.max(targetTokens.length, saidTokens.length, 1);
    const sim = 1 - dist / maxLen;
    const missingTokens = unique(targetTokens.filter((t) => !saidTokens.includes(t)));
    const extraTokens = unique(saidTokens.filter((t) => !targetTokens.includes(t)));
    return { coverage: cov, similarity: sim, missing: missingTokens, extra: extraTokens };
  }, [currentSentence, finalText, language]);

  // 清理静默定时器
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // init recognition per language
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as unknown as { SpeechRecognition?: new () => WebSpeechRecognition; webkitSpeechRecognition?: new () => WebSpeechRecognition }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => WebSpeechRecognition; webkitSpeechRecognition?: new () => WebSpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    const langMap: Record<string, string> = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' };
    rec.lang = langMap[language] || 'en-US';
    rec.onstart = () => {
      setIsRecognizing(true);
      setDisplayText('');
      setFinalText('');
      lastResultAtRef.current = Date.now();
      clearSilenceTimer();
      // 每 300ms 检查一次，超过 2s 无新结果则自动结束
      silenceTimerRef.current = window.setInterval(() => {
        if (!isRecognizing) return;
        const diff = Date.now() - lastResultAtRef.current;
        if (diff >= 2000) {
          try { rec.stop(); } catch {}
          clearSilenceTimer();
        }
      }, 300);
    };
    rec.onresult = (event: WebSpeechRecognitionEvent) => {
      lastResultAtRef.current = Date.now();
      // Web Speech API 通常会在每次回调里带上从 0 开始的全部结果
      // 将所有 final 拼接为完整最终文本，interim 仅取当前回合的临时部分
      let fullFinal = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) fullFinal += transcript + ' ';
        else if (i >= event.resultIndex) interim += transcript; // 当前批次的临时结果
      }
      const finalTrimmed = fullFinal.trim();
      setFinalText(finalTrimmed);
      const combined = `${finalTrimmed}${finalTrimmed && interim ? ' ' : ''}${interim}`.trim();
      setDisplayText(combined);
    };
    rec.onerror = () => {
      setIsRecognizing(false);
      clearSilenceTimer();
    };
    rec.onend = () => {
      setIsRecognizing(false);
      clearSilenceTimer();
    };
    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
      clearSilenceTimer();
    };
  }, [language]);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      alert('当前浏览器不支持实时语音识别，请更换浏览器/开启权限');
      return;
    }
    try {
      setDisplayText('');
      setFinalText('');
      recognitionRef.current.start();
    } catch {
      alert('无法开始识别，请更换浏览器/开启权限');
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const speak = useCallback(() => {
    try {
      // 忽略对话角色标签（A: / B: / A： / B：）
      const sentenceForTts = currentSentence.replace(/^\s*[ABＡＢ]\s*[：:]\s*/, '');
      const utter = new SpeechSynthesisUtterance(sentenceForTts);
      const langMap: Record<string, string> = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' };
      utter.lang = langMap[language] || 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {}
  }, [currentSentence, language]);

  const next = useCallback(() => {
    window.speechSynthesis.cancel();
    setDisplayText('');
    setFinalText('');
    setActiveIndex((i) => Math.min(i + 1, Math.max(0, total - 1)));
  }, [total]);

  const prev = useCallback(() => {
    window.speechSynthesis.cancel();
    setDisplayText('');
    setFinalText('');
    setActiveIndex((i) => Math.max(0, i - 1));
  }, []);

  return (
    <Card className={`p-4 md:p-6 border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 ${className || ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-indigo-600">🗣️</span>
          逐句练习（不保存）
        </h3>
        <div className="text-sm text-gray-600">{total > 0 ? `${activeIndex + 1}/${total}` : '无句子'}</div>
      </div>

      {total > 0 ? (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-gray-900 leading-relaxed">{currentSentence}</div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={speak} variant="outline" size="sm" className="rounded-lg">
              <Volume2 className="w-4 h-4 mr-1" /> 朗读本句
            </Button>
            {!isRecognizing ? (
              <Button onClick={start} variant="default" size="sm" className="rounded-lg">
                <Play className="w-4 h-4 mr-1" /> 开始练习
              </Button>
            ) : (
              <Button onClick={stop} variant="destructive" size="sm" className="rounded-lg">
                <Square className="w-4 h-4 mr-1" /> 停止
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button onClick={prev} variant="ghost" size="sm" className="rounded-lg">上一句</Button>
              <Button onClick={next} variant="ghost" size="sm" className="rounded-lg">下一句</Button>
            </div>
          </div>

          {(isRecognizing || displayText) && (
            <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="text-xs font-medium text-green-700 mb-1">实时转录：</div>
              <div className="text-sm text-green-800 whitespace-pre-wrap break-words leading-relaxed">{displayText}</div>
            </div>
          )}

          {finalText && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500">覆盖度</div>
                  <div className="text-lg font-semibold text-gray-900">{Math.round(coverage * 100)}%</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500">相似度</div>
                  <div className="text-lg font-semibold text-gray-900">{Math.round(similarity * 100)}%</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-500">识别字数</div>
                  <div className="text-lg font-semibold text-gray-900">{tokenize(finalText, language).length}</div>
                </div>
              </div>

              {(missing.length > 0 || extra.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {missing.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-amber-200">
                      <div className="text-xs font-medium text-amber-700 mb-1">缺失关键词</div>
                      <div className="text-sm text-amber-800 flex flex-wrap gap-2">
                        {missing.map((w) => (
                          <span key={`miss-${w}`} className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {extra.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-red-200">
                      <div className="text-xs font-medium text-red-700 mb-1">误读/多读</div>
                      <div className="text-sm text-red-800 flex flex-wrap gap-2">
                        {extra.map((w) => (
                          <span key={`extra-${w}`} className="px-2 py-0.5 bg-red-50 border border-red-200 rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-gray-500">暂无内容</div>
      )}
    </Card>
  );
}


