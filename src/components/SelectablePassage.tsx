'use client';

import { useState, useRef, useEffect } from 'react';

interface SelectablePassageProps {
  text: string;
  lang: 'en' | 'ja' | 'zh';
  onSelectionChange?: (selectedText: string, context: string) => void;
  disabled?: boolean;
  className?: string;
  clearSelection?: boolean; // 用于外部控制清除选择
}



export default function SelectablePassage({ 
  text, 
  lang, // eslint-disable-line @typescript-eslint/no-unused-vars
  onSelectionChange,
  disabled = false,
  className = '',
  clearSelection = false
}: SelectablePassageProps) {
  const [isMobile, setIsMobile] = useState(false);
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

  // 监听clearSelection变化，清除选择
  useEffect(() => {
    if (clearSelection) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }
  }, [clearSelection]);


  // 处理选择触发逻辑
  useEffect(() => {
    let triggerTimeout: NodeJS.Timeout | null = null;
    let isDragging = false; // 是否正在拖动
    let selectionStartTime = 0; // 选择开始时间

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
      
      // 记录选择开始时间
      selectionStartTime = Date.now();
      
      // 使用较短的延迟，但添加额外的稳定性检查
      const delay = 400; // 统一使用400ms延迟
      triggerTimeout = setTimeout(() => {
        // 再次检查选择是否仍然存在且稳定
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== '') {
          // 检查选择是否还在进行中（通过检查选择时间是否足够长）
          const selectionDuration = Date.now() - selectionStartTime;
          if (selectionDuration >= 200) { // 减少最小选择时间到200ms
            checkAndTrigger();
          }
        }
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
        // 不立即启动定时器，等触摸结束
      }
    };

    // 触摸结束事件（手机端）
    const handleTouchEnd = (event: TouchEvent) => {
      if (!isEventInComponent(event)) return;
      isDragging = false;
      
      // 延迟一点时间让选择稳定，然后启动定时器
      setTimeout(() => {
        startTimer();
      }, 100);
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
        // 不立即启动定时器，等鼠标松开
      }
    };

    // 鼠标松开事件（电脑端）
    const handleMouseUp = (event: MouseEvent) => {
      if (!isEventInComponent(event)) return;
      isDragging = false;
      // 鼠标松开后启动定时器
      startTimer();
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

    // 添加selectionchange事件作为备用检测机制（特别是手机端）
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        const range = selection.getRangeAt(0);
        const textElement = textRef.current;
        
        if (textElement && textElement.contains(range.commonAncestorContainer)) {
          // 选中的文本在当前组件内
          if (isMobile) {
            // 手机端使用selectionchange事件，立即启动定时器
            cancelTimer();
            startTimer();
          }
        } else {
          // 选中的文本不在当前组件内，清除选择
          if (isMobile) {
            selection.removeAllRanges();
          }
        }
      }
    };


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
        
        // 不立即清除选择，保持高亮状态
        // selection.removeAllRanges();
        
        // 调用回调函数通知父组件有新的选择
        if (onSelectionChange) {
          onSelectionChange(selectedText, context);
        }
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
    
    // 选择变化事件（手机端备用检测）
    document.addEventListener('selectionchange', handleSelectionChange);
    
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
      
      document.removeEventListener('selectionchange', handleSelectionChange);
      
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [isMobile, isProcessingSelection, text, onSelectionChange]);












  // 渲染文本，支持拖拽选择或手机端点击选择
  const renderText = () => {
    if (disabled) {
      return <span className="select-none whitespace-pre-wrap">{text}</span>;
    }

    // 手机端和桌面端都使用相同的文本渲染方式
    return <span className="whitespace-pre-wrap">{text}</span>;
  };

  return (
    <div className={`relative ${className}`}>
      {!disabled && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          💡 <strong>选词提示：</strong>
          {isMobile ? '长按并拖动选择单词或短语，松开手指后稍等' : '拖拽选择单词或短语，松开鼠标后稍等'}（不超过50个字符），选择完成后会显示确认按钮
        </div>
      )}
      <div
        ref={textRef}
        className={`text-lg leading-relaxed ${
          disabled ? 'text-gray-400' : 'text-gray-800'
        }`}
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
    </div>
  );
}
