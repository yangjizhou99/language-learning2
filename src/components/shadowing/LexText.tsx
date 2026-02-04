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
    const getContext = useCallback(() => {
        if (selectedTokens.length === 0) return '';
        const sortedTokens = [...selectedTokens].sort((a, b) => a.index - b.index);
        const firstIndex = sortedTokens[0].index;
        const lastIndex = sortedTokens[sortedTokens.length - 1].index;

        // 获取前后5个token作为上下文
        const contextStart = Math.max(0, firstIndex - 5);
        const contextEnd = Math.min(tokenList.length - 1, lastIndex + 5);

        return tokenList.slice(contextStart, contextEnd + 1).map(t => t.token).join('');
    }, [selectedTokens, tokenList]);

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

        // 处理对话格式换行
        let processedText = text;
        if ((lang === 'ko' || lang === 'en' || lang === 'ja') && processedText.includes('A:') && processedText.includes('B:') && !processedText.includes('\n')) {
            processedText = processedText.replace(/\s+B:/g, '\nB:');
            processedText = processedText.replace(/([^A])\s+A:/g, '$1\nA:');
        }

        // 按行分割处理
        const lines = processedText.split('\n');

        // 为每个token在原文中找到实际位置
        let tokenIndex = 0;
        const result: React.ReactElement[] = [];

        lines.forEach((line, lineIdx) => {
            if (lineIdx > 0) {
                result.push(<br key={`br-${lineIdx}`} />);
            }

            // 在这一行中寻找并渲染token
            let linePos = 0;
            const lineElements: React.ReactElement[] = [];

            while (linePos < line.length && tokenIndex < tokenList.length) {
                const token = tokenList[tokenIndex];
                const tokenText = token.token;

                // 在当前行中寻找这个token（忽略大小写）
                const lineSubset = line.slice(linePos);
                const matchIndex = lineSubset.toLowerCase().indexOf(tokenText.toLowerCase());
                const foundPos = matchIndex === -1 ? -1 : linePos + matchIndex;

                if (foundPos === -1 || foundPos > linePos + 10) {
                    // token不在这一行，或者距离太远，输出当前位置的字符然后继续
                    if (linePos < line.length) {
                        // 检查是否是标点或空格
                        const char = line[linePos];
                        lineElements.push(
                            <span key={`char-${lineIdx}-${linePos}`} className="text-gray-700">
                                {char}
                            </span>
                        );
                        linePos++;
                    }

                    // 如果到达行尾但token还没找到，说明token在下一行
                    if (linePos >= line.length) {
                        break;
                    }
                    continue;
                }

                // 输出token之前的内容（标点、空格等）
                if (foundPos > linePos) {
                    const beforeText = line.slice(linePos, foundPos);
                    lineElements.push(
                        <span key={`before-${lineIdx}-${linePos}`} className="text-gray-700">
                            {beforeText}
                        </span>
                    );
                }

                // 提取原文中的文本用于显示（保留原有大小写）
                const displayTokenText = line.substring(foundPos, foundPos + tokenText.length);

                // 渲染token
                const isSelected = selectedTokens.some(st => st.index === tokenIndex);
                const isAlreadySelectedWord = isAlreadySelected(tokenIndex);

                const prediction = wordPredictions?.get(tokenText);
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

                const currentTokenIndex = tokenIndex; // 捕获当前值
                lineElements.push(
                    <span
                        key={`token-${lineIdx}-${tokenIndex}`}
                        onClick={() => handleTokenClick(token, currentTokenIndex)}
                        onTouchStart={(e) => e.preventDefault()}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTokenClick(token, currentTokenIndex);
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

                linePos = foundPos + tokenText.length;
                tokenIndex++;
            }

            // 输出行尾剩余内容
            if (linePos < line.length) {
                const remaining = line.slice(linePos);
                lineElements.push(
                    <span key={`end-${lineIdx}`} className="text-gray-700">
                        {remaining}
                    </span>
                );
            }

            result.push(
                <div key={`line-${lineIdx}`} className="mb-2">
                    {lineElements}
                </div>
            );
        });

        return <>{result}</>;
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
