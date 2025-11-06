'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { SentenceSegment } from '@/hooks/useSegmentAudio';
import { useMobile } from '@/contexts/MobileContext';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import { useSentenceGesture } from '@/hooks/useSentenceGesture';
import { useSentencePracticeCore } from '@/hooks/useSentencePracticeCore';
import SentencePracticeProgress from '@/components/shadowing/SentencePracticeProgress';
import { AnimatedScore } from '@/components/shadowing/ScoreAnimation';
import SentenceCard from '@/components/shadowing/SentenceCard';
import type { AcuUnit } from '@/lib/alignment-utils';

type Lang = 'en' | 'ja' | 'zh' | 'ko';

interface SentenceInlinePlayerProps {
  text: string;
  language: Lang;
  sentenceTimeline?: SentenceSegment[] | null;
  onPlaySentence?: (index: number) => void;
  activeIndex?: number | null;
  isPlaying?: boolean;
  className?: string;
  renderText?: (text: string) => React.ReactNode;
  enablePractice?: boolean;
  showCompactProgress?: boolean;
  acuUnits?: AcuUnit[];
  translationText?: string;
  translationLanguage?: Lang;
}

function splitTextFallback(text: string, language: Lang): string[] {
  const src = String(text || '');
  if (!src.trim()) return [];
  // 对话体：A:/B: 优先按行分句
  const hasDialogue = /(?:^|\n)\s*[ABＡＢ]\s*[：:]/.test(src);
  if (hasDialogue) {
    const normalized = src.replace(/([^\n])\s*([AＡ]\s*[：:])/g, '$1\n$2')
      .replace(/([^\n])\s*([BＢ]\s*[：:])/g, '$1\n$2');
    return normalized.split(/\n+/).map(s => s.trim()).filter(Boolean);
  }
  // 优先使用 Intl.Segmenter
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const locale = language === 'ko' ? 'ko-KR' : language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US';
      const segmenter = new (Intl as any).Segmenter(locale, { granularity: 'sentence' });
      const parts: string[] = [];
      for (const seg of Array.from(segmenter.segment(src))) {
        const s = String((seg as any).segment || '').trim();
        if (s) parts.push(s);
      }
      if (parts.length) return parts;
    } catch {}
  }
  // 标点回退
  if (language === 'en' || language === 'ko') {
    return src.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  }
  return src.split(/[。！？!?…]+/).map(s => s.trim()).filter(Boolean);
}

function normalizeSpeakerLabel(speaker?: string): string | undefined {
  if (!speaker) return undefined;
  const ch = speaker.trim().charAt(0).toUpperCase();
  if (ch === 'A' || ch === 'B') return ch;
  return speaker.trim();
}

