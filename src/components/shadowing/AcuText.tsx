'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();

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
    return selectedWords.some(selectedWord => {
      const selectedWordText = selectedWord.word.trim();
      
      // 完全匹配
      if (span === selectedWordText) {
        return true;
      }
      
      // 检查unit的span是否包含已选择生词（unit包含已选择词）
      // 对于韩语，需要检查词边界
      if (lang === 'ko' && span.includes(selectedWordText)) {
        // 检查是否在词边界
        const startIndex = span.indexOf(selectedWordText);
        if (startIndex >= 0) {
          const endIndex = startIndex + selectedWordText.length;
          
          // 检查词前边界
          const beforeChar = startIndex > 0 ? span[startIndex - 1] : '';
          const isBeforeBoundary = startIndex === 0 || 
            /[\s\p{P}\p{S}]/u.test(beforeChar) || // 空格、标点符号
            !/[\uac00-\ud7af]/.test(beforeChar); // 非韩文字符
          
          // 检查词后边界
          const afterChar = endIndex < span.length ? span[endIndex] : '';
          const isAfterBoundary = endIndex === span.length || 
            /[\s\p{P}\p{S}]/u.test(afterChar) || // 空格、标点符号
            !/[\uac00-\ud7af]/.test(afterChar); // 非韩文字符
          
          if (isBeforeBoundary && isAfterBoundary) {
            return true;
          }
        }
      }
      
      // 对于英文，加入大小写不敏感的词边界判断，避免 though 命中 thought
      if (lang === 'en' && span.toLowerCase().includes(selectedWordText.toLowerCase())) {
        const lowerSpan = span.toLowerCase();
        const lowerWord = selectedWordText.toLowerCase();
        const startIndex = lowerSpan.indexOf(lowerWord);
        if (startIndex >= 0) {
          const endIndex = startIndex + selectedWordText.length;
          const isLetter = (ch: string) => /[A-Za-z]/.test(ch);
          const beforeChar = startIndex > 0 ? span[startIndex - 1] : '';
          const isBeforeBoundary = startIndex === 0 || !isLetter(beforeChar);
          const afterChar = endIndex < span.length ? span[endIndex] : '';
          const isAfterBoundary = endIndex === span.length || !isLetter(afterChar);
          if (isBeforeBoundary && isAfterBoundary) {
            return true;
          }
        }
      }
      
      // 对于其他语言，检查unit是否包含已选择词
      if (span.includes(selectedWordText)) {
        return true;
      }
      
      // 关键修复：检查已选择生词是否包含unit的span（用于处理连续块合并的情况）
      // 例如：已选择生词是"块1块2块3"，当前unit是"块1"、"块2"或"块3"时，应该匹配
      if (selectedWordText.includes(span)) {
        const startIndex = selectedWordText.indexOf(span);
        if (startIndex >= 0) {
          const endIndex = startIndex + span.length;
          
          // 对于英文，需要检查词边界，避免误匹配
          if (lang === 'en') {
            const isLetter = (ch: string) => /[A-Za-z]/.test(ch);
            const beforeChar = startIndex > 0 ? selectedWordText[startIndex - 1] : '';
            const isBeforeBoundary = startIndex === 0 || !isLetter(beforeChar);
            const afterChar = endIndex < selectedWordText.length ? selectedWordText[endIndex] : '';
            const isAfterBoundary = endIndex === selectedWordText.length || !isLetter(afterChar);
            
            // 如果unit的span在已选择生词中是一个完整的词，则匹配
            if (isBeforeBoundary && isAfterBoundary) {
              return true;
            }
            
            // 对于连续块的情况，即使不是完整词边界，如果unit的span在已选择生词的开头或结尾，也应该匹配
            // 这是为了处理连续块合并的情况，比如"块1块2块3"应该匹配"块1"、"块2"、"块3"
            if (startIndex === 0 || endIndex === selectedWordText.length) {
              return true;
            }
          } else {
            // 对于非英文语言（中文、日文、韩文），更宽松的匹配策略
            // 检查unit的span是否在已选择生词的开头或结尾，直接匹配（这是连续块合并的情况）
            if (startIndex === 0 || endIndex === selectedWordText.length) {
              return true;
            }
            
            // 检查是否在词边界处（空格、标点符号或韩文词边界）
            const beforeChar = startIndex > 0 ? selectedWordText[startIndex - 1] : '';
            const afterChar = endIndex < selectedWordText.length ? selectedWordText[endIndex] : '';
            const isBeforeBoundary = startIndex === 0 || 
              /[\s\p{P}\p{S}]/u.test(beforeChar) || // 空格、标点符号
              (lang === 'ko' && !/[\uac00-\ud7af]/.test(beforeChar)); // 韩文词边界
            const isAfterBoundary = endIndex === selectedWordText.length || 
              /[\s\p{P}\p{S}]/u.test(afterChar) || // 空格、标点符号
              (lang === 'ko' && !/[\uac00-\ud7af]/.test(afterChar)); // 韩文词边界
            
            if (isBeforeBoundary && isAfterBoundary) {
              return true;
            }
            
            // 对于连续块的情况，即使不在词边界处，如果unit的span在已选择生词中，也应该匹配
            // 这是为了处理连续块合并的情况，比如"块1块2块3"应该匹配"块1"、"块2"、"块3"
            // 注意：这里使用更宽松的匹配，因为连续块合并时可能没有空格分隔
            // 但要避免误匹配，只在已选择生词明显比unit的span长时才匹配（说明是合并后的文本）
            if (selectedWordText.length > span.length) {
              return true;
            }
          }
        }
      }
      
      return false;
    });
  }, [selectedWords, lang]);

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
            alert(t.shadowing.acu_text.select_adjacent_units);
            return prev;
          }
        }
        
        // 添加选中
        return [...prev, { unit, index }];
      }
    });
  }, [isNonSelectable, t]);

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
    const sentenceUnits = units.filter((unit) => unit.sid === firstUnit.sid);

    // 该句在原文中的内容范围（单位坐标基于原文）
    let sentenceStart = Math.min(...sentenceUnits.map((u) => u.start));
    const sentenceEnd = Math.max(...sentenceUnits.map((u) => u.end));

    // 若该句前有对话标识符（A:/B: 等），将切片起点回溯到行首以包含标识符
    const lineStart = Math.max(0, text.lastIndexOf('\n', sentenceStart - 1) + 1);
    const prefix = text.slice(lineStart, sentenceStart);
    if (/^[ABab][:：]\s*$/.test(prefix.trim())) {
      sentenceStart = lineStart;
    }

    let contextRaw = text.slice(sentenceStart, sentenceEnd);

    // 兜底：若切片范围异常大（疑似 sid 全文一致的旧数据），改为按就近标点推断一句
    const spanLen = sentenceEnd - sentenceStart;
    if (spanLen > Math.min(400, Math.floor(text.length * 0.7))) {
      const firstStart = firstUnit.start;
      const before = text.slice(0, firstStart);
      const after = text.slice(firstUnit.end);
      const punct = /[。．\.？！!?]/;
      const prevP = (() => {
        for (let i = before.length - 1; i >= 0; i--) {
          if (punct.test(before[i])) return i;
        }
        return -1;
      })();
      const nextP = (() => {
        for (let i = 0; i < after.length; i++) {
          if (punct.test(after[i])) return firstUnit.end + i + 1;
        }
        return text.length;
      })();
      const fallbackStart = Math.max(0, prevP + 1);
      const fallbackEnd = Math.min(text.length, nextP);

      // 包含可能的对话标识符
      const fbLineStart = Math.max(0, text.lastIndexOf('\n', fallbackStart - 1) + 1);
      const fbPrefix = text.slice(fbLineStart, fallbackStart);
      const fbStartIncl = /^[ABab][:：]\s*$/.test(fbPrefix.trim()) ? fbLineStart : fallbackStart;
      contextRaw = text.slice(fbStartIncl, fallbackEnd);
    }

    return contextRaw;
  }, [selectedUnits, units, text]);

  // 处理确认
  const handleConfirm = useCallback(() => {
    const mergedText = getMergedText();
    const context = getContext();
    
    if (mergedText && context) {
      onConfirm(mergedText, context);
      setSelectedUnits([]);
    }
  }, [getMergedText, getContext, onConfirm]);

  // 处理取消
  const handleCancel = useCallback(() => {
    setSelectedUnits([]);
  }, []);

  // 渲染带格式的文本和ACU块 - 基于原文渲染
  const renderTextWithUnits = () => {
    // 检查是否为对话格式且所有unit都在同一个句子中（sid都是1）
    const isDialogueInOneSentence = units.length > 0 && units.every(u => u.sid === 1) && 
                                   text.includes('A:') && text.includes('B:');
    
    if (isDialogueInOneSentence) {
      console.warn('ACU数据异常，回退到显示原文:', {
        dialogueInOneSentence: isDialogueInOneSentence,
        unitsCount: units.length,
        textLength: text.length
      });
      
      // 处理对话格式换行
      let formattedText = text;
      if ((lang === 'ko' || lang === 'en') && formattedText.includes('A:') && formattedText.includes('B:') && !formattedText.includes('\n')) {
        // 在 B: 前添加换行符
        formattedText = formattedText.replace(/\s+B:/g, '\nB:');
        // 在 A: 前添加换行符（除了第一个）
        formattedText = formattedText.replace(/([^A])\s+A:/g, '$1\nA:');
      }
      
      return (
        <div className="text-gray-700 whitespace-pre-wrap">
          {formattedText.split('\n').map((line, i) => (
            <div key={i} className="mb-2">{line}</div>
          ))}
        </div>
      );
    }
    
    // 如果ACU数据异常（只有对话标识符等），回退到显示原文
    const hasValidAcuData = units.length > 2 && units.some(u => u.span.length > 3);
    
    if (!hasValidAcuData) {
      console.warn('ACU数据异常，回退到显示原文:', units);
      
      // 处理对话格式换行
      let formattedText = text;
      if ((lang === 'ko' || lang === 'en') && formattedText.includes('A:') && formattedText.includes('B:') && !formattedText.includes('\n')) {
        // 在 B: 前添加换行符
        formattedText = formattedText.replace(/\s+B:/g, '\nB:');
        // 在 A: 前添加换行符（除了第一个）
        formattedText = formattedText.replace(/([^A])\s+A:/g, '$1\nA:');
      }
      
      return (
        <div className="text-gray-700 whitespace-pre-wrap">
          {formattedText.split('\n').map((line, i) => (
            <div key={i} className="mb-2">{line}</div>
          ))}
        </div>
      );
    }
    
    // 处理对话格式换行 - 在ACU渲染之前
    let processedText = text;
    if ((lang === 'ko' || lang === 'en') && processedText.includes('A:') && processedText.includes('B:') && !processedText.includes('\n')) {
      // 在 B: 前添加换行符
      processedText = processedText.replace(/\s+B:/g, '\nB:');
      // 在 A: 前添加换行符（除了第一个）
      processedText = processedText.replace(/([^A])\s+A:/g, '$1\nA:');
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
      
      // 扩展句子结束位置以包含句尾标点符号（仅匹配当前位置之后的前缀）
      const remainingText = processedText.slice(sentenceEnd);
      const trailing = remainingText.match(/^[。！？；.!?…\s]+/);
      if (trailing) {
        sentenceEnd += trailing[0].length;
      }
      
      // 获取该句的原文（用于调试，暂时注释）
      // const sentenceText = processedText.slice(sentenceStart, sentenceEnd);
      
      // 基于原文逐字符渲染
      let currentPos = sentenceStart;
      const elements: React.ReactElement[] = [];
      
      for (let i = 0; i < sortedUnits.length; i++) {
        const unit = sortedUnits[i];
        const unitIndex = unit.index;
        
        // 添加unit之前的内容（如果有）
        if (unit.start > currentPos) {
          const beforeText = processedText.slice(currentPos, unit.start);
          if (beforeText) {
            // 仅在间隙完全由空白或标点组成时渲染，避免与下一个 unit 重复字母
            const isOnlyPunctOrSpace = /^[\s\p{P}\p{S}]+$/u.test(beforeText);
            if (isOnlyPunctOrSpace) {
              elements.push(
                <span key={`before-${i}`} className="text-gray-700">
                  {beforeText}
                </span>
              );
            }
          }
        }
        
        // 添加unit内容
        const isSelected = selectedUnits.some(su => su.index === unitIndex);
        const isNonSelectableUnit = isNonSelectable(unit);
        const isAlreadySelectedWord = isAlreadySelected(unit);
        
        // 不再跳过单字母块，保证缩写如 I'm / it's 能完整显示
        const shouldSkipUnit = unit.span.length === 0;
        
        if (!shouldSkipUnit) {
          elements.push(
            <span
              key={`unit-${i}`}
              onClick={() => handleUnitClick(unit, unitIndex)}
              onTouchStart={(e) => {
                // 防止触摸时触发双击缩放
                e.preventDefault();
              }}
              onTouchEnd={(e) => {
                // 处理触摸结束事件
                e.preventDefault();
                e.stopPropagation();
                handleUnitClick(unit, unitIndex);
              }}
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
        }
        
        currentPos = unit.end;
      }
      
      // 添加最后一个unit之后的内容（如果有）
      if (currentPos < sentenceEnd) {
        const afterText = processedText.slice(currentPos, sentenceEnd);
        if (afterText) {
          // 仅在间隙完全由空白或标点组成时渲染
          const isOnlyPunctOrSpace = /^[\s\p{P}\p{S}]+$/u.test(afterText);
          if (isOnlyPunctOrSpace) {
            elements.push(
              <span key={`after-${sid}`} className="text-gray-700">
                {afterText}
              </span>
            );
          }
        }
      }
      
      return (
        <div key={sid} className="mb-2">
          {elements}
        </div>
      );
    });
  };


  return (
    <div className="space-y-4">
      {/* ACU 块显示 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600 mb-2">
          {units.length > 0 && units.every(u => u.sid === 1) && text.includes('A:') && text.includes('B:') ? (
            <>
              <span className="text-orange-600 font-medium">⚠️ ACU数据异常，已回退到原文显示模式</span>
              <br />
              <span className="text-xs text-gray-500">
                💡 当前显示原文，请使用自由框选模式选择生词
              </span>
            </>
          ) : (
            <>
              点击选择 ACU 块（仅限同句相邻块）:
              <br />
              <span className="text-xs text-gray-500">
                💡 灰色块（A:、B:、标点符号）不可选中，但会在合并时自动包含
              </span>
            </>
          )}
        </div>
        <div className="whitespace-pre-wrap text-base leading-relaxed">
          {units.length === 0 ? (
            <div className="text-gray-500">没有ACU数据</div>
          ) : (
            renderTextWithUnits()
          )}
        </div>
      </div>

      {/* 选中状态显示 - 采用和自由框选模式相同的样式 */}
      {selectedUnits.length > 0 && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm">
            <div className="font-medium text-gray-800 mb-1">已选择的文本：</div>
            <div className="text-blue-600 font-semibold mb-1">
              {getMergedText()}
            </div>
            <div className="text-xs text-gray-600 mb-2">
              {getContext()}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleConfirm}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {t.shadowing.acu_text.confirm_add_to_vocab}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
              >
                {t.shadowing.acu_text.cancel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
