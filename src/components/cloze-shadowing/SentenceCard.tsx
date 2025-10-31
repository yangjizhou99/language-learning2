'use client';

import React, { memo, forwardRef } from 'react';
import { OptionsGrid } from './OptionsGrid';

type SentencePayload = {
  index: number;
  text: string;
  blank: { start: number; length: number };
  options: string[];
  num_correct: number;
  is_placeholder?: boolean;
};

interface SentenceCardProps {
  sentence: SentencePayload;
  selected: string[];
  feedback: 'correct' | 'wrong' | null;
  animating: Record<string, boolean>;
  shaking: boolean;
  needCount: number;
  onSelect: (opt: string) => void;
  onUndo: () => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
}

const SentenceInline = memo(({ 
  sentence, 
  selected, 
  feedback 
}: { 
  sentence: SentencePayload; 
  selected: string[]; 
  feedback: 'correct' | 'wrong' | null;
}) => {
  if (sentence.is_placeholder || (sentence.blank.length || 0) === 0 || (sentence.num_correct || 0) === 0) {
    return (
      <div className="leading-7 text-base">
        <span>{sentence.text}</span>
        <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 align-middle">无挖空，跳过</span>
      </div>
    );
  }
  const before = sentence.text.slice(0, sentence.blank.start);
  const after = sentence.text.slice(sentence.blank.start + sentence.blank.length);
  return (
    <div className="leading-7 text-base" aria-live="polite" aria-atomic="true">
      <span>{before}</span>
      {selected.length > 0 ? (
        <span className="inline-flex flex-wrap gap-1.5 align-middle">
          {selected.map((opt) => (
            <span key={opt} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${feedback === 'correct' ? 'bg-emerald-100 text-emerald-900' : feedback === 'wrong' ? 'bg-rose-100 text-rose-900' : 'bg-muted'}`}>
              <span>{opt}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="px-1.5 py-0.5 bg-muted rounded" aria-label="请输入填空">____</span>
      )}
      <span>{after}</span>
    </div>
  );
});

SentenceInline.displayName = 'SentenceInline';

export const SentenceCard = memo(forwardRef<HTMLDivElement, SentenceCardProps>(({
  sentence,
  selected,
  feedback,
  animating,
  shaking,
  needCount,
  onSelect,
  onUndo,
  onFocus,
  onBlur,
}, ref) => {
  const completed = selected.length >= needCount;
  const showUndo = !sentence.is_placeholder && 
    (sentence.blank.length || 0) > 0 && 
    (sentence.num_correct || 0) > 0 && 
    selected.length > 0 && 
    selected.length < needCount;

  return (
    <div
      ref={ref}
      className={`rounded-lg border bg-card text-card-foreground p-4 transition-shadow hover:shadow-md ${completed ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-muted'} ${shaking ? 'animate-card-shake' : ''}`}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={0}
    >
      <div className="p-3 bg-muted rounded mb-2">
        <SentenceInline sentence={sentence} selected={selected} feedback={feedback} />
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-muted-foreground">
          {sentence.is_placeholder || (sentence.blank.length || 0) === 0 || (sentence.num_correct || 0) === 0
            ? '无需作答'
            : (feedback === 'correct'
                ? '正确'
                : feedback === 'wrong'
                  ? '再试一次'
                  : (completed
                      ? '已完成'
                      : `选择 ${needCount} 项`))}
        </div>
        {showUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="text-[10px] px-2 py-0.5 text-muted-foreground hover:text-foreground border border-muted rounded transition-colors"
            aria-label="撤销最近一次选择"
            title="撤销最近一次选择 (Backspace)"
          >
            撤销
          </button>
        )}
      </div>
      {!completed && (
        <OptionsGrid
          sentenceIndex={sentence.index}
          options={sentence.options}
          selected={selected}
          animating={animating}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}));

SentenceCard.displayName = 'SentenceCard';

