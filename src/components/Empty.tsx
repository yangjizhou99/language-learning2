import React from 'react';
import { Button } from '@/components/ui/button';

export function Empty({ title = '暂无数据', onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <div className="border rounded-lg p-8 text-center bg-card text-card-foreground">
      <div className="text-base mb-3">{title}</div>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          重试
        </Button>
      )}
    </div>
  );
}
