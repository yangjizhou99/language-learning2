'use client';

import React, { useRef, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatedScore } from './ScoreAnimation';
import { useSentenceGesture } from '@/hooks/useSentenceGesture';

interface SentenceScore {
  coverage: number;
  similarity: number;
  finalText: string;
  missing: string[];
  extra: string[];
}

interface SentenceCardProps {
  index: number;
  sentence: string;
  score: SentenceScore | null;
  isExpanded: boolean;
  isRecognizing: boolean;
  displayText: string;
  finalText: string;
  currentMetrics: {
    coverage: number;
    similarity: number;
    missing: string[];
    extra: string[];
  } | null;
  isMobile: boolean;
  language: 'ja' | 'en' | 'zh';
  onToggleExpand: () => void;
  onSpeak: () => void;
  onStartPractice: () => void;
  onStopPractice: () => void;
  onRetry: () => void;
  tokenize: (text: string, lang: 'ja' | 'en' | 'zh') => string[];
}

// 根据评分获取颜色方案
function getScoreColor(score: SentenceScore | null): { bg: string; border: string; text: string; badge: string } {
  if (!score || !score.finalText) {
    return {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-700',
      badge: 'bg-gray-100 text-gray-600'
    };
  }
  
  const avgScore = (score.coverage + score.similarity) / 2;
  
  if (avgScore >= 0.8) {
    return {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
      badge: 'bg-green-500 text-white'
    };
  } else if (avgScore >= 0.6) {
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-900',
      badge: 'bg-yellow-500 text-white'
    };
  } else {
    return {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
      badge: 'bg-red-500 text-white'
    };
  }
}

