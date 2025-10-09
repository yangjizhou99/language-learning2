'use client';

import React, { useMemo } from 'react';

interface SentenceScore {
  coverage: number;
  similarity: number;
}

interface SentencePracticeProgressProps {
  total: number;
  scores: Record<number, SentenceScore>;
  onJumpToSentence?: (index: number) => void;
  className?: string;
}

// 根据评分获取颜色
function getScoreStatus(score: SentenceScore | null): 'excellent' | 'medium' | 'poor' | 'unpracticed' {
  if (!score) return 'unpracticed';
  const avg = (score.coverage + score.similarity) / 2;
  if (avg >= 0.8) return 'excellent';
  if (avg >= 0.6) return 'medium';
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
      const avg = (score.coverage + score.similarity) / 2;
      totalScore += avg;
      
      if (avg >= 0.8) excellentCount++;
      else if (avg >= 0.6) mediumCount++;
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

  // 获取徽章
  const badge = useMemo(() => {
    if (stats.excellentCount === total && total > 0) {
      return { emoji: '🥇', label: '黄金练习者', color: 'text-yellow-600' };
    } else if (stats.practiced >= 10) {
      return { emoji: '🥈', label: '白银练习者', color: 'text-gray-400' };
    } else if (stats.practiced >= 5) {
      return { emoji: '🥉', label: '青铜练习者', color: 'text-orange-400' };
    }
    return null;
  }, [stats.practiced, stats.excellentCount, total]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 主进度显示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🗣️</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">逐句练习</h3>
            <div className="text-sm text-gray-600">
              {stats.practiced}/{total} 已练习
              {stats.avgScore > 0 && (
                <span className="ml-2 text-gray-500">
                  · 平均 {Math.round(stats.avgScore * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* 徽章显示 */}
        {badge && (
          <div className={`flex items-center gap-1 px-3 py-1 bg-white rounded-full border-2 border-gray-200 ${badge.color}`}>
            <span className="text-lg">{badge.emoji}</span>
            <span className="text-xs font-medium">{badge.label}</span>
          </div>
        )}
      </div>

      {/* 圆点进度条 */}
      <div className="flex flex-wrap items-center gap-2">
        {dots.map(({ index, status }) => {
          const colors = {
            unpracticed: 'bg-gray-300 border-gray-400',
            poor: 'bg-red-400 border-red-500',
            medium: 'bg-yellow-400 border-yellow-500',
            excellent: 'bg-green-400 border-green-500',
          };

          const labels = {
            unpracticed: '未练习',
            poor: '需改进',
            medium: '中等',
            excellent: '优秀',
          };

          return (
            <button
              key={index}
              onClick={() => onJumpToSentence?.(index)}
              className={`
                relative w-8 h-8 rounded-full border-2 transition-all duration-200
                ${colors[status]}
                ${onJumpToSentence ? 'hover:scale-125 hover:shadow-lg cursor-pointer' : ''}
                ${status === 'unpracticed' ? 'opacity-50' : ''}
              `}
              title={`第 ${index + 1} 句 - ${labels[status]}`}
              aria-label={`跳转到第 ${index + 1} 句`}
            >
              {/* 优秀标记 */}
              {status === 'excellent' && (
                <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                  ✓
                </span>
              )}
              
              {/* 需改进标记 */}
              {status === 'poor' && (
                <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                  !
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 进度条 */}
      <div className="space-y-1">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
            style={{ width: `${stats.practiceRate * 100}%` }}
          />
        </div>
        
        {/* 统计信息 */}
        {stats.practiced > 0 && (
          <div className="flex items-center gap-4 text-xs text-gray-600">
            {stats.excellentCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                优秀 {stats.excellentCount}
              </span>
            )}
            {stats.mediumCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                中等 {stats.mediumCount}
              </span>
            )}
            {stats.poorCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                需改进 {stats.poorCount}
              </span>
            )}
            {stats.unpracticed > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                未练习 {stats.unpracticed}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