export default function SentenceInlinePlayer({
  text,
  language,
  sentenceTimeline,
  onPlaySentence,
  activeIndex = null,
  isPlaying = false,
  className = '',
  renderText,
  enablePractice = false,
  showCompactProgress = false,
  acuUnits,
  translationText,
  translationLanguage,
}: SentenceInlinePlayerProps) {
  const { actualIsMobile } = useMobile();

  // 句子来源优先：timeline 文本顺序 -> 回退拆分；保留 A/B 标识
  const sentenceItems = useMemo(() => {
    if (Array.isArray(sentenceTimeline) && sentenceTimeline.length > 0) {
      const ordered = [...sentenceTimeline].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return ordered.map(s => {
        const label = normalizeSpeakerLabel(s.speaker);
        const display = label ? `${label}: ${s.text}` : s.text;
        return { display, keyIndex: typeof s.index === 'number' ? s.index : undefined };
      });
    }
    const arr = splitTextFallback(text || '', language);
    return arr.map((line, idx) => ({ display: line, keyIndex: idx }));
  }, [sentenceTimeline, text, language]);

  const canPlay = Array.isArray(sentenceTimeline) && sentenceTimeline.length > 0;

  // 翻译分句（用于右侧对照显示）
  const translationItems = useMemo(() => {
    const src = String(translationText || '');
    if (!src.trim()) return [] as string[];
    return splitTextFallback(src, translationLanguage || 'en');
  }, [translationText, translationLanguage]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [lastTapKeyIndex, setLastTapKeyIndex] = useState<number | null>(null);

  // 统一双击/双触手势：重播最近点击的句子
  useSentenceGesture(containerRef, {
    onDoubleTap: () => {
      if (lastTapKeyIndex !== null) onPlaySentence?.(lastTapKeyIndex);
    },
    enabled: true,
  });

  // 逐句练习（紧凑控件）
  const practice = enablePractice
    ? useSentencePracticeCore({
        originalText: text,
        language: language as any,
        sentenceTimeline: sentenceTimeline || undefined,
        onPlaySentence: onPlaySentence as any,
        acuUnits,
      })
    : null;

  // 统一 UI：启用练习时，直接复用 SentenceCard 的渲染（与第四步一致）
  if (enablePractice && practice) {
    return (
      <div className={`${className}`} ref={containerRef}>
        {/* 已按用户要求移除顶部快速选择的小圆圈进度模块 */}
        <div className="space-y-2">
          {sentenceItems.length === 0 ? (
            <div className="text-gray-500">暂无内容</div>
          ) : (
            sentenceItems.map((item, i) => {
              const keyIndex = item.keyIndex ?? i;
              const isExpanded = practice.expandedIndex === keyIndex;
              const score = practice.sentenceScores[keyIndex] || null;
              const sentenceText = item.display;
              return (
                <div key={i} data-sentence-index={keyIndex} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                  <div className="mt-1">
                    <SentenceCard
                      index={keyIndex}
                      sentence={sentenceText}
                      score={score}
                      isExpanded={isExpanded}
                      isRecognizing={practice.isRecognizing && isExpanded}
                      displayText={isExpanded ? practice.displayText : ''}
                      finalText={isExpanded ? practice.finalText : ''}
                      currentMetrics={isExpanded && score ? { score: score.score, missing: score.missing, extra: score.extra, alignmentResult: score.alignmentResult } : null}
                      isMobile={actualIsMobile}
                      language={language}
                      onToggleExpand={() => practice.setExpandedIndex(isExpanded ? null : keyIndex)}
                      onSpeak={() => practice.speak(keyIndex)}
                      onStartPractice={() => practice.start(keyIndex)}
                      onStopPractice={() => practice.stop()}
                      onRetry={() => practice.retry(keyIndex)}
                      renderText={renderText}
                    />
                  </div>
                  <div className="mt-1 md:pl-2 text-gray-700 text-base leading-relaxed whitespace-pre-wrap">
                    {translationItems[i] || ''}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* 取消底部建议卡片（用户要求移除占一行的三角播放卡） */}
      </div>
    );
  }

  // 非练习模式：保持原来的纯行内播放列表
  return (
    <div className={`${className}`} ref={containerRef}>
      <div className="space-y-2">
        {sentenceItems.length === 0 ? (
          <div className="text-gray-500">暂无内容</div>
        ) : (
          sentenceItems.map((item, i) => {
            const keyIndex = item.keyIndex ?? i;
            const active = activeIndex === keyIndex;
            return (
              <div key={i} className={`group relative flex items-start gap-2 rounded-lg px-2 py-1 ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <div className={`pt-1 ${actualIsMobile ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  {canPlay ? (
                    active && isPlaying ? (
                      <Button variant="ghost" size="icon" onClick={() => onPlaySentence?.(keyIndex)} aria-label="停止">
                        <Square className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => onPlaySentence?.(keyIndex)} aria-label="播放">
                        <Play className="w-4 h-4" />
                      </Button>
                    )
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`text-left flex-1 leading-[2.1] ${active ? 'text-blue-800' : 'text-gray-800'}`}
                  onClick={() => {
                    setLastTapKeyIndex(keyIndex);
                    if (canPlay) onPlaySentence?.(keyIndex);
                  }}
                >
                  {renderText ? renderText(item.display) : item.display}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

