'use client';

import { useState, useRef, useEffect } from 'react';

interface SelectablePassageProps {
  text: string;
  lang: 'en' | 'ja' | 'zh';
  onWordSelect: (word: string, context: string) => void;
  disabled?: boolean;
  className?: string;
}

interface SelectedWord {
  word: string;
  context: string;
  startIndex: number;
  endIndex: number;
}


export default function SelectablePassage({ 
  text, 
  lang, // eslint-disable-line @typescript-eslint/no-unused-vars
  onWordSelect, 
  disabled = false,
  className = '' 
}: SelectablePassageProps) {
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showWordMenu, setShowWordMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isProcessingSelection, setIsProcessingSelection] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  // 检测是否为手机端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  // 处理选择触发逻辑
  useEffect(() => {
    let triggerTimeout: NodeJS.Timeout | null = null;
    let isDragging = false; // 是否正在拖动

    // 检查选择的函数
    const checkAndTrigger = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        // 检查选中的文本是否在当前组件内
        const range = selection.getRangeAt(0);
        const textElement = textRef.current;
        
        if (textElement && textElement.contains(range.commonAncestorContainer)) {
          // 选中的文本在当前组件内，触发弹窗
          processSelection();
        } else {
          // 选中的文本不在当前组件内，清除选择但不触发弹窗
          selection.removeAllRanges();
        }
      }
    };

    // 开始倒计时
    const startTimer = () => {
      // 清除之前的定时器
      if (triggerTimeout) {
        clearTimeout(triggerTimeout);
      }
      
      // 手机端：2秒后触发，电脑端：立即触发
      const delay = isMobile ? 2000 : 50;
      triggerTimeout = setTimeout(() => {
        checkAndTrigger();
      }, delay);
    };

    // 取消定时器
    const cancelTimer = () => {
      if (triggerTimeout) {
        clearTimeout(triggerTimeout);
        triggerTimeout = null;
      }
    };

    // 检查事件是否发生在组件内
    const isEventInComponent = (event: Event) => {
      const target = event.target as HTMLElement;
      const textElement = textRef.current;
      return textElement && textElement.contains(target);
    };

    // 触摸开始事件（手机端）
    const handleTouchStart = (event: TouchEvent) => {
      if (!isEventInComponent(event)) return;
      isDragging = false;
      cancelTimer(); // 取消之前的定时器
    };

    // 触摸移动事件（手机端）
    const handleTouchMove = (event: TouchEvent) => {
      if (!isEventInComponent(event)) return;
      if (!isDragging) {
        isDragging = true;
        startTimer(); // 开始拖动，启动倒计时
      }
    };

    // 触摸结束事件（手机端）
    const handleTouchEnd = (event: TouchEvent) => {
      if (!isEventInComponent(event)) return;
      isDragging = false;
      // 不取消定时器，让倒计时继续
    };

    // 鼠标按下事件（电脑端）
    const handleMouseDown = (event: MouseEvent) => {
      if (!isEventInComponent(event)) return;
      isDragging = false;
      cancelTimer(); // 取消之前的定时器
    };

    // 鼠标移动事件（电脑端）
    const handleMouseMove = (event: MouseEvent) => {
      if (!isEventInComponent(event)) return;
      if (!isDragging) {
        isDragging = true;
        startTimer(); // 开始拖动，启动倒计时
      }
    };

    // 鼠标松开事件（电脑端）
    const handleMouseUp = (event: MouseEvent) => {
      if (!isEventInComponent(event)) return;
      isDragging = false;
      // 不取消定时器，让倒计时继续
    };

    // 禁用系统自带的文本选择菜单
    const handleContextMenu = (e: Event) => {
      const target = e.target as HTMLElement;
      const textElement = textRef.current;
      
      // 只在文本区域内阻止右键菜单
      if (textElement && textElement.contains(target)) {
        e.preventDefault(); // 阻止右键菜单
      }
    };

    // 禁用系统自带的文本选择菜单，但保留文本选择功能
    const handleSelectStart = () => {
      // 不阻止默认行为，让文本可以被选中
      // 我们会在选择完成后禁用系统菜单
    };

    // 不再使用selectionchange事件，因为它会在选择过程中过早触发

    // 获取选中文本的上下文 - 返回包含选中文本的完整句子
    const getContext = (startIndex: number, endIndex: number): string => {
      // 找到选中文本在原文中的位置
      const selectedText = text.substring(startIndex, endIndex);
      
      // 按句子分割（支持中英文标点符号）
      const sentences = text.split(/[.!?。！？；;]/);
      
      // 找到包含选中文本的句子
      for (const sentence of sentences) {
        if (sentence.includes(selectedText)) {
          // 清理句子，移除多余的空白字符
          return sentence.trim();
        }
      }
      
      // 如果没找到完整句子，则按逗号分割
      const clauses = text.split(/[,，]/);
      for (const clause of clauses) {
        if (clause.includes(selectedText)) {
          return clause.trim();
        }
      }
      
      // 如果还是没找到，返回选中文本本身
      return selectedText;
    };

    // 处理选择的通用函数
    const processSelection = () => {
      // 防止重复处理
      if (isProcessingSelection) {
        return;
      }
      
      setIsProcessingSelection(true);
      
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        const selectedText = selection.toString().trim();
        
        // 限制选中文本长度
        if (selectedText.length > 50) {
          selection.removeAllRanges();
          alert('请选择较短的文本（不超过50个字符）');
          setIsProcessingSelection(false);
          return;
        }

        // 检查是否包含换行符
        if (selectedText.includes('\n')) {
          selection.removeAllRanges();
          alert('请选择同一行的文本');
          setIsProcessingSelection(false);
          return;
        }

        // 获取选中文本在原文中的位置
        const range = selection.getRangeAt(0);
        const startIndex = range.startOffset;
        const endIndex = range.endOffset;
        
        const context = getContext(startIndex, endIndex);
        
        // 设置菜单位置
        const rect = range.getBoundingClientRect();
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top
        });
        
        // 立即清除系统选择，防止系统菜单出现
        selection.removeAllRanges();
        
        setSelectedWord({
          word: selectedText,
          context,
          startIndex,
          endIndex
        });
        setShowWordMenu(true);
      }
      setIsProcessingSelection(false);
    };

    // 添加事件监听器
    // 触摸事件（手机端）
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // 鼠标事件（电脑端）
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 禁用系统自带的文本选择菜单
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      // 清理定时器
      cancelTimer();
      
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [isMobile, isProcessingSelection, text]);







  // 取消选择
  const cancelSelection = () => {
    setSelectedWord(null);
    setShowWordMenu(false);
  };

  // 处理点击外部区域取消选择
  const handleClickOutside = () => {
    if (showWordMenu) {
      cancelSelection();
    }
  };





  // 渲染文本，支持拖拽选择或手机端点击选择
  const renderText = () => {
    if (disabled) {
      return <span className="select-none whitespace-pre-wrap">{text}</span>;
    }

    // 手机端和桌面端都使用相同的文本渲染方式
    return <span className="whitespace-pre-wrap">{text}</span>;
  };

  return (
    <div 
      className={`relative ${className}`}
      onClick={handleClickOutside}
    >
      {!disabled && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          💡 <strong>选词提示：</strong>
          {isMobile ? '长按并拖动选择单词或短语，松开手指后2秒弹窗' : '拖拽选择单词或短语，松开鼠标立即弹窗'}（不超过50个字符）
        </div>
      )}
      <div
        ref={textRef}
        className={`text-lg leading-relaxed ${
          disabled ? 'text-gray-400' : 'text-gray-800'
        }`}
        onClick={(e) => e.stopPropagation()} // 阻止事件冒泡，避免点击文本时取消选择
        style={{ 
          userSelect: disabled ? 'none' : 'text',
          WebkitUserSelect: disabled ? 'none' : 'text',
          MozUserSelect: disabled ? 'none' : 'text',
          msUserSelect: disabled ? 'none' : 'text'
        }}
        onContextMenu={(e) => e.preventDefault()} // 阻止右键菜单
      >
        {renderText()}
      </div>

      {/* 选中单词弹窗 */}
      {showWordMenu && selectedWord && (
        <div 
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-48"
          style={{
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y - 60}px`
          }}
        >
          <div className="text-sm">
            <div className="font-medium text-gray-800 mb-1">选中的单词：</div>
            <div className="text-blue-600 font-semibold mb-2 text-center border-b pb-1">
              {selectedWord.word}
            </div>
            <div className="text-xs text-gray-600 mb-2">{selectedWord.context}</div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onWordSelect(selectedWord.word, selectedWord.context);
                  setShowWordMenu(false);
                  setSelectedWord(null);
                }}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex-1"
              >
                添加到生词本
              </button>
              <button
                onClick={() => {
                  setShowWordMenu(false);
                  setSelectedWord(null);
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 transition-colors flex-1"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
