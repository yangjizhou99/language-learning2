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

interface WordCandidate {
  word: string;
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

  // 监听鼠标事件来检测拖拽和处理选择
  useEffect(() => {
    let isMouseDown = false;
    let hasMoved = false;

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
        // 拖拽结束后，延迟处理选择
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection && selection.toString().trim() !== '') {
            const selectedText = selection.toString().trim();
            
            // 限制选中文本长度
            if (selectedText.length > 50) {
              selection.removeAllRanges();
              alert('请选择较短的文本（不超过50个字符）');
              return;
            }

            // 检查是否包含换行符
            if (selectedText.includes('\n')) {
              selection.removeAllRanges();
              alert('请选择同一行的文本');
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
        }, 100);
      } else {
        // 如果没有拖拽，立即重置状态
        setIsDragging(false);
      }
      isMouseDown = false;
      hasMoved = false;
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);




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
          拖拽选择单词或短语（不超过50个字符）
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
