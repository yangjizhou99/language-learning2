'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EnhancedAudioPlayerProps {
  audioUrl: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
  duration_ms?: number;
  className?: string;
}

export default function EnhancedAudioPlayer({
  audioUrl,
  onPlayStateChange,
  duration_ms,
  className = '',
}: EnhancedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setIsPlaying(true);
      onPlayStateChange?.(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onPlayStateChange]);

  const skipTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + seconds)
      );
    }
  };

  const resetAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    }
  };

  const handleRateChange = (rate: string) => {
    const rateNum = parseFloat(rate);
    setPlaybackRate(rateNum);
    if (audioRef.current) {
      audioRef.current.playbackRate = rateNum;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 快捷操作按钮 */}
      <div className="flex items-center justify-between gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
        {/* 左侧：跳转按钮 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => skipTime(-15)}
            className="h-10 px-3 rounded-xl bg-white hover:bg-blue-50 border-blue-200"
            title="后退15秒"
          >
            <SkipBack className="w-4 h-4 mr-1" />
            <span className="text-xs">-15s</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => skipTime(15)}
            className="h-10 px-3 rounded-xl bg-white hover:bg-blue-50 border-blue-200"
            title="前进15秒"
          >
            <span className="text-xs">+15s</span>
            <SkipForward className="w-4 h-4 ml-1" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={resetAudio}
            className="h-10 px-3 rounded-xl bg-white hover:bg-blue-50 border-blue-200"
            title="重新开始"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            <span className="text-xs hidden sm:inline">重置</span>
          </Button>
        </div>

        {/* 右侧：倍速选择 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-medium">倍速</span>
          <Select value={playbackRate.toString()} onValueChange={handleRateChange}>
            <SelectTrigger className="h-9 w-[88px] bg-white border-blue-200 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">0.5x 慢</SelectItem>
              <SelectItem value="0.75">0.75x</SelectItem>
              <SelectItem value="1">1x 正常</SelectItem>
              <SelectItem value="1.25">1.25x</SelectItem>
              <SelectItem value="1.5">1.5x</SelectItem>
              <SelectItem value="1.75">1.75x</SelectItem>
              <SelectItem value="2">2x 快</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 原生音频播放器 - 保留完整功能 */}
      <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          preload="metadata"
          className="w-full h-12"
          style={{
            borderRadius: '8px',
          }}
          onPlay={() => {
            if (audioRef.current) {
              audioRef.current.playbackRate = playbackRate;
            }
          }}
        />
        {duration_ms && (
          <div className="mt-2 text-center text-xs text-gray-500">
            总时长: {Math.round(duration_ms / 1000)} 秒
          </div>
        )}
      </div>
    </div>
  );
}

