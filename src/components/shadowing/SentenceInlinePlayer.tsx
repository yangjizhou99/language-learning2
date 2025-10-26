'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useSegmentAudio, type SentenceSegment } from '@/hooks/useSegmentAudio';
import { useMobile } from '@/contexts/MobileContext';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';
import { useSentenceGesture } from '@/hooks/useSentenceGesture';

type Lang = 'en' | 'ja' | 'zh' | 'ko';

interface SentenceInlinePlayerProps {
  text: string;
  language: Lang;
  audioUrl?: string | null;
  sentenceTimeline?: SentenceSegment[] | null;
  onSegmentPlayStart?: (index: number) => void;
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
  audioUrl,
  sentenceTimeline,
  onSegmentPlayStart,
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

  const canPlay = !!audioUrl && Array.isArray(sentenceTimeline) && sentenceTimeline.length > 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [lastTapKeyIndex, setLastTapKeyIndex] = useState<number | null>(null);
  const { speak, stop, currentIndex, playbackRate, setPlaybackRate, isPlaying } = useSegmentAudio(
    audioUrl || null,
    sentenceTimeline || null,
    { onSegmentPlayStart },
  );

  // 统一双击/双触手势：重播最近点击的句子
  useSentenceGesture(containerRef, {
    onDoubleTap: () => {
      if (lastTapKeyIndex !== null) speak(lastTapKeyIndex);
    },
    enabled: true,
  });

  return (
    <div className={`space-y-3 ${className}`} ref={containerRef}>
      {/* 变速控制：滑动调节，0.1 步进 */}
      {canPlay && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">倍速</span>
          <span className="text-gray-500">0.5x</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            aria-label="播放速度"
            className="flex-1 h-2 rounded-lg cursor-pointer"
          />
          <span className="text-gray-600 font-medium">{playbackRate.toFixed(1)}x</span>
          <span className="text-gray-500">2.0x</span>
        </div>
      )}

      {/* 行内逐句列表 */}
      <div className="space-y-2">
        {sentenceItems.length === 0 ? (
          <div className="text-gray-500">暂无内容</div>
        ) : (
          sentenceItems.map((item, i) => {
            const keyIndex = item.keyIndex ?? i;
            const active = currentIndex === keyIndex;
            return (
              <div
                key={i}
                className={`group relative flex items-start gap-2 rounded-lg px-2 py-1 ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                {/* 播放按钮 */}
                <div className={`pt-1 ${actualIsMobile ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}> 
                  {canPlay ? (
                    active && isPlaying ? (
                      <Button variant="ghost" size="icon" onClick={() => stop()} aria-label="停止">
                        <Square className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => speak(keyIndex)} aria-label="播放">
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
                    if (canPlay) speak(keyIndex);
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


