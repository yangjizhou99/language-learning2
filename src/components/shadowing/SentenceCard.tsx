'use client';

import React, { useRef, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSentenceGesture } from '@/hooks/useSentenceGesture';

interface SentenceScore {
  score: number; // 综合相似度评分 (0-1范围)
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
    score: number;
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
  
  if (score.score >= 0.8) {
    return {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-900',
      badge: 'bg-green-500 text-white'
    };
  } else if (score.score >= 0.6) {
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
}: SentenceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const colors = getScoreColor(score);
  const [scoreAnimKey, setScoreAnimKey] = React.useState(0);
  const [prevScore, setPrevScore] = React.useState<number | null>(null);
  const [animatedScore, setAnimatedScore] = React.useState(0);
  const animatedScoreRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // DOM 引用，用于直接操作避免重渲染
  const progressBarRef = useRef<HTMLDivElement>(null);
  const percentageRef = useRef<HTMLDivElement>(null);
  
  // 保存最后一次的评分结果，即使重练也保留显示
  const [lastMetrics, setLastMetrics] = React.useState<{
    score: number;
    missing: string[];
    extra: string[];
  } | null>(null);

  // 根据分数(0-100)计算颜色 - 红→黄→绿渐变
  const getGradientColors = React.useCallback((scorePercent: number): { bg: string; border: string; shadow: string } => {
    // 性能优化：使用固定的颜色断点
    if (scorePercent >= 85) {
      return {
        bg: 'from-emerald-50 via-green-100 to-emerald-100',
        border: 'border-emerald-400',
        shadow: 'shadow-emerald-200/60'
      };
    } else if (scorePercent >= 70) {
      return {
        bg: 'from-green-50 via-lime-100 to-green-100',
        border: 'border-green-400',
        shadow: 'shadow-green-200/60'
      };
    } else if (scorePercent >= 55) {
      return {
        bg: 'from-yellow-50 via-amber-100 to-yellow-100',
        border: 'border-yellow-400',
        shadow: 'shadow-yellow-200/60'
      };
    } else if (scorePercent >= 40) {
      return {
        bg: 'from-orange-50 via-amber-100 to-orange-100',
        border: 'border-orange-400',
        shadow: 'shadow-orange-200/60'
      };
    } else {
      return {
        bg: 'from-red-50 via-rose-100 to-red-100',
        border: 'border-red-400',
        shadow: 'shadow-red-200/60'
      };
    }
  }, []);

  // 根据分数计算进度条颜色
  const getProgressColor = React.useCallback((scorePercent: number): string => {
    if (scorePercent >= 80) return 'bg-gradient-to-r from-green-400 to-emerald-500';
    if (scorePercent >= 60) return 'bg-gradient-to-r from-yellow-400 to-amber-500';
    return 'bg-gradient-to-r from-red-400 to-rose-500';
  }, []);

