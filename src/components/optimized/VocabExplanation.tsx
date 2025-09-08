/**
 * 优化的词汇解释组件
 * 使用React.memo和useCallback进行性能优化
 */

import React, { memo, useCallback, useState, useEffect } from 'react';

interface Explanation {
  gloss_native: string;
  senses?: Array<{
    example_target: string;
    example_native: string;
  }>;
}

interface VocabExplanationProps {
  word: string;
  explanation?: Explanation;
  onRefresh?: (word: string) => Promise<void>;
  loading?: boolean;
  className?: string;
}

const VocabExplanation = memo<VocabExplanationProps>(({ 
  word, 
  explanation, 
  onRefresh, 
  loading = false,
  className = ""
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 记忆化刷新处理函数
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh(word);
    } finally {
      setIsRefreshing(false);
    }
  }, [word, onRefresh, isRefreshing]);

  // 记忆化刷新按钮
  const refreshButton = useMemo(() => (
    <button 
      onClick={handleRefresh}
      className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
      title="刷新解释"
      disabled={loading || isRefreshing}
    >
      {loading || isRefreshing ? '⏳' : '🔄'}
    </button>
  ), [handleRefresh, loading, isRefreshing]);

  // 如果没有解释，显示占位符
  if (!explanation) {
    return (
      <div className={`text-sm text-gray-500 flex items-center gap-2 ${className}`}>
        <span>暂无解释</span>
        {refreshButton}
      </div>
    );
  }

  return (
    <div className={`text-sm text-gray-700 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <strong>解释：</strong>
        <span>{explanation.gloss_native}</span>
        {refreshButton}
      </div>
      
      {explanation.senses && explanation.senses.length > 0 && (
        <div className="text-sm text-gray-600">
          <strong>例句：</strong>
          <div className="mt-1">
            <div className="font-medium">{explanation.senses[0]?.example_target}</div>
            <div className="text-gray-500">{explanation.senses[0]?.example_native}</div>
          </div>
        </div>
      )}
    </div>
  );
});

VocabExplanation.displayName = 'VocabExplanation';

export default VocabExplanation;
