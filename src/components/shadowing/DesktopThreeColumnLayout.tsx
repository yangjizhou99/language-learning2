'use client';

import React, { useState } from 'react';
import ResizablePanel from './ResizablePanel';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DesktopThreeColumnLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  leftPanelMinWidth?: number;
  leftPanelMaxWidth?: number;
  leftPanelDefaultWidth?: number;
  rightPanelMinWidth?: number;
  rightPanelMaxWidth?: number;
  rightPanelDefaultWidth?: number;
  className?: string;
}

export default function DesktopThreeColumnLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  leftPanelMinWidth = 240,
  leftPanelMaxWidth = 400,
  leftPanelDefaultWidth = 288,
  rightPanelMinWidth = 300,
  rightPanelMaxWidth = 600,
  rightPanelDefaultWidth = 400,
  className = '',
}: DesktopThreeColumnLayoutProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className={`flex gap-0 min-h-[700px] ${className}`}>
      {/* 左侧题库栏 - 可调整宽度 */}
      <ResizablePanel
        minWidth={leftPanelMinWidth}
        maxWidth={leftPanelMaxWidth}
        defaultWidth={leftPanelDefaultWidth}
        storageKey="shadowing-left-panel-width"
        resizeHandlePosition="right"
        collapsible={true}
        collapsed={leftCollapsed}
        onCollapsedChange={setLeftCollapsed}
        collapsedWidth={64}
        className="h-[85vh]"
      >
        {leftPanel}
        
        {/* 折叠/展开按钮 */}
        {!leftCollapsed && (
          <button
            onClick={() => setLeftCollapsed(true)}
            className="absolute top-4 right-2 w-6 h-6 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all z-20 border border-gray-200"
            title="折叠题库"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </ResizablePanel>

      {/* 左侧折叠状态的展开按钮 */}
      {leftCollapsed && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30">
          <button
            onClick={() => setLeftCollapsed(false)}
            className="w-8 h-16 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 rounded-r-xl shadow-lg flex items-center justify-center text-white transition-all"
            title="展开题库"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 中央主内容面板 - 固定宽度，自适应剩余空间 */}
      <div className="flex-1 min-w-[480px] overflow-y-auto h-[85vh] px-3">
        {centerPanel}
      </div>

      {/* 右侧辅助面板 - 可调整宽度 */}
      <ResizablePanel
        minWidth={rightPanelMinWidth}
        maxWidth={rightPanelMaxWidth}
        defaultWidth={rightPanelDefaultWidth}
        storageKey="shadowing-right-panel-width"
        resizeHandlePosition="left"
        collapsible={true}
        collapsed={rightCollapsed}
        onCollapsedChange={setRightCollapsed}
        collapsedWidth={0}
        className="h-[85vh]"
      >
        {rightPanel}
        
        {/* 折叠/展开按钮 */}
        {!rightCollapsed && (
          <button
            onClick={() => setRightCollapsed(true)}
            className="absolute top-4 left-2 w-6 h-6 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all z-20 border border-gray-200"
            title="折叠辅助面板"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </ResizablePanel>

      {/* 右侧折叠状态的展开按钮 */}
      {rightCollapsed && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-30">
          <button
            onClick={() => setRightCollapsed(false)}
            className="w-8 h-16 bg-gradient-to-l from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-l-xl shadow-lg flex items-center justify-center text-white transition-all"
            title="展开辅助面板"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}




