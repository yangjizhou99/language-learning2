/**
 * 优化的音频播放器组件
 * 使用React.memo和useCallback进行性能优化
 */

import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  duration?: number;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
}

const AudioPlayer = memo<AudioPlayerProps>(({ 
  src, 
  title = "音频", 
  duration, 
  className = "",
  onPlay,
  onPause,
  onEnded,
  onError
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 记忆化播放/暂停处理函数
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
    } else {
      audioRef.current.play().catch(error => {
        console.error('播放失败:', error);
        onError?.(error.message);
      });
      setIsPlaying(true);
      onPlay?.();
    }
  }, [isPlaying, onPlay, onPause, onError]);

  // 记忆化静音切换处理函数
  const handleMuteToggle = useCallback(() => {
    if (!audioRef.current) return;

    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  // 记忆化音量变化处理函数
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!audioRef.current) return;

    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  // 记忆化时间更新处理函数
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  }, []);

  // 记忆化播放结束处理函数
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    onEnded?.();
  }, [onEnded]);

  // 记忆化错误处理函数
  const handleError = useCallback(() => {
    setIsPlaying(false);
    onError?.('音频加载失败');
  }, [onError]);

  // 记忆化进度条点击处理函数
  const handleProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // 格式化时间显示
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 记忆化进度百分比
  const progressPercentage = useMemo(() => {
    if (!duration) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  // 记忆化音量图标
  const volumeIcon = useMemo(() => {
    if (isMuted || volume === 0) {
      return <VolumeX className="w-4 h-4" />;
    }
    return <Volume2 className="w-4 h-4" />;
  }, [isMuted, volume]);

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded p-3 ${className}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-blue-700">{title}</span>
        {duration && (
          <span className="text-xs text-blue-600">
            时长: {Math.round(duration / 1000)}秒
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {/* 播放/暂停按钮 */}
        <button
          onClick={handlePlayPause}
          className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          disabled={!src}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        {/* 进度条 */}
        <div className="flex-1">
          <div 
            className="w-full bg-gray-200 rounded-full h-2 cursor-pointer"
            onClick={handleProgressClick}
          >
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-100"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {duration && (
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration / 1000)}</span>
            </div>
          )}
        </div>

        {/* 音量控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleMuteToggle}
            className="text-blue-600 hover:text-blue-700"
          >
            {volumeIcon}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16"
          />
        </div>
      </div>

      {/* 隐藏的音频元素 */}
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
      />
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
