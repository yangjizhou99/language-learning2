'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { performAlignment, calculateSimilarityScore, AlignmentResult, AcuUnit } from '@/lib/alignment-utils';

export type LangCode = 'ja' | 'en' | 'zh' | 'ko';

type WebSpeechRecognitionEvent = {
  resultIndex: number;
  results: Array<{ 0: { transcript: string }; isFinal: boolean }>;
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

export interface SentenceSegment {
  index: number;
  text: string;
  start?: number;
  end?: number;
  speaker?: string;
}

export interface SentenceScore {
  score: number; // 0-1
  finalText: string;
  missing: string[];
  extra: string[];
  alignmentResult?: AlignmentResult;
  attempts?: number;
  firstScore?: number;
  bestScore?: number;
}

export interface UseSentencePracticeCoreOptions {
  originalText?: string | null;
  language: LangCode;
  sentenceTimeline?: SentenceSegment[] | null;
  onPlaySentence?: (index: number) => Promise<void> | void;
  acuUnits?: AcuUnit[];
  enabled?: boolean;
  onScoreUpdate?: (index: number, score: SentenceScore) => void;
  externalScores?: Record<number, SentenceScore>;
}

function mapLangToLocale(lang: LangCode): string {
  switch (lang) {
    case 'ja': return 'ja-JP';
    case 'zh': return 'zh-CN';
    case 'ko': return 'ko-KR';
    case 'en':
    default: return 'en-US';
  }
}

function stripSpeakerLabel(line: string): string {
  const m = String(line || '').trim().match(/^([A-Za-zＡ-Ｚ])[:：]\s*(.+)$/);
  if (!m) return String(line || '');
  return m[2].trim();
}

function splitTextToSentences(text: string, language: LangCode): string[] {
  const src = String(text || '').trim();
  if (!src.trim()) return [];
  const hasDialogue = /(?:^|\n)\s*[ABＡＢ]\s*[：:]/.test(src);
  if (hasDialogue) {
    const normalized = src
      .replace(/([^\n])\s*([AＡ]\s*[：:])/g, '$1\n$2')
      .replace(/([^\n])\s*([BＢ]\s*[：:])/g, '$1\n$2');
    return normalized.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const locale = language === 'ko' ? 'ko-KR' : language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US';
      const segmenter = new (Intl as any).Segmenter(locale, { granularity: 'sentence' });
      const parts: string[] = [];
      for (const seg of Array.from((segmenter as any).segment(src))) {
        const s = String((seg as any).segment || '').trim();
        if (s) parts.push(s);
      }
      if (parts.length) return parts;
    } catch { }
  }
  if (language === 'en' || language === 'ko') {
    return src.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  }
  return src.split(/[。！？!?…]+/).map((s) => s.trim()).filter(Boolean);
}

