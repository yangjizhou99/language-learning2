'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioSpeedControlProps {
  playbackRate: number;
  onRateChange: (rate: number) => void;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  className?: string;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x 慢' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x 正常' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 1.75, label: '1.75x' },
  { value: 2, label: '2x 快' },
];

export default function AudioSpeedControl({
  playbackRate,
  onRateChange,
  isPlaying,
  onPlay,
  onPause,
  onReset,
  className = '',
}: AudioSpeedControlProps) {
  return (
    <div className={cn('flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      {/* 播放控制按钮 */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={isPlaying ? onPause : onPlay}
          className="h-8 w-8 p-0"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={onReset}
          className="h-8 w-8 p-0"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* 速度选择器 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">播放速度:</span>
        <Select
          value={playbackRate.toString()}
          onValueChange={(value) => onRateChange(parseFloat(value))}
        >
          <SelectTrigger className="h-8 w-24 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 当前速度显示 */}
      <div className="text-xs text-gray-500">
        当前: {playbackRate}x
      </div>
    </div>
  );
}
