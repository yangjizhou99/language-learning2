'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, Volume2, ChevronDown, ChevronUp, Pause, RotateCcw, SkipForward, Mic } from 'lucide-react';
import SentencePracticeProgress from './SentencePracticeProgress';
import SmartSuggestion from './SmartSuggestion';
import { Toast } from './ScoreAnimation';
import SentenceCard from './SentenceCard';
import AudioSpeedControl from './AudioSpeedControl';
import { useMobile } from '@/contexts/MobileContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { performAlignment, calculateSimilarityScore, AlignmentResult, AcuUnit } from '@/lib/alignment-utils';
import { toast } from 'sonner';
import { useSentencePracticeCore } from '@/hooks/useSentencePracticeCore';

type Lang = 'ja' | 'en' | 'zh' | 'ko';

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

export interface RolePracticeSegment {
  index: number;
  start?: number;
  end?: number;
  text: string;
  speaker: string;
}

export interface RoleSentenceScore {
  index: number;
  transcript: string;
  text: string;
  scoreRatio: number;
  scorePercent: number;
  missing: string[];
  extra: string[];
  skipped?: boolean;
}

interface SentenceScore {
  score: number; // 综合相似度评分 (0-1范围)
  finalText: string;
  missing: string[];
  extra: string[];
  alignmentResult?: AlignmentResult; // 新增：对齐分析结果
}

interface SentencePracticeProps {
  originalText: string | undefined | null;
  language: Lang;
  className?: string;
  audioUrl?: string | null;
  sentenceTimeline?: Array<{ index: number; text: string; start: number; end: number; speaker?: string }>;
  practiceMode?: 'default' | 'role';
  activeRole?: string;
  roleSegments?: RolePracticeSegment[];
  onRoleRoundComplete?: (results: RoleSentenceScore[]) => void;
  acuUnits?: AcuUnit[]; // 新增：ACU 单元数据
  onPlaySentence?: (index: number) => Promise<void> | void; // 新增：统一用主播放器播放分段，可返回 Promise 等待完成
  completedSegmentIndex?: number | null; // 新增：播放完成的句子索引（用于检测播放完成）
  renderText?: (text: string) => React.ReactNode; // 可选：自定义句子渲染（用于注音）
}

const mapLangToLocale = (lang: Lang): string => {
  switch (lang) {
    case 'ja':
      return 'ja-JP';
    case 'zh':
      return 'zh-CN';
    case 'ko':
      return 'ko-KR';
    case 'en':
    default:
      return 'en-US';
  }
};

const normalizeSpeakerSymbol = (value: string | null | undefined) => {
  if (!value) return '';
  const converted = value.replace(/[Ａ-Ｚａ-ｚ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0),
  );
  const match = converted.match(/[A-Za-z]/);
  if (match) return match[0].toUpperCase();
  return converted.trim().charAt(0).toUpperCase();
};

const parseSegmentLine = (line: string): { speaker: string; content: string } | null => {
  if (!line) return null;
  const trimmed = line.trim();
  const match = trimmed.match(/^([A-Za-zＡ-Ｚ])[:：]\s*(.+)$/);
  if (!match) return null;
  const speaker = normalizeSpeakerSymbol(match[1]);
  const content = match[2].trim();
  if (!speaker || !content) return null;
  return { speaker, content };
};

const buildSegmentsFromText = (text: string | null | undefined): RolePracticeSegment[] => {
  if (!text) return [];
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const segments: RolePracticeSegment[] = [];
  let cursor = 0;
  lines.forEach((line) => {
    const parsed = parseSegmentLine(line);
    if (!parsed) return;
    const duration = Math.max(parsed.content.length / 5, 2);
    segments.push({
      index: segments.length,
      speaker: parsed.speaker,
      text: parsed.content,
      start: cursor,
      end: cursor + duration,
    });
    cursor += duration;
  });
  return segments;
};

const mergeTimelineWithText = (
  timeline: Array<{ index?: number; text?: string; start?: number; end?: number; speaker?: string }> = [],
  textSegments: RolePracticeSegment[],
): RolePracticeSegment[] => {
  if (!timeline.length) {
    return textSegments.map((seg, idx) => ({ ...seg, index: idx }));
  }

  const result: RolePracticeSegment[] = [];
  const fallbackQueue = [...textSegments];

  timeline.forEach((segment, order) => {
    const fallback = fallbackQueue[0];
    const rawText = typeof segment.text === 'string' ? segment.text.trim() : '';
    const parsedFromTimeline = parseSegmentLine(rawText);

    let speaker = normalizeSpeakerSymbol(
      segment.speaker || parsedFromTimeline?.speaker || fallback?.speaker || '',
    );
    let content =
      parsedFromTimeline?.content ||
      (rawText && parsedFromTimeline ? parsedFromTimeline.content : rawText) ||
      fallback?.text ||
      '';

    if (!content && fallback) {
      content = fallback.text;
    } else if (content) {
      const parsed = parseSegmentLine(content);
      if (parsed) {
        speaker = speaker || parsed.speaker;
        content = parsed.content;
      }
    }

    if (!content) return;

    const start =
      typeof segment.start === 'number'
        ? segment.start
        : fallback?.start ?? order * 4;
    const end =
      typeof segment.end === 'number'
        ? segment.end
        : fallback?.end ?? start + Math.max(content.length / 5, 2);

    result.push({
      index: order,
      speaker: speaker || 'A',
      text: content.trim(),
      start,
      end,
    });

    if (fallbackQueue.length) {
      fallbackQueue.shift();
    }
  });

  if (!result.length) {
    return textSegments.map((seg, idx) => ({ ...seg, index: idx }));
  }

  return result
    .filter((seg) => seg.text.length > 0)
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
    .map((seg, idx) => ({
      ...seg,
      index: idx,
    }));
};

export function deriveRoleSegments(
  text: string | null | undefined,
  timeline?: Array<{ index: number; text: string; start: number; end: number; speaker?: string }>,
): RolePracticeSegment[] {
  const textSegments = buildSegmentsFromText(text);
  return mergeTimelineWithText(timeline, textSegments);
}

