'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, CheckCircle, Target, AlertCircle, TrendingUp, Play } from 'lucide-react';

interface SentenceScore {
  score: number; // 综合相似度评分 (0-1范围)
}

interface SmartSuggestionProps {
  total: number;
  scores: Record<number, SentenceScore>;
  onJumpToSentence?: (index: number) => void;
  className?: string;
}

export default function SmartSuggestion({ 
  total, 
  scores, 
  onJumpToSentence,
  className = '' 
}: SmartSuggestionProps) {
  // 分析并生成建议
  const suggestion = useMemo(() => {
    const practiced = Object.keys(scores).length;
    
    // 未练习的句子
    const unpracticedIndices: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!scores[i]) {
        unpracticedIndices.push(i);
      }
    }
    
    // 按质量分类已练习的句子
    const poorIndices: number[] = [];
    const mediumIndices: number[] = [];
    const excellentIndices: number[] = [];
    
    Object.entries(scores).forEach(([indexStr, score]) => {
      const index = parseInt(indexStr);
      
      if (score.score >= 0.8) {
        excellentIndices.push(index);
      } else if (score.score >= 0.6) {
        mediumIndices.push(index);
      } else {
        poorIndices.push(index);
      }
    });
    
    // 生成建议 - Pastel柔和配色
    if (practiced === 0) {
      return {
        type: 'start' as const,
        IconComponent: Target,
        subIcon: '1',
        targetIndex: 0,
        bgColor: 'from-sky-50/80 to-indigo-100/80',
        textColor: 'text-indigo-600',
        iconColor: 'text-indigo-500',
        showArrow: true,
      };
    }
    
    if (poorIndices.length > 0) {
      return {
        type: 'improve' as const,
        IconComponent: AlertCircle,
        subIcon: `${poorIndices[0] + 1}`,
        targetIndex: poorIndices[0],
        bgColor: 'from-rose-50/80 to-pink-100/80',
        textColor: 'text-rose-600',
        iconColor: 'text-rose-500',
        showArrow: true,
        badges: poorIndices.slice(0, 3).map(i => ({ num: i + 1, color: 'red' })),
      };
    }
    
    if (mediumIndices.length > 0) {
      return {
        type: 'improve' as const,
        IconComponent: TrendingUp,
        subIcon: `${mediumIndices[0] + 1}`,
        targetIndex: mediumIndices[0],
        bgColor: 'from-amber-50/80 to-yellow-100/80',
        textColor: 'text-amber-600',
        iconColor: 'text-amber-500',
        showArrow: true,
        badges: mediumIndices.slice(0, 3).map(i => ({ num: i + 1, color: 'yellow' })),
      };
    }
    
    if (unpracticedIndices.length > 0) {
      return {
        type: 'continue' as const,
        IconComponent: Play,
        subIcon: `${unpracticedIndices.length}`,
        targetIndex: unpracticedIndices[0],
        bgColor: 'from-violet-50/80 to-indigo-100/80',
        textColor: 'text-violet-600',
        iconColor: 'text-violet-500',
        showArrow: true,
      };
    }
    
    // 全部优秀
    return {
      type: 'complete' as const,
      IconComponent: CheckCircle,
      subIcon: '✓',
      targetIndex: null,
      bgColor: 'from-emerald-50/80 to-teal-100/80',
      textColor: 'text-emerald-600',
      iconColor: 'text-emerald-500',
      showArrow: false,
    };
  }, [total, scores]);

  if (!suggestion) return null;

  return (
    <div className={`${className}`}>
      <div className={`
        relative overflow-hidden rounded-2xl p-3
        bg-gradient-to-r ${suggestion.bgColor}
        ${suggestion.textColor} shadow-sm border border-slate-200
      `}>
        {/* 背景装饰 */}
        <div className={`absolute top-0 right-0 opacity-5 ${suggestion.iconColor}`}>
          <Sparkles className="w-24 h-24" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            {/* 主图标和副图标 */}
            <div className="flex items-center gap-2.5">
              <div className="flex-shrink-0">
                <suggestion.IconComponent className={`w-6 h-6 ${suggestion.iconColor}`} />
              </div>
              
              {suggestion.subIcon && (
                <div className="text-2xl font-bold">
                  {suggestion.subIcon}
                </div>
              )}
              
              {/* 徽章组 - Pastel柔和配色 */}
              {suggestion.badges && suggestion.badges.length > 0 && (
                <div className="flex items-center gap-1">
                  {suggestion.badges.map((badge, idx) => (
                    <div 
                      key={idx}
                      className={`
                        px-2 py-0.5 rounded-full text-xs font-medium
                        ${badge.color === 'red' 
                          ? 'bg-rose-100/70 border border-rose-200 text-rose-600' 
                          : 'bg-amber-100/70 border border-amber-200 text-amber-600'}
                      `}
                    >
                      #{badge.num}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* 操作按钮或完成图标 */}
            {suggestion.showArrow && suggestion.targetIndex !== null && onJumpToSentence ? (
              <Button
                onClick={() => onJumpToSentence(suggestion.targetIndex!)}
                size="sm"
                variant="outline"
                className={`flex-shrink-0 ${suggestion.iconColor} border-current hover:bg-white/50 hover:scale-110 transition-transform`}
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            ) : suggestion.type === 'complete' ? (
              <CheckCircle className={`w-6 h-6 flex-shrink-0 ${suggestion.iconColor}`} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

