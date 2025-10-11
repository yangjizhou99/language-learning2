'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import SentencePracticeProgress from './SentencePracticeProgress';
import SmartSuggestion from './SmartSuggestion';
import { Toast } from './ScoreAnimation';
import SentenceCard from './SentenceCard';
import { useMobile } from '@/contexts/MobileContext';

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
  audioUrl?: string | null;
  sentenceTimeline?: Array<{ index: number; text: string; start: number; end: number; speaker?: string }>;
}

interface SentenceScore {
  score: number; // 综合相似度评分 (0-1范围)
  finalText: string;
  missing: string[];
  extra: string[];
}

function splitSentences(text: string, language: Lang): string[] {
  if (!text || !text.trim()) return [];
  // 对话体优先：以 A/B（含全角Ａ/Ｂ）作为最小句的分界
  const hasDialogue = /(?:^|\n)\s*[ABＡＢ]\s*[：:]/.test(text);
  if (hasDialogue) {
    // 规范化：确保每个对话角色前有换行
    let normalized = text;
    normalized = normalized.replace(/([^\n])\s*([AＡ]\s*[：:])/g, '$1\n$2');
    normalized = normalized.replace(/([^\n])\s*([BＢ]\s*[：:])/g, '$1\n$2');

    // 按行首的 A/B 标签切分，每个说话段落作为一个最小句
    const parts = normalized
      .split(/(?=^\s*[ABＡＢ]\s*[：:])/m)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) return parts;
  }
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

// 将词汇按在原文中的连续性分组
function groupConsecutiveTokens(tokens: string[], sourceTokens: string[], separator: string = ''): string[] {
  if (tokens.length === 0) return [];
  
  // 找到每个token在source中的所有位置
  const tokenPositions = new Map<string, number[]>();
  sourceTokens.forEach((token, index) => {
    if (!tokenPositions.has(token)) {
      tokenPositions.set(token, []);
    }
    tokenPositions.get(token)!.push(index);
  });
  
  // 为每个缺失/多余的token找到它在原文中的位置
  const positionsWithTokens: Array<{ pos: number; token: string; used: boolean }> = [];
  tokens.forEach(token => {
    const positions = tokenPositions.get(token) || [];
    positions.forEach(pos => {
      positionsWithTokens.push({ pos, token, used: false });
    });
  });
  
  // 按位置排序
  positionsWithTokens.sort((a, b) => a.pos - b.pos);
  
  // 分组：将位置连续的token合并
  const groups: string[] = [];
  let currentGroup: string[] = [];
  let lastPos = -2;
  
  for (const item of positionsWithTokens) {
    if (item.used) continue;
    
    if (item.pos === lastPos + 1) {
      // 连续的，加入当前组
      currentGroup.push(item.token);
    } else {
      // 不连续，开始新组
      if (currentGroup.length > 0) {
        groups.push(currentGroup.join(separator));
      }
      currentGroup = [item.token];
    }
    lastPos = item.pos;
    item.used = true;
  }
  
  // 添加最后一组
  if (currentGroup.length > 0) {
    groups.push(currentGroup.join(separator));
  }
  
  return groups.length > 0 ? groups : tokens;
}

const EN_STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','when','at','by','for','in','of','on','to','with','as','is','are','was','were','be','been','being','do','does','did','have','has','had','i','you','he','she','it','we','they','them','me','my','your','his','her','its','our','their','this','that','these','those','from'
]);

// 根据评分获取颜色方案
function getScoreColor(score: SentenceScore | null): { bg: string; border: string; text: string; badge: string } {
  if (!score || !score.finalText) {
    return {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-700',
      badge: 'bg-gray-100 text-gray-600'
    };
  }
  
  if (score.score >= 0.8) {
    return {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
      badge: 'bg-green-500 text-white'
    };
  } else if (score.score >= 0.6) {
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-900',
      badge: 'bg-yellow-500 text-white'
    };
  } else {
    return {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
      badge: 'bg-red-500 text-white'
    };
  }
}