const splitSentences = (text: string, language: Lang): string[] => {
  if (!text || !text.trim()) return [];
  
  // 处理对话格式（A: / B: 开头的内容）
  const hasDialogue = /(?:^|\n)\s*[ABＡＢ]\s*[：:]/.test(text);
  if (hasDialogue) {
    let normalized = text;
    normalized = normalized.replace(/([^\n])\s*([AＡ]\s*[：:])/g, '$1\n$2');
    normalized = normalized.replace(/([^\n])\s*([BＢ]\s*[：:])/g, '$1\n$2');
    const parts = normalized
      .split(/(?=^\s*[ABＡＢ]\s*[：:])/m)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts;
  }

  // 尝试使用 Intl.Segmenter 进行句子切分
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      // 为韩语使用 ko-KR locale，其他语言使用对应的 locale
      const locale = language === 'ko' ? 'ko-KR' : language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US';
      const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
      const segments = Array.from(segmenter.segment(text));
      const parts: string[] = [];
      
      for (const segment of segments) {
        const s = segment.segment.trim();
        if (s) {
          parts.push(s);
        }
      }
      
      if (parts.length > 0) {
        return parts;
      }
    } catch (error) {
      console.warn(`Intl.Segmenter 切分失败，回退到标点切分:`, error);
    }
  } else {
    // 浏览器不支持 Intl.Segmenter，使用标点切分
  }

  // 回退到标点符号切分
  if (language === 'en' || language === 'ko') {
    // 英语和韩语使用英文标点符号
    const result = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return result;
  }
  
  // 中文和日文使用对应的标点符号
  const result = text
    .split(/[。！？!?…]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return result;
};

const tokenize = (text: string, language: Lang): string[] => {
  if (!text) return [];
  if (language === 'en') {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }
  // 韩语采用"非英文逐字"策略（MVP阶段足够）
  if (language === 'ko') {
    return Array.from(text.replace(/[\p{P}\p{S}\s]/gu, '')).filter(Boolean);
  }
  return Array.from(text.replace(/[\p{P}\p{S}\s]/gu, '')).filter(Boolean);
};

const levenshtein = (a: string[], b: string[]): number => {
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
};

const unique = <T,>(arr: T[]): T[] => Array.from(new Set(arr));

const groupConsecutiveTokens = (tokens: string[], sourceTokens: string[], separator = ''): string[] => {
  if (tokens.length === 0) return [];
  const tokenPositions = new Map<string, number[]>();
  sourceTokens.forEach((token, index) => {
    if (!tokenPositions.has(token)) {
      tokenPositions.set(token, []);
    }
    tokenPositions.get(token)!.push(index);
  });
  const positions: Array<{ pos: number; token: string; used: boolean }> = [];
  tokens.forEach((token) => {
    const positionsList = tokenPositions.get(token) || [];
    positionsList.forEach((pos) => {
      positions.push({ pos, token, used: false });
    });
  });
  positions.sort((a, b) => a.pos - b.pos);
  const groups: string[] = [];
  let currentGroup: string[] = [];
  let lastPos = -2;
  for (const item of positions) {
    if (item.used) continue;
    if (item.pos === lastPos + 1) {
      currentGroup.push(item.token);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup.join(separator));
      }
      currentGroup = [item.token];
    }
    lastPos = item.pos;
    item.used = true;
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup.join(separator));
  }
  return groups.length > 0 ? groups : tokens;
};

const EN_STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','when','at','by','for','in','of','on','to','with','as','is','are','was','were','be','been','being','do','does','did','have','has','had','i','you','he','she','it','we','they','them','me','my','your','his','her','its','our','their','this','that','these','those','from'
]);

const computeRoleScore = (target: string, said: string, lang: Lang) => {
  const cleanTarget = target.replace(/^[A-Z]:\s*/, '');
  const cleanSaid = said.replace(/^[A-Z]:\s*/, '');
  const targetTokens = tokenize(cleanTarget, lang);
  const saidTokens = tokenize(cleanSaid, lang);
  if (!targetTokens.length) {
    return {
      ratio: 0,
      percent: 0,
      missing: [] as string[],
      extra: saidTokens,
    };
  }
  const saidSet = new Set(saidTokens);
  const targetSet = new Set(targetTokens);
  const matched = targetTokens.filter((token) => saidSet.has(token)).length;
  const coverage = matched / targetTokens.length;
  const missing = targetTokens.filter((token) => !saidSet.has(token));
  const extra = saidTokens.filter((token) => !targetSet.has(token));
  const ratio = Math.max(0, Math.min(coverage, 1));
  return {
    ratio,
    percent: Math.round(ratio * 100),
    missing,
    extra,
  };
};

