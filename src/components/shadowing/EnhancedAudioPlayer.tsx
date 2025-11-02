'use client';

import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
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
  onSegmentComplete?: (start: number, end: number) => void; // 新增：分段播放完成回调
  duration_ms?: number;
  className?: string;
}

export interface EnhancedAudioPlayerRef {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  seek: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  playSegment: (start: number, end: number) => Promise<void>;
}

const EnhancedAudioPlayer = forwardRef<EnhancedAudioPlayerRef, EnhancedAudioPlayerProps>(({
  audioUrl,
  onPlayStateChange,
  onSegmentComplete,
  duration_ms,
  className = '',
}, ref) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const stopAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

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

  // 监控分段播放自动停止
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const audioEl: HTMLAudioElement = a;

    function watch() {
      const stopAt = stopAtRef.current;
      if (typeof stopAt === 'number' && audioEl.currentTime >= stopAt) {
        // 到达停止点，暂停音频（会触发 pause 事件，从而 resolve Promise）
        try { 
          audioEl.pause();
          // 确保在停止点处停住
          audioEl.currentTime = Math.min(stopAt, audioEl.currentTime);
        } catch {}
        stopAtRef.current = null;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        return;
      }
      rafRef.current = requestAnimationFrame(watch);
    }

    const onPlay = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(watch);
    };
    const onPause = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    audioEl.addEventListener('play', onPlay);
    audioEl.addEventListener('pause', onPause);
    return () => {
      audioEl.removeEventListener('play', onPlay);
      audioEl.removeEventListener('pause', onPause);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [audioUrl]); // 使用 audioUrl 作为依赖，而不是 audioRef.current

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    play: () => {
      audioRef.current?.play();
    },
    pause: () => {
      audioRef.current?.pause();
    },
    toggle: () => {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
    },
    reset: () => {
      resetAudio();
    },
    seek: (seconds: number) => {
      if (!audioRef.current) return;
      try {
        const anyAudio = audioRef.current as any;
        if (typeof anyAudio.fastSeek === 'function') {
          anyAudio.fastSeek(Math.max(0, seconds));
        } else {
          audioRef.current.currentTime = Math.max(0, seconds);
        }
      } catch {
        try { audioRef.current.currentTime = Math.max(0, seconds); } catch {}
      }
    },
    setPlaybackRate: (rate: number) => {
      setPlaybackRate(rate);
      if (audioRef.current) {
        audioRef.current.playbackRate = rate;
      }
    },
    playSegment: async (start: number, end: number) => {
      const a = audioRef.current;
      if (!a) return;
      const audioEl: HTMLAudioElement = a;

      // 等待元数据
      await new Promise<void>((resolve) => {
        if (audioEl.readyState >= 1) return resolve();
        const onLoaded = () => {
          audioEl.removeEventListener('loadedmetadata', onLoaded);
          audioEl.removeEventListener('canplay', onLoaded);
          resolve();
        };
        audioEl.addEventListener('loadedmetadata', onLoaded, { once: true });
        audioEl.addEventListener('canplay', onLoaded, { once: true });
      });

      const START_EPS = 0.005;
      const STOP_EPS = 0.08;
      const targetStart = Math.max(0, start + START_EPS);
      const targetStop = Math.max(start, end - STOP_EPS);

      // 定位
      try {
        const anyAudio = audioEl as any;
        if (typeof anyAudio.fastSeek === 'function') {
          anyAudio.fastSeek(targetStart);
        } else {
          audioEl.currentTime = targetStart;
        }
      } catch { audioEl.currentTime = targetStart; }

      // 等待 seek 完成
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; cleanup(); resolve(); } };
        const onSeeked = () => finish();
        const onCanPlay = () => finish();
        const cleanup = () => {
          audioEl.removeEventListener('seeked', onSeeked);
          audioEl.removeEventListener('canplay', onCanPlay);
        };
        audioEl.addEventListener('seeked', onSeeked, { once: true });
        audioEl.addEventListener('canplay', onCanPlay, { once: true });
        setTimeout(finish, 800);
      });

      stopAtRef.current = targetStop;
      audioEl.playbackRate = playbackRate;

      await new Promise<void>((resolve, reject) => {
        let finished = false;
        let safetyId: ReturnType<typeof setTimeout> | null = null;
        const onEnded = () => finish();
        const onPause = () => {
          // 分段结束或用户暂停，均视为完成
          finish();
        };
        function finish() {
          if (finished) return;
          finished = true;
          // 兜底：强制在段末停住，防止继续到下一句
          try {
            if (audioEl && !audioEl.paused) {
              const stopAt = stopAtRef.current;
              if (typeof stopAt === 'number') {
                try { audioEl.currentTime = Math.min(stopAt, audioEl.currentTime); } catch {}
              }
              try { audioEl.pause(); } catch {}
            }
          } catch {}
          // 触发分段播放完成回调
          if (onSegmentComplete && stopAtRef.current !== null) {
            onSegmentComplete(targetStart, stopAtRef.current);
          }
          if (safetyId) { clearTimeout(safetyId); safetyId = null; }
          audioEl.removeEventListener('ended', onEnded);
          audioEl.removeEventListener('pause', onPause);
          stopAtRef.current = null;
          resolve();
        }
        function fail(err?: unknown) {
          if (finished) return;
          finished = true;
          if (safetyId) { clearTimeout(safetyId); safetyId = null; }
          audioEl.removeEventListener('ended', onEnded);
          audioEl.removeEventListener('pause', onPause);
          stopAtRef.current = null;
          reject(err);
        }
        audioEl.addEventListener('ended', onEnded, { once: true });
        audioEl.addEventListener('pause', onPause);
        safetyId = setTimeout(() => finish(), Math.max((targetStop - targetStart) * 1000 + 1500, 1500));
        (async () => {
          try {
            await audioEl.play();
          } catch (e) {
            fail(e);
          }
        })();
      });
    },
  }));

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
            aria-label="后退15秒"
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
            aria-label="前进15秒"
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
            aria-label="重置音频到开始位置"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            <span className="text-xs hidden sm:inline">重置</span>
          </Button>
        </div>

        {/* 右侧：倍速选择 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-medium">倍速</span>
          <Select value={playbackRate.toString()} onValueChange={handleRateChange}>
            <SelectTrigger className="h-9 w-[88px] bg-white border-blue-200 text-sm" aria-label="选择播放速度">
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
          playsInline
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
});

EnhancedAudioPlayer.displayName = 'EnhancedAudioPlayer';

export default EnhancedAudioPlayer;

