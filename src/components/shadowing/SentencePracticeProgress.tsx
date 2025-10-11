'use client';

import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';

interface SentenceScore {
  score: number; // 综合相似度评分 (0-1范围)
}

interface SentencePracticeProgressProps {
  total: number;
  scores: Record<number, SentenceScore>;
  onJumpToSentence?: (index: number) => void;
  className?: string;
}

// 根据评分获取状态
function getScoreStatus(score: SentenceScore | null): 'excellent' | 'medium' | 'poor' | 'unpracticed' {
  if (!score) return 'unpracticed';
  if (score.score >= 0.8) return 'excellent';
  if (score.score >= 0.6) return 'medium';
  return 'poor';
}

export default function SentencePracticeProgress({ 
  total, 
  scores, 
  onJumpToSentence,
  className = '' 
}: SentencePracticeProgressProps) {
  // 计算统计数据
  const stats = useMemo(() => {
    const practiced = Object.keys(scores).length;
    const scoreList = Object.values(scores);
    
    let excellentCount = 0;
    let mediumCount = 0;
    let poorCount = 0;
    let totalScore = 0;
    
    scoreList.forEach(score => {
      totalScore += score.score;
      
      if (score.score >= 0.8) excellentCount++;
      else if (score.score >= 0.6) mediumCount++;
      else poorCount++;
    });
    
    const avgScore = practiced > 0 ? totalScore / practiced : 0;
    
    return {
      practiced,
      unpracticed: total - practiced,
      excellentCount,
      mediumCount,
      poorCount,
      avgScore,
      practiceRate: total > 0 ? practiced / total : 0,
    };
  }, [total, scores]);

  // 生成圆点数组
  const dots = useMemo(() => {
    return Array.from({ length: total }, (_, i) => {
      const score = scores[i];
      const status = getScoreStatus(score);
      return { index: i, status };
    });
  }, [total, scores]);


  return (
    <div className={`space-y-3 ${className}`}>
      {/* 主进度显示 - Pastel柔和蓝色风格 */}
      <div className="flex items-center gap-2.5">
        <MessageSquare className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <span className="text-xl font-bold text-indigo-600">
          {stats.practiced}/{total}
        </span>
        {stats.avgScore > 0 && (
          <>
            <span className="text-indigo-200 text-sm">·</span>
            <span className="text-lg font-semibold text-indigo-500">
              {Math.round(stats.avgScore * 100)}%
            </span>
          </>
        )}
      </div>

      {/* 圆点进度条 */}
      <div className="flex flex-wrap items-center gap-2">
        {dots.map(({ index, status }) => {
          const colors = {
            unpracticed: 'bg-white border-slate-400 text-slate-600',
            poor: 'bg-rose-50/80 border-rose-200 text-rose-500',
            medium: 'bg-amber-50/80 border-amber-200 text-amber-500',
            excellent: 'bg-emerald-50/80 border-emerald-200 text-emerald-500',
          };

          const labels = {
            unpracticed: 'Not practiced',
            poor: 'Needs improvement',
            medium: 'Good',
            excellent: 'Excellent',
          };

          return (
            <button
              key={index}
              onClick={() => onJumpToSentence?.(index)}
              className={`
                relative w-7 h-7 rounded-full border transition-all duration-200
                ${colors[status]}
                ${onJumpToSentence ? 'hover:scale-125 hover:shadow-md cursor-pointer' : ''}
                ${status === 'unpracticed' ? 'opacity-50' : ''}
                flex items-center justify-center text-xs font-semibold
              `}
              title={`#${index + 1} - ${labels[status]}`}
              aria-label={`#${index + 1}`}
            >
              {/* 优秀标记 */}
              {status === 'excellent' && '✓'}
              
              {/* 需改进标记 */}
              {status === 'poor' && '!'}
            </button>
          );
        })}
      </div>

      {/* 进度条 - Pastel柔和渐变 */}
      <div className="space-y-1">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all duration-500"
            style={{ width: `${stats.practiceRate * 100}%` }}
          />
        </div>
        
        {/* 统计信息 - Pastel柔和色调 */}
        {stats.practiced > 0 && (
          <div className="flex items-center gap-2 text-xs font-medium">
            {stats.excellentCount > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {stats.excellentCount}
              </span>
            )}
            {stats.mediumCount > 0 && (
              <span className="flex items-center gap-0.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                {stats.mediumCount}
              </span>
            )}
            {stats.poorCount > 0 && (
              <span className="flex items-center gap-0.5 text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                {stats.poorCount}
              </span>
            )}
            {stats.unpracticed > 0 && (
              <span className="flex items-center gap-0.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                {stats.unpracticed}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

