'use client';

import React, { useRef, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Square, Volume2, ChevronDown, ChevronUp, Mic, RotateCcw, Smile, Meh, Frown, AlertTriangle, XCircle, ArrowRight, Minus, Plus } from 'lucide-react';
import WaveformAnimation from './WaveformAnimation';
import { AlignmentResult, AlignmentError } from '@/lib/alignment-utils';

interface SentenceScore {
  score: number; // 综合相似度评分 (0-1范围)
  finalText: string;
  missing: string[];
  extra: string[];
  alignmentResult?: AlignmentResult; // 新增：对齐分析结果
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
    alignmentResult?: AlignmentResult;
  } | null;
  isMobile: boolean;
  language: 'ja' | 'en' | 'zh' | 'ko';
  onToggleExpand: () => void;
  onSpeak: () => void;
  onStartPractice: () => void;
  onStopPractice: () => void;
  onRetry: () => void;
  highlightReview?: boolean;
  renderText?: (text: string) => React.ReactNode;
}

// 根据评分获取颜色方案 - Pastel柔和配色
function getScoreColor(score: SentenceScore | null): { bg: string; border: string; text: string; badge: string } {
  if (!score || !score.finalText) {
    return {
      bg: 'bg-slate-50/50',
      border: 'border-slate-200',
      text: 'text-slate-700',
      badge: 'bg-slate-100 text-slate-600'
    };
  }
  
  if (score.score >= 0.8) {
    return {
      bg: 'bg-emerald-50/60',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      badge: 'bg-emerald-400 text-white'
    };
  } else if (score.score >= 0.6) {
    return {
      bg: 'bg-amber-50/60',
      border: 'border-amber-200',
      text: 'text-amber-800',
      badge: 'bg-amber-400 text-white'
    };
  } else {
    return {
      bg: 'bg-rose-50/60',
      border: 'border-rose-200',
      text: 'text-rose-800',
      badge: 'bg-rose-400 text-white'
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
  highlightReview = false,
  renderText,
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
  
  // 保存最后一次的评分结果，即使重练也保留显示
  const [lastMetrics, setLastMetrics] = React.useState<{
    score: number;
    missing: string[];
    extra: string[];
    alignmentResult?: AlignmentResult;
  } | null>(null);

  // 根据分数(0-100)计算颜色 - Pastel柔和渐变
  const getGradientColors = React.useCallback((scorePercent: number): { bg: string; border: string; shadow: string } => {
    // 性能优化：使用固定的颜色断点，柔和渐变
    if (scorePercent >= 85) {
      return {
        bg: 'from-emerald-50/80 via-emerald-100/60 to-teal-50/80',
        border: 'border-emerald-200',
        shadow: 'shadow-emerald-100/40'
      };
    } else if (scorePercent >= 70) {
      return {
        bg: 'from-green-50/80 via-emerald-50/60 to-green-100/80',
        border: 'border-green-200',
        shadow: 'shadow-green-100/40'
      };
    } else if (scorePercent >= 55) {
      return {
        bg: 'from-amber-50/80 via-yellow-50/60 to-amber-100/80',
        border: 'border-amber-200',
        shadow: 'shadow-amber-100/40'
      };
    } else if (scorePercent >= 40) {
      return {
        bg: 'from-orange-50/80 via-amber-50/60 to-orange-100/80',
        border: 'border-orange-200',
        shadow: 'shadow-orange-100/40'
      };
    } else {
      return {
        bg: 'from-rose-50/80 via-pink-50/60 to-rose-100/80',
        border: 'border-rose-200',
        shadow: 'shadow-rose-100/40'
      };
    }
  }, []);

  // 根据分数计算进度条颜色 - Pastel柔和渐变
  const getProgressColor = React.useCallback((scorePercent: number): string => {
    if (scorePercent >= 80) return 'bg-gradient-to-r from-emerald-300 to-teal-400';
    if (scorePercent >= 60) return 'bg-gradient-to-r from-amber-300 to-yellow-400';
    return 'bg-gradient-to-r from-rose-300 to-pink-400';
  }, []);

  // 根据当前状态获取转录框颜色 - Pastel柔和配色
  const getTranscriptionColors = React.useCallback((): {
    border: string;
    bg: string;
    shadow: string;
    text: string;
    waveColor: 'green' | 'yellow' | 'red' | 'blue';
  } => {
    if (lastMetrics && finalText) {
      const scorePercent = Math.round(lastMetrics.score * 100);
      if (scorePercent >= 80) {
        return {
          border: 'border-emerald-200',
          bg: 'from-emerald-50/70 via-teal-50/50 to-emerald-100/70',
          shadow: 'shadow-emerald-100/40',
          text: 'text-emerald-700',
          waveColor: 'green'
        };
      } else if (scorePercent >= 60) {
        return {
          border: 'border-amber-200',
          bg: 'from-amber-50/70 via-yellow-50/50 to-amber-100/70',
          shadow: 'shadow-amber-100/40',
          text: 'text-amber-700',
          waveColor: 'yellow'
        };
      } else {
        return {
          border: 'border-rose-200',
          bg: 'from-rose-50/70 via-pink-50/50 to-rose-100/70',
          shadow: 'shadow-rose-100/40',
          text: 'text-rose-700',
          waveColor: 'red'
        };
      }
    }
    // 录音中或无评分时使用柔和蓝色
    return {
      border: 'border-sky-200',
      bg: 'from-sky-50/70 via-blue-50/50 to-sky-100/70',
      shadow: 'shadow-sky-100/40',
      text: 'text-sky-700',
      waveColor: 'blue'
    };
  }, [lastMetrics, finalText]);

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
        'ko': 'ko-KR',
      };
      utterance.lang = langMap[language] || 'zh-CN';
      utterance.rate = 0.5; // 很慢，便于仔细听清每个音
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('语音合成失败:', error);
    }
  };

  return (
    <div
      id={`sentence-${index}`}
      ref={cardRef}
      className={`rounded-2xl border-2 transition-all duration-300 ease-out ${
        isExpanded ? 'shadow-lg scale-[1.01]' : 'hover:shadow-md'
      } ${
        highlightReview
          ? 'border-amber-200 bg-amber-50/40 shadow-amber-100'
          : isExpanded
          ? 'border-blue-200 bg-blue-50/30 shadow-blue-100'
          : colors.border + ' ' + colors.bg
      }`}
    >
      {/* 句子标题栏 */}
      <div className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-white/50 transition-colors ${isExpanded ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
        {/* 左侧：序号 + 评分 + 文本 - 可点击展开 */}
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          {/* 序号 */}
          <span className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${colors.badge}`}>
            {index + 1}
          </span>
          
          {/* 评分圆点 */}
          {score && (
            <div className="flex items-center gap-0.5 flex-shrink-0" title={`综合相似度: ${Math.round(score.score * 100)}%`}>
              {/* 综合相似度圆点 - Pastel柔和色 */}
              {[...Array(5)].map((_, i) => (
                <div
                  key={`score-${i}`}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < Math.round(score.score * 5) 
                      ? colors.badge.includes('emerald') ? 'bg-emerald-400' 
                        : colors.badge.includes('amber') ? 'bg-amber-400'
                        : 'bg-rose-400'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* 句子文本 */}
          <span className={`${colors.text} text-sm flex-1 ${isExpanded ? '' : 'line-clamp-1'}`}>
            {renderText ? renderText(sentence) : sentence}
          </span>
        </button>
        
        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 播放按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSpeak();
            }}
            className="p-1.5 rounded-full hover:bg-gray-200 transition-all hover:scale-110"
            title="🔊"
          >
            <Volume2 className="w-4 h-4 text-gray-600" />
          </button>
          
          {/* 录音/停止按钮 */}
          {!isRecognizing ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isExpanded) {
                  onToggleExpand(); // 先展开
                }
                setTimeout(() => {
                  onStartPractice(); // 延迟执行录音，确保展开完成
                }, isExpanded ? 0 : 100);
              }}
              className="p-1.5 rounded-full hover:bg-blue-100 transition-all hover:scale-110"
              title="🎤"
            >
              <Mic className="w-4 h-4 text-blue-600" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStopPractice();
              }}
              className="p-1.5 rounded-full hover:bg-red-100 transition-all hover:scale-110"
              title="🛑"
            >
              <Square className="w-4 h-4 text-red-600" />
            </button>
          )}
          
          {/* 重试按钮 - 仅在有评分时显示 */}
          {score && !isRecognizing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isExpanded) {
                  onToggleExpand(); // 先展开
                }
                setTimeout(() => {
                  onRetry(); // 延迟执行重试，确保展开完成
                }, isExpanded ? 0 : 100);
              }}
              className="p-1.5 rounded-full hover:bg-purple-100 transition-all hover:scale-110 hover:rotate-180"
              title="🔄"
            >
              <RotateCcw className="w-4 h-4 text-purple-600" />
            </button>
          )}
          
          {/* 展开/折叠图标 */}
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-200 rounded transition-all"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* 展开的内容 */}
      {isExpanded && (
        <div className={`px-4 pb-4 space-y-3 border-t border-gray-200 ${isMobile ? 'pb-20' : ''}`}>
          {/* 实时转录 - 紧凑布局，Pastel圆润风格 */}
          {(isRecognizing || displayText) && (
            <div className={`p-3 rounded-xl border-2 ${getTranscriptionColors().border} bg-gradient-to-br ${getTranscriptionColors().bg} shadow-sm ${getTranscriptionColors().shadow}`}>
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                  <Mic className={`w-5 h-5 ${
                    lastMetrics && finalText
                      ? animatedScore >= 80 ? 'text-emerald-500'
                        : animatedScore >= 60 ? 'text-amber-500'
                        : 'text-rose-500'
                      : 'text-sky-500'
                  }`} />
                  <WaveformAnimation isActive={isRecognizing} color={getTranscriptionColors().waveColor} size="md" />
                </div>
                <div className={`text-sm ${getTranscriptionColors().text} whitespace-pre-wrap break-words leading-relaxed min-h-[1.5rem] flex-1`}>
                  {displayText || '...'}
                </div>
              </div>
            </div>
          )}

          {/* 评分结果 - 单行布局带完整信息 */}
          {lastMetrics && (
            <div className="space-y-2">
              <div 
                key={scoreAnimKey}
                className={`
                  p-3 rounded-xl border-2 transition-all duration-700 ease-in-out
                  score-card-animate bg-gradient-to-br shadow-sm
                  ${getGradientColors(animatedScore).bg}
                  ${getGradientColors(animatedScore).border}
                  ${getGradientColors(animatedScore).shadow}
                  ${!finalText ? 'opacity-75' : ''}
                `}
              >
                {/* 单行布局：图标 + 进度条（带百分比和刻度） + 提升 */}
                <div className="flex items-center gap-3">
                  {/* 表情图标 */}
                  <div className="flex-shrink-0">
                    {finalText ? (
                      <>
                        {lastMetrics.score >= 0.8 ? (
                          <Smile className="w-5 h-5 text-emerald-500" />
                        ) : lastMetrics.score >= 0.6 ? (
                          <Meh className="w-5 h-5 text-amber-500" />
                        ) : (
                          <Frown className="w-5 h-5 text-rose-500" />
                        )}
                      </>
                    ) : isRecognizing ? (
                      <Mic className="w-5 h-5 text-sky-500" />
                    ) : null}
                  </div>
                  
                  {/* 进度条容器（带百分比和刻度） */}
                  <div className="flex-1 relative pt-5 pb-2">
                    {/* 百分比指示器 */}
                    <div 
                      className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none"
                      style={{ 
                        left: `calc(${animatedScore}% - 20px)`,
                        width: '40px'
                      }}
                    >
                      <div className={`
                        text-base font-bold
                        ${animatedScore >= 80 ? 'text-emerald-600' : animatedScore >= 60 ? 'text-amber-600' : 'text-rose-600'}
                      `}>
                        {Math.round(lastMetrics.score * 100)}%
                      </div>
                    </div>
                    
                    {/* 进度条背景 */}
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                      {/* 进度条填充 */}
                      <div 
                        ref={progressBarRef}
                        className={`
                          h-full rounded-full
                          ${getProgressColor(animatedScore)}
                        `}
                        style={{ 
                          width: '100%',
                          transform: `scaleX(${animatedScore / 100})`,
                          transformOrigin: 'left',
                          willChange: 'transform'
                        }}
                      />
                      
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
                  
                  {/* 提升指示 - Pastel柔和色 */}
                  {prevScore !== null && prevScore !== animatedScore && finalText && (
                    <div className={`flex items-center gap-1 text-sm font-bold flex-shrink-0 ${animatedScore > prevScore ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {animatedScore > prevScore ? '↑' : '↓'}{Math.abs(animatedScore - prevScore)}
                    </div>
                  )}
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

              {/* 对齐错误分析 - 新的对比展示 */}
              {lastMetrics.alignmentResult && (
                lastMetrics.alignmentResult.extra.length > 0 || 
                lastMetrics.alignmentResult.missing.length > 0 || 
                lastMetrics.alignmentResult.substitution.length > 0
              ) && (
                <div className="space-y-3">
                  {/* 多读错误 - 仅显示多读的内容 */}
                  {lastMetrics.alignmentResult.extra.length > 0 && (
                    <div 
                      key={`extra-${scoreAnimKey}`}
                      className={`p-3 rounded-xl border animate-gentle-reminder ${
                        animatedScore >= 80 
                          ? 'bg-emerald-50/60 border-emerald-200' 
                          : animatedScore >= 60 
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Plus className={`w-5 h-5 flex-shrink-0 ${
                          animatedScore >= 80 
                            ? 'text-emerald-500' 
                            : animatedScore >= 60 
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`} />
                        <span className="text-sm font-medium text-gray-700">多读的内容</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {lastMetrics.alignmentResult.extra.map((error: AlignmentError, idx: number) => (
                          <button
                            key={`extra-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              speakWord(error.actual);
                            }}
                            className={`px-2 py-1 rounded-full flex-shrink-0 transition-all cursor-pointer inline-flex items-center gap-1 hover:scale-105 text-xs ${
                              animatedScore >= 80
                                ? 'bg-emerald-100/80 border border-emerald-200 text-emerald-700 hover:bg-emerald-200/90 hover:border-emerald-300 active:bg-emerald-200'
                                : animatedScore >= 60
                                ? 'bg-amber-100/80 border border-amber-200 text-amber-700 hover:bg-amber-200/90 hover:border-amber-300 active:bg-amber-200'
                                : 'bg-rose-100/80 border border-rose-200 text-rose-700 hover:bg-rose-200/90 hover:border-rose-300 active:bg-rose-200'
                            }`}
                            title={`Play: ${error.actual}`}
                          >
                            <Volume2 className="w-3 h-3" />
                            <span className="font-medium">{error.actual}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 少读错误 - 显示完整ACU块与用户少读形式的对比 */}
                  {lastMetrics.alignmentResult.missing.length > 0 && (
                    <div 
                      key={`missing-${scoreAnimKey}`}
                      className={`p-3 rounded-xl border animate-gentle-reminder ${
                        animatedScore >= 80 
                          ? 'bg-emerald-50/60 border-emerald-200' 
                          : animatedScore >= 60 
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Minus className={`w-5 h-5 flex-shrink-0 ${
                          animatedScore >= 80 
                            ? 'text-emerald-500' 
                            : animatedScore >= 60 
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`} />
                        <span className="text-sm font-medium text-gray-700">少读的内容</span>
                      </div>
                      <div className="space-y-2">
                        {lastMetrics.alignmentResult.missing.map((error: AlignmentError, idx: number) => (
                          <div key={`missing-${idx}`} className={`${isMobile ? 'flex flex-col gap-2' : 'flex items-center gap-2'} p-2 bg-white/50 rounded-lg`}>
                            {/* 左侧：完整的ACU块 */}
                            <div className="flex-1">
                              <div className="text-xs text-gray-500 mb-1">完整ACU块</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakWord(error.acuContext || error.expected || '');
                                }}
                                className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors inline-flex items-center gap-1"
                                title={`Play: ${error.acuContext || error.expected || ''}`}
                              >
                                <Volume2 className="w-3 h-3" />
                                {error.acuContext || error.expected || ''}
                              </button>
                            </div>
                            
                            {/* 箭头分隔符 - 桌面端显示 */}
                            {!isMobile && <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                            
                            {/* 右侧：用户少读的形式 */}
                            <div className="flex-1">
                              <div className="text-xs text-gray-500 mb-1">你读的</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakWord(error.actual || '');
                                }}
                                className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors inline-flex items-center gap-1"
                                title={`Play: ${error.actual || ''}`}
                              >
                                <Volume2 className="w-3 h-3" />
                                {error.actual}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 读错错误 - 显示正确形式与用户读错形式的对比 */}
                  {lastMetrics.alignmentResult.substitution.length > 0 && (
                    <div 
                      key={`substitution-${scoreAnimKey}`}
                      className={`p-3 rounded-xl border animate-gentle-reminder ${
                        animatedScore >= 80 
                          ? 'bg-emerald-50/60 border-emerald-200' 
                          : animatedScore >= 60 
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                          animatedScore >= 80 
                            ? 'text-emerald-500' 
                            : animatedScore >= 60 
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`} />
                        <span className="text-sm font-medium text-gray-700">读错的内容</span>
                      </div>
                      <div className="space-y-2">
                        {lastMetrics.alignmentResult.substitution.map((error: AlignmentError, idx: number) => (
                          <div key={`substitution-${idx}`} className={`${isMobile ? 'flex flex-col gap-2' : 'flex items-center gap-2'} p-2 bg-white/50 rounded-lg`}>
                            {/* 左侧：正确的形式 */}
                            <div className="flex-1">
                              <div className="text-xs text-gray-500 mb-1">正确</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakWord(error.expected || '');
                                }}
                                className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors inline-flex items-center gap-1"
                                title={`Play: ${error.expected || ''}`}
                              >
                                <Volume2 className="w-3 h-3" />
                                {error.expected || ''}
                              </button>
                            </div>
                            
                            {/* 箭头分隔符 - 桌面端显示 */}
                            {!isMobile && <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                            
                            {/* 右侧：用户读错的形式 */}
                            <div className="flex-1">
                              <div className="text-xs text-gray-500 mb-1">你读的</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakWord(error.actual);
                                }}
                                className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors inline-flex items-center gap-1"
                                title={`Play: ${error.actual}`}
                              >
                                <Volume2 className="w-3 h-3" />
                                {error.actual}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 回退到原有展示（当没有对齐数据时） */}
              {!lastMetrics.alignmentResult && (lastMetrics.missing.length > 0 || lastMetrics.extra.length > 0) && (
                <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                  {lastMetrics.missing.length > 0 && (
                    <div 
                      key={`missing-fallback-${scoreAnimKey}`}
                      className={`p-2 rounded-xl border animate-gentle-reminder ${
                        animatedScore >= 80 
                          ? 'bg-emerald-50/60 border-emerald-200' 
                          : animatedScore >= 60 
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                          animatedScore >= 80 
                            ? 'text-emerald-500' 
                            : animatedScore >= 60 
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`} />
                        {lastMetrics.missing.map((group, idx) => (
                          <button
                            key={`miss-fallback-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              speakWord(group);
                            }}
                            className={`px-2 py-1 rounded-full flex-shrink-0 transition-all cursor-pointer inline-flex items-center gap-1 hover:scale-105 text-xs ${
                              animatedScore >= 80
                                ? 'bg-emerald-100/80 border border-emerald-200 text-emerald-700 hover:bg-emerald-200/90 hover:border-emerald-300 active:bg-emerald-200'
                                : animatedScore >= 60
                                ? 'bg-amber-100/80 border border-amber-200 text-amber-700 hover:bg-amber-200/90 hover:border-amber-300 active:bg-amber-200'
                                : 'bg-rose-100/80 border border-rose-200 text-rose-700 hover:bg-rose-200/90 hover:border-rose-300 active:bg-rose-200'
                            }`}
                            title={`Play: ${group}`}
                          >
                            <Volume2 className="w-3 h-3" />
                            <span className="font-medium">{group}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastMetrics.extra.length > 0 && (
                    <div 
                      key={`extra-fallback-${scoreAnimKey}`}
                      className={`p-2 rounded-xl border animate-gentle-reminder ${
                        animatedScore >= 80 
                          ? 'bg-emerald-50/60 border-emerald-200' 
                          : animatedScore >= 60 
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <XCircle className={`w-5 h-5 flex-shrink-0 ${
                          animatedScore >= 80 
                            ? 'text-emerald-500' 
                            : animatedScore >= 60 
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }`} />
                        {lastMetrics.extra.map((group, idx) => (
                          <button
                            key={`extra-fallback-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              speakWord(group);
                            }}
                            className={`px-2 py-1 rounded-full flex-shrink-0 transition-all cursor-pointer inline-flex items-center gap-1 hover:scale-105 text-xs ${
                              animatedScore >= 80
                                ? 'bg-emerald-100/80 border border-emerald-200 text-emerald-700 hover:bg-emerald-200/90 hover:border-emerald-300 active:bg-emerald-200'
                                : animatedScore >= 60
                                ? 'bg-amber-100/80 border border-amber-200 text-amber-700 hover:bg-amber-200/90 hover:border-amber-300 active:bg-amber-200'
                                : 'bg-rose-100/80 border border-rose-200 text-rose-700 hover:bg-rose-200/90 hover:border-rose-300 active:bg-rose-200'
                            }`}
                            title={`Play: ${group}`}
                          >
                            <Volume2 className="w-3 h-3" />
                            <span className="font-medium">{group}</span>
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
      
      {/* 移动端底部固定操作栏 - Pastel柔和风格 */}
      {isMobile && isExpanded && (
        <div className="border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center gap-2 rounded-b-2xl -mx-[1px] -mb-[2px]">
          <Button 
            onClick={onSpeak} 
            variant="outline" 
            size="lg" 
            className="flex-1 rounded-full p-3"
            title="🔊"
          >
            <Volume2 className="w-5 h-5" />
          </Button>
          {!isRecognizing ? (
            <Button 
              onClick={onStartPractice} 
              variant="outline" 
              size="lg" 
              className="flex-[2] rounded-full p-3 text-sky-500 border-sky-200 hover:bg-sky-50"
              title="🎤"
            >
              <Mic className="w-5 h-5" />
            </Button>
          ) : (
            <Button 
              onClick={onStopPractice} 
              variant="outline" 
              size="lg" 
              className="flex-[2] rounded-full p-3 text-rose-500 border-rose-200 hover:bg-rose-50"
              title="🛑"
            >
              <Square className="w-5 h-5" />
            </Button>
          )}
          {score && !isRecognizing && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="lg"
              className="flex-1 rounded-full p-3 text-indigo-500 border-indigo-200 hover:bg-indigo-50"
              title="🔄"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

