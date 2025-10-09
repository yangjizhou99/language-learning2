'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, CheckCircle } from 'lucide-react';

interface SentenceScore {
  coverage: number;
  similarity: number;
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
      const avg = (score.coverage + score.similarity) / 2;
      
      if (avg >= 0.8) {
        excellentIndices.push(index);
      } else if (avg >= 0.6) {
        mediumIndices.push(index);
      } else {
        poorIndices.push(index);
      }
    });
    
    // 生成建议
    if (practiced === 0) {
      return {
        type: 'start' as const,
        title: '开始练习',
        message: '从第1句开始，逐句练习，打好基础',
        targetIndex: 0,
        icon: '🎯',
        color: 'from-blue-500 to-indigo-600',
      };
    }
    
    if (poorIndices.length > 0) {
      return {
        type: 'improve' as const,
        title: '重点突破',
        message: `第 ${poorIndices.map(i => i + 1).join('、')} 句需要重点练习`,
        targetIndex: poorIndices[0],
        icon: '⚠️',
        color: 'from-red-500 to-orange-600',
      };
    }
    
    if (mediumIndices.length > 0) {
      return {
        type: 'improve' as const,
        title: '继续提升',
        message: `第 ${mediumIndices.map(i => i + 1).join('、')} 句还有进步空间`,
        targetIndex: mediumIndices[0],
        icon: '📈',
        color: 'from-yellow-500 to-orange-500',
      };
    }
    
    if (unpracticedIndices.length > 0) {
      return {
        type: 'continue' as const,
        title: '继续练习',
        message: `还有 ${unpracticedIndices.length} 句未练习`,
        targetIndex: unpracticedIndices[0],
        icon: '▶️',
        color: 'from-purple-500 to-indigo-600',
      };
    }
    
    // 全部优秀
    return {
      type: 'complete' as const,
      title: '太棒了！',
      message: '所有句子都达到优秀水平，可以进行正式录音了',
      targetIndex: null,
      icon: '🎉',
      color: 'from-green-500 to-emerald-600',
    };
  }, [total, scores]);

  if (!suggestion) return null;

  return (
    <div className={`${className}`}>
      <div className={`
        relative overflow-hidden rounded-xl p-4
        bg-gradient-to-r ${suggestion.color}
        text-white shadow-lg
      `}>
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 opacity-10">
          <Sparkles className="w-32 h-32" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-start gap-3">
            {/* 图标 */}
            <div className="flex-shrink-0 text-2xl">
              {suggestion.icon}
            </div>
            
            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold mb-1">
                {suggestion.title}
              </h4>
              <p className="text-sm opacity-90">
                {suggestion.message}
              </p>
            </div>
            
            {/* 操作按钮 */}
            {suggestion.type !== 'complete' && suggestion.targetIndex !== null && onJumpToSentence && (
              <Button
                onClick={() => onJumpToSentence(suggestion.targetIndex!)}
                size="sm"
                variant="secondary"
                className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {suggestion.type === 'start' && '开始'}
                {suggestion.type === 'improve' && '去练习'}
                {suggestion.type === 'continue' && '继续'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            
            {suggestion.type === 'complete' && (
              <CheckCircle className="w-6 h-6 flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

