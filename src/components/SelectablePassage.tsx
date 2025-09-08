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
  const [isSelecting, setIsSelecting] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

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


  // 处理拖拽选择
  const handleMouseUp = () => {
    if (disabled) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') {
      setSelectedWord(null);
      return;
    }

    const selectedText = selection.toString().trim();
    
    // 限制选中文本长度 - 只允许选择单词或短语
    if (selectedText.length > 50) {
      selection.removeAllRanges();
      setSelectedWord(null);
      alert('请选择较短的文本（不超过50个字符）');
      return;
    }

    // 检查是否包含换行符
    if (selectedText.includes('\n')) {
      selection.removeAllRanges();
      setSelectedWord(null);
      alert('请选择同一行的文本');
      return;
    }

    // 获取选中文本在原文中的位置
    const range = selection.getRangeAt(0);
    const startIndex = range.startOffset;
    const endIndex = range.endOffset;
    
    const context = getContext(startIndex, endIndex);
    
    setSelectedWord({
      word: selectedText,
      context,
      startIndex,
      endIndex
    });
  };

  // 确认选择
  const confirmSelection = () => {
    if (selectedWord) {
      onWordSelect(selectedWord.word, selectedWord.context);
      setSelectedWord(null);
    }
  };

  // 取消选择
  const cancelSelection = () => {
    setSelectedWord(null);
  };


  // 渲染文本，支持拖拽选择
  const renderText = () => {
    if (disabled) {
      return <span className="select-none whitespace-pre-wrap">{text}</span>;
    }

    // 直接返回文本，允许拖拽选择，保持换行符
    return <span className="whitespace-pre-wrap">{text}</span>;
  };

  return (
    <div className={`relative ${className}`}>
      {!disabled && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          💡 <strong>选词提示：</strong>拖拽选择单词或短语（不超过50个字符）
        </div>
      )}
      <div
        ref={textRef}
        className={`text-lg leading-relaxed ${
          disabled ? 'text-gray-400' : 'text-gray-800'
        }`}
        onMouseUp={handleMouseUp}
        style={{ userSelect: disabled ? 'none' : 'text' }}
      >
        {renderText()}
      </div>

      {/* 选择确认弹窗 */}
      {selectedWord && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-64">
          <div className="text-sm">
            <div className="font-medium text-gray-800 mb-1">选中的词：</div>
            <div className="text-blue-600 font-semibold mb-2">{selectedWord.word}</div>
            
            <div className="font-medium text-gray-800 mb-1">上下文：</div>
            <div className="text-gray-600 text-xs mb-3 bg-gray-50 p-2 rounded">
              {selectedWord.context}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={confirmSelection}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
              >
                添加到生词本
              </button>
              <button
                onClick={cancelSelection}
                className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
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
