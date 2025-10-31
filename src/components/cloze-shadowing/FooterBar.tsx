'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface FooterBarProps {
  completedCount: number;
  totalSentences: number;
  firstIncompleteIndex: number | null;
  loading: boolean;
  onJumpToNext: () => void;
  onSubmit: () => void;
}

export function FooterBar({
  completedCount,
  totalSentences,
  firstIncompleteIndex,
  loading,
  onJumpToNext,
  onSubmit,
}: FooterBarProps) {
  if (totalSentences === 0) return null;

  return (
    <div className="fixed left-0 right-0 bottom-4 pointer-events-none">
      <div className="max-w-4xl mx-auto px-4">
        <div className="pointer-events-auto rounded-full border bg-background/80 backdrop-blur shadow-lg px-3 py-2 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">已完成 {completedCount}/{totalSentences}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={onJumpToNext}
              disabled={firstIncompleteIndex == null}
            >
              跳到下一未完成
            </Button>
            <Button onClick={onSubmit} disabled={loading || completedCount < totalSentences}>
              提交整篇
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

