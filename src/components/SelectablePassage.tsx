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
  lang, 
  onWordSelect, 
  disabled = false,
  className = '' 
}: SelectablePassageProps) {
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showWordMenu, setShowWordMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
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


  // 监听鼠标和触摸事件来检测拖拽和处理选择
  useEffect(() => {
    let isMouseDown = false;
    let hasMoved = false;
    let isTouchActive = false;

    // 鼠标事件处理（电脑端）
    const handleMouseDown = () => {
      isMouseDown = true;
      hasMoved = false;
      setIsDragging(false);
    };

    const handleMouseMove = () => {
      if (isMouseDown) {
        hasMoved = true;
        setIsDragging(true);
      }
    };

    const handleMouseUp = () => {
      if (isMouseDown && hasMoved) {
        processSelection();
      } else {
        setIsDragging(false);
      }
      isMouseDown = false;
      hasMoved = false;
    };

    // 触摸事件处理（手机端）
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isTouchActive = true;
        hasMoved = false;
        setIsDragging(false);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isTouchActive && e.touches.length === 1) {
        hasMoved = true;
        setIsDragging(true);
        e.preventDefault(); // 阻止默认滚动行为，允许文本选择
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTouchActive) {
        // 用户松开手指后200ms触发选择检测
        setTimeout(() => {
          processSelection();
        }, 200);
      }
      isTouchActive = false;
      hasMoved = false;
      setIsDragging(false);
    };

    // 选择变化事件（电脑端使用，手机端等待touchend）
    const handleSelectionChange = () => {
      // 电脑端：立即处理选择
      // 手机端：不处理，等待touchend事件
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
        
        setSelectedWord({
          word: selectedText,
          context,
          startIndex,
          endIndex
        });
        setShowWordMenu(true);
      }
      setIsDragging(false);
      setIsProcessingSelection(false);
    };

    // 添加事件监听器
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 添加触摸事件监听器
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    // 添加选择变化监听器
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isMobile]);




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



  // 取消选择
  const cancelSelection = () => {
    setSelectedWord(null);
    setShowWordMenu(false);
  };

  // 处理点击外部区域取消选择
  const handleClickOutside = (event: React.MouseEvent) => {
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
          {isMobile ? '长按并拖动选择单词或短语，松开手指后确认选择' : '拖拽选择单词或短语'}（不超过50个字符）
        </div>
      )}
      <div
        ref={textRef}
        className={`text-lg leading-relaxed ${
          disabled ? 'text-gray-400' : 'text-gray-800'
        }`}
        onClick={(e) => e.stopPropagation()} // 阻止事件冒泡，避免点击文本时取消选择
        style={{ userSelect: disabled ? 'none' : 'text' }}
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
