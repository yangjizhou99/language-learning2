'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { SentenceSegment } from '@/hooks/useSegmentAudio';
import { useMobile } from '@/contexts/MobileContext';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import { useSentenceGesture } from '@/hooks/useSentenceGesture';

type Lang = 'en' | 'ja' | 'zh' | 'ko';

interface SentenceInlinePlayerProps {
  text: string;
  language: Lang;
  sentenceTimeline?: SentenceSegment[] | null;
  onPlaySentence?: (index: number) => void;
  activeIndex?: number | null;
  isPlaying?: boolean;
  className?: string;
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [lastTapKeyIndex, setLastTapKeyIndex] = useState<number | null>(null);

  // 统一双击/双触手势：重播最近点击的句子
  useSentenceGesture(containerRef, {
    onDoubleTap: () => {
      if (lastTapKeyIndex !== null) onPlaySentence?.(lastTapKeyIndex);
    },
    enabled: true,
  });

  return (
    <div className={`space-y-3 ${className}`} ref={containerRef}>
      {/* 倍速控制移除：统一使用主播放器 */}

      {/* 行内逐句列表 */}
      <div className="space-y-2">
        {sentenceItems.length === 0 ? (
          <div className="text-gray-500">暂无内容</div>
        ) : (
          sentenceItems.map((item, i) => {
            const keyIndex = item.keyIndex ?? i;
            const active = activeIndex === keyIndex;
            return (
              <div
                key={i}
                className={`group relative flex items-start gap-2 rounded-lg px-2 py-1 ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                {/* 播放按钮 */}
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

                {/* 句子文本（可点击触发） */}
                <button
                  type="button"
                  className={`text-left flex-1 leading-relaxed ${active ? 'text-blue-800' : 'text-gray-800'}`}
                  onClick={() => {
                    setLastTapKeyIndex(keyIndex);
                    if (canPlay) onPlaySentence?.(keyIndex);
                  }}
                >
                  {item.display}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

