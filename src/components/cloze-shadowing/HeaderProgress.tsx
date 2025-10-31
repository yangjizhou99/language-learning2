'use client';

import React from 'react';

type SentencePayload = {
  index: number;
  text: string;
  blank: { start: number; length: number };
  options: string[];
  num_correct: number;
  is_placeholder?: boolean;
};

interface HeaderProgressProps {
  article: { id: string; lang: string; level: number; title: string } | null;
  totalSentences: number;
  completedCount: number;
  showOnlyIncomplete: boolean;
  sentences: SentencePayload[];
  answersByIndex: Record<number, string[]>;
  needCountForSentence: (s: SentencePayload) => number;
  onToggleFilter: (showOnlyIncomplete: boolean) => void;
  onDotClick: (idx: number) => void;
}

export function HeaderProgress({
  article,
  totalSentences,
  completedCount,
  showOnlyIncomplete,
  sentences,
  answersByIndex,
  needCountForSentence,
  onToggleFilter,
  onDotClick,
}: HeaderProgressProps) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-2">基于 Shadowing 的 Cloze 挖空</h1>
      <div className="text-xs text-muted-foreground">
        {article ? `语言: ${article.lang.toUpperCase()} | 难度: L${article.level}` : ''}
      </div>
      {totalSentences > 0 && (
        <div className="mt-2">
          <div 
            className="h-1.5 bg-muted rounded"
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemax={totalSentences}
            aria-label="练习进度"
          >
            <div className="h-1.5 bg-primary rounded" style={{ width: `${Math.min(100, Math.round((completedCount / Math.max(1, totalSentences)) * 100))}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">进度：{completedCount}/{totalSentences}</div>
        </div>
      )}
      {totalSentences > 0 && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="inline-flex items-center rounded-full border bg-background p-1">
            <button
              type="button"
              onClick={() => onToggleFilter(false)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${!showOnlyIncomplete ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => onToggleFilter(true)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${showOnlyIncomplete ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              仅未完成
            </button>
          </div>
        </div>
      )}
      {totalSentences > 0 && (
        <div className="mt-2 overflow-x-auto">
          <div className="flex items-center justify-center gap-2 min-w-max px-1">
            {sentences.map((s) => {
              const arr = answersByIndex[s.index] || [];
              const need = needCountForSentence(s);
              const done = arr.length >= need;
              return (
                <button
                  key={s.index}
                  type="button"
                  onClick={() => onDotClick(s.index)}
                  className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-primary' : 'bg-muted-foreground/30'} hover:bg-primary/80`}
                  aria-label={`跳转到句子 ${s.index + 1}`}
                  title={`跳转到句子 ${s.index + 1}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