function tokenize(text: string, lang: LangCode): string[] {
  const cleaned = stripSpeakerLabel(text)
    .replace(/[“”"\u300C\u300D]/g, '')
    .trim();
  if (lang === 'en' || lang === 'ko') {
    return cleaned
      .toLowerCase()
      .replace(/[^a-z0-9\u3131-\u318E\uAC00-\uD7A3\s]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }
  // zh/ja: 按字符
  const removedPunct = cleaned.replace(/[，。,．．。！？!？、；：:“”"'‘’（）()\[\]【】《》〈〉…—\-·\s]/g, '');
  return removedPunct.split('').filter((c) => c.trim().length > 0);
}

// ... (lines 41-234 unchanged)

export function useSentencePracticeCore({ originalText, language, sentenceTimeline, onPlaySentence, acuUnits, enabled = true, onScoreUpdate, externalScores }: UseSentencePracticeCoreOptions) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [sentenceScores, setSentenceScores] = useState<Record<number, SentenceScore>>({});
  const [speakingDuration, setSpeakingDuration] = useState(0);

  // Sync with external scores
  useEffect(() => {
    if (externalScores) {
      // Sync attempts ref
      Object.entries(externalScores).forEach(([k, v]) => {
        const idx = Number(k);
        if (v && typeof v.attempts === 'number') {
          // Only update if external is greater (to avoid overwriting local increments before sync)
          // Or if it's a reset (external is 0 or missing? No, v.attempts is number)
          // Actually, if external is significantly different, we should trust it?
          // Let's trust external if it exists, but be careful about race conditions.
          // Since external comes from us, it should be consistent.
          // But if we just incremented locally, external might be stale by 1.
          // So max is safer?
          // But if we reset (attempts=0), max will keep old value.
          // If reset happens, externalScores will be empty or attempts=0.
          // If externalScores is empty, this loop won't run for those keys.
          // We need to handle reset.
          attemptsRef.current[idx] = v.attempts;
        }
      });

      setSentenceScores(prev => {
        // Only update if there are changes to avoid infinite loops
        const hasChanges = Object.keys(externalScores).some(key => {
          const k = Number(key);
          return JSON.stringify(prev[k]) !== JSON.stringify(externalScores[k]);
        });
        if (hasChanges || Object.keys(externalScores).length !== Object.keys(prev).length) {
          return { ...prev, ...externalScores };
        }
        return prev;
      });
    } else {
      // If externalScores is null/undefined, maybe reset?
      // But usually it's passed as {} initially.
    }
  }, [externalScores]);

  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  const lastResultAtRef = useRef<number>(0);
  const tempCombinedTextRef = useRef('');
  const tempFinalTextRef = useRef('');
  const attemptsRef = useRef<Record<number, number>>({});
  const speakingStartTimeRef = useRef<number | null>(null);

  const sentences: SentenceSegment[] = useMemo(() => {
    if (Array.isArray(sentenceTimeline) && sentenceTimeline.length > 0) {
      const ordered = [...sentenceTimeline].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return ordered.map((s) => ({ index: s.index, text: s.text, start: s.start, end: s.end, speaker: s.speaker }));
    }
    const arr = splitTextToSentences(String(originalText || ''), language);
    return arr.map((line, idx) => ({ index: idx, text: line }));
  }, [sentenceTimeline, originalText, language]);

  // 初始化 Web Speech Recognition
  useEffect(() => {
    if (!enabled) {
      recognitionRef.current = null;
      return;
    }
    const SpeechRecognition = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return;
    }
    const rec: WebSpeechRecognition = new (SpeechRecognition as any)();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = mapLangToLocale(language);

    rec.onstart = () => {
      speakingStartTimeRef.current = Date.now();
    };

    rec.onresult = (event: WebSpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) final += (res as any)[0]?.transcript || '';
        else interim += (res as any)[0]?.transcript || '';
      }
      tempCombinedTextRef.current = interim;
      tempFinalTextRef.current = final;
      setDisplayText((final + ' ' + interim).trim());

      // 重置静音计时器（与第四步一致：连续静音阈值触发结束）
      lastResultAtRef.current = Date.now();
      if (silenceTimerRef.current) {
        try { clearTimeout(silenceTimerRef.current); } catch { }
        silenceTimerRef.current = null;
      }
      const SILENCE_MS = 1200;
      silenceTimerRef.current = window.setTimeout(() => {
        try { recognitionRef.current?.stop?.(); } catch { }
      }, SILENCE_MS) as any;
    };

    rec.onend = () => {
      setIsRecognizing(false);
      // Accumulate duration
      if (speakingStartTimeRef.current) {
        const duration = Date.now() - speakingStartTimeRef.current;
        setSpeakingDuration(prev => prev + duration);
        speakingStartTimeRef.current = null;
      }
      // 保存最终文本
      const textToSave = tempFinalTextRef.current || tempCombinedTextRef.current || '';
      if (textToSave && expandedIndex !== null) {
        setFinalText(textToSave);
        scoreCurrent(textToSave, expandedIndex);
      }
      // 清理计时器
      if (silenceTimerRef.current) { try { clearTimeout(silenceTimerRef.current); } catch { } silenceTimerRef.current = null; }
      if (maxDurationTimerRef.current) { try { clearTimeout(maxDurationTimerRef.current); } catch { } maxDurationTimerRef.current = null; }
    };

    rec.onerror = (event: { error?: string }) => {
      const err = (event?.error || '').toLowerCase();
      // 无语音时直接结束，避免长等待
      if (err === 'no-speech' || err === 'audio-capture') {
        try { recognitionRef.current?.stop?.(); } catch { }
        return;
      }
      // already started：做一次安全重试
      if (err.includes('already')) {
        try { recognitionRef.current?.stop?.(); } catch { }
        setTimeout(() => { try { recognitionRef.current?.start?.(); } catch { } }, 120);
      }
    };

    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch { }
      recognitionRef.current = null;
      if (silenceTimerRef.current) { try { clearTimeout(silenceTimerRef.current); } catch { } silenceTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, expandedIndex, enabled]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      try { clearTimeout(silenceTimerRef.current); } catch { }
      silenceTimerRef.current = null;
    }
  }, []);

  const scoreCurrent = useCallback((spoken: string, index: number) => {
    const target = sentences.find((s) => s.index === index) || sentences[index];
    if (!target) return;
    const targetTokens = tokenize(target.text, language);
    const saidTokens = tokenize(spoken, language);
    const alignment = performAlignment(targetTokens, saidTokens, acuUnits, target.text, language);
    const score = calculateSimilarityScore(targetTokens, saidTokens, alignment);

    setSentenceScores((prev) => {
      const prevScore = prev[index];

      // Use ref for reliable increment
      const currentAttempts = (attemptsRef.current[index] || 0) + 1;
      attemptsRef.current[index] = currentAttempts;
      const attempts = currentAttempts;

      const firstScore = prevScore?.firstScore !== undefined ? prevScore.firstScore : score;
      const bestScore = Math.max(prevScore?.bestScore || 0, score);

      const newScoreData = {
        score, // Current score
        finalText: spoken,
        missing: alignment.missing.map((m) => m.expected || ''),
        extra: alignment.extra.map((e) => e.actual),
        alignmentResult: alignment,
        attempts,
        firstScore,
        bestScore,
      };

      // Notify parent about the update
      if (onScoreUpdate) {
        onScoreUpdate(index, newScoreData);
      }

      return {
        ...prev,
        [index]: newScoreData,
      };
    });
  }, [language, sentences, acuUnits, onScoreUpdate]);

  const ensureMicReleased = useCallback(async (delayMs = 150) => {
    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { }
      }
    } finally {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }, []);

  const speak = useCallback(async (index: number) => {
    await ensureMicReleased(120);
    try { await onPlaySentence?.(index); } catch { }
  }, [ensureMicReleased, onPlaySentence]);

  const start = useCallback((index?: number) => {
    if (!enabled) return;
    if (!recognitionRef.current) return;
    const idx = typeof index === 'number' ? index : expandedIndex;
    if (idx === null || typeof idx !== 'number') return;

    // 若指定了句子索引，先切换当前展开句，避免录到上一句
    if (typeof index === 'number' && index !== expandedIndex) {
      setExpandedIndex(index);
    }

    // 重置
    tempCombinedTextRef.current = '';
    tempFinalTextRef.current = '';
    setDisplayText('');
    setFinalText('');
    setIsRecognizing(true);

    // 清理旧计时器
    clearSilenceTimer();
    if (maxDurationTimerRef.current) { try { clearTimeout(maxDurationTimerRef.current); } catch { } maxDurationTimerRef.current = null; }

    try { recognitionRef.current.start(); } catch { }

    // 最大录音时长兜底（防止无限识别）
    const MAX_DURATION_MS = 15000;
    maxDurationTimerRef.current = window.setTimeout(() => {
      try { recognitionRef.current?.stop?.(); } catch { }
    }, MAX_DURATION_MS) as any;
  }, [expandedIndex, clearSilenceTimer, enabled]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop?.(); } catch { }
    setIsRecognizing(false);
    // 清理计时器
    if (silenceTimerRef.current) { try { clearTimeout(silenceTimerRef.current); } catch { } silenceTimerRef.current = null; }
    if (maxDurationTimerRef.current) { try { clearTimeout(maxDurationTimerRef.current); } catch { } maxDurationTimerRef.current = null; }
  }, []);

  const retry = useCallback((index?: number) => {
    if (typeof index === 'number') setExpandedIndex(index);
    setDisplayText('');
    setFinalText('');
    setTimeout(() => start(typeof index === 'number' ? index : undefined), 80);
  }, [start]);

  const total = sentences.length;

  const currentMetrics = useMemo(() => {
    if (expandedIndex === null) return null;
    const score = sentenceScores[expandedIndex];
    if (!score) return null;
    return { score: score.score, missing: score.missing, extra: score.extra } as { score: number; missing: string[]; extra: string[] };
  }, [expandedIndex, sentenceScores]);

  // 清空显示文字（不开始录音）
  const clearText = useCallback(() => {
    setDisplayText('');
    setFinalText('');
    tempCombinedTextRef.current = '';
    tempFinalTextRef.current = '';
  }, []);

  return {
    sentences,
    total,
    expandedIndex,
    setExpandedIndex,
    isRecognizing,
    displayText,
    finalText,
    currentMetrics,
    sentenceScores,
    start,
    stop,
    retry,
    speak,
    ensureMicReleased,
    clearText,
    speakingDuration,
  };
}

export type UseSentencePracticeCoreReturn = ReturnType<typeof useSentencePracticeCore>;


