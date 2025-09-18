/**
 * 优化的Shadowing题目卡片组件
 * 使用React.memo和useMemo进行性能优化
 */

import React, { memo, useMemo, useCallback } from 'react';
import { CheckCircle, Circle, FileText, Mic, BookOpen, Clock } from 'lucide-react';
import { LANG_LABEL } from '@/types/lang';

interface ShadowingItem {
  id: string;
  lang: 'ja' | 'en' | 'zh';
  level: number;
  title: string;
  text: string;
  audio_url: string;
  duration_ms?: number;
  tokens?: number;
  cefr?: string;
  meta?: Record<string, unknown>;
  created_at: string;
  isPracticed: boolean;
  status?: 'draft' | 'completed';
  stats: {
    recordingCount: number;
    vocabCount: number;
    practiceTime: number;
    lastPracticed: string | null;
  };
}

interface ShadowingItemCardProps {
  item: ShadowingItem;
  isSelected: boolean;
  onClick: (item: ShadowingItem) => void;
  formatTime: (seconds: number) => string;
}

const ShadowingItemCard = memo<ShadowingItemCardProps>(
  ({ item, isSelected, onClick, formatTime }) => {
    // 记忆化点击处理函数
    const handleClick = useCallback(() => {
      onClick(item);
    }, [item, onClick]);

    // 记忆化状态图标
    const statusIcon = useMemo(() => {
      if (item.isPracticed) {
        return <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />;
      }
      if (item.status === 'draft') {
        return <FileText className="w-4 h-4 text-yellow-600 flex-shrink-0" />;
      }
      return <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    }, [item.isPracticed, item.status]);

    // 记忆化状态标签
    const statusBadge = useMemo(() => {
      if (item.isPracticed) {
        return (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            已完成
          </span>
        );
      }
      if (item.status === 'draft' && !item.isPracticed) {
        return (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            草稿中
          </span>
        );
      }
      return null;
    }, [item.isPracticed, item.status]);

    // 记忆化进度条
    const progressBar = useMemo(() => {
      if (item.isPracticed) {
        return (
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
          </div>
        );
      }

      return (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${
              item.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-300'
            }`}
            style={{ width: item.status === 'draft' ? '50%' : '0%' }}
          ></div>
        </div>
      );
    }, [item.isPracticed, item.status]);

    // 记忆化统计信息
    const statsInfo = useMemo(() => {
      if (!item.isPracticed) return null;

      return (
        <div className="mt-2">
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3" />
              {item.stats.recordingCount} 录音
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {item.stats.vocabCount} 生词
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(item.stats.practiceTime)}
            </span>
          </div>
          {progressBar}
        </div>
      );
    }, [item.isPracticed, item.stats, formatTime, progressBar]);

    // 记忆化未练习状态的进度条
    const unpracticedProgress = useMemo(() => {
      if (item.isPracticed) return null;

      return (
        <div className="mt-2">
          {progressBar}
          <div className="text-xs text-gray-400 mt-1">
            {item.status === 'draft' ? '草稿中' : '未开始'}
          </div>
        </div>
      );
    }, [item.isPracticed, item.status, progressBar]);

    return (
      <div
        className={`p-3 rounded border cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-50 border-blue-200'
            : item.isPracticed
              ? 'bg-green-50 border-green-200 hover:bg-green-100'
              : item.status === 'draft'
                ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                : 'hover:bg-gray-50'
        }`}
        onClick={handleClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {statusIcon}
              <span className="text-sm font-medium truncate">
                {item.title}
                {item.isPracticed && <span className="ml-1 text-green-600">✓</span>}
                {item.status === 'draft' && <span className="ml-1 text-yellow-600">📝</span>}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {LANG_LABEL[item.lang]} • L{item.level}
              {item.cefr && ` • ${item.cefr}`}
              {statusBadge}
            </div>
            {statsInfo}
            {unpracticedProgress}
          </div>
        </div>
      </div>
    );
  },
);

ShadowingItemCard.displayName = 'ShadowingItemCard';

export default ShadowingItemCard;
