'use client';

import React from 'react';
import { BookOpen, CheckCircle, FileEdit, Circle } from 'lucide-react';

interface CompactStatsCardsProps {
  totalCount: number;
  completedCount: number;
  draftCount: number;
  unstartedCount: number;
}

export default function CompactStatsCards({
  totalCount,
  completedCount,
  draftCount,
  unstartedCount,
}: CompactStatsCardsProps) {
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="px-4 pb-3">
      {/* 横向滚动容器 */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {/* 总题数卡片 */}
        <div className="snap-start flex-shrink-0 w-32 group relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 transition-all hover:shadow-md">
          <div className="flex flex-col items-center text-center gap-1">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs text-blue-600 font-medium">总题数</p>
            <p className="text-xl font-bold text-blue-900">{totalCount}</p>
          </div>
        </div>

        {/* 已完成卡片 */}
        <div className="snap-start flex-shrink-0 w-32 group relative overflow-hidden rounded-xl border bg-gradient-to-br from-green-50 to-green-100/50 p-3 transition-all hover:shadow-md">
          <div className="flex flex-col items-center text-center gap-1">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-xs text-green-600 font-medium">已完成</p>
            <p className="text-xl font-bold text-green-900">{completedCount}</p>
            <div className="w-full bg-green-200/50 rounded-full h-1 overflow-hidden mt-1">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="text-xs text-green-600">{completionRate}%</p>
          </div>
        </div>

        {/* 草稿中卡片 */}
        <div className="snap-start flex-shrink-0 w-32 group relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 transition-all hover:shadow-md">
          <div className="flex flex-col items-center text-center gap-1">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <FileEdit className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs text-amber-600 font-medium">草稿中</p>
            <p className="text-xl font-bold text-amber-900">{draftCount}</p>
          </div>
        </div>

        {/* 未开始卡片 */}
        <div className="snap-start flex-shrink-0 w-32 group relative overflow-hidden rounded-xl border bg-gradient-to-br from-gray-50 to-gray-100/50 p-3 transition-all hover:shadow-md">
          <div className="flex flex-col items-center text-center gap-1">
            <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center">
              <Circle className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-xs text-gray-600 font-medium">未开始</p>
            <p className="text-xl font-bold text-gray-900">{unstartedCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}



