'use client';

import React, { useState, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  onToggle?: (isOpen: boolean) => void;
}

/**
 * 可折叠卡片组件
 * 用于显示可以展开/折叠的内容区域
 */
export default function CollapsibleCard({
  title,
  icon,
  badge,
  summary,
  children,
  defaultOpen = false,
  className = '',
  headerClassName = '',
  contentClassName = '',
  onToggle,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <Card className={`overflow-hidden transition-all duration-200 ${className}`}>
      {/* 卡片头部 - 可点击 */}
      <button
        onClick={handleToggle}
        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors ${headerClassName}`}
        aria-expanded={isOpen}
        aria-label={isOpen ? `折叠${title}` : `展开${title}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 图标 */}
          {icon && (
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
              {icon}
            </div>
          )}
          
          {/* 标题和摘要 */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              {badge && <div className="flex-shrink-0">{badge}</div>}
            </div>
            
            {/* 折叠时显示摘要 */}
            {!isOpen && summary && (
              <div className="text-xs text-gray-600 mt-1 line-clamp-1">
                {summary}
              </div>
            )}
          </div>
        </div>

        {/* 展开/折叠图标 */}
        <div className="flex-shrink-0 ml-2">
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* 卡片内容 - 可展开 */}
      <div
        className={`transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className={`px-4 pb-4 ${contentClassName}`}>
          {isOpen && children}
        </div>
      </div>
    </Card>
  );
}

