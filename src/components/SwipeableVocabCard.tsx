'use client';

import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import TTSButton from '@/components/TTSButton';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface VocabEntry {
  id: string;
  term: string;
  lang: string;
  status: string;
  explanation?: {
    gloss_native: string;
    pronunciation?: string;
    pos?: string;
    senses?: Array<{
      example_target: string;
      example_native: string;
    }>;
  };
  context?: string;
}

interface SwipeableVocabCardProps {
  entry: VocabEntry;
  isExpanded: boolean;
  isSelected: boolean;
  speakingId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSpeak: (text: string, lang: string, id: string) => void;
  onStar: (id: string, currentStatus: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

export function SwipeableVocabCard({
  entry,
  isExpanded,
  isSelected,
  speakingId,
  onToggleExpand,
  onToggleSelect,
  onSpeak,
  onStar,
  onDelete,
  index,
}: SwipeableVocabCardProps) {
  const t = useTranslation();
  const [showActions, setShowActions] = useState<'left' | 'right' | null>(null);
  const x = useMotionValue(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const hasExplanation = entry.explanation && entry.explanation.gloss_native;

  // 滑动手势处理
  const bind = useDrag(
    ({ movement: [mx], cancel, last }) => {
      // 只在移动端启用滑动手势
      if (typeof window !== 'undefined' && window.innerWidth >= 640) {
        cancel();
        return;
      }

      // 限制滑动范围
      const clampedX = Math.max(-120, Math.min(120, mx));
      x.set(clampedX);

      if (last) {
        // 左滑超过60px - 显示操作按钮
        if (mx < -60) {
          x.set(-100);
          setShowActions('left');
        }
        // 右滑超过60px - 快速选中
        else if (mx > 60) {
          onToggleSelect(entry.id);
          x.set(0);
          setShowActions(null);
        }
        // 否则回弹
        else {
          x.set(0);
          setShowActions(null);
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      rubberband: true,
    }
  );

  const backgroundColor = useTransform(
    x,
    [-100, -50, 0, 50, 100],
    [
      'rgba(239, 68, 68, 0.1)', // 左滑红色
      'rgba(239, 68, 68, 0.05)',
      'rgba(255, 255, 255, 1)',
      'rgba(59, 130, 246, 0.05)',
      'rgba(59, 130, 246, 0.1)', // 右滑蓝色
    ]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.5) }}
      className="relative"
    >
      {/* 左侧操作按钮（左滑显示） */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 flex items-center gap-2 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: showActions === 'left' ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          onClick={() => {
            onStar(entry.id, entry.status);
            x.set(0);
            setShowActions(null);
          }}
          className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center text-white shadow-lg"
        >
          {entry.status === 'starred' ? '⭐' : '☆'}
        </button>
        <button
          onClick={() => {
            if (confirm('确定要删除这个生词吗？')) {
              onDelete(entry.id);
            }
            x.set(0);
            setShowActions(null);
          }}
          className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center text-white shadow-lg"
        >
          🗑️
        </button>
      </motion.div>

      {/* 右侧提示（右滑显示） */}
      <motion.div
        className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: x.get() > 60 ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <span className="text-blue-600 font-medium">✓ 选中</span>
      </motion.div>

      {/* 可滑动的卡片主体 */}
      <motion.div
        ref={cardRef}
        {...bind()}
        style={{ x, backgroundColor }}
        className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all touch-pan-y ${
          !hasExplanation ? 'border-yellow-200' : 'border-gray-200'
        } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
      >
        {/* 卡片头部 - 可点击展开 */}
        <div 
          className="p-3 sm:p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100"
          onClick={() => onToggleExpand(entry.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect(entry.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0 mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 break-words">
                    {entry.term}
                  </h3>
                  {entry.explanation?.pronunciation && (
                    <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-medium w-fit">
                      {entry.explanation.pronunciation}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      entry.lang === 'en'
                        ? 'bg-blue-100 text-blue-700'
                        : entry.lang === 'ja'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {t.vocabulary.language_labels[entry.lang as keyof typeof t.vocabulary.language_labels]}
                  </span>
                  {entry.status === 'starred' && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                      ⭐
                    </span>
                  )}
                  {!hasExplanation && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                      未解释
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div onClick={(e) => e.stopPropagation()}>
                <TTSButton
                  text={entry.term}
                  lang={entry.lang}
                  entryId={entry.id}
                  isPlaying={speakingId === entry.id}
                  onPlay={onSpeak}
                  disabled={speakingId !== null && speakingId !== entry.id}
                />
              </div>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </motion.div>
            </div>
          </div>
          
          {/* 精简释义 - 始终显示 */}
          {hasExplanation && (
            <div className="mt-3 pl-8">
              <p className="text-sm text-gray-700 font-medium line-clamp-2">
                {entry.explanation.gloss_native}
              </p>
            </div>
          )}
        </div>

        {/* 卡片详细内容 - 展开后显示 */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
              {/* 上下文 */}
              {entry.context && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                  <p className="text-xs font-medium text-gray-500 mb-1">上下文</p>
                  <p className="text-sm text-gray-700 italic break-words">&ldquo;{entry.context}&rdquo;</p>
                </div>
              )}

              {/* 词性 */}
              {entry.explanation?.pos && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-gray-500 mr-2">词性:</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                    {entry.explanation.pos}
                  </span>
                </div>
              )}

              {/* 例句 */}
              {entry.explanation && Array.isArray(entry.explanation.senses) && entry.explanation.senses.length > 0 && entry.explanation.senses[0] && (
                <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-xs font-medium text-amber-700 mb-2">
                    {t.vocabulary.vocab_card.example}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-800 break-words">
                      {entry.explanation.senses[0].example_target}
                    </div>
                    <div className="text-sm text-gray-600 break-words">
                      {entry.explanation.senses[0].example_native}
                    </div>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                <button
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    entry.status === 'starred'
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => onStar(entry.id, entry.status)}
                >
                  {entry.status === 'starred' ? '⭐ 取消标星' : '☆ 标星'}
                </button>
                <button
                  className="flex-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  onClick={() => {
                    if (confirm('确定要删除这个生词吗？')) {
                      onDelete(entry.id);
                    }
                  }}
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* 滑动提示（首次使用时显示） */}
      {index === 0 && typeof window !== 'undefined' && window.innerWidth < 640 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute -top-10 left-0 right-0 text-center"
        >
          <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
            💡 左滑操作，右滑选中
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

