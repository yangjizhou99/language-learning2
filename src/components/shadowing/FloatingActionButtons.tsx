'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, Languages, ArrowUp } from 'lucide-react';

interface FloatingActionButtonsProps {
  // 生词模式相关
  showVocabButton?: boolean;
  isVocabMode?: boolean;
  onToggleVocabMode?: () => void;
  
  // 翻译显示相关
  showTranslationButton?: boolean;
  showTranslation?: boolean;
  onToggleTranslation?: () => void;
  
  // 返回顶部相关
  showScrollToTop?: boolean;
  onScrollToTop?: () => void;
  
  className?: string;
}

/**
 * 浮动操作按钮组件
 * 用于在页面右下角显示快速操作按钮
 */
export default function FloatingActionButtons({
  showVocabButton = false,
  isVocabMode = false,
  onToggleVocabMode,
  showTranslationButton = false,
  showTranslation = false,
  onToggleTranslation,
  showScrollToTop = false,
  onScrollToTop,
  className = '',
}: FloatingActionButtonsProps) {
  // 如果没有任何按钮要显示，则不渲染
  if (!showVocabButton && !showTranslationButton && !showScrollToTop) {
    return null;
  }

  return (
    <div
      className={`fixed right-4 z-20 flex flex-col gap-3 ${className}`}
      style={{
        bottom: 'calc(max(env(safe-area-inset-bottom), 0.75rem) + 80px)', // 避免与底部导航栏冲突
      }}
    >
      {/* 生词选择按钮 */}
      {showVocabButton && (
        <button
          onClick={onToggleVocabMode}
          className={`w-14 h-14 rounded-full shadow-lg backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
            isVocabMode
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-white/90 hover:bg-white text-amber-600 border-2 border-amber-200'
          }`}
          aria-label={isVocabMode ? '关闭生词模式' : '开启生词模式'}
          title={isVocabMode ? '关闭生词模式' : '开启生词模式'}
        >
          <BookOpen className={`w-6 h-6 ${isVocabMode ? 'animate-pulse' : ''}`} />
        </button>
      )}

      {/* 翻译显示按钮 */}
      {showTranslationButton && (
        <button
          onClick={onToggleTranslation}
          className={`w-14 h-14 rounded-full shadow-lg backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
            showTranslation
              ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
              : 'bg-white/90 hover:bg-white text-indigo-600 border-2 border-indigo-200'
          }`}
          aria-label={showTranslation ? '隐藏翻译' : '显示翻译'}
          title={showTranslation ? '隐藏翻译' : '显示翻译'}
        >
          <Languages className={`w-6 h-6 ${showTranslation ? 'animate-pulse' : ''}`} />
        </button>
      )}

      {/* 返回顶部按钮 */}
      {showScrollToTop && (
        <button
          onClick={onScrollToTop}
          className="w-14 h-14 rounded-full bg-white/90 hover:bg-white shadow-lg backdrop-blur-md border-2 border-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 text-gray-600 hover:text-gray-800"
          aria-label="返回顶部"
          title="返回顶部"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

