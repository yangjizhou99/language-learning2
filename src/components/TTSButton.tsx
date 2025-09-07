'use client';

import { useState, useEffect } from 'react';

interface TTSButtonProps {
  text: string;
  lang: string;
  entryId: string;
  isPlaying: boolean;
  onPlay: (text: string, lang: string, entryId: string) => void;
  disabled?: boolean;
}

export default function TTSButton({ text, lang, entryId, isPlaying, onPlay, disabled }: TTSButtonProps) {
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // 检查浏览器支持
    setIsSupported('speechSynthesis' in window);
  }, []);

  if (!isSupported) {
    return null; // 不支持TTS则不显示按钮
  }

  const handleClick = () => {
    onPlay(text, lang, entryId);
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1 rounded-full hover:bg-gray-100 transition-colors ${
        isPlaying ? 'text-green-600 bg-green-50' : 'text-gray-500'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isPlaying ? '正在播放...' : '点击播放读音'}
      disabled={disabled}
    >
      {isPlaying ? (
        // 播放中的图标 (带动画)
        <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M9 12l3-3v6l-3-3zm6.268-8.536a9 9 0 010 12.728" />
        </svg>
      ) : (
        // 普通的音量图标
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M9 12l3-3v6l-3-3zm6.268-8.536a9 9 0 010 12.728" />
        </svg>
      )}
    </button>
  );
}