  // 当评分更新时触发动画和保存结果
  React.useEffect(() => {
    if (currentMetrics?.score !== undefined && finalText) {
      // 保存这次的评分结果
      setLastMetrics(currentMetrics);
      setScoreAnimKey(prev => prev + 1);
      
      const newScore = Math.round(currentMetrics.score * 100);
      const startScore = animatedScoreRef.current;
      setPrevScore(startScore);
      
      // 取消之前的动画
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // 动画更新分数 - 直接操作DOM，避免重渲染
      const duration = 1000;
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 缓动函数
        const easeProgress = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const currentScore = startScore + (newScore - startScore) * easeProgress;
        const roundedScore = Math.round(currentScore);
        animatedScoreRef.current = roundedScore;
        
        // 直接操作DOM，避免React重渲染
        if (progressBarRef.current) {
          progressBarRef.current.style.transform = `scaleX(${currentScore / 100})`;
        }
        if (percentageRef.current) {
          percentageRef.current.style.left = `calc(${currentScore}% - 20px)`;
        }
        
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          animationFrameRef.current = null;
          // 动画结束后更新React state，确保最终值正确
          setAnimatedScore(roundedScore);
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentMetrics, finalText]);

  // 点击词汇标签进行发音
  const speakWord = (text: string) => {
    if (!text || typeof window === 'undefined') return;
    
    try {
      // 停止当前正在播放的语音
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // 根据语言设置语音
      const langMap: Record<string, string> = {
        'ja': 'ja-JP',
        'zh': 'zh-CN',
        'en': 'en-US',
      };
      utterance.lang = langMap[language] || 'zh-CN';
      utterance.rate = 0.5; // 很慢，便于仔细听清每个音
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('语音合成失败:', error);
    }
  };

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
            <div className="flex items-center gap-0.5 flex-shrink-0" title={`综合相似度: ${Math.round(score.score * 100)}%`}>
              {/* 综合相似度圆点 */}
              {[...Array(5)].map((_, i) => (
                <div
                  key={`score-${i}`}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < Math.round(score.score * 5) 
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
            <div className="p-4 rounded-xl border-2 border-green-400 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 shadow-lg shadow-green-200/60">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-600">实时转录</div>
                {isRecognizing && !displayText && (
                  <span className="text-xs text-green-600 animate-pulse">识别中...</span>
                )}
              </div>
              <div className="text-sm text-green-800 whitespace-pre-wrap break-words leading-relaxed min-h-[1.5rem]">
                {displayText || '正在识别...'}
              </div>
            </div>
          )}

          {/* 评分结果 - 带动画和进度条（点击重练后依然保留） */}
          {lastMetrics && (
            <div className="space-y-3">
              <div 
                key={scoreAnimKey}
                className={`
                  p-4 rounded-xl border-2 transition-all duration-700 ease-in-out
                  score-card-animate bg-gradient-to-br shadow-lg
                  ${getGradientColors(animatedScore).bg}
                  ${getGradientColors(animatedScore).border}
                  ${getGradientColors(animatedScore).shadow}
                  ${!finalText ? 'opacity-75' : ''}
                `}
              >
                <div className="space-y-2">
                  {/* 标题栏 */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-gray-600">综合相似度</div>
                    {!finalText && isRecognizing && (
                      <span className="text-xs text-gray-500 animate-pulse">录音中...</span>
                    )}
                    {prevScore !== null && prevScore !== animatedScore && finalText && (
                      <span className={`text-xs font-semibold ${animatedScore > prevScore ? 'text-green-600' : 'text-red-600'}`}>
                        {animatedScore > prevScore ? '↑' : '↓'} {Math.abs(animatedScore - prevScore)}%
                      </span>
                    )}
                  </div>
                  
                  {/* 进度条容器 */}
                  <div className="relative pt-6 pb-1">
                    {/* 百分比指示器（无箭头） */}
                    <div 
                      ref={percentageRef}
                      className="absolute top-0"
                      style={{ 
                        left: `calc(${animatedScore}% - 20px)`,
                        width: '40px',
                        willChange: 'left'
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <div className={`
                          text-base font-bold
                          ${animatedScore >= 80 ? 'text-green-600' : animatedScore >= 60 ? 'text-yellow-600' : 'text-red-600'}
                        `}>
                          {Math.round(lastMetrics.score * 100)}%
                        </div>
                      </div>
                    </div>
                    
                    {/* 进度条背景 */}
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                      {/* 进度条填充 - 使用 transform 提高性能 */}
                      <div 
                        ref={progressBarRef}
                        className={`
                          h-full rounded-full
                          ${getProgressColor(animatedScore)}
                          relative overflow-hidden
                        `}
                        style={{ 
                          width: '100%',
                          transform: `scaleX(${animatedScore / 100})`,
                          transformOrigin: 'left',
                          willChange: 'transform'
                        }}
                      >
                        {/* 光泽效果 */}
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                          style={{
                            animation: 'shimmer 2s infinite',
                            backgroundSize: '200% 100%'
                          }}
                        />
                      </div>
                      
                      {/* 刻度线 */}
                      <div className="absolute inset-0 flex items-center pointer-events-none">
                        {[25, 50, 75].map(mark => (
                          <div 
                            key={mark}
                            className="absolute w-px h-full bg-gray-300 opacity-30"
                            style={{ left: `${mark}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* 分数刻度 */}
                    <div className="flex justify-between text-[9px] text-gray-400 mt-0.5 px-0.5">
                      <span>0</span>
                      <span>25</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes scoreReveal {
                  0% {
                    opacity: 0;
                    transform: translateY(-20px);
                  }
                  100% {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                
                @keyframes shimmer {
                  0% {
                    background-position: -200% 0;
                  }
                  100% {
                    background-position: 200% 0;
                  }
                }
                
                @keyframes gentleReminder {
                  0%, 100% {
                    transform: translateX(0);
                    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
                  }
                  25% {
                    transform: translateX(-3px);
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                  }
                  75% {
                    transform: translateX(3px);
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                  }
                }
                
                .score-card-animate {
                  animation: scoreReveal 0.5s ease-out;
                }
                
                .animate-gentle-reminder {
                  animation: gentleReminder 0.6s ease-in-out 0.5s;
                }
              `}} />

              {/* 缺失和多读词汇（显示最后一次的结果） */}
              {(lastMetrics.missing.length > 0 || lastMetrics.extra.length > 0) && (
                <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                  {lastMetrics.missing.length > 0 && (
                    <div 
                      key={`missing-${scoreAnimKey}`}
                      className="p-3 bg-white rounded-lg border border-amber-200 animate-gentle-reminder"
                    >
                      <div className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                        <span>缺失关键词</span>
                        <span className="text-[10px] text-amber-500">（点击发音）</span>
                      </div>
                      <div className={`text-sm text-amber-800 flex flex-wrap gap-2 ${isMobile ? 'overflow-x-auto scrollbar-thin' : ''}`}>
                        {lastMetrics.missing.map((group, idx) => (
                          <button
                            key={`miss-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              speakWord(group);
                            }}
                            className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded flex-shrink-0 hover:bg-amber-100 hover:border-amber-300 active:bg-amber-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                            title={`点击朗读: ${group}`}
                          >
                            <Volume2 className="w-3 h-3 opacity-60" />
                            {group}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastMetrics.extra.length > 0 && (
                    <div 
                      key={`extra-${scoreAnimKey}`}
                      className="p-3 bg-white rounded-lg border border-red-200 animate-gentle-reminder"
                    >
                      <div className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                        <span>误读/多读</span>
                        <span className="text-[10px] text-red-500">（点击发音）</span>
                      </div>
                      <div className={`text-sm text-red-800 flex flex-wrap gap-2 ${isMobile ? 'overflow-x-auto scrollbar-thin' : ''}`}>
                        {lastMetrics.extra.map((group, idx) => (
                          <button
                            key={`extra-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              speakWord(group);
                            }}
                            className="px-2 py-0.5 bg-red-50 border border-red-200 rounded flex-shrink-0 hover:bg-red-100 hover:border-red-300 active:bg-red-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                            title={`点击朗读: ${group}`}
                          >
                            <Volume2 className="w-3 h-3 opacity-60" />
                            {group}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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

