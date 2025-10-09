'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  storageKey?: string;
  className?: string;
  resizeHandlePosition?: 'left' | 'right';
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapsedWidth?: number;
}

export default function ResizablePanel({
  children,
  minWidth = 240,
  maxWidth = 600,
  defaultWidth = 320,
  storageKey,
  className = '',
  resizeHandlePosition = 'right',
  collapsible = false,
  collapsed = false,
  onCollapsedChange,
  collapsedWidth = 64,
}: ResizablePanelProps) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsedWidth = parseInt(stored, 10);
        if (!isNaN(parsedWidth) && parsedWidth >= minWidth && parsedWidth <= maxWidth) {
          return parsedWidth;
        }
      }
    }
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  }, [width]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const diff = resizeHandlePosition === 'right' 
      ? e.clientX - startXRef.current 
      : startXRef.current - e.clientX;
    
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));
    setWidth(newWidth);
  }, [isResizing, minWidth, maxWidth, resizeHandlePosition]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      if (storageKey) {
        localStorage.setItem(storageKey, width.toString());
      }
    }
  }, [isResizing, width, storageKey]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const actualWidth = collapsed ? collapsedWidth : width;

  return (
    <div
      ref={panelRef}
      className={`relative flex-shrink-0 transition-all duration-300 ${className}`}
      style={{ width: `${actualWidth}px` }}
    >
      {children}
      
      {/* 拖拽手柄 */}
      {!collapsed && (
        <div
          className={`absolute top-0 ${
            resizeHandlePosition === 'right' ? 'right-0' : 'left-0'
          } h-full w-1 cursor-col-resize group z-10`}
          onMouseDown={handleMouseDown}
        >
          {/* 悬停区域 */}
          <div className="absolute inset-y-0 -inset-x-2" />
          
          {/* 可见指示器 */}
          <div
            className={`absolute inset-y-0 w-1 bg-transparent group-hover:bg-gradient-to-b group-hover:from-blue-400 group-hover:via-indigo-500 group-hover:to-purple-400 transition-all ${
              isResizing ? 'bg-gradient-to-b from-blue-500 via-indigo-600 to-purple-500' : ''
            }`}
          />
          
          {/* 中心手柄图标 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
              <div className="w-0.5 h-8 bg-gradient-to-b from-blue-400 via-indigo-500 to-purple-400 rounded-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