export default function SentencePractice({ originalText, language, className = '', audioUrl, sentenceTimeline }: SentencePracticeProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [sentenceScores, setSentenceScores] = useState<Record<number, SentenceScore>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'celebration' } | null>(null);
  
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastResultAtRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const iosUnlockedRef = useRef(false);
  
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
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.preload = 'auto';
      try { audioRef.current.load(); } catch {}
      audioRef.current.addEventListener('timeupdate', () => {
        const stopAt = stopAtRef.current;
        if (typeof stopAt === 'number' && audioRef.current && audioRef.current.currentTime >= stopAt) {
          audioRef.current.pause();
          stopAtRef.current = null;
        }
      });
      audioRef.current.addEventListener('pause', () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      });
    } else {
      audioRef.current.src = audioUrl;
      try { audioRef.current.load(); } catch {}
    }
  }, [audioUrl, sentenceTimeline]);

  // 计算当前句子的评分
  const currentMetrics = useMemo(() => {
    if (expandedIndex === null) return null;
    
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
    
    // 找出缺失和多余的token
    const missingTokensRaw = unique(targetTokens.filter((t) => !saidTokens.includes(t)));
    const extraTokensRaw = unique(saidTokens.filter((t) => !targetTokens.includes(t)));
    
    // 将连续的token分组（中文/日文直接连接，英文用空格连接）
    const separator = language === 'en' ? ' ' : '';
    const missingGroups = groupConsecutiveTokens(missingTokensRaw, targetTokens, separator);
    const extraGroups = groupConsecutiveTokens(extraTokensRaw, saidTokens, separator);
    
    // 合并覆盖度和相似度为综合得分
    const comprehensiveScore = (cov + sim) / 2;
    
    return { score: comprehensiveScore, missing: missingGroups, extra: extraGroups };
  }, [currentSentence, finalText, language, expandedIndex, isConversation]);

  // 保存评分当finalText更新时
  useEffect(() => {
    if (expandedIndex !== null && finalText && currentMetrics) {
      const newScore = {
        score: currentMetrics.score,
        finalText: finalText,
        missing: currentMetrics.missing,
        extra: currentMetrics.extra,
      };
      
      setSentenceScores(prev => ({
        ...prev,
        [expandedIndex]: newScore,
      }));
      
      // 检查是否优秀并显示反馈
      if (currentMetrics.score >= 0.8) {
        setToast({
          message: '做得很好！这句练得不错 👍',
          type: 'success',
        });
      }
    }
  }, [expandedIndex, finalText, currentMetrics]);

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
    const langMap: Record<string, string> = { ja: 'ja-JP', zh: 'zh-CN', en: 'en-US' };
    rec.lang = langMap[language] || 'en-US';
    rec.onstart = () => {
      setIsRecognizing(true);
      setDisplayText('');
      setFinalText('');
      tempFinalTextRef.current = '';
      tempCombinedTextRef.current = '';
      lastResultAtRef.current = Date.now();
      clearSilenceTimer();
      
      console.log('录音开始，当前句子:', currentSentenceRef.current); // 调试日志
      
      // 智能静默检测：根据完成度动态调整静默时间
      silenceTimerRef.current = window.setInterval(() => {
        const diff = Date.now() - lastResultAtRef.current;
        
        // 从 ref 获取当前句子，避免闭包问题
        const targetSentence = currentSentenceRef.current;
        if (!targetSentence || targetSentence.trim() === '') {
          // 没有目标句子时，使用简单的静默检测（2秒）
          if (diff >= 2000) {
            console.log('无目标句子，2秒后自动停止');
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
        
        console.log(`完成度: ${Math.round(completionRate * 100)}%, 静默: ${diff}ms, 目标tokens: ${targetTokens.length}, 当前tokens: ${currentTokens.length}, 文本: "${currentText}"`);
        
        // 根据完成度动态调整静默时间
        let requiredSilence = 10000; // 默认10秒（<100%时）
        
        if (completionRate >= 1.0) {
          requiredSilence = 1000; // 完成度 >= 100%：1秒
        }
        // else: 完成度 < 100%：保持默认10秒
        
        // 达到静默时间要求，自动停止
        if (diff >= requiredSilence) {
          console.log(`完成度 ${Math.round(completionRate * 100)}% 且静默 ${requiredSilence}ms，自动停止`);
          try { rec.stop(); } catch {}
          clearSilenceTimer();
        }
        // 超过12秒强制兜底（防止卡住）
        else if (diff >= 12000) {
          console.log('超过 12秒，强制兜底停止');
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
        console.log('检测到新内容，重置静默时间:', combined);
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
        // 检查是否是HTTPS问题
        const isNonSecure = typeof window !== 'undefined' && 
                           window.location.protocol !== 'https:' && 
                           window.location.hostname !== 'localhost' &&
                           !window.location.hostname.startsWith('127.');
        
        if (isNonSecure) {
          setTimeout(() => {
            alert('麦克风权限被拒绝。\n\n移动端需要使用HTTPS安全连接。\n\n请使用 https:// 开头的地址访问，或部署到Vercel等平台测试。');
          }, 100);
        } else {
          setTimeout(() => {
            alert('麦克风权限被拒绝。\n\n请在浏览器设置中允许本网站使用麦克风。\n\n步骤：\n1. 点击地址栏的锁图标\n2. 找到麦克风权限\n3. 设置为"允许"\n4. 刷新页面');
          }, 100);
        }
      } else if (errorType === 'audio-capture') {
        setTimeout(() => {
          alert('无法捕获音频。\n\n可能原因：\n1. 麦克风被其他应用占用\n2. 麦克风硬件故障');
        }, 100);
      } else if (errorType === 'service-not-allowed') {
        setTimeout(() => {
          alert('语音识别服务不可用。\n\n请确保使用支持Web Speech API的浏览器（如Chrome）。');
        }, 100);
      }
      // no-speech等其他错误不提示，静默处理
      
      setIsRecognizing(false);
      clearSilenceTimer();
      // 发生错误时也要提交结果，延迟到按钮状态更新后
      if (tempFinalTextRef.current) {
        setTimeout(() => {
          setFinalText(tempFinalTextRef.current);
        }, 100);
      }
    };
    rec.onend = () => {
      setIsRecognizing(false);
      clearSilenceTimer();
      // 录音真正结束时才提交最终结果用于评分
      // 延迟一小段时间，确保按钮从"停止"变为"练习"后再开始评分
      if (tempFinalTextRef.current) {
        setTimeout(() => {
          setFinalText(tempFinalTextRef.current);
        }, 100);
      }
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
      alert('当前浏览器不支持实时语音识别。\n\n建议使用最新版Chrome浏览器。');
      return;
    }
    
    try {
      setDisplayText('');
      setFinalText('');
      tempFinalTextRef.current = '';
      tempCombinedTextRef.current = '';
      lastFinalTextRef.current = '';
      recognitionRef.current.start();
    } catch (error) {
      console.error('语音识别启动错误:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`无法开始语音识别：${errorMsg}\n\n请检查麦克风权限。`);
    }
  }, []);

  const stop = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // 立即清理状态
      clearSilenceTimer();
      setIsRecognizing(false);
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

  const speak = useCallback(async (index: number) => {
    if (!(audioUrl && sentenceTimeline && sentenceTimeline.length > 0)) {
      alert('未找到可用的生成音频或时间轴，无法播放该句。');
      return;
    }

    if (!audioRef.current) {
      try {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.preload = 'auto';
        try { audioRef.current.load(); } catch {}
        audioRef.current.addEventListener('timeupdate', () => {
          const stopAt = stopAtRef.current;
          if (typeof stopAt === 'number' && audioRef.current && audioRef.current.currentTime >= stopAt) {
            audioRef.current.pause();
            stopAtRef.current = null;
          }
        });
      } catch {}
    } else if (audioRef.current.src !== audioUrl) {
      audioRef.current.src = audioUrl;
      try { audioRef.current.load(); } catch {}
    }

    const a = audioRef.current;
    const seg = sentenceTimeline.find((s) => s.index === index) || sentenceTimeline[index];
    if (!(seg && a)) {
      alert('未找到可用的生成音频或时间轴，无法播放该句。');
      return;
    }

    // iOS 解锁：在用户手势内先触发一次静音播放以满足自动播放策略
    if (isIOS && !iosUnlockedRef.current) {
      try {
        a.muted = true;
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
        try { a.load(); } catch {}
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

      // 避免在 iOS 上同步 cancel 造成卡顿
      if (!isIOS) {
        try {
          if ('speechSynthesis' in window) {
            setTimeout(() => { try { window.speechSynthesis.cancel(); } catch {} }, 0);
          }
        } catch {}
      }

      await a.play();
      const tick = () => {
        const stopAt = stopAtRef.current;
        if (typeof stopAt === 'number' && audioRef.current && audioRef.current.currentTime >= stopAt) {
          audioRef.current.pause();
          stopAtRef.current = null;
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
      return;
    } catch {}

    alert('未找到可用的生成音频或时间轴，无法播放该句。');
  }, [audioUrl, sentenceTimeline, isIOS]);

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

  return (
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
                onStartPractice={start}
                onStopPractice={stop}
                onRetry={() => {
                  setDisplayText('');
                  setFinalText('');
                  setTimeout(() => start(), 100);
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">暂无内容</div>
      )}

      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </Card>
  );
}
