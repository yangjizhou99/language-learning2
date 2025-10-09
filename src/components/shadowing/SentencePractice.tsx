'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import SentencePracticeProgress from './SentencePracticeProgress';
import SmartSuggestion from './SmartSuggestion';
import { AnimatedScore, Toast, BadgeUpgrade } from './ScoreAnimation';
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
  coverage: number;
  similarity: number;
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
  
  const avgScore = (score.coverage + score.similarity) / 2;
  
  if (avgScore >= 0.8) {
    return {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
      badge: 'bg-green-500 text-white'
    };
  } else if (avgScore >= 0.6) {
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
  const [quickMode, setQuickMode] = useState(false); // 快速练习模式
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'celebration' } | null>(null);
  const [badgeUpgrade, setBadgeUpgrade] = useState<{ emoji: string; label: string } | null>(null);
  const prevPracticedCount = useRef(0);
  const prevExcellentCount = useRef(0);
  
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastResultAtRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const sentences = useMemo(() => splitSentences(originalText || '', language), [originalText, language]);
  const total = sentences.length;
  const currentSentence = expandedIndex !== null ? sentences[expandedIndex] || '' : '';
  const { actualIsMobile } = useMobile();

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
    const missingTokens = unique(targetTokens.filter((t) => !saidTokens.includes(t)));
    const extraTokens = unique(saidTokens.filter((t) => !targetTokens.includes(t)));
    
    return { coverage: cov, similarity: sim, missing: missingTokens, extra: extraTokens };
  }, [currentSentence, finalText, language, expandedIndex, isConversation]);

  // 保存评分当finalText更新时
  useEffect(() => {
    if (expandedIndex !== null && finalText && currentMetrics) {
      const newScore = {
        coverage: currentMetrics.coverage,
        similarity: currentMetrics.similarity,
        finalText: finalText,
        missing: currentMetrics.missing,
        extra: currentMetrics.extra,
      };
      
      setSentenceScores(prev => ({
        ...prev,
        [expandedIndex]: newScore,
      }));
      
      // 检查是否优秀并显示反馈
      const avg = (currentMetrics.coverage + currentMetrics.similarity) / 2;
      if (avg >= 0.8) {
        setToast({
          message: '做得很好！这句练得不错 👍',
          type: 'success',
        });
      }
    }
  }, [expandedIndex, finalText, currentMetrics]);
  
  // 检查徽章升级
  useEffect(() => {
    const practiced = Object.keys(sentenceScores).length;
    const excellent = Object.values(sentenceScores).filter(score => {
      const avg = (score.coverage + score.similarity) / 2;
      return avg >= 0.8;
    }).length;
    
    // 检查徽章升级
    if (practiced >= 5 && prevPracticedCount.current < 5) {
      setBadgeUpgrade({ emoji: '🥉', label: '青铜练习者' });
    } else if (practiced >= 10 && prevPracticedCount.current < 10) {
      setBadgeUpgrade({ emoji: '🥈', label: '白银练习者' });
    } else if (excellent === total && total > 0 && prevExcellentCount.current < total) {
      setBadgeUpgrade({ emoji: '🥇', label: '黄金练习者' });
    }
    
    prevPracticedCount.current = practiced;
    prevExcellentCount.current = excellent;
  }, [sentenceScores, total]);

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
      lastResultAtRef.current = Date.now();
      clearSilenceTimer();
      // 使用定时器检查静默，不依赖 isRecognizing 闭包值
      silenceTimerRef.current = window.setInterval(() => {
        const diff = Date.now() - lastResultAtRef.current;
        if (diff >= 2000) {
          try { rec.stop(); } catch {}
          clearSilenceTimer();
        }
      }, 300);
    };
    rec.onresult = (event: WebSpeechRecognitionEvent) => {
      lastResultAtRef.current = Date.now();
      let fullFinal = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) fullFinal += transcript + ' ';
        else if (i >= event.resultIndex) interim += transcript;
      }
      const finalTrimmed = fullFinal.trim();
      setFinalText(finalTrimmed);
      const combined = `${finalTrimmed}${finalTrimmed && interim ? ' ' : ''}${interim}`.trim();
      setDisplayText(combined);
    };
    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
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
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // 立即清理状态
      clearSilenceTimer();
      setIsRecognizing(false);
    } catch (e) {
      console.error('停止识别时出错:', e);
      // 即使出错也要清理状态
      clearSilenceTimer();
      setIsRecognizing(false);
    }
  }, []);

  const speak = useCallback(async (index: number) => {
    if (audioUrl && sentenceTimeline && sentenceTimeline.length > 0) {
      if (!audioRef.current) {
        try {
          audioRef.current = new Audio(audioUrl);
          audioRef.current.preload = 'auto';
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
      }

      const seg = sentenceTimeline.find((s) => s.index === index) || sentenceTimeline[index];
      if (seg && audioRef.current) {
        try {
          const ensureReady = () =>
            new Promise<void>((resolve) => {
              const a = audioRef.current!;
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
          await ensureReady();
          const START_EPS = 0.005;
          const STOP_EPS = 0.08;
          audioRef.current.currentTime = Math.max(0, seg.start + START_EPS);
          stopAtRef.current = Math.max(seg.start, seg.end - STOP_EPS);
          try { window.speechSynthesis.cancel(); } catch {}
          await audioRef.current.play();
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
      }
    }
    alert('未找到可用的生成音频或时间轴，无法播放该句。');
  }, [audioUrl, sentenceTimeline]);

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
      
      // 快速模式：自动播放+录音
      if (quickMode) {
        setTimeout(async () => {
          // 先播放原音
          await speak(index);
          // 播放完毕后自动开始录音
          setTimeout(() => {
            if (expandedIndex === index) { // 确保还在当前句子
              start();
            }
          }, 500);
        }, 300);
      }
    }
  };

  // 计算整体进度
  const progress = useMemo(() => {
    const practiced = Object.keys(sentenceScores).length;
    const goodCount = Object.values(sentenceScores).filter(score => {
      const avg = (score.coverage + score.similarity) / 2;
      return avg >= 0.8;
    }).length;
    return { practiced, total, goodCount };
  }, [sentenceScores, total]);

  return (
    <Card className={`p-4 md:p-6 border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 ${className || ''}`}>
      {/* 顶部：进度和快速模式切换 */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
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
        
        {/* 快速模式开关 */}
        <button
          onClick={() => setQuickMode(!quickMode)}
          className={`
            flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
            ${quickMode 
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 border-purple-600 text-white shadow-lg' 
              : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
            }
          `}
          title={quickMode ? '关闭快速模式' : '开启快速模式：点击句子自动播放+录音+评分'}
        >
          <span className="text-lg">{quickMode ? '⚡' : '⚪'}</span>
          <span className="text-xs font-medium whitespace-nowrap">快速模式</span>
        </button>
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
                tokenize={tokenize}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">暂无内容</div>
      )}

      {/* 提示信息 */}
      {total > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-700">
            💡 <strong>提示：</strong>点击任意句子开始练习，建议把每一句都练好（绿色=优秀）后再进行正式录音。
          </div>
        </div>
      )}
      
      {/* Toast 通知 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* 徽章升级动画 */}
      {badgeUpgrade && (
        <BadgeUpgrade
          badge={badgeUpgrade}
          onClose={() => setBadgeUpgrade(null)}
        />
      )}
    </Card>
  );
}
