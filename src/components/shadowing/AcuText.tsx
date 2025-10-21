'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type AcuUnit } from '@/lib/acu-utils';

interface AcuTextProps {
  text: string;
  lang: 'zh' | 'en' | 'ja' | 'ko';
  units: AcuUnit[];
  onConfirm: (mergedText: string, context: string) => void;
  selectedWords?: Array<{ word: string; context: string }>;
}

interface SelectedUnit {
  unit: AcuUnit;
  index: number;
}

export default function AcuText({ text, lang, units, onConfirm, selectedWords = [] }: AcuTextProps) {
  const [selectedUnits, setSelectedUnits] = useState<SelectedUnit[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // 判断是否为对话标识符（标点符号现在可以选中）
  const isNonSelectable = useCallback((unit: AcuUnit) => {
    const span = unit.span.trim();
    // 只标记对话标识符为不可选中
    if (/^[ABab][:：]$/.test(span)) return true;
    return false;
  }, []);

  // 检查ACU单元是否包含已选择的生词
  const isAlreadySelected = useCallback((unit: AcuUnit) => {
    const span = unit.span.trim();
    return selectedWords.some(selectedWord => 
      selectedWord.word === span || span.includes(selectedWord.word)
    );
  }, [selectedWords]);

  // 处理块点击
  const handleUnitClick = useCallback((unit: AcuUnit, index: number) => {
    // 检查是否为不可选中的块
    if (isNonSelectable(unit)) {
      return; // 不处理点击
    }

    setSelectedUnits(prev => {
      const existingIndex = prev.findIndex(su => su.index === index);
      
      if (existingIndex >= 0) {
        // 取消选中
        return prev.filter((_, i) => i !== existingIndex);
      } else {
        // 检查是否与已选中的块相邻且同句
        if (prev.length > 0) {
          const lastSelected = prev[prev.length - 1];
          const isAdjacent = Math.abs(index - lastSelected.index) === 1;
          const isSameSentence = unit.sid === lastSelected.unit.sid;
          
          if (!isAdjacent || !isSameSentence) {
            // 跨句或不相邻，提示用户
            alert('请选择同一句的相邻片段');
            return prev;
          }
        }
        
        // 限制最多选择 5 个块
        if (prev.length >= 5) {
          alert('最多只能选择 5 个相邻的 ACU 块');
          return prev;
        }
        
        // 添加选中
        return [...prev, { unit, index }];
      }
    });
  }, [isNonSelectable]);

  // 获取合并后的文本
  const getMergedText = useCallback(() => {
    if (selectedUnits.length === 0) return '';
    
    // 按索引排序
    const sortedUnits = [...selectedUnits].sort((a, b) => a.index - b.index);
    
    // 获取选中单元的范围
    const minIndex = Math.min(...sortedUnits.map(su => su.index));
    const maxIndex = Math.max(...sortedUnits.map(su => su.index));
    
    // 构建文本：包含选中单元和它们之间的所有单元
    let mergedText = '';
    let lastEnd = -1;
    
    for (let i = minIndex; i <= maxIndex; i++) {
      const unit = units[i];
      if (unit) {
        // 保持原始间距
        if (lastEnd >= 0 && unit.start > lastEnd) {
          mergedText += text.slice(lastEnd, unit.start);
        }
        mergedText += unit.span;
        lastEnd = unit.end;
      }
    }
    
    return mergedText.trim();
  }, [selectedUnits, units, text]);

  // 获取上下文（该句的完整文本）
  const getContext = useCallback(() => {
    if (selectedUnits.length === 0) return '';
    
    const firstUnit = selectedUnits[0].unit;
    const sentenceUnits = units.filter(unit => unit.sid === firstUnit.sid);
    
    // 找到该句在原文中的位置
    const sentenceStart = Math.min(...sentenceUnits.map(u => u.start));
    const sentenceEnd = Math.max(...sentenceUnits.map(u => u.end));
    
    return text.slice(sentenceStart, sentenceEnd);
  }, [selectedUnits, units, text]);

  // 处理确认
  const handleConfirm = useCallback(() => {
    const mergedText = getMergedText();
    const context = getContext();
    
    if (mergedText && context) {
      onConfirm(mergedText, context);
      setSelectedUnits([]);
      setShowConfirmDialog(false);
    }
  }, [getMergedText, getContext, onConfirm]);

  // 处理取消
  const handleCancel = useCallback(() => {
    setSelectedUnits([]);
    setShowConfirmDialog(false);
  }, []);

  // 渲染带格式的文本和ACU块 - 基于原文渲染
  const renderTextWithUnits = () => {
    // 如果ACU数据异常（只有对话标识符等），回退到显示原文
    const hasValidAcuData = units.length > 2 && units.some(u => u.span.length > 3);
    
    if (!hasValidAcuData) {
      console.warn('ACU数据异常，回退到显示原文:', units);
      return (
        <div className="text-gray-700 whitespace-pre-wrap">
          {text.split('\n').map((line, i) => (
            <div key={i} className="mb-2">{line}</div>
          ))}
        </div>
      );
    }
    
    // 简化渲染逻辑：直接基于原文和ACU units进行渲染
    // 按句子分组渲染，避免重复
    const sentences = units.reduce((acc, unit, index) => {
      if (!acc[unit.sid]) {
        acc[unit.sid] = [];
      }
      acc[unit.sid].push({ ...unit, index });
      return acc;
    }, {} as Record<number, (AcuUnit & { index: number })[]>);

    return Object.entries(sentences).map(([sid, sentenceUnits]) => {
      // 按start位置排序
      const sortedUnits = sentenceUnits.sort((a, b) => a.start - b.start);
      
      // 找到该句在原文中的位置
      const sentenceStart = Math.min(...sortedUnits.map(u => u.start));
      let sentenceEnd = Math.max(...sortedUnits.map(u => u.end));
      
      // 扩展句子结束位置以包含句尾标点符号
      // 查找句尾标点符号（。！？；等）
      const sentenceEndPattern = /[。！？；\s]*$/;
      const remainingText = text.slice(sentenceEnd);
      const match = remainingText.match(sentenceEndPattern);
      if (match) {
        sentenceEnd += match[0].length;
      }
      
      // 获取该句的原文
      const sentenceText = text.slice(sentenceStart, sentenceEnd);
      
      // 基于原文逐字符渲染
      let currentPos = sentenceStart;
      const elements: React.ReactElement[] = [];
      
      for (let i = 0; i < sortedUnits.length; i++) {
        const unit = sortedUnits[i];
        const unitIndex = unit.index;
        
        // 添加unit之前的内容（如果有）
        if (unit.start > currentPos) {
          const beforeText = text.slice(currentPos, unit.start);
          if (beforeText) {
            elements.push(
              <span key={`before-${i}`} className="text-gray-700">
                {beforeText}
              </span>
            );
          }
        }
        
        // 添加unit内容
        const isSelected = selectedUnits.some(su => su.index === unitIndex);
        const isNonSelectableUnit = isNonSelectable(unit);
        const isAlreadySelectedWord = isAlreadySelected(unit);
        
        elements.push(
          <span
            key={`unit-${i}`}
            onClick={() => handleUnitClick(unit, unitIndex)}
            className={`
              inline-block px-1 py-0.5 mx-0.5 rounded transition-all
              touch-manipulation select-none
              ${isNonSelectableUnit 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60' 
                : isSelected 
                  ? 'bg-blue-500 text-white border-blue-600 shadow-md cursor-pointer' 
                  : isAlreadySelectedWord
                    ? 'bg-yellow-200 text-yellow-800 border-yellow-400 hover:bg-yellow-300 cursor-pointer'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 cursor-pointer'
              }
            `}
            title={
              isNonSelectableUnit 
                ? '不可选中' 
                : isAlreadySelectedWord 
                  ? `已选择的生词: ${unit.span}` 
                  : `块 ${unitIndex + 1} (句子 ${unit.sid})`
            }
          >
            {unit.span}
          </span>
        );
        
        currentPos = unit.end;
      }
      
      // 添加最后一个unit之后的内容（如果有）
      if (currentPos < sentenceEnd) {
        const afterText = text.slice(currentPos, sentenceEnd);
        if (afterText) {
          elements.push(
            <span key={`after-${sid}`} className="text-gray-700">
              {afterText}
            </span>
          );
        }
      }
      
      return (
        <div key={sid} className="mb-2">
          {elements}
        </div>
      );
    });
  };

  // 渲染单个 ACU 块（保留原函数以防其他地方使用）
  const renderUnit = (unit: AcuUnit, index: number) => {
    const isSelected = selectedUnits.some(su => su.index === index);
    const isNonSelectableUnit = isNonSelectable(unit);
    
    return (
      <span
        key={index}
        onClick={() => handleUnitClick(unit, index)}
        className={`
          inline px-1 py-0.5 rounded transition-all
          touch-manipulation select-none
          ${isNonSelectableUnit 
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60' // 不可选中的样式
            : isSelected 
              ? 'bg-blue-500 text-white border-blue-600 shadow-md cursor-pointer' 
              : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 cursor-pointer'
          }
        `}
        title={isNonSelectableUnit ? '不可选中' : `块 ${index + 1} (句子 ${unit.sid})`}
        style={{ 
          display: 'inline',
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all'
        }}
      >
        {unit.span}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ACU 块显示 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600 mb-2">
          点击选择 ACU 块（仅限同句相邻块）:
          <br />
          <span className="text-xs text-gray-500">
            💡 灰色块（A:、B:、标点符号）不可选中，但会在合并时自动包含
          </span>
        </div>
        <div className="whitespace-pre-wrap text-base leading-relaxed">
          {units.length === 0 ? (
            <div className="text-gray-500">没有ACU数据</div>
          ) : (
            renderTextWithUnits()
          )}
        </div>
      </div>

      {/* 选中状态显示 */}
      {selectedUnits.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="space-y-2">
            <div className="text-sm font-medium text-blue-800">
              已选择的文本: {getMergedText()}
            </div>
            <div className="text-xs text-blue-600">
              上下文: {getContext()}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setShowConfirmDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                确认添加到生词本
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
              >
                取消
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md mx-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">确认添加到生词本</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">选择的文本:</div>
                <div className="p-2 bg-gray-100 rounded text-sm font-medium">
                  {getMergedText()}
                </div>
                <div className="text-sm text-gray-600">上下文:</div>
                <div className="p-2 bg-gray-100 rounded text-sm">
                  {getContext()}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  确认添加
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                >
                  取消
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