function SentencePracticeDefault({ originalText, language, className = '', audioUrl, sentenceTimeline, practiceMode = 'default', activeRole = 'A', roleSegments, onRoleRoundComplete, acuUnits, onPlaySentence, completedSegmentIndex, renderText }: SentencePracticeProps) {
  const { t } = useLanguage();
  const [displayText, setDisplayText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [sentenceScores, setSentenceScores] = useState<Record<number, SentenceScore>>({});
  const [customToast, setCustomToast] = useState<{ message: string; type: 'success' | 'info' | 'celebration' } | null>(null);
  const [highlightUnperfect, setHighlightUnperfect] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  // 角色模式播放控制所需状态
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // 音频播放速度控制状态
  const isRoleMode = practiceMode === 'role';

  // 非分角色模式：抽取核心 Hook（始终调用，禁用开关确保不在角色模式初始化识别）
  const practice = useSentencePracticeCore({
    originalText: originalText || '',
    language: language as any,
    sentenceTimeline: sentenceTimeline as any,
    onPlaySentence: onPlaySentence as any,
    acuUnits,
    enabled: !isRoleMode,
  });

  const nonRoleContent = (
    <Card className={`p-4 ${className}`}>
      <div className="mb-3">
        <SentencePracticeProgress
          total={practice.total}
          scores={practice.sentenceScores}
          onJumpToSentence={(index) => practice.setExpandedIndex(index)}
        />
      </div>
      <div className="space-y-2">
        {practice.sentences.map((s, index) => {
          const score = practice.sentenceScores[index] || null;
          const isExpanded = practice.expandedIndex === index;
          return (
            <SentenceCard
              key={index}
              index={index}
              sentence={s.text}
              score={score}
              isExpanded={isExpanded}
              isRecognizing={practice.isRecognizing && isExpanded}
              displayText={isExpanded ? practice.displayText : ''}
              finalText={isExpanded ? practice.finalText : ''}
              currentMetrics={isExpanded && score ? { score: score.score, missing: score.missing, extra: score.extra, alignmentResult: score.alignmentResult } : null}
              isMobile={false}
              language={language}
              onToggleExpand={() => practice.setExpandedIndex(isExpanded ? null : index)}
              onSpeak={() => practice.speak(index)}
              onStartPractice={() => practice.start(index)}
              onStopPractice={() => practice.stop()}
              onRetry={() => practice.retry(index)}
              renderText={renderText}
            />
          );
        })}
      </div>
    </Card>
  );
  const normalizedActiveRole = useMemo(() => normalizeSpeakerSymbol(activeRole || 'A'), [activeRole]);
  const derivedRoleSegments = useMemo(() => {
    if (!isRoleMode) return [] as RolePracticeSegment[];
    if (roleSegments && roleSegments.length > 0) return roleSegments;
    return deriveRoleSegments(originalText, sentenceTimeline);
  }, [isRoleMode, roleSegments, originalText, sentenceTimeline]);
  const [roleAutoState, setRoleAutoState] = useState<'idle' | 'running'>(`idle`);
  const [roleAutoStarted, setRoleAutoStarted] = useState(false);
  const [roleStepSignal, setRoleStepSignal] = useState(0);
  const roleIndexRef = useRef(0);
  const rolePendingResolveRef = useRef<(() => void) | null>(null);
  const roleCancelledRef = useRef(false);
  const roleProcessingRef = useRef(false); // 防止重复触发

  // 使用 ref 持有最新的 completedSegmentIndex，避免在 setInterval 闭包中捕获旧值
  const completedSegmentIndexRef = useRef<number | null>(null);
  useEffect(() => {
    completedSegmentIndexRef.current = completedSegmentIndex ?? null;
  }, [completedSegmentIndex]);

  // 使用 ref 缓存 onPlaySentence，避免因父组件重渲染导致 effect 反复重跑
  const onPlaySentenceRef = useRef<typeof onPlaySentence>(undefined);
  useEffect(() => {
    onPlaySentenceRef.current = onPlaySentence;
  }, [onPlaySentence]);

  // 定时器句柄，确保在 effect 清理时可以取消旧的推进定时器
  const roleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRoleMode) {
      roleCancelledRef.current = true;
      rolePendingResolveRef.current = null;
      setRoleAutoState('idle');
      setRoleAutoStarted(false);
      setRoleStepSignal(0);
    } else {
      roleCancelledRef.current = false;
    }
  }, [isRoleMode]);

  useEffect(() => {
    roleIndexRef.current = 0;
  }, [derivedRoleSegments]);

  const cleanupRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {}
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
  }, []);

  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastResultAtRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const iosUnlockedRef = useRef(false);
  const isStartingRef = useRef(false);
  
  // 临时存储识别结果，只在录音真正停止时才提交
  const tempFinalTextRef = useRef<string>('');
  // 保存上一次的最终文本，用于检测是否有新内容
  const lastFinalTextRef = useRef<string>('');
  // 保存完整文本（final + interim），供完成度计算使用
  const tempCombinedTextRef = useRef<string>('');

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = (navigator as any).platform || '';
    const iOSUA = /iPad|iPhone|iPod/.test(ua);
    const iPadOS13Plus = /Mac/.test(platform) && 'ontouchend' in (window as any);
    return iOSUA || iPadOS13Plus;
  }, []);

  const sentences = useMemo(() => splitSentences(originalText || '', language), [originalText, language]);
  const total = sentences.length;
  const currentSentence = expandedIndex !== null ? sentences[expandedIndex] || '' : '';
  const { actualIsMobile } = useMobile();
  
  // 使用 ref 保存当前句子，供定时器闭包使用
  const currentSentenceRef = useRef('');
  useEffect(() => {
    currentSentenceRef.current = currentSentence;
  }, [currentSentence]);

  // 是否为对话类型
  const isConversation = useMemo(() => {
    const t = originalText || '';
    return /(?:^|\n)\s*[ABＡＢ][：:]/.test(t);
  }, [originalText]);

  // 初始化音频
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!audioUrl || !sentenceTimeline || sentenceTimeline.length === 0) return;
    
    // 清理旧的音频实例
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    
    const handleTimeUpdate = () => {
      const stopAt = stopAtRef.current;
      if (typeof stopAt === 'number' && audio.currentTime >= stopAt) {
        audio.pause();
        stopAtRef.current = null;
      }
    };
    
    const handlePause = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setIsAudioPlaying(false);
    };
    
    const handlePlay = () => setIsAudioPlaying(true);
    const handleEnded = () => setIsAudioPlaying(false);
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('ended', handleEnded);
    
    try { audio.load(); } catch {}
    audioRef.current = audio;
    
    // 清理函数
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, sentenceTimeline]);

  // 应用播放速度
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // 计算当前句子的评分
  const currentMetrics = useMemo(() => {
    if (expandedIndex === null) return null;
    
    const targetRaw = tokenize(currentSentence, language);
    const saidRaw = tokenize(finalText, language);

    const filterSpeaker = (arr: string[]) =>
      isConversation ? arr.filter((w) => w.toLowerCase() !== 'a' && w.toLowerCase() !== 'b') : arr;

    const targetTokens = filterSpeaker(targetRaw);
    const saidTokens = filterSpeaker(saidRaw);
    
    // 使用传入的 ACU 数据
    
    // 使用新的对齐算法（如果有 ACU 数据）
    let alignmentResult;
    let comprehensiveScore;
    let missingGroups;
    let extraGroups;
    
    if (acuUnits && acuUnits.length > 0) {
      alignmentResult = performAlignment(
        targetTokens,
        saidTokens,
        acuUnits,
        currentSentence
      );
      
      // 计算综合评分
      comprehensiveScore = calculateSimilarityScore(targetTokens, saidTokens, alignmentResult);
      
      // 为了向后兼容，保留原有的 missing 和 extra 格式
      missingGroups = alignmentResult.missing.map(err => err.expected || '');
      extraGroups = alignmentResult.extra.map(err => err.actual);
    } else {
      // 回退到原有的简单匹配算法
      const cov = targetTokens.length > 0 ? Math.min(1, saidTokens.length / targetTokens.length) : 0;
      const dist = levenshtein(targetTokens, saidTokens);
      const maxLen = Math.max(targetTokens.length, saidTokens.length, 1);
      const sim = 1 - dist / maxLen;
      
      // 找出缺失和多余的token
      const missingTokensRaw = unique(targetTokens.filter((t) => !saidTokens.includes(t)));
      const extraTokensRaw = unique(saidTokens.filter((t) => !targetTokens.includes(t)));
      
      // 将连续的token分组（中文/日文直接连接，英文用空格连接）
      const separator = language === 'en' ? ' ' : '';
      missingGroups = groupConsecutiveTokens(missingTokensRaw, targetTokens, separator);
      extraGroups = groupConsecutiveTokens(extraTokensRaw, saidTokens, separator);
      
      // 合并覆盖度和相似度为综合得分
      comprehensiveScore = (cov + sim) / 2;
      alignmentResult = undefined;
    }
    
    return { 
      score: comprehensiveScore, 
      missing: missingGroups, 
      extra: extraGroups,
      alignmentResult 
    };
  }, [currentSentence, finalText, language, expandedIndex, isConversation, originalText]);

  // 保存评分当finalText更新时
  useEffect(() => {
    if (expandedIndex === null || !finalText || !currentMetrics) {
      return;
    }

    if (isRoleMode) {
      const activeSegment = derivedRoleSegments.find((seg, idx) => {
        const segIndex = typeof seg.index === 'number' ? seg.index : idx;
        return segIndex === expandedIndex;
      });

      if (
        activeSegment &&
        normalizeSpeakerSymbol(activeSegment.speaker) !== normalizedActiveRole
      ) {
        return;
      }
    }

    const newScore = {
      score: currentMetrics.score,
      finalText: finalText,
      missing: currentMetrics.missing,
      extra: currentMetrics.extra,
      alignmentResult: currentMetrics.alignmentResult,
    };

    setSentenceScores(prev => ({
      ...prev,
      [expandedIndex]: newScore,
    }));

    // 检查是否优秀并显示反馈
    if (currentMetrics.score >= 0.8) {
      setCustomToast({
        message: '做得很好！这句练得不错👍',
        type: 'success',
      });
    }

    // 在分角色模式下，评分保存后，触发回调（回调中会延迟1秒后推进）
    if (isRoleMode && rolePendingResolveRef.current) {
      // 验证当前 expandedIndex 对应的片段是否是用户回合
      const activeSegment = derivedRoleSegments.find((seg, idx) => {
        const segIndex = typeof seg.index === 'number' ? seg.index : idx;
        return segIndex === expandedIndex;
      });
      
      // 只有当是用户回合时才推进
      if (activeSegment && normalizeSpeakerSymbol(activeSegment.speaker) === normalizedActiveRole) {
        // 调用回调，回调中会延迟1秒显示评分后推进
        if (rolePendingResolveRef.current) {
          const resolve = rolePendingResolveRef.current;
          rolePendingResolveRef.current = null;
          resolve();
        }
      }
    }
  }, [expandedIndex, finalText, currentMetrics, derivedRoleSegments, isRoleMode, normalizedActiveRole]);

  // 清理静默定时器
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // 初始化识别
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as unknown as { SpeechRecognition?: new () => WebSpeechRecognition; webkitSpeechRecognition?: new () => WebSpeechRecognition }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => WebSpeechRecognition; webkitSpeechRecognition?: new () => WebSpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    const langMap: Record<string, string> = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US', ko: 'ko-KR' };
    rec.lang = langMap[language] || 'en-US';
    rec.onstart = () => {
      isStartingRef.current = false;
      setIsRecognizing(true);
      setDisplayText('');
      setFinalText('');
      tempFinalTextRef.current = '';
      tempCombinedTextRef.current = '';
      lastResultAtRef.current = Date.now();
      clearSilenceTimer();
      
      // 智能静默检测：根据完成度动态调整静默时间
      silenceTimerRef.current = window.setInterval(() => {
        const diff = Date.now() - lastResultAtRef.current;
        
        // 从 ref 获取当前句子，避免闭包问题
        const targetSentence = currentSentenceRef.current;
        if (!targetSentence || targetSentence.trim() === '') {
          // 没有目标句子时，使用简单的静默检测（2秒）
          if (diff >= 2000) {
            try { rec.stop(); } catch {}
            clearSilenceTimer();
          }
          return;
        }
        
        // 计算当前录入文本的token数量（使用完整文本：final + interim）
        const currentText = tempCombinedTextRef.current;
        const currentTokensRaw = tokenize(currentText, language);
        const targetTokensRaw = tokenize(targetSentence, language);
        
        // 检测是否为对话类型（从当前句子判断）
        const isDialogueType = /^[ABＡＢ]\s*[：:]/.test(targetSentence.trim());
        
        // 对话类型需要过滤A/B标记（与评分计算保持一致）
        const filterSpeaker = (arr: string[]) =>
          isDialogueType ? arr.filter((w) => w.toLowerCase() !== 'a' && w.toLowerCase() !== 'b') : arr;
        
        const currentTokens = filterSpeaker(currentTokensRaw);
        const targetTokens = filterSpeaker(targetTokensRaw);
        
        const completionRate = targetTokens.length > 0 
          ? currentTokens.length / targetTokens.length 
          : 0;
        
        // 根据完成度动态调整静默时间
        let requiredSilence = 10000; // 默认10秒（<80%时）
        
        if (completionRate >= 1.0) {
          requiredSilence = 1000; // 完成度 >= 100%：1秒
        } else if (completionRate >= 0.8) {
          requiredSilence = 1500; // 完成度在80%-99%：1.5秒
        }
        // else: 完成度 < 80%：保持默认10秒
        
        // 达到静默时间要求，自动停止
        if (diff >= requiredSilence) {
          try { rec.stop(); } catch {}
          clearSilenceTimer();
        }
        // 超过12秒强制兜底（防止卡住）
        else if (diff >= 12000) {
          try { rec.stop(); } catch {}
          clearSilenceTimer();
        }
      }, 50);
    };
    rec.onresult = (event: WebSpeechRecognitionEvent) => {
      let fullFinal = '';
      let interim = '';
      
      // 正确处理所有结果：累积所有final结果，只取最后一个interim结果
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          fullFinal += transcript + ' ';
        } else {
          // 对于interim结果，直接拼接（移动端可能一次返回多个interim）
          interim += transcript;
        }
      }
      
      const finalTrimmed = fullFinal.trim();
      const interimTrimmed = interim.trim();
      const combined = finalTrimmed 
        ? (interimTrimmed ? `${finalTrimmed} ${interimTrimmed}` : finalTrimmed)
        : interimTrimmed;
      
      // 只要完整文本有变化就重置静默时间（包括interim变化）
      if (combined && combined !== tempCombinedTextRef.current) {
        lastResultAtRef.current = Date.now();
      }
      
      // 保存final文本用于最终评分
      if (finalTrimmed && finalTrimmed !== lastFinalTextRef.current) {
        lastFinalTextRef.current = finalTrimmed;
      }
      
      // 暂存到 ref
      tempFinalTextRef.current = finalTrimmed;
      tempCombinedTextRef.current = combined; // 保存完整文本供完成度计算
      
      // 使用requestAnimationFrame优化UI更新，避免阻塞
      requestAnimationFrame(() => {
        setDisplayText(combined);
      });
    };
    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      const errorType = event.error || 'unknown';
      
      // 只在严重错误时弹出提示
      if (errorType === 'not-allowed' || errorType === 'permission-denied') {
        const isNonSecure = typeof window !== 'undefined' && 
                           window.location.protocol !== 'https:' && 
                           window.location.hostname !== 'localhost' &&
                           !window.location.hostname.startsWith('127.');
        if (isNonSecure) {
          toast?.error(t.shadowing?.alert_messages?.microphone_permission_denied_mobile || '麦克风权限被拒绝。\n\n移动端需要使用HTTPS安全连接。\n\n请使用 https:// 开头的地址访问，或部署到Vercel等平台测试。');
        } else {
          toast?.error(t.shadowing?.alert_messages?.microphone_permission_denied_desktop || '麦克风权限被拒绝。\n\n请在浏览器设置中允许本网站使用麦克风。\n\n步骤：\n1. 点击地址栏的锁图标\n2. 找到麦克风权限\n3. 设置为"允许"\n4. 刷新页面');
        }
      } else if (errorType === 'audio-capture') {
        toast?.error(t.shadowing?.alert_messages?.microphone_audio_capture_error || '无法捕获音频。\n\n可能原因：\n1. 麦克风被其他应用占用\n2. 麦克风硬件故障');
      } else if (errorType === 'service-not-allowed') {
        toast?.error(t.shadowing?.alert_messages?.microphone_service_not_allowed || '语音识别服务不可用。\n\n请确保使用支持Web Speech API的浏览器（如Chrome）。');
      }
      // no-speech等其他错误不提示，静默处理
      
      setIsRecognizing(false);
      clearSilenceTimer();
      
      // 设置 finalText 以触发评分计算（评分保存后会自动推进）
      const textToSave = tempFinalTextRef.current || tempCombinedTextRef.current || '';
      if (textToSave) {
        setTimeout(() => {
          setFinalText(textToSave);
        }, 100);
      }
    };
    rec.onend = () => {
      isStartingRef.current = false;
      setIsRecognizing(false);
      clearSilenceTimer();
      
      // 设置 finalText 以触发评分计算（评分保存后会自动推进）
      const textToSave = tempFinalTextRef.current || tempCombinedTextRef.current || '';
      if (textToSave) {
        setTimeout(() => {
          setFinalText(textToSave);
        }, 100);
      }
    };
    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
      clearSilenceTimer();
    };
  }, [language, t.shadowing?.alert_messages?.microphone_permission_denied_mobile, t.shadowing?.alert_messages?.microphone_permission_denied_desktop, t.shadowing?.alert_messages?.microphone_audio_capture_error, t.shadowing?.alert_messages?.microphone_service_not_allowed]);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error(t.shadowing?.alert_messages?.speech_recognition_not_supported || '当前浏览器不支持实时语音识别。\n\n建议使用最新版Chrome浏览器。');
      return;
    }
    
    try {
      if (isStartingRef.current || isRecognizing) {
        // 已在启动中或正在识别，避免重复调用
        return;
      }
      isStartingRef.current = true;
      setDisplayText('');
      setFinalText('');
      tempFinalTextRef.current = '';
      tempCombinedTextRef.current = '';
      lastFinalTextRef.current = '';
      try {
        recognitionRef.current.start();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 避免在“已启动”情况下弹框，进行一次无提示的安全重试
        if (msg && msg.toLowerCase().includes('already started')) {
          try { recognitionRef.current.stop(); } catch {}
          setTimeout(() => {
            try {
              if (!isRecognizing) {
                recognitionRef.current?.start?.();
              }
            } catch {}
          }, 350);
          return;
        }
        throw err;
      }
    } catch (error) {
      console.error('语音识别启动错误:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      // 对于非"已启动"错误才提示用户
      if (!errorMsg.toLowerCase().includes('already started')) {
        toast.error(`无法开始语音识别：${errorMsg}\n\n请检查麦克风权限。`);
      }
      isStartingRef.current = false;
    }
  }, [isRecognizing, t.shadowing?.alert_messages?.speech_recognition_not_supported]);

  const stop = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // 立即清理状态
      clearSilenceTimer();
      setIsRecognizing(false);
      isStartingRef.current = false;
      // 手动停止时也要提交结果，延迟到按钮状态更新后
      if (tempFinalTextRef.current) {
        setTimeout(() => {
          setFinalText(tempFinalTextRef.current);
        }, 100);
      }
    } catch (e) {
      console.error('停止识别时出错:', e);
      // 即使出错也要清理状态和提交结果
      clearSilenceTimer();
      setIsRecognizing(false);
      if (tempFinalTextRef.current) {
        setTimeout(() => {
          setFinalText(tempFinalTextRef.current);
        }, 100);
      }
    }
  }, []);

  // 确保麦克风资源已释放的安全栅栏（默认500ms）
  const ensureMicReleased = useCallback(async (ms: number = 500) => {
    try { stop(); } catch {}
    try { cleanupRecognition(); } catch {}
    if (ms > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, ms));
    }
  }, [stop, cleanupRecognition]);

  // 音频控制函数
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  }, [isAudioPlaying]);

  const handleReset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  }, []);

  const handleRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, []);

  const speak = useCallback(async (index: number) => {
    // 优先使用父层主播放器播放
    if (typeof onPlaySentence === 'function') {
      try { onPlaySentence(index); } catch {}
      return;
    }
    if (!(audioUrl && sentenceTimeline && sentenceTimeline.length > 0)) {
      toast.error(t.shadowing?.alert_messages?.no_audio_or_timeline || '未找到可用的生成音频或时间轴，无法播放该句。');
      return;
    }

    // 清理之前的播放状态
    if (audioRef.current) {
      audioRef.current.pause();
      stopAtRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    if (!audioRef.current) {
      try {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.preload = 'auto';
        // 设置初始播放速度
        audioRef.current.playbackRate = playbackRate;
      } catch {}
    } else if (audioRef.current.src !== audioUrl) {
      audioRef.current.src = audioUrl;
      // 重新设置播放速度
      audioRef.current.playbackRate = playbackRate;
    } else {
      // 确保当前音频的播放速度是最新的
      audioRef.current.playbackRate = playbackRate;
    }

    const a = audioRef.current;
    const seg = sentenceTimeline.find((s) => s.index === index) || sentenceTimeline[index];
    if (!(seg && a)) {
      toast.error(t.shadowing?.alert_messages?.no_audio_or_timeline || '未找到可用的生成音频或时间轴，无法播放该句。');
      return;
    }

    // iOS 解锁：在用户手势内先触发一次静音播放以满足自动播放策略
    if (isIOS && !iosUnlockedRef.current) {
      try {
        a.muted = true;
        // 设置播放速度
        a.playbackRate = playbackRate;
        // 不等待，以保留用户手势调用栈
        const p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(() => { try { a.pause(); } catch {}; a.muted = false; }).catch(() => { a.muted = false; });
        } else {
          try { a.pause(); } catch {}
          a.muted = false;
        }
      } catch { a.muted = false; }
      iosUnlockedRef.current = true;
    }

    try {
      // 等待元数据就绪
      await new Promise<void>((resolve) => {
        if (a.readyState >= 1) return resolve();
        const onLoaded = () => {
          a.removeEventListener('loadedmetadata', onLoaded);
          a.removeEventListener('canplay', onLoaded);
          resolve();
        };
        a.addEventListener('loadedmetadata', onLoaded, { once: true });
        a.addEventListener('canplay', onLoaded, { once: true });
      });

      const START_EPS = 0.005;
      const STOP_EPS = 0.08;
      const targetStart = Math.max(0, seg.start + START_EPS);
      const targetStop = Math.max(seg.start, seg.end - STOP_EPS);

      // 尽量使用 fastSeek，iOS 对 seeking 更稳定
      const anyAudio = a as any;
      try {
        if (typeof anyAudio.fastSeek === 'function') {
          anyAudio.fastSeek(targetStart);
        } else {
          a.currentTime = targetStart;
        }
      } catch { a.currentTime = targetStart; }

      // 等待 seek 完成或可以播放该位置
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; cleanup(); resolve(); } };
        const onSeeked = () => finish();
        const onCanPlay = () => finish();
        const cleanup = () => {
          a.removeEventListener('seeked', onSeeked);
          a.removeEventListener('canplay', onCanPlay);
        };
        a.addEventListener('seeked', onSeeked, { once: true });
        a.addEventListener('canplay', onCanPlay, { once: true });
        // 超时兜底
        setTimeout(finish, 1200);
      });

      stopAtRef.current = targetStop;

      // 设置播放速度
      a.playbackRate = playbackRate;

      // 避免在 iOS 上同步 cancel 造成卡顿
      if (!isIOS) {
        try {
          if ('speechSynthesis' in window) {
            setTimeout(() => { try { window.speechSynthesis.cancel(); } catch {} }, 0);
          }
        } catch {}
      }

      await new Promise<void>((resolve, reject) => {
        let finished = false;
        let safetyId: ReturnType<typeof setTimeout> | null = null;
        let playbackAttempted = false;
        let playbackStarted = false;

        function clearRaf() {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        }

        function cleanup() {
          clearRaf();
          if (safetyId !== null) {
            clearTimeout(safetyId);
            safetyId = null;
          }
          stopAtRef.current = null;
          if (a) {
            a.removeEventListener('ended', handleEnded);
            a.removeEventListener('pause', handlePause);
          }
        }

        function finish() {
          if (finished) return;
          finished = true;
          // 兜底：强制在段末处暂停，防止继续播放到下一句
          try {
            if (a && !a.paused) {
              const stopAt = stopAtRef.current;
              if (typeof stopAt === 'number') {
                try { a.currentTime = Math.min(stopAt, a.currentTime); } catch {}
              }
              try { a.pause(); } catch {}
            }
          } catch {}
          cleanup();
          resolve();
        }

        function fail(error?: unknown) {
          if (finished) return;
          finished = true;
          cleanup();
          reject(error ?? new Error('Audio playback failed'));
        }

        function handleEnded() {
          finish();
        }

        function handlePause() {
          if (!playbackAttempted) return;
          if (!playbackStarted && !roleCancelledRef.current) return;
          finish();
        }

        const watchPlayback = () => {
          const stopAt = stopAtRef.current;
          if (typeof stopAt === 'number' && audioRef.current && audioRef.current.currentTime >= stopAt) {
            audioRef.current.pause();
            finish();
            return;
          }
          rafRef.current = requestAnimationFrame(watchPlayback);
        };

        a.addEventListener('ended', handleEnded, { once: true });
        a.addEventListener('pause', handlePause);

        clearRaf();
        rafRef.current = requestAnimationFrame(watchPlayback);

        const estimatedDuration = Math.max((targetStop - targetStart) * 1000, 300);
        safetyId = setTimeout(() => finish(), estimatedDuration + 2000);

        (async () => {
          try {
            playbackAttempted = true;
            // 确保播放速度设置正确
            a.playbackRate = playbackRate;
            await a.play();
            playbackStarted = true;
          } catch (err) {
            fail(err);
          }
        })();
      });
      return;
    } catch {}

    toast.error(t.shadowing?.alert_messages?.no_audio_or_timeline || '未找到可用的生成音频或时间轴，无法播放该句。');
  }, [audioUrl, sentenceTimeline, isIOS, playbackRate, t.shadowing?.alert_messages?.no_audio_or_timeline, onPlaySentence]);

  const speakWithTTS = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = mapLangToLocale(language);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) =>
      (voice.lang || '').toLowerCase().startsWith(utterance.lang.toLowerCase()),
    );
    if (preferred) {
      utterance.voice = preferred;
    }
    await new Promise<void>((resolve) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      try {
        window.speechSynthesis.cancel();
      } catch {}
      window.speechSynthesis.speak(utterance);
    });
  }, [language]);

  const stopRoleAutomation = useCallback(() => {
    roleCancelledRef.current = true;
    roleProcessingRef.current = false; // 重置处理标记
    if (rolePendingResolveRef.current) {
      rolePendingResolveRef.current = null;
    }
    setRoleAutoState('idle');
    setIsRecognizing(false);
    cleanupRecognition();
    cleanupAudio();
  }, [cleanupAudio, cleanupRecognition]);

  // 统一的推进到下一句的函数
  const advanceToNextSegment = useCallback(() => {
    if (roleCancelledRef.current) return;
    
    const segments = derivedRoleSegments;
    if (roleIndexRef.current >= segments.length) {
      // 已完成所有片段
      roleProcessingRef.current = false;
      stopRoleAutomation();
      setRoleAutoStarted(false);
      if (onRoleRoundComplete) {
        const results = segments
          .filter((seg) => normalizeSpeakerSymbol(seg.speaker) === normalizedActiveRole)
          .map((seg) => {
            const base = sentenceScores[seg.index ?? 0];
            return {
              index: seg.index ?? 0,
              transcript: base?.finalText || '',
              text: seg.text,
              scoreRatio: base?.score || 0,
              scorePercent: Math.round((base?.score || 0) * 100),
              missing: base?.missing || [],
              extra: base?.extra || [],
              skipped: !base,
            };
          });
        onRoleRoundComplete(results);
      }
      setHighlightUnperfect(true);
      setTimeout(() => setHighlightUnperfect(false), 6000);
      return;
    }
    
    // 推进到下一句
    const oldIndex = roleIndexRef.current;
    roleIndexRef.current += 1;
    
    // 先重置处理标记，确保 useEffect 能检测到新的索引
    roleProcessingRef.current = false;
    
    // 触发信号更新，让 useEffect 重新执行处理下一句
    setRoleStepSignal((x) => x + 1);
  }, [derivedRoleSegments, normalizedActiveRole, onRoleRoundComplete, sentenceScores, stopRoleAutomation]);

  const startRoleAutomation = useCallback(() => {
    if (!isRoleMode) return;
    const segments = derivedRoleSegments;
    if (!segments.length) {
      setCustomToast({
        message: t.shadowing?.role_no_segments || '当前材料暂不支持分角色练习。',
        type: 'info',
      });
      return;
    }
    roleCancelledRef.current = false;
    // 重置索引（如果是第一次开始或已完成）
    if (!roleAutoStarted || roleIndexRef.current >= segments.length) {
      roleIndexRef.current = 0;
    }
    // 清理状态
    setIsRecognizing(false);
    setDisplayText('');
    setFinalText('');
    tempFinalTextRef.current = '';
    tempCombinedTextRef.current = '';
    lastFinalTextRef.current = '';
    // 设置状态，让 useEffect 处理流程
    setRoleAutoStarted(true);
    setRoleAutoState('running');
    // 触发 useEffect（通过改变 roleStepSignal）
    setRoleStepSignal((x) => x + 1);
  }, [derivedRoleSegments, isRoleMode, roleAutoStarted, setCustomToast, t.shadowing?.role_no_segments]);

  // 分角色模式下：手动开始/停止/重试包装（复用逐句练习管线）
  const startManualPractice = useCallback(() => {
    if (isRoleMode) {
      stopRoleAutomation();
    }
    cleanupAudio();
    start();
  }, [cleanupAudio, isRoleMode, start, stopRoleAutomation]);

  const stopManualPractice = useCallback(() => {
    stop();
  }, [stop]);

  const retryManualPractice = useCallback(() => {
    setDisplayText('');
    setFinalText('');
    setTimeout(() => startManualPractice(), 100);
  }, [startManualPractice]);

  // 分角色模式的自动流程：复用逐句练习的录音和播放功能
  useEffect(() => {
    if (!isRoleMode) return;
    if (roleAutoState !== 'running') return;
    if (roleProcessingRef.current) {
      // 如果正在处理，不重复触发
      return;
    }
    
    const segments = derivedRoleSegments;
    if (!segments.length) {
      stopRoleAutomation();
      return;
    }
    
    // 检查是否已完成所有片段
    if (roleIndexRef.current >= segments.length) {
      roleProcessingRef.current = false;
      stopRoleAutomation();
      setRoleAutoStarted(false);
      if (onRoleRoundComplete) {
        const results = segments
          .filter((seg) => normalizeSpeakerSymbol(seg.speaker) === normalizedActiveRole)
          .map((seg) => {
            const base = sentenceScores[seg.index ?? 0];
            return {
              index: seg.index ?? 0,
              transcript: base?.finalText || '',
              text: seg.text,
              scoreRatio: base?.score || 0,
              scorePercent: Math.round((base?.score || 0) * 100),
              missing: base?.missing || [],
              extra: base?.extra || [],
              skipped: !base,
            };
          });
        onRoleRoundComplete(results);
      }
      // 轮次结束：触发未满分高亮提示（6秒后自动关闭）
      setHighlightUnperfect(true);
      setTimeout(() => setHighlightUnperfect(false), 6000);
      return;
    }

    const segment = segments[roleIndexRef.current];
    if (!segment) {
      roleProcessingRef.current = false;
      stopRoleAutomation();
      return;
    }
    
    // 保存当前处理的索引，防止依赖项变化时重新执行
    const currentIndex = roleIndexRef.current;
    
    // 立即标记正在处理，防止重复触发
    roleProcessingRef.current = true;
    
    const isUserTurn = normalizeSpeakerSymbol(segment.speaker) === normalizedActiveRole;

    if (isUserTurn) {
      // 用户回合：复用逐句练习的录音功能
      // 1. 停止之前的录音（如果有）
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecognizing(false);
      isStartingRef.current = false;
      cleanupAudio();
      
      // 2. 清理状态
      setDisplayText('');
      setFinalText('');
      tempFinalTextRef.current = '';
      tempCombinedTextRef.current = '';
      lastFinalTextRef.current = '';
      
      // roleProcessingRef 已经在上面设置了，这里不需要重复设置
      
      // 3. 设置评分完成后的回调（会在评分保存 useEffect 中触发）
      rolePendingResolveRef.current = () => {
        rolePendingResolveRef.current = null;
        // 评分完成后，延迟1秒显示，然后推进到下一句
        setTimeout(() => {
          advanceToNextSegment();
        }, 1000);
      };
      
      // 4. 展开句子并触发录音（模拟点击麦克风按钮）
      const targetIndex = segment.index ?? roleIndexRef.current;
      setExpandedIndex(targetIndex);
      // 延迟一点确保 expandedIndex 和 currentSentenceRef 已更新，然后触发录音
      setTimeout(() => {
        if (roleCancelledRef.current) {
          roleProcessingRef.current = false;
          return;
        }
        // 调用 start() 开始录音，就像点击了麦克风按钮一样
        start();
      }, 100);
      
    } else {
      // 电脑回合：复用逐句练习的播放功能
      // roleProcessingRef 已经在上面设置了，这里不需要重复设置
      
      // 1. 停止录音（如果有）
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecognizing(false);
      cleanupAudio();
      
      // 2. 不展开句子
      setExpandedIndex(null);
      setDisplayText('');
      setFinalText('');
      tempFinalTextRef.current = '';
      tempCombinedTextRef.current = '';
      lastFinalTextRef.current = '';
      
      // 3. 调用逐句练习的 speak() 函数播放音频并等待完成
      let cancelled = false;
      const playAndAdvance = async () => {
        try {
          // 确保麦克风已释放，避免与播放冲突
          await ensureMicReleased(200);
          // 再次检查是否已取消/索引变化
          if (cancelled || roleCancelledRef.current || roleIndexRef.current !== currentIndex) {
            roleProcessingRef.current = false;
            return;
          }

          const segIndex = segment.index ?? currentIndex;

          // 触发播放（不等待事件/Promise，改用定时推进）
          try {
            const fn = onPlaySentenceRef.current;
            if (typeof fn === 'function') {
              fn(segIndex);
            }
          } catch {}

          // 使用 derivedRoleSegments 的时长作为推进依据（避免依赖父层 timeline 和播放条）
          const baseDurationMs = (typeof segment.start === 'number' && typeof segment.end === 'number')
            ? Math.max((segment.end - segment.start) * 1000, 400)
            : 1200;
          const fudgeMs = 600;
          const waitMs = baseDurationMs + fudgeMs;

          // 清理旧定时器（如果有）
          if (roleTimerRef.current) {
            try { clearTimeout(roleTimerRef.current); } catch {}
            roleTimerRef.current = null;
          }

          roleTimerRef.current = window.setTimeout(() => {
            // 超时后推进到下一句（仍做取消/索引检查）
            if (cancelled || roleCancelledRef.current) {
              roleProcessingRef.current = false;
              return;
            }
            if (roleIndexRef.current !== currentIndex) {
              roleProcessingRef.current = false;
              return;
            }
            const savedIndex = currentIndex;
            advanceToNextSegment();
            if (roleIndexRef.current === savedIndex) {
              // 推进失败，重置处理标记，避免卡死
              roleProcessingRef.current = false;
            }
          }, waitMs);
        } catch (err) {
          console.error('播放启动失败:', err);
          // 出错也尝试推进，避免卡住
          roleProcessingRef.current = false;
        }
      };
      
      playAndAdvance();
      
      // 清理函数
      return () => {
        cancelled = true;
        if (roleTimerRef.current) {
          try { clearTimeout(roleTimerRef.current); } catch {}
          roleTimerRef.current = null;
        }
        // 注意：不在这里重置 roleProcessingRef，让播放完成后自己重置
        // 如果在这里重置，可能导致播放还没完成就重新触发
      };
    }
  }, [derivedRoleSegments, isRoleMode, normalizedActiveRole, onRoleRoundComplete, roleAutoState, roleStepSignal, start, stopRoleAutomation, ensureMicReleased, cleanupAudio, advanceToNextSegment]);

  const handleSentenceClick = async (index: number) => {
    // 如果点击的是当前展开的句子，则折叠
    if (expandedIndex === index) {
      setExpandedIndex(null);
      // 折叠时停止识别
      if (isRecognizing) {
        stop();
      }
    } else {
      // 切换到新句子时，先停止当前的识别
      if (isRecognizing) {
        stop();
      }
      // 清空当前的识别状态
      setExpandedIndex(index);
      setDisplayText('');
      setFinalText('');
    }
  };

  // 计算整体进度
  const progress = useMemo(() => {
    const practiced = Object.keys(sentenceScores).length;
    const goodCount = Object.values(sentenceScores).filter(score => {
      return score.score >= 0.8;
    }).length;
    return { practiced, total, goodCount };
  }, [sentenceScores, total]);

  if (!isRoleMode) {
    return nonRoleContent;
  }

  return (
    <>
      {isRoleMode && derivedRoleSegments.length > 0 && (
        <Card className="mb-4 border border-indigo-100 bg-white/80 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-indigo-600">
                {t.shadowing?.role_mode_title || '分角色练习'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {t.shadowing?.role_mode_hint || '轮到对方时自动播放，轮到你时会自动录音并分析。'}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {roleAutoState !== 'running' ? (
                <Button size="sm" onClick={startRoleAutomation}>
                  <Play className="w-4 h-4 mr-2" />
                  {roleAutoStarted ? t.shadowing?.role_resume_button || '继续' : t.shadowing?.role_start_button || '开始角色练习'}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={stopRoleAutomation}>
                  <Pause className="w-4 h-4 mr-2" />
                  {t.shadowing?.role_pause_button || '暂停'}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  stopRoleAutomation();
                  roleIndexRef.current = 0;
                  setRoleAutoStarted(false);
                  setSentenceScores({});
                  setExpandedIndex(null);
                  setDisplayText('');
                  setFinalText('');
                  tempFinalTextRef.current = '';
                  tempCombinedTextRef.current = '';
                  lastFinalTextRef.current = '';
                  setCustomToast(null);
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {t.shadowing?.role_reset_button || '重新开始'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className={`p-4 md:p-6 border border-slate-200 shadow-sm bg-slate-50/30 ${className || ''}`}>
      {/* 顶部：进度显示 */}
      <div className="mb-4">
        <SentencePracticeProgress
          total={total}
          scores={sentenceScores}
          onJumpToSentence={(index) => {
            handleSentenceClick(index);
            setTimeout(() => {
              const element = document.getElementById(`sentence-${index}`);
              element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }}
        />
      </div>

      {/* 音频播放速度控制 */}
      {audioUrl && sentenceTimeline && sentenceTimeline.length > 0 && (
        <div className="mb-4">
          {/* 倍速与播放控制已由底部主播放器统一管理，此处仅保留占位/提示或可移除 */}
        </div>
      )}

      {/* 智能建议 */}
      <SmartSuggestion
        total={total}
        scores={sentenceScores}
        onJumpToSentence={(index) => {
          handleSentenceClick(index);
          setTimeout(() => {
            const element = document.getElementById(`sentence-${index}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }}
        className="mb-4"
      />

      {total > 0 ? (
        <div className="space-y-2">
          {sentences.map((sentence, index) => {
            const score = sentenceScores[index];
            const isExpanded = expandedIndex === index;
            
            return (
              <SentenceCard
                key={index}
                index={index}
                sentence={sentence}
                score={score || null}
                isExpanded={isExpanded}
                isRecognizing={isRecognizing && isExpanded}
                displayText={isExpanded ? displayText : ''}
                finalText={isExpanded ? finalText : ''}
                currentMetrics={isExpanded ? currentMetrics : null}
                isMobile={actualIsMobile}
                language={language}
                onToggleExpand={() => handleSentenceClick(index)}
                onSpeak={() => speak(index)}
                onStartPractice={isRoleMode ? startManualPractice : start}
                onStopPractice={stop}
                onRetry={isRoleMode
                  ? retryManualPractice
                  : () => {
                      setDisplayText('');
                      setFinalText('');
                      setTimeout(() => start(), 100);
                    }}
                highlightReview={highlightUnperfect && !!score && Math.round((score.score || 0) * 100) < 100}
                renderText={renderText}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">
          {t.shadowing?.alert_messages?.no_content_message || '暂无内容'}
        </div>
      )}

      {/* Toast 通知 */}
      {customToast && (
        <Toast
          message={customToast.message}
          type={customToast.type}
          onClose={() => setCustomToast(null)}
        />
      )}
    </Card>
    </>
  );
}

export default function SentencePractice(props: SentencePracticeProps) {
  return <SentencePracticeDefault {...props} />;
}
