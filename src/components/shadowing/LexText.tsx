'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

// Token type from lex profile analyzer
export interface LexToken {
    token: string;           // 词汇表面形式
    lemma: string;
    pos: string;
    originalLevel: string;   // JLPT 等级
    broadCEFR: 'A1_A2' | 'B1_B2' | 'C1_plus' | 'unknown';
    isContentWord: boolean;
    compoundGrammar?: string;
    frequencyRank?: number;
    charStart?: number;      // 注意：这个偏移量可能不准确
    charEnd?: number;
}

interface LexTextProps {
    text: string;
    lang: 'zh' | 'en' | 'ja' | 'ko';
    tokenList: LexToken[];
    onConfirm: (mergedText: string, context: string, jlptLevel: string) => void;
    selectedWords?: Array<{ word: string; context: string }>;
    wordPredictions?: Map<string, { probability: number; confidence: 'high' | 'medium' | 'low' }>;
}

interface SelectedToken {
    token: LexToken;
    index: number;
}

export default function LexText({ text, lang, tokenList, onConfirm, selectedWords = [], wordPredictions }: LexTextProps) {
    const [selectedTokens, setSelectedTokens] = useState<SelectedToken[]>([]);
    const [editedText, setEditedText] = useState<string>('');
    const { t } = useLanguage();

    // 预计算所有需要高亮的单元索引
    const highlightedIndices = useMemo(() => {
        const indices = new Set<number>();
        if (!tokenList.length || !selectedWords.length) return indices;

        for (const { word } of selectedWords) {
            if (!word) continue;
            // 简单匹配：检查连续 token 是否组成目标词
            for (let i = 0; i < tokenList.length; i++) {
                let combined = '';
                for (let j = i; j < tokenList.length && combined.length < word.length + 10; j++) {
                    combined += tokenList[j].token;
                    if (combined === word) {
                        for (let k = i; k <= j; k++) indices.add(k);
                        break;
                    }
                }
            }
        }
        return indices;
    }, [tokenList, selectedWords]);

    const isAlreadySelected = useCallback((index: number) => {
        return highlightedIndices.has(index);
    }, [highlightedIndices]);

    // 处理块点击
    const handleTokenClick = useCallback((token: LexToken, index: number) => {
        setSelectedTokens(prev => {
            const existingIndex = prev.findIndex(st => st.index === index);

            if (existingIndex >= 0) {
                return prev.filter((_, i) => i !== existingIndex);
            } else {
                // 检查是否与已选中的块相邻
                if (prev.length > 0) {
                    const lastSelected = prev[prev.length - 1];
                    const isAdjacent = Math.abs(index - lastSelected.index) === 1;

                    if (!isAdjacent) {
                        toast.error(t.shadowing.acu_text.select_adjacent_units);
                        return prev;
                    }
                }

                return [...prev, { token, index }];
            }
        });
    }, [t]);

    // 获取合并后的文本
    const getMergedText = useCallback(() => {
        if (selectedTokens.length === 0) return '';
        const sortedTokens = [...selectedTokens].sort((a, b) => a.index - b.index);
        return sortedTokens.map(st => st.token.token).join('');
    }, [selectedTokens]);

    // 获取 JLPT 等级
    const getJlptLevel = useCallback(() => {
        if (selectedTokens.length === 0) return 'Unknown';
        const levels = selectedTokens.map(st => st.token.originalLevel);
        if (levels.some(l => l.includes('N1'))) return 'N1';
        if (levels.some(l => l.includes('N2'))) return 'N2';
        if (levels.some(l => l.includes('N3'))) return 'N3';
        if (levels.some(l => l.includes('N4'))) return 'N4';
        if (levels.some(l => l.includes('N5'))) return 'N5';
        return levels[0] || 'Unknown';
    }, [selectedTokens]);

    // 获取上下文


    // 预处理文本：处理对话格式换行（统一逻辑）
    const processedText = useMemo(() => {
        let textToProcess = text;
        if ((lang === 'ko' || lang === 'en' || lang === 'ja') && textToProcess.includes('A:') && textToProcess.includes('B:') && !textToProcess.includes('\n')) {
            textToProcess = textToProcess.replace(/\s+B:/g, '\nB:');
            textToProcess = textToProcess.replace(/([^A])\s+A:/g, '$1\nA:');
        }
        return textToProcess;
    }, [text, lang]);

    // 计算每个token在原文中的位置范围
    const tokenRanges = useMemo(() => {
        if (!tokenList.length) return [];

        const ranges: Array<{ start: number; end: number; tokenIndex: number }> = [];
        const lowerText = processedText.toLowerCase();
        let currentPos = 0;

        tokenList.forEach((token, index) => {
            const tokenText = token.token.toLowerCase();
            // 在当前位置之后寻找token
            const matchIndex = lowerText.indexOf(tokenText, currentPos);

            if (matchIndex !== -1 && matchIndex < currentPos + 50) { // 限制查找范围，防止跨度过大匹配错误
                ranges.push({
                    start: matchIndex,
                    end: matchIndex + token.token.length,
                    tokenIndex: index
                });
                currentPos = matchIndex + token.token.length;
            } else {
                // 如果找不到（可能是标点差异等），尝试跳过
                // 这种情况下该token可能无法正确映射，或者我们简单地略过它
                // console.warn(`Token not found in text: ${token.token}`);
            }
        });

        return ranges;
    }, [processedText, tokenList]);

    // 获取上下文 - 从原文中提取完整句子
    const getContext = useCallback(() => {
        if (selectedTokens.length === 0 || tokenRanges.length === 0) return '';

        const sortedSelectedIndices = selectedTokens.map(st => st.index).sort((a, b) => a - b);
        const firstTokenIndex = sortedSelectedIndices[0];
        const lastTokenIndex = sortedSelectedIndices[sortedSelectedIndices.length - 1];

        // 找到对应的原文范围
        const startRange = tokenRanges.find(r => r.tokenIndex === firstTokenIndex);
        const endRange = tokenRanges.find(r => r.tokenIndex === lastTokenIndex);

        if (!startRange || !endRange) {
            // 回退到旧逻辑（仅作为防御性编程）
            const contextStart = Math.max(0, firstTokenIndex - 5);
            const contextEnd = Math.min(tokenList.length - 1, lastTokenIndex + 5);
            return tokenList.slice(contextStart, contextEnd + 1).map(t => t.token).join(' ');
        }

        // 在原文中向前后查找句子边界
        const sentenceSplitters = /[.!?:;。\！\？\n]/;

        // 向前查找
        let sentenceStart = startRange.start;
        // 限制回溯字符数，防止性能问题
        const maxLookBack = 150;
        let lookedBack = 0;

        while (sentenceStart > 0 && lookedBack < maxLookBack) {
            const char = processedText[sentenceStart - 1];
            if (sentenceSplitters.test(char)) {
                // 找到了上一个句子的结束符，但不包含它
                break;
            }
            sentenceStart--;
            lookedBack++;
        }

        // 如果是因为 maxLookBack 停止，尝试找一个空格作为妥协
        if (lookedBack >= maxLookBack) {
            const spaceIndex = processedText.lastIndexOf(' ', startRange.start - 50);
            if (spaceIndex !== -1 && spaceIndex > sentenceStart) sentenceStart = spaceIndex + 1;
        }

        // 处理对话标识符 A: / B: (如果是行首)
        // 检查 sentenceStart 前面是否有 "A: " 或 "B: "
        const potentialSpeakerStart = Math.max(0, sentenceStart - 4);
        const prefix = processedText.slice(potentialSpeakerStart, sentenceStart);
        if (/[ABab][:：]\s*$/.test(prefix)) {
            // 包含 speaker
            const match = prefix.match(/[ABab][:：]\s*$/);
            if (match) sentenceStart -= match[0].length;
        }


        // 向后查找
        let sentenceEnd = endRange.end;
        const maxLookForward = 150;
        let lookedForward = 0;

        while (sentenceEnd < processedText.length && lookedForward < maxLookForward) {
            const char = processedText[sentenceEnd];
            if (sentenceSplitters.test(char)) {
                // 包含了当前句子的结束符
                sentenceEnd++;
                break;
            }
            sentenceEnd++;
            lookedForward++;
        }

        if (lookedForward >= maxLookForward) {
            const spaceIndex = processedText.indexOf(' ', endRange.end + 50);
            if (spaceIndex !== -1 && spaceIndex < sentenceEnd) sentenceEnd = spaceIndex;
        }

        return processedText.slice(sentenceStart, sentenceEnd).trim();
    }, [selectedTokens, tokenRanges, processedText, tokenList]);

    useEffect(() => {
        const mergedText = getMergedText();
        setEditedText(mergedText);
    }, [getMergedText]);

    const handleConfirm = useCallback(() => {
        const context = getContext();
        const jlptLevel = getJlptLevel();

        if (editedText.trim() && context) {
            onConfirm(editedText.trim(), context, jlptLevel);
            setSelectedTokens([]);
            setEditedText('');
        }
    }, [editedText, getContext, getJlptLevel, onConfirm]);

    const handleCancel = useCallback(() => {
        setSelectedTokens([]);
        setEditedText('');
    }, []);

    // 简化渲染：直接渲染原文，用token作为可点击区域覆盖在上面
    // 方法：在原文中找到每个token的位置，并渲染
    const renderTextWithTokens = () => {
        if (!tokenList.length) {
            return <div className="text-gray-500">暂无分词数据</div>;
        }

        // 使用预处理后的文本进行渲染，逻辑与之前不同
        // 我们利用计算好的 tokenRanges 来渲染

        const elements: React.ReactNode[] = [];
        let lastPos = 0;

        // 按行分割 processedText 以便处理换行显示
        // 但为了保持 token 可点击，我们需要更精细的控制
        // 这里采用一种混合策略：遍历 processedText，根据 tokenRanges 插入 token 元素

        // 为了支持换行，我们按行处理
        const lines = processedText.split('\n');
        let currentTokenIndex = 0;
        let globalPos = 0;

        return lines.map((line, lineIdx) => {
            const lineStartPos = globalPos;
            const lineEndPos = globalPos + line.length;
            const lineElements: React.ReactNode[] = [];

            let currentLinePos = 0; // 相对于当前行的位置

            while (currentLinePos < line.length) {
                // 检查当前是否有 token 在这个位置开始
                const currentGlobalStart = lineStartPos + currentLinePos;

                // 找到起始位置 >= currentGlobalStart 的第一个 token range
                // tokenRanges 是按顺序的
                let range: { start: number; end: number; tokenIndex: number } | undefined;

                // 优化查找：从 currentTokenIndex 开始找
                for (let i = currentTokenIndex; i < tokenRanges.length; i++) {
                    if (tokenRanges[i].start >= currentGlobalStart) {
                        // 找到了最近的一个 token (可能是当前位置，也可能是之后)
                        // 还要确保这个 token 在当前行内开始
                        if (tokenRanges[i].start < lineEndPos) {
                            range = tokenRanges[i];
                            currentTokenIndex = i; // 更新索引，下次从这里开始
                        }
                        break; // 只要找到第一个 >= 的就行
                    }
                }

                if (range && range.start === currentGlobalStart) {
                    // 这是一个 token 的开始
                    const token = tokenList[range.tokenIndex];
                    const displayTokenText = line.slice(currentLinePos, currentLinePos + (range.end - range.start));

                    const isSelected = selectedTokens.some(st => st.index === range!.tokenIndex);
                    const isAlreadySelectedWord = isAlreadySelected(range!.tokenIndex);
                    const prediction = wordPredictions?.get(token.token);
                    const isPredictedUnknown = prediction && prediction.probability < 0.5;
                    const predictionColor = prediction
                        ? prediction.probability < 0.3 ? 'border-red-500'
                            : prediction.probability < 0.5 ? 'border-orange-400'
                                : prediction.probability < 0.7 ? 'border-yellow-400'
                                    : 'border-green-400'
                        : '';
                    const freqDisplay = token.frequencyRank
                        ? token.frequencyRank <= 500 ? '常用'
                            : token.frequencyRank <= 2000 ? '较常用'
                                : token.frequencyRank <= 5000 ? '不常用'
                                    : '罕见'
                        : '';

                    // 捕获循环变量
                    const idx = range.tokenIndex;

                    lineElements.push(
                        <span
                            key={`token-${lineIdx}-${idx}`}
                            onClick={() => handleTokenClick(token, idx)}
                            onTouchStart={(e) => e.preventDefault()}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTokenClick(token, idx);
                            }}
                            className={`
                  inline-block px-1 py-0.5 mx-0.5 rounded transition-all
                  touch-manipulation select-none
                  ${isSelected
                                    ? 'bg-blue-500 text-white border-blue-600 shadow-md cursor-pointer'
                                    : isAlreadySelectedWord
                                        ? 'bg-yellow-200 text-yellow-800 border-yellow-400 hover:bg-yellow-300 cursor-pointer'
                                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 cursor-pointer'
                                }
                  ${isPredictedUnknown && !isSelected && !isAlreadySelectedWord ? `border-b-2 border-dashed ${predictionColor}` : ''}
                `}
                            title={`${displayTokenText} (${token.lemma}) - ${token.originalLevel} - ${token.pos}${token.frequencyRank ? ` | #${token.frequencyRank} ${freqDisplay}` : ''}${prediction ? ` | 预测: ${Math.round(prediction.probability * 100)}%` : ''}`}
                        >
                            {displayTokenText}
                        </span>
                    );

                    currentLinePos += (range.end - range.start);
                    // 移动到下一个 token (虽然循环会自动处理，但逻辑上 currentTokenIndex 指向下一个)
                    currentTokenIndex++;
                } else {
                    // 当前位置不是 token 的开始，输出普通文本直到下一个 token 或行尾
                    let nextStop = line.length; // 默认直到行尾
                    if (range) {
                        // 如果这行后面还有 token，直到那个 token 的开始
                        nextStop = range.start - lineStartPos;
                    }

                    const textSegment = line.slice(currentLinePos, nextStop);
                    if (textSegment) {
                        lineElements.push(<span key={`text-${lineIdx}-${currentLinePos}`} className="text-gray-700">{textSegment}</span>);
                    }
                    currentLinePos = nextStop;
                }
            }

            globalPos += line.length + 1; // +1 用于换行符

            return (
                <div key={`line-${lineIdx}`} className="mb-2">
                    {lineElements}
                </div>
            );
        });
    };


    return (
        <div className="space-y-4">
            {/* 词汇块显示 */}
            <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">
                    点击选择词汇（仅限相邻块）:
                    <br />
                    <span className="text-xs text-gray-500">
                        💡 悬浮显示 JLPT 等级和词频
                    </span>
                </div>
                <div className="whitespace-pre-wrap text-base leading-relaxed">
                    {renderTextWithTokens()}
                </div>
            </div>

            {/* 选中状态显示 */}
            {selectedTokens.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="text-sm">
                        <div className="font-medium text-gray-800 mb-1">已选择的文本：</div>
                        <input
                            type="text"
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="w-full px-2 py-1 text-blue-600 font-semibold mb-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <div className="text-xs text-gray-600 mb-1">
                            等级: <span className="font-medium">{getJlptLevel()}</span>
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                            {getContext()}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleConfirm}
                                disabled={!editedText.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