export default function SentenceCard({
  index,
  sentence,
  score,
  isExpanded,
  isRecognizing,
  displayText,
  finalText,
  currentMetrics,
  isMobile,
  language,
  onToggleExpand,
  onSpeak,
  onStartPractice,
  onStopPractice,
  onRetry,
  tokenize,
}: SentenceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const colors = getScoreColor(score);

  // 手势支持（仅移动端且未展开时）
  useSentenceGesture(cardRef as RefObject<HTMLElement>, {
    enabled: isMobile && !isExpanded,
    onSwipeRight: onSpeak, // 右滑朗读
    onSwipeLeft: () => {
      onToggleExpand();
      setTimeout(onStartPractice, 300);
    }, // 左滑展开并练习
    onDoubleTap: () => {
      if (score) {
        onRetry();
      }
    }, // 双击重练
  });

  return (
    <div
      id={`sentence-${index}`}
      ref={cardRef}
      className={`border-2 rounded-lg transition-all ${colors.border} ${colors.bg}`}
    >
      {/* 句子标题栏 - 可点击展开 */}
      <button
        onClick={onToggleExpand}
        className={`w-full px-3 py-2 flex items-center justify-between hover:bg-white/50 transition-colors ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'}`}
      >
        <div className="flex items-center gap-2 flex-1 text-left min-w-0">
          {/* 序号 */}
          <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${colors.badge}`}>
            {index + 1}
          </span>
          
          {/* 评分圆点 */}
          {score && (
            <div className="flex items-center gap-0.5 flex-shrink-0" title={`覆盖度: ${Math.round(score.coverage * 100)}%, 相似度: ${Math.round(score.similarity * 100)}%`}>
              {/* 覆盖度圆点 */}
              {[...Array(5)].map((_, i) => (
                <div
                  key={`cov-${i}`}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < Math.round(score.coverage * 5) 
                      ? colors.badge.includes('green') ? 'bg-green-500' 
                        : colors.badge.includes('yellow') ? 'bg-yellow-500'
                        : 'bg-red-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
              <div className="w-1"></div>
              {/* 相似度圆点 */}
              {[...Array(5)].map((_, i) => (
                <div
                  key={`sim-${i}`}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < Math.round(score.similarity * 5)
                      ? colors.badge.includes('green') ? 'bg-green-500'
                        : colors.badge.includes('yellow') ? 'bg-yellow-500'
                        : 'bg-red-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* 句子文本 */}
          <span className={`${colors.text} text-sm flex-1 ${isExpanded ? '' : 'line-clamp-1'}`}>
            {sentence}
          </span>
        </div>
        
        {/* 展开/折叠图标 */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
        )}
      </button>

      {/* 展开的内容 */}
      {isExpanded && (
        <div className={`px-4 pb-4 space-y-3 border-t border-gray-200 ${isMobile ? 'pb-20' : ''}`}>
          {/* 操作按钮 - 仅在桌面端显示 */}
          {!isMobile && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <Button 
                onClick={onSpeak} 
                variant="outline" 
                size="sm" 
                className="rounded-lg"
              >
                <Volume2 className="w-4 h-4 mr-1" /> 朗读
              </Button>
              {!isRecognizing ? (
                <Button 
                  onClick={onStartPractice} 
                  variant="default" 
                  size="sm" 
                  className="rounded-lg"
                >
                  <Play className="w-4 h-4 mr-1" /> 练习
                </Button>
              ) : (
                <Button 
                  onClick={onStopPractice} 
                  variant="destructive" 
                  size="sm" 
                  className="rounded-lg"
                >
                  <Square className="w-4 h-4 mr-1" /> 停止
                </Button>
              )}
              {/* 重新练习按钮 */}
              {score && !isRecognizing && (
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重练
                </Button>
              )}
            </div>
          )}

          {/* 实时转录 */}
          {(isRecognizing || displayText) && (
            <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="text-xs font-medium text-green-700 mb-1">实时转录：</div>
              <div className="text-sm text-green-800 whitespace-pre-wrap break-words leading-relaxed">
                {displayText || '正在识别...'}
              </div>
            </div>
          )}

          {/* 评分结果 - 带动画 */}
          {finalText && currentMetrics && (
            <div className="space-y-3">
              <div className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-3'} gap-3`}>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <AnimatedScore
                    score={Math.round(currentMetrics.coverage * 100)}
                    label="覆盖度"
                  />
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <AnimatedScore
                    score={Math.round(currentMetrics.similarity * 100)}
                    label="相似度"
                  />
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-lg font-semibold text-gray-900">
                    {tokenize(finalText, language).length}
                  </div>
                  <div className="text-xs text-gray-500">识别字数</div>
                </div>
              </div>

              {/* 缺失和多读词汇 */}
              {(currentMetrics.missing.length > 0 || currentMetrics.extra.length > 0) && (
                <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                  {currentMetrics.missing.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-amber-200">
                      <div className="text-xs font-medium text-amber-700 mb-1">缺失关键词</div>
                      <div className={`text-sm text-amber-800 flex flex-wrap gap-2 ${isMobile ? 'overflow-x-auto scrollbar-thin' : ''}`}>
                        {currentMetrics.missing.map((w) => (
                          <span 
                            key={`miss-${w}`} 
                            className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded flex-shrink-0"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentMetrics.extra.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-red-200">
                      <div className="text-xs font-medium text-red-700 mb-1">误读/多读</div>
                      <div className={`text-sm text-red-800 flex flex-wrap gap-2 ${isMobile ? 'overflow-x-auto scrollbar-thin' : ''}`}>
                        {currentMetrics.extra.map((w) => (
                          <span 
                            key={`extra-${w}`} 
                            className="px-2 py-0.5 bg-red-50 border border-red-200 rounded flex-shrink-0"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 已保存的评分（当切换到其他句子后显示） */}
          {!finalText && score && (
            <div className="p-3 bg-white/50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600 mb-2">上次练习结果：</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-xs text-gray-500">覆盖度</div>
                  <div className="text-sm font-semibold">
                    {Math.round(score.coverage * 100)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">相似度</div>
                  <div className="text-sm font-semibold">
                    {Math.round(score.similarity * 100)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">识别字数</div>
                  <div className="text-sm font-semibold">
                    {tokenize(score.finalText, language).length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 移动端底部固定操作栏（仅展开时显示） */}
      {isMobile && isExpanded && (
        <div className="border-t border-gray-200 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center gap-2 rounded-b-lg -mx-[1px] -mb-[2px]">
          <Button 
            onClick={onSpeak} 
            variant="outline" 
            size="sm" 
            className="flex-1 rounded-lg"
          >
            <Volume2 className="w-4 h-4" />
          </Button>
          {!isRecognizing ? (
            <Button 
              onClick={onStartPractice} 
              variant="default" 
              size="sm" 
              className="flex-[2] rounded-lg"
            >
              <Play className="w-4 h-4 mr-1" /> 练习
            </Button>
          ) : (
            <Button 
              onClick={onStopPractice} 
              variant="destructive" 
              size="sm" 
              className="flex-[2] rounded-lg"
            >
              <Square className="w-4 h-4 mr-1" /> 停止
            </Button>
          )}
          {score && !isRecognizing && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="flex-1 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

