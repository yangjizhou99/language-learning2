'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RepairRequest, RepairResponse } from '@/lib/nlp/repair-service';

type Lang = 'en' | 'ja' | 'zh';

interface ShadowingItem {
    id: string;
    title: string;
    text: string;
    lang: string;
}

interface GrammarProfileResult {
    total: number;
    byLevel: Record<string, number>;
    patterns: Array<{
        pattern: string;
        level: string;
        definition: string;
    }>;
    hardestGrammar: string | null;
    unrecognizedGrammar: string[];
}

interface LexProfileResult {
    tokens: number;
    uniqueTokens: number;
    contentWordCount: number;
    functionWordCount: number;
    lexProfile: {
        A1_A2: number;
        B1_B2: number;
        C1_plus: number;
        unknown: number;
    };
    grammarProfile?: GrammarProfileResult;
    lexProfileForDB: {
        A1_A2: number;
        B1_B2: number;
        C1_plus: number;
    };
    details: {
        tokenList: Array<{ token: string; lemma: string; pos: string; originalLevel: string; broadCEFR: 'A1_A2' | 'B1_B2' | 'C1_plus' | 'unknown'; isContentWord: boolean; compoundGrammar?: string }>;
        unknownTokens: string[];
        coverage: number;
        grammarTokens: string[];
    };
    dictionarySize: number;
}

const testCases: Array<{ name: string; text: string; lang: Lang; description: string }> = [
    {
        name: '英文对话 (简单)',
        text: 'Hello! My name is John. I like to read books and watch movies. What is your favorite food?',
        lang: 'en',
        description: 'Simple English dialogue with basic vocabulary',
    },
    {
        name: '英文新闻 (中级)',
        text: 'The rapid advancement of artificial intelligence has revolutionized numerous industries. Machine learning algorithms can now process vast amounts of data with unprecedented accuracy.',
        lang: 'en',
        description: 'English tech news with intermediate vocabulary',
    },
    {
        name: '日文对话 (简单)',
        text: 'こんにちは。私は田中です。今日は天気がいいですね。何を食べますか。',
        lang: 'ja',
        description: 'Simple Japanese greeting and daily conversation',
    },
    {
        name: '日文商务 (中级)',
        text: '会議の準備をしています。資料を確認して、問題があれば連絡してください。来週の予定について相談したいです。',
        lang: 'ja',
        description: 'Japanese business conversation with intermediate vocabulary',
    },
    {
        name: '中文对话 (简单)',
        text: '你好！我是学生。我喜欢吃水果和看电影。你呢？明天我们一起去买东西吧。',
        lang: 'zh',
        description: 'Simple Chinese daily conversation',
    },
    {
        name: '中文新闻 (中级)',
        text: '随着科技的发展，人工智能已经在各个领域产生了深远的影响。经济增长带来了更多的就业机会，社会结构也在不断变化。',
        lang: 'zh',
        description: 'Chinese news article with intermediate vocabulary',
    },
];

export default function LexProfileTestPage() {
    const [lang, setLang] = useState<Lang>('ja');
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<LexProfileResult | null>(null);
    const [isRepairing, setIsRepairing] = useState(false);
    const [repairResult, setRepairResult] = useState<RepairResponse | null>(null);
    const [dbItems, setDbItems] = useState<ShadowingItem[]>([]);
    const [loadingDbItems, setLoadingDbItems] = useState(false);

    // New state for LLM level assignment
    const [isAssigningLevels, setIsAssigningLevels] = useState(false);
    const [llmLevelResult, setLlmLevelResult] = useState<{
        vocab_entries: Array<{ surface: string; reading: string; definition: string; jlpt: string }>;
        grammar_chunks: Array<{ surface: string; canonical: string; jlpt: string; definition?: string }>;
        confidence: number;
    } | null>(null);
    const [isSavingRules, setIsSavingRules] = useState(false);
    const [savedRulesCount, setSavedRulesCount] = useState<{ vocab: number; grammar: number }>({ vocab: 0, grammar: 0 });

    // Japanese tokenizer selection
    const [jaTokenizer, setJaTokenizer] = useState<'kuromoji' | 'tinysegmenter' | 'budoux'>('kuromoji');

    // Japanese vocabulary dictionary selection
    const [jaVocabDict, setJaVocabDict] = useState<'default' | 'elzup' | 'tanos' | 'combined'>('combined');

    // Japanese grammar dictionary selection
    const [jaGrammarDict, setJaGrammarDict] = useState<'yapan' | 'hagoromo' | 'combined'>('combined');

    // === Batch LLM Level Assignment State ===
    interface BatchScanResult {
        totalItems: number;
        analyzedItems: number;
        unknownVocab: Array<{ token: string; lemma: string; pos: string; count: number; contexts: string[] }>;
        unmatchedGrammar: Array<{ token: string; lemma: string; pos: string; count: number; contexts: string[] }>;
        currentCoverage: { vocab: number; grammar: number };
        stats: { totalVocabTokens: number; vocabWithLevel: number; totalGrammarTokens: number; grammarWithLevel: number };
    }
    interface SavedRule {
        level: string;
        reading?: string;
        definition?: string;
        canonical?: string;
        source: 'llm';
        createdAt: string;
    }
    const [showBatchPanel, setShowBatchPanel] = useState(false);
    const [isBatchScanning, setIsBatchScanning] = useState(false);
    const [batchScanResult, setBatchScanResult] = useState<BatchScanResult | null>(null);
    const [isBatchAssigning, setIsBatchAssigning] = useState(false);
    const [batchAssignProgress, setBatchAssignProgress] = useState({ current: 0, total: 0, saved: 0 });
    const [showRulesPanel, setShowRulesPanel] = useState(false);
    const [showUnmatchedPanel, setShowUnmatchedPanel] = useState(false);
    const [savedRules, setSavedRules] = useState<{ vocab: Record<string, SavedRule>; grammar: Record<string, SavedRule> } | null>(null);
    const [loadingRules, setLoadingRules] = useState(false);

    useEffect(() => {
        const fetchDbItems = async () => {
            setLoadingDbItems(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const res = await fetch('/api/admin/shadowing/items', {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Handle both array and paginated response formats
                    const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
                    setDbItems(items);
                }
            } catch (error) {
                console.error('Failed to fetch DB items:', error);
            } finally {
                setLoadingDbItems(false);
            }
        };
        fetchDbItems();
    }, []);

    const handleAnalyze = async () => {
        if (!text.trim()) {
            toast.error('请输入文本');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('请先登录');
                setLoading(false);
                return;
            }

            const res = await fetch('/api/admin/lex-profile-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ text, lang, jaTokenizer, jaVocabDict, jaGrammarDict }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '分析失败');
            }

            setResult(data.result);
            toast.success('分析完成');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            toast.error('分析失败: ' + message);
        } finally {
            setLoading(false);
        }
    };

    const handleRepair = async () => {
        if (!result) return;
        setIsRepairing(true);
        setRepairResult(null); // Reset

        try {
            const baseRequest = {
                text,
                tokens: result.details.tokenList,
                unknownTokens: result.details.unknownTokens,
                unrecognizedGrammar: result.grammarProfile?.unrecognizedGrammar,
            };

            // 1. Token Repair
            if (result.details.unknownTokens.length > 0) {
                toast.info('正在修复粘连 Token...');
                const res1 = await fetch('/api/nlp/repair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...baseRequest, task: 'token_repair' }),
                });
                const data1 = await res1.json();
                setRepairResult(prev => ({ ...prev, ...data1, repairs: data1.repairs || [] }));
            }

            // 2. Vocab Definition
            if (result.details.unknownTokens.length > 0) {
                toast.info('正在分析生词...');
                const res2 = await fetch('/api/nlp/repair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...baseRequest, task: 'vocab_definition' }),
                });
                const data2 = await res2.json();
                setRepairResult(prev => ({ ...prev, ...data2, vocab_entries: data2.vocab_entries || [] }));
            }

            // 3. Grammar Analysis
            if (result.grammarProfile?.unrecognizedGrammar && result.grammarProfile.unrecognizedGrammar.length > 0) {
                toast.info('正在分析语法块...');
                const res3 = await fetch('/api/nlp/repair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...baseRequest, task: 'grammar_analysis' }),
                });
                const data3 = await res3.json();
                setRepairResult(prev => ({ ...prev, ...data3, grammar_chunks: data3.grammar_chunks || [] }));
            }

            toast.success('所有修复任务完成');
        } catch (error) {
            console.error('Repair error:', error);
            toast.error('修复过程中断');
        } finally {
            setIsRepairing(false);
        }
    };





    const handleLevelAssignment = async () => {
        if (!result) return;
        setIsAssigningLevels(true);
        setLlmLevelResult(null);

        try {
            const hasUnknownVocab = result.details.unknownTokens.length > 0;

            // Collect grammar tokens without specific levels (just "grammar" instead of "grammar (Nx)")
            const grammarWithoutLevel = result.details.tokenList
                .filter(t => t.originalLevel === 'grammar')  // Just "grammar", no level
                .map(t => t.token);
            const uniqueGrammarWithoutLevel = [...new Set(grammarWithoutLevel)];

            // Combine with unrecognizedGrammar patterns from grammarProfile
            const allUnrecognizedGrammar = [
                ...uniqueGrammarWithoutLevel,
                ...(result.grammarProfile?.unrecognizedGrammar || [])
            ];
            const uniqueUnrecognizedGrammar = [...new Set(allUnrecognizedGrammar)];

            const hasUnknownGrammar = uniqueUnrecognizedGrammar.length > 0;

            if (!hasUnknownVocab && !hasUnknownGrammar) {
                toast.info('没有需要分配等级的未知项');
                return;
            }

            // Build context snippets for each unknown item (about 1 sentence around it)
            const buildContextSnippet = (targetToken: string, fullText: string): string => {
                const idx = fullText.indexOf(targetToken);
                if (idx === -1) return targetToken;

                // Get surrounding context (up to 20 chars before and after, try to end at sentence boundaries)
                const contextRadius = 25;
                let start = Math.max(0, idx - contextRadius);
                let end = Math.min(fullText.length, idx + targetToken.length + contextRadius);

                // Try to find sentence boundaries (。、！？)
                const sentenceEndChars = ['。', '！', '？', '、', '\n'];

                // Extend start to previous sentence boundary if close
                for (let i = idx - 1; i >= start; i--) {
                    if (sentenceEndChars.includes(fullText[i])) {
                        start = i + 1;
                        break;
                    }
                }

                // Extend end to next sentence boundary if close
                for (let i = idx + targetToken.length; i < end; i++) {
                    if (sentenceEndChars.includes(fullText[i])) {
                        end = i + 1;
                        break;
                    }
                }

                const prefix = start > 0 ? '...' : '';
                const suffix = end < fullText.length ? '...' : '';
                return `${prefix}${fullText.slice(start, end).trim()}${suffix}`;
            };

            // Build context for unknown vocab tokens
            const unknownTokensWithContext = result.details.unknownTokens.map(token => ({
                token,
                context: buildContextSnippet(token, text)
            }));

            // Build context for unrecognized grammar
            const unrecognizedGrammarWithContext = uniqueUnrecognizedGrammar.map(grammar => ({
                token: grammar,
                context: buildContextSnippet(grammar, text)
            }));

            toast.info(`正在使用 LLM 分配等级... (${result.details.unknownTokens.length} 词汇, ${uniqueUnrecognizedGrammar.length} 语法)`);
            const res = await fetch('/api/nlp/repair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'level_assignment',
                    text: '', // No longer sending full text
                    tokens: result.details.tokenList,
                    unknownTokens: result.details.unknownTokens,
                    unknownTokensWithContext,
                    unrecognizedGrammar: uniqueUnrecognizedGrammar,
                    unrecognizedGrammarWithContext,
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setLlmLevelResult({
                vocab_entries: data.vocab_entries || [],
                grammar_chunks: data.grammar_chunks || [],
                confidence: data.confidence || 0,
            });

            toast.success(`LLM 分配完成：${data.vocab_entries?.length || 0} 词汇，${data.grammar_chunks?.length || 0} 语法`);
        } catch (error) {
            console.error('Level assignment error:', error);
            toast.error('LLM 等级分配失败');
        } finally {
            setIsAssigningLevels(false);
        }
    };

    const handleSaveRules = async () => {
        if (!llmLevelResult) return;
        setIsSavingRules(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('请先登录');
                return;
            }

            const res = await fetch('/api/admin/lex-profile-test/save-rule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    vocabEntries: llmLevelResult.vocab_entries,
                    grammarChunks: llmLevelResult.grammar_chunks,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSavedRulesCount(prev => ({
                vocab: prev.vocab + (data.saved?.vocab || 0),
                grammar: prev.grammar + (data.saved?.grammar || 0),
            }));

            toast.success(data.message || '规则保存成功');
        } catch (error) {
            console.error('Save rules error:', error);
            toast.error('规则保存失败');
        } finally {
            setIsSavingRules(false);
        }
    };

    // === Batch Processing Handlers ===
    const handleBatchScan = async () => {
        setIsBatchScanning(true);
        setBatchScanResult(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('请先登录');
                return;
            }

            toast.info('正在扫描全部题库，请稍候...');
            const res = await fetch('/api/admin/lex-profile-test/batch-scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    jaVocabDict,
                    jaGrammarDict,
                    jaTokenizer
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setBatchScanResult(data);
            toast.success(`扫描完成：${data.unknownVocab.length} 未知词汇, ${data.unmatchedGrammar.length} 未匹配语法`);
        } catch (error) {
            console.error('Batch scan error:', error);
            toast.error('扫描失败');
        } finally {
            setIsBatchScanning(false);
        }
    };

    const handleBatchLevelAssign = async () => {
        if (!batchScanResult) return;
        setIsBatchAssigning(true);

        const allUnknown = [
            ...batchScanResult.unknownVocab.map(v => ({ type: 'vocab' as const, ...v })),
            ...batchScanResult.unmatchedGrammar.map(g => ({ type: 'grammar' as const, ...g })),
        ];

        const batchSize = 30;
        const totalBatches = Math.ceil(allUnknown.length / batchSize);
        setBatchAssignProgress({ current: 0, total: allUnknown.length, saved: 0 });

        let totalSaved = 0;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('请先登录');
                return;
            }

            for (let i = 0; i < allUnknown.length; i += batchSize) {
                const batch = allUnknown.slice(i, i + batchSize);
                const vocabBatch = batch.filter(b => b.type === 'vocab');
                const grammarBatch = batch.filter(b => b.type === 'grammar');

                setBatchAssignProgress(p => ({ ...p, current: i }));

                // Build context for items
                const unknownTokensWithContext = vocabBatch.map(v => ({
                    token: v.token,
                    context: v.contexts[0] || v.token
                }));
                const unrecognizedGrammarWithContext = grammarBatch.map(g => ({
                    token: g.token,
                    context: g.contexts[0] || g.token
                }));

                // Call LLM for level assignment
                const llmRes = await fetch('/api/nlp/repair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task: 'level_assignment',
                        text: '',
                        tokens: [],
                        unknownTokens: vocabBatch.map(v => v.token),
                        unknownTokensWithContext,
                        unrecognizedGrammar: grammarBatch.map(g => g.token),
                        unrecognizedGrammarWithContext,
                    }),
                });

                const llmData = await llmRes.json();
                if (llmData.error) {
                    console.warn(`Batch ${i / batchSize + 1} LLM error:`, llmData.error);
                    continue;
                }

                // Save to rules file
                if ((llmData.vocab_entries?.length > 0) || (llmData.grammar_chunks?.length > 0)) {
                    const saveRes = await fetch('/api/admin/lex-profile-test/save-rule', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                            vocabEntries: llmData.vocab_entries,
                            grammarChunks: llmData.grammar_chunks,
                        }),
                    });
                    const saveData = await saveRes.json();
                    totalSaved += (saveData.saved?.vocab || 0) + (saveData.saved?.grammar || 0);
                    setBatchAssignProgress(p => ({ ...p, saved: totalSaved }));
                }

                // Delay between batches
                await new Promise(r => setTimeout(r, 500));
            }

            setBatchAssignProgress(p => ({ ...p, current: allUnknown.length }));
            toast.success(`批量分配完成！共保存 ${totalSaved} 条规则`);

            // Refresh scan results
            handleBatchScan();
        } catch (error) {
            console.error('Batch assign error:', error);
            toast.error('批量分配过程中出错');
        } finally {
            setIsBatchAssigning(false);
        }
    };

    const handleLoadSavedRules = async () => {
        setLoadingRules(true);
        try {
            const res = await fetch('/api/admin/lex-profile-test/save-rule');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSavedRules({
                vocab: data.vocabRules || {},
                grammar: data.grammarRules || {},
            });
            setShowRulesPanel(true);
        } catch (error) {
            console.error('Load rules error:', error);
            toast.error('加载规则失败');
        } finally {
            setLoadingRules(false);
        }
    };

    const handleDeleteAllRules = async () => {
        if (!confirm('确定要删除所有已保存的补丁规则吗？此操作不可恢复。')) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('请先登录');
                return;
            }

            const res = await fetch('/api/admin/lex-profile-test/save-rule', {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSavedRulesCount({ vocab: 0, grammar: 0 });
            setSavedRules(null);
            setShowRulesPanel(false);
            toast.success(data.message || '规则已清空');
        } catch (error) {
            console.error('Delete rules error:', error);
            toast.error('删除失败');
        }
    };

    const selectTestCase = (testCase: typeof testCases[0]) => {
        setLang(testCase.lang);
        setText(testCase.text);
        setResult(null);
        setLlmLevelResult(null);
    };

    const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'A1_A2': return 'bg-green-500';
            case 'B1_B2': return 'bg-yellow-500';
            case 'C1_plus': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    const getLevelBadgeClass = (level: string) => {
        switch (level) {
            case 'A1_A2': return 'bg-green-100 text-green-800';
            case 'B1_B2': return 'bg-yellow-100 text-yellow-800';
            case 'C1_plus': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <Link href="/" className="text-lg font-semibold text-gray-900">
                            Lang Trainer
                        </Link>
                        <div className="flex items-center space-x-4">
                            <Link href="/admin" className="text-gray-700 hover:text-gray-900">
                                控制台
                            </Link>
                            <span className="text-blue-600 font-medium">词汇难度分析测试</span>
                        </div>
                    </div>
                    <Link href="/admin" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
                        返回控制台
                    </Link>
                </div>
            </nav>

            <div className="p-8 max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Lex Profile 词汇难度分析测试</h1>
                    <p className="text-gray-600">
                        分析文本的词汇难度分布，计算 tokens 数量和 lex_profile（CEFR 等级分布）
                    </p>
                </div>

                {/* === 批量 LLM 等级分配模块 === */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-purple-800 flex items-center gap-2">
                            🎯 LLM 批量等级分配
                            <span className="text-xs font-normal text-gray-500">目标: 100% 覆盖率</span>
                        </h2>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleLoadSavedRules}
                                disabled={loadingRules}
                                variant="outline"
                                size="sm"
                            >
                                {loadingRules ? '加载中...' : `📋 查看补丁列表 ${savedRules ? `(${Object.keys(savedRules.vocab).length + Object.keys(savedRules.grammar).length})` : ''}`}
                            </Button>
                            <Button
                                onClick={() => setShowBatchPanel(!showBatchPanel)}
                                variant="outline"
                                size="sm"
                            >
                                {showBatchPanel ? '收起' : '展开'}
                            </Button>
                        </div>
                    </div>

                    {showBatchPanel && (
                        <div className="space-y-4">
                            {/* Scan and Stats */}
                            <div className="flex gap-4 items-start">
                                <Button
                                    onClick={handleBatchScan}
                                    disabled={isBatchScanning}
                                    className="bg-purple-600 hover:bg-purple-700"
                                >
                                    {isBatchScanning ? '扫描中...' : '🔍 扫描题库'}
                                </Button>

                                {batchScanResult && (
                                    <div className="flex-1 grid grid-cols-4 gap-3">
                                        <div className="bg-white p-3 rounded shadow-sm text-center">
                                            <div className="text-xl font-bold text-blue-600">{batchScanResult.analyzedItems}</div>
                                            <div className="text-xs text-gray-600">分析题目数</div>
                                        </div>
                                        <div className="bg-white p-3 rounded shadow-sm text-center">
                                            <div className="text-xl font-bold text-orange-600">{batchScanResult.unknownVocab.length}</div>
                                            <div className="text-xs text-gray-600">未知词汇</div>
                                        </div>
                                        <div className="bg-white p-3 rounded shadow-sm text-center">
                                            <div className="text-xl font-bold text-pink-600">{batchScanResult.unmatchedGrammar.length}</div>
                                            <div className="text-xs text-gray-600">未匹配语法</div>
                                        </div>
                                        <div className="bg-white p-3 rounded shadow-sm text-center">
                                            <div className="text-xl font-bold text-green-600">{batchScanResult.currentCoverage.vocab.toFixed(1)}%</div>
                                            <div className="text-xs text-gray-600">词汇覆盖率</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Coverage Progress Bar */}
                            {batchScanResult && (
                                <div className="bg-white p-4 rounded shadow-sm">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>词汇覆盖率</span>
                                        <span className="font-mono">{batchScanResult.currentCoverage.vocab.toFixed(2)}%</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                                            style={{ width: `${Math.min(batchScanResult.currentCoverage.vocab, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-sm mt-2">
                                        <span>语法覆盖率</span>
                                        <span className="font-mono">{batchScanResult.currentCoverage.grammar.toFixed(2)}%</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                            style={{ width: `${Math.min(batchScanResult.currentCoverage.grammar, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* LLM Assign Button */}
                            {batchScanResult && (batchScanResult.unknownVocab.length > 0 || batchScanResult.unmatchedGrammar.length > 0) && (
                                <div className="bg-white p-4 rounded shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold">🤖 开始 LLM 批量分配</h4>
                                            <p className="text-sm text-gray-500">
                                                共 {batchScanResult.unknownVocab.length + batchScanResult.unmatchedGrammar.length} 个待处理项，
                                                每批 30 个，约需 {Math.ceil((batchScanResult.unknownVocab.length + batchScanResult.unmatchedGrammar.length) / 30)} 次 API 调用
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleBatchLevelAssign}
                                            disabled={isBatchAssigning}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            {isBatchAssigning ? '处理中...' : '开始分配'}
                                        </Button>
                                    </div>

                                    {isBatchAssigning && (
                                        <div className="mt-4">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>进度: {batchAssignProgress.current} / {batchAssignProgress.total}</span>
                                                <span>已保存: {batchAssignProgress.saved} 条规则</span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 transition-all"
                                                    style={{ width: `${(batchAssignProgress.current / batchAssignProgress.total) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Unmatched Content Preview and Full List Button */}
                            {batchScanResult && (batchScanResult.unknownVocab.length > 0 || batchScanResult.unmatchedGrammar.length > 0) && (
                                <div className="bg-white p-4 rounded shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold">
                                            📊 未匹配内容
                                            <span className="text-sm font-normal text-gray-500 ml-2">
                                                ({batchScanResult.unknownVocab.length} 词汇 + {batchScanResult.unmatchedGrammar.length} 语法)
                                            </span>
                                        </h4>
                                        <Button
                                            onClick={() => setShowUnmatchedPanel(!showUnmatchedPanel)}
                                            variant="outline"
                                            size="sm"
                                        >
                                            {showUnmatchedPanel ? '收起完整列表' : '👁️ 查看完整列表'}
                                        </Button>
                                    </div>
                                    {batchScanResult.unknownVocab.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <span className="text-xs text-gray-500">词汇:</span>
                                            {batchScanResult.unknownVocab.slice(0, 15).map((v, i) => (
                                                <span key={i} className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm">
                                                    {v.token} <span className="text-xs text-gray-500">×{v.count}</span>
                                                </span>
                                            ))}
                                            {batchScanResult.unknownVocab.length > 15 && (
                                                <span className="text-xs text-gray-400">+{batchScanResult.unknownVocab.length - 15}</span>
                                            )}
                                        </div>
                                    )}
                                    {batchScanResult.unmatchedGrammar.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            <span className="text-xs text-gray-500">语法:</span>
                                            {batchScanResult.unmatchedGrammar.slice(0, 15).map((g, i) => (
                                                <span key={i} className="px-2 py-1 bg-pink-100 text-pink-800 rounded text-sm">
                                                    {g.token} <span className="text-xs text-gray-500">×{g.count}</span>
                                                </span>
                                            ))}
                                            {batchScanResult.unmatchedGrammar.length > 15 && (
                                                <span className="text-xs text-gray-400">+{batchScanResult.unmatchedGrammar.length - 15}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Full Unmatched Content Panel */}
                            {showUnmatchedPanel && batchScanResult && (
                                <div className="bg-white p-4 rounded shadow-sm border-2 border-orange-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-lg">📋 未匹配内容完整列表</h4>
                                        <Button onClick={() => setShowUnmatchedPanel(false)} variant="ghost" size="sm">关闭</Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Unknown Vocabulary */}
                                        <div>
                                            <h5 className="font-semibold text-orange-700 mb-2 flex items-center gap-2">
                                                📚 未知词汇
                                                <span className="text-sm font-normal text-gray-500">({batchScanResult.unknownVocab.length})</span>
                                            </h5>
                                            <div className="max-h-80 overflow-y-auto space-y-1 pr-2">
                                                {batchScanResult.unknownVocab.map((v, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 bg-orange-50 rounded text-sm hover:bg-orange-100">
                                                        <div className="flex-1">
                                                            <span className="font-medium">{v.token}</span>
                                                            {v.lemma !== v.token && (
                                                                <span className="text-gray-400 ml-1">({v.lemma})</span>
                                                            )}
                                                            <span className="text-xs text-gray-500 ml-2">{v.pos}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs bg-orange-200 px-1.5 py-0.5 rounded">×{v.count}</span>
                                                            <span className="text-xs text-gray-400 max-w-24 truncate" title={v.contexts.join(', ')}>
                                                                {v.contexts[0]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Unmatched Grammar */}
                                        <div>
                                            <h5 className="font-semibold text-pink-700 mb-2 flex items-center gap-2">
                                                📖 未匹配语法
                                                <span className="text-sm font-normal text-gray-500">({batchScanResult.unmatchedGrammar.length})</span>
                                            </h5>
                                            <div className="max-h-80 overflow-y-auto space-y-1 pr-2">
                                                {batchScanResult.unmatchedGrammar.map((g, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 bg-pink-50 rounded text-sm hover:bg-pink-100">
                                                        <div className="flex-1">
                                                            <span className="font-medium">{g.token}</span>
                                                            <span className="text-xs text-gray-500 ml-2">{g.pos}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs bg-pink-200 px-1.5 py-0.5 rounded">×{g.count}</span>
                                                            <span className="text-xs text-gray-400 max-w-24 truncate" title={g.contexts.join(', ')}>
                                                                {g.contexts[0]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rules Panel */}
                    {showRulesPanel && savedRules && (
                        <div className="mt-4 bg-white p-4 rounded shadow-sm max-h-96 overflow-y-auto">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold">📋 已保存的补丁规则</h4>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleDeleteAllRules}
                                        variant="destructive"
                                        size="sm"
                                        className="h-8"
                                    >
                                        🗑️ 一键删除全部
                                    </Button>
                                    <Button onClick={() => setShowRulesPanel(false)} variant="ghost" size="sm">关闭</Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-600 mb-2">词汇规则 ({Object.keys(savedRules.vocab).length})</h5>
                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                        {Object.entries(savedRules.vocab).slice(0, 50).map(([word, rule]) => (
                                            <div key={word} className="flex justify-between text-sm p-1 bg-gray-50 rounded">
                                                <span>{word}</span>
                                                <span className="text-blue-600">{rule.level}</span>
                                            </div>
                                        ))}
                                        {Object.keys(savedRules.vocab).length > 50 && (
                                            <div className="text-xs text-gray-400 text-center">... 还有 {Object.keys(savedRules.vocab).length - 50} 条</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h5 className="text-sm font-medium text-gray-600 mb-2">语法规则 ({Object.keys(savedRules.grammar).length})</h5>
                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                        {Object.entries(savedRules.grammar).slice(0, 50).map(([word, rule]) => (
                                            <div key={word} className="flex justify-between text-sm p-1 bg-gray-50 rounded">
                                                <span>{word}</span>
                                                <span className="text-purple-600">{rule.level}</span>
                                            </div>
                                        ))}
                                        {Object.keys(savedRules.grammar).length > 50 && (
                                            <div className="text-xs text-gray-400 text-center">... 还有 {Object.keys(savedRules.grammar).length - 50} 条</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 左侧：输入区域 */}
                    <div className="space-y-6">
                        {/* 预设测试用例 */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">预设测试用例</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {testCases.map((tc, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => selectTestCase(tc)}
                                        className={`text-left p-3 rounded-lg border transition-colors hover:border-blue-300 hover:bg-blue-50 ${text === tc.text ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs rounded ${tc.lang === 'en' ? 'bg-blue-100 text-blue-700' :
                                                tc.lang === 'ja' ? 'bg-pink-100 text-pink-700' :
                                                    'bg-orange-100 text-orange-700'
                                                }`}>
                                                {tc.lang === 'en' ? 'EN' : tc.lang === 'ja' ? 'JA' : 'ZH'}
                                            </span>
                                            <span className="font-medium">{tc.name}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">{tc.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 数据库素材 */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">从数据库选择 ({dbItems.length})</h3>
                            {loadingDbItems ? (
                                <div className="text-sm text-gray-500">加载中...</div>
                            ) : (
                                <select
                                    className="w-full p-2 border rounded text-sm"
                                    onChange={(e) => {
                                        const item = dbItems.find(i => i.id === e.target.value);
                                        if (item) {
                                            setText(item.text);
                                            setLang(item.lang as Lang);
                                            setResult(null);
                                        }
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>选择一个素材...</option>
                                    {dbItems.map(item => (
                                        <option key={item.id} value={item.id}>
                                            [{item.lang}] {item.title}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* 自定义输入 */}
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4">自定义测试</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">语言</label>
                                    <select
                                        value={lang}
                                        onChange={(e) => setLang(e.target.value as Lang)}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="en">English (英文)</option>
                                        <option value="ja">日本語 (日文)</option>
                                        <option value="zh">中文</option>
                                    </select>
                                </div>
                                {/* Japanese tokenizer selector - only show when Japanese is selected */}
                                {lang === 'ja' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            日语分词器
                                            <span className="text-xs text-gray-500 ml-2">(可切换对比效果)</span>
                                        </label>
                                        <select
                                            value={jaTokenizer}
                                            onChange={(e) => setJaTokenizer(e.target.value as 'kuromoji' | 'tinysegmenter' | 'budoux')}
                                            className="w-full p-2 border rounded"
                                        >
                                            <option value="kuromoji">Kuromoji (默认，完整形态素分析)</option>
                                            <option value="tinysegmenter">TinySegmenter (轻量级)</option>
                                            <option value="budoux">Budoux (Google ML模型)</option>
                                        </select>
                                    </div>
                                )}
                                {/* Japanese vocabulary dictionary selector */}
                                {lang === 'ja' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                词汇等级库
                                                <span className="text-xs text-gray-500 ml-2">(可切换对比覆盖率)</span>
                                            </label>
                                            <select
                                                value={jaVocabDict}
                                                onChange={(e) => setJaVocabDict(e.target.value as 'default' | 'elzup' | 'tanos' | 'combined')}
                                                className="w-full p-2 border rounded"
                                            >
                                                <option value="combined">Combined (Strong) (8,805词 - Merged)</option>
                                                <option value="default">Default JLPT (8,135词)</option>
                                                <option value="elzup">Elzup JLPT (7,846词 - elzup/jlpt-word-list)</option>
                                                <option value="tanos">Tanos JLPT (8,130词 - tanos.co.uk)</option>
                                            </select>
                                        </div>
                                        {/* Grammar Dictionary Selector */}
                                        <div>
                                            <label className="block text-sm font-medium mb-1">语法库</label>
                                            <select
                                                value={jaGrammarDict}
                                                onChange={(e) => setJaGrammarDict(e.target.value as 'yapan' | 'hagoromo' | 'combined')}
                                                className="w-full p-2 border rounded"
                                            >
                                                <option value="combined">Combined (Strong) (3,273模式 - Merged)</option>
                                                <option value="yapan">YAPAN (667模式 - jlptsensei.com)</option>
                                                <option value="hagoromo">Hagoromo 4.1 (1,731模式 - hgrm.jpn.org)</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="block text-sm font-medium mb-1">文本内容</label>
                                    <textarea
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        placeholder="输入要分析的文本..."
                                        className="w-full p-3 border rounded h-32 font-mono text-sm"
                                    />
                                </div>
                                <Button onClick={handleAnalyze} disabled={loading} className="w-full">
                                    {loading ? '分析中...' : '开始分析'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* 右侧：结果展示 */}
                    <div className="space-y-6">
                        {result ? (
                            <>
                                {/* 基本统计 */}
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-semibold mb-4">分析结果</h3>
                                    <div className="grid grid-cols-2 gap-4 text-center mb-4">
                                        <div className="p-4 bg-gray-50 rounded">
                                            <div className="text-3xl font-bold text-blue-600">{result.tokens}</div>
                                            <div className="text-sm text-gray-600">总词元数</div>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded">
                                            <div className="text-3xl font-bold text-green-600">{formatPercent(result.details.coverage)}</div>
                                            <div className="text-sm text-gray-600">内容词覆盖率</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="p-3 bg-purple-50 rounded">
                                            <div className="text-xl font-bold text-purple-600">{result.contentWordCount}</div>
                                            <div className="text-xs text-gray-600">内容词</div>
                                            <div className="text-xs text-gray-400">名詞/動詞/形容詞/副詞</div>
                                        </div>
                                        <div className="p-3 bg-orange-50 rounded">
                                            <div className="text-xl font-bold text-orange-600">{result.functionWordCount}</div>
                                            <div className="text-xs text-gray-600">功能词</div>
                                            <div className="text-xs text-gray-400">助詞/助動詞</div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded">
                                            <div className="text-xl font-bold text-gray-600">{result.uniqueTokens}</div>
                                            <div className="text-xs text-gray-600">唯一词元</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-sm text-gray-500">
                                        词典大小: {result.dictionarySize.toLocaleString()} 词
                                    </div>
                                </div>

                                {/* CEFR 分布 */}
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-semibold mb-4">词汇难度分布 (lex_profile)</h3>

                                    {/* 分布条 */}
                                    <div className="h-8 flex rounded overflow-hidden mb-4">
                                        {result.lexProfile.A1_A2 > 0 && (
                                            <div
                                                className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                                                style={{ width: `${result.lexProfile.A1_A2 * 100}%` }}
                                            >
                                                {result.lexProfile.A1_A2 > 0.08 && 'A1_A2'}
                                            </div>
                                        )}
                                        {result.lexProfile.B1_B2 > 0 && (
                                            <div
                                                className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                                                style={{ width: `${result.lexProfile.B1_B2 * 100}%` }}
                                            >
                                                {result.lexProfile.B1_B2 > 0.08 && 'B1_B2'}
                                            </div>
                                        )}
                                        {result.lexProfile.C1_plus > 0 && (
                                            <div
                                                className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                                                style={{ width: `${result.lexProfile.C1_plus * 100}%` }}
                                            >
                                                {result.lexProfile.C1_plus > 0.08 && 'C1+'}
                                            </div>
                                        )}
                                        {result.lexProfile.unknown > 0 && (
                                            <div
                                                className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                                                style={{ width: `${result.lexProfile.unknown * 100}%` }}
                                            >
                                                {result.lexProfile.unknown > 0.08 && '未知'}
                                            </div>
                                        )}
                                    </div>

                                    {/* 详细数据 */}
                                    <div className="grid grid-cols-4 gap-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded bg-green-500"></div>
                                            <span>A1_A2 (初级): {formatPercent(result.lexProfile.A1_A2)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded bg-yellow-500"></div>
                                            <span>B1_B2 (中级): {formatPercent(result.lexProfile.B1_B2)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded bg-red-500"></div>
                                            <span>C1+ (高级): {formatPercent(result.lexProfile.C1_plus)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded bg-gray-400"></div>
                                            <span>未知: {formatPercent(result.lexProfile.unknown)}</span>
                                        </div>
                                    </div>

                                    {/* 语法难度分析 (Japanese only) */}
                                    {result.grammarProfile && (
                                        <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                                            <h4 className="font-semibold text-indigo-800 mb-3">📚 语法难度分析 (YAPAN)</h4>

                                            <div className="grid grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <div className="text-2xl font-bold text-indigo-600">{result.grammarProfile.total}</div>
                                                    <div className="text-xs text-gray-600">识别语法点</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-red-600">{result.grammarProfile.hardestGrammar || '无'}</div>
                                                    <div className="text-xs text-gray-600">最难语法</div>
                                                </div>
                                            </div>

                                            {/* Grammar by level */}
                                            <div className="flex gap-2 text-xs mb-3">
                                                {['N5', 'N4', 'N3', 'N2', 'N1'].map(level => (
                                                    <div key={level} className={`px-2 py-1 rounded ${result.grammarProfile!.byLevel[level] > 0
                                                        ? level === 'N1' ? 'bg-red-100 text-red-700'
                                                            : level === 'N2' ? 'bg-orange-100 text-orange-700'
                                                                : level === 'N3' ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-400'
                                                        }`}>
                                                        {level}: {result.grammarProfile!.byLevel[level] || 0}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Pattern list */}
                                            {result.grammarProfile.patterns.length > 0 && (
                                                <div className="max-h-32 overflow-auto">
                                                    <div className="flex flex-wrap gap-1">
                                                        {result.grammarProfile.patterns.slice(0, 15).map((p, i) => (
                                                            <span
                                                                key={i}
                                                                className={`text-xs px-2 py-0.5 rounded ${p.level === 'N1' ? 'bg-red-200'
                                                                    : p.level === 'N2' ? 'bg-orange-200'
                                                                        : p.level === 'N3' ? 'bg-yellow-200'
                                                                            : 'bg-green-200'
                                                                    }`}
                                                                title={p.definition}
                                                            >
                                                                {p.pattern} ({p.level})
                                                            </span>
                                                        ))}
                                                        {result.grammarProfile.patterns.length > 15 && (
                                                            <span className="text-xs text-gray-500">
                                                                +{result.grammarProfile.patterns.length - 15} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Unrecognized Grammar */}
                                            {result.grammarProfile.unrecognizedGrammar && result.grammarProfile.unrecognizedGrammar.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-indigo-100">
                                                    <div className="text-xs text-gray-500 mb-1">未识别语法块 (疑似):</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {result.grammarProfile.unrecognizedGrammar.map((g, i) => (
                                                            <span key={i} className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                                                                {g}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}


                                    {/* AI Repair Section */}
                                    <div className="mt-8 border-t pt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-medium text-gray-900">AI 智能修复 (Beta)</h3>
                                            <button
                                                onClick={handleRepair}
                                                disabled={isRepairing || !result.details.unknownTokens.length}
                                                className={`px-4 py-2 rounded text-sm font-medium text-white transition-colors
                                                ${isRepairing || !result.details.unknownTokens.length
                                                        ? 'bg-gray-400 cursor-not-allowed'
                                                        : 'bg-purple-600 hover:bg-purple-700 shadow-sm'}`}
                                            >
                                                {isRepairing ? '修复中...' : '执行 AI 修复'}
                                            </button>
                                        </div>

                                        {repairResult && (
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-purple-700 font-bold">修复完成</span>
                                                    <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">
                                                        置信度: {(repairResult.confidence * 100).toFixed(0)}%
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Repairs List */}
                                                    <div className="bg-white p-3 rounded border border-purple-100">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">修复操作</h4>
                                                        <div className="space-y-2">
                                                            {repairResult.repairs.map((repair, i) => (
                                                                <div key={i} className="text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className={`text-xs px-1.5 py-0.5 rounded text-white
                                                                        ${repair.type === 'split_token' ? 'bg-blue-500' :
                                                                                repair.type === 'map_colloquial' ? 'bg-green-500' : 'bg-gray-500'}`}>
                                                                            {repair.type}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 text-gray-700">
                                                                        <span className="text-gray-400">原:</span>
                                                                        <span className="font-mono bg-red-50 text-red-700 px-1 rounded">{repair.original}</span>

                                                                        <span className="text-gray-400">改:</span>
                                                                        <span className="font-mono bg-green-50 text-green-700 px-1 rounded">
                                                                            {repair.replacement_tokens?.join(' + ') || repair.canonical}
                                                                        </span>

                                                                        {repair.notes && (
                                                                            <div className="col-span-2 text-xs text-gray-500 mt-0.5 italic">
                                                                                "{repair.notes}"
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Grammar Chunks */}
                                                    {repairResult.grammar_chunks && repairResult.grammar_chunks.length > 0 && (
                                                        <div className="bg-white p-3 rounded border border-purple-100">
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">新发现语法块</h4>
                                                            <div className="space-y-2">
                                                                {repairResult.grammar_chunks.map((chunk, i) => (
                                                                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                                                        <div>
                                                                            <span className="font-medium text-gray-800">{chunk.surface}</span>
                                                                            <span className="text-xs text-gray-500 ml-2">→ {chunk.canonical}</span>
                                                                        </div>
                                                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                                            {chunk.jlpt}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Vocab Entries */}
                                                    {repairResult.vocab_entries && repairResult.vocab_entries.length > 0 && (
                                                        <div className="bg-white p-3 rounded border border-purple-100 col-span-1 md:col-span-2">
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">新词汇定义</h4>
                                                            <div className="space-y-2">
                                                                {repairResult.vocab_entries.map((vocab, i) => (
                                                                    <div key={i} className="flex items-center justify-between text-sm bg-yellow-50 p-2 rounded border border-yellow-100">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-gray-800">{vocab.surface}</span>
                                                                            <span className="text-xs text-gray-500">[{vocab.reading}]</span>
                                                                            <span className="text-gray-600 border-l border-gray-300 pl-2 ml-1">{vocab.definition}</span>
                                                                        </div>
                                                                        <span className="text-xs font-bold text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded">
                                                                            {vocab.jlpt}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* LLM JLPT Level Assignment Section */}
                                    <div className="mt-6 border-t pt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-900">🎯 LLM 等级分配</h3>
                                                <p className="text-xs text-gray-500">为未知词汇和语法分配 JLPT 等级，可保存规则供后续分析使用</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {savedRulesCount.vocab + savedRulesCount.grammar > 0 && (
                                                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                                        已保存 {savedRulesCount.vocab + savedRulesCount.grammar} 条规则
                                                    </span>
                                                )}
                                                <button
                                                    onClick={handleLevelAssignment}
                                                    disabled={isAssigningLevels}
                                                    className={`px-4 py-2 rounded text-sm font-medium text-white transition-colors
                                                    ${isAssigningLevels
                                                            ? 'bg-gray-400 cursor-not-allowed'
                                                            : 'bg-blue-600 hover:bg-blue-700 shadow-sm'}`}
                                                >
                                                    {isAssigningLevels ? '分析中...' : '执行 LLM 分级'}
                                                </button>
                                            </div>
                                        </div>

                                        {llmLevelResult && (
                                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-blue-700 font-bold">✅ 分级完成</span>
                                                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                                                            置信度: {(llmLevelResult.confidence * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={handleSaveRules}
                                                        disabled={isSavingRules}
                                                        className="px-3 py-1.5 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                                                    >
                                                        {isSavingRules ? '保存中...' : '💾 保存规则'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Vocab Levels */}
                                                    {llmLevelResult.vocab_entries.length > 0 && (
                                                        <div className="bg-white p-3 rounded border border-blue-100">
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                                                词汇等级 ({llmLevelResult.vocab_entries.length})
                                                            </h4>
                                                            <div className="space-y-2 max-h-48 overflow-auto">
                                                                {llmLevelResult.vocab_entries.map((vocab, i) => (
                                                                    <div key={i} className="flex items-center justify-between text-sm bg-yellow-50 p-2 rounded">
                                                                        <div>
                                                                            <span className="font-bold text-gray-800">{vocab.surface}</span>
                                                                            {vocab.reading && <span className="text-xs text-gray-500 ml-1">[{vocab.reading}]</span>}
                                                                            <span className="text-gray-600 text-xs block">{vocab.definition}</span>
                                                                        </div>
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${vocab.jlpt === 'N1' ? 'bg-red-100 text-red-700' :
                                                                            vocab.jlpt === 'N2' ? 'bg-orange-100 text-orange-700' :
                                                                                vocab.jlpt === 'N3' ? 'bg-yellow-100 text-yellow-700' :
                                                                                    'bg-green-100 text-green-700'
                                                                            }`}>
                                                                            {vocab.jlpt}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Grammar Levels */}
                                                    {llmLevelResult.grammar_chunks.length > 0 && (
                                                        <div className="bg-white p-3 rounded border border-blue-100">
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                                                语法等级 ({llmLevelResult.grammar_chunks.length})
                                                            </h4>
                                                            <div className="space-y-2 max-h-48 overflow-auto">
                                                                {llmLevelResult.grammar_chunks.map((grammar, i) => (
                                                                    <div key={i} className="flex items-center justify-between text-sm bg-indigo-50 p-2 rounded">
                                                                        <div>
                                                                            <span className="font-bold text-gray-800">{grammar.surface}</span>
                                                                            <span className="text-xs text-gray-500 ml-2">→ {grammar.canonical}</span>
                                                                        </div>
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${grammar.jlpt === 'N1' ? 'bg-red-100 text-red-700' :
                                                                            grammar.jlpt === 'N2' ? 'bg-orange-100 text-orange-700' :
                                                                                grammar.jlpt === 'N3' ? 'bg-yellow-100 text-yellow-700' :
                                                                                    'bg-green-100 text-green-700'
                                                                            }`}>
                                                                            {grammar.jlpt}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 数据库格式 */}
                                    <div className="mt-4 p-3 bg-gray-50 rounded font-mono text-xs">
                                        <div className="text-gray-500 mb-1">// 存入数据库的格式 (已知词归一化)</div>
                                        <code>
                                            {JSON.stringify(result.lexProfileForDB, null, 2)}
                                        </code>
                                    </div>
                                </div>

                                {/* 分词详情 */}
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h3 className="text-lg font-semibold mb-4">分词详情（含词根/基本形）</h3>
                                    <div className="max-h-80 overflow-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="px-2 py-1 text-left">原词</th>
                                                    <th className="px-2 py-1 text-left">词根</th>
                                                    <th className="px-2 py-1 text-left">词性</th>
                                                    <th className="px-2 py-1 text-left">等级</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {(() => {
                                                    // Merge consecutive tokens with same compoundGrammar
                                                    // BUT: for split patterns (ば～ほど), only mark prefix/suffix as grammar
                                                    const mergedTokens: Array<{
                                                        token: string;
                                                        lemma: string;
                                                        pos: string;
                                                        originalLevel: string;
                                                        broadCEFR: string;
                                                        isCompound: boolean;
                                                        isGrammarRoot?: boolean; // true for split pattern prefix/suffix
                                                    }> = [];

                                                    // Common split pattern markers (will be marked as grammar roots)
                                                    const grammarRootPatterns = [
                                                        'ないと', 'ない', 'ば', 'ほど', 'から', 'まで', 'ながら',
                                                        'たら', 'なら', 'ても', 'でも', 'のに', 'ものの', 'つつ',
                                                        'ざるを得', 'を得ない', 'わけにはいかない', 'しかない',
                                                        'ほかない', 'べき', 'はず', 'わけ', 'こと', 'もの',
                                                    ];

                                                    const isGrammarRoot = (token: string): boolean => {
                                                        return grammarRootPatterns.some(p => token === p || token.endsWith(p) || token.startsWith(p));
                                                    };

                                                    let i = 0;
                                                    while (i < result.details.tokenList.length) {
                                                        const t = result.details.tokenList[i];

                                                        // Check if this token is part of a compound grammar
                                                        if (t.compoundGrammar) {
                                                            // Check if this looks like a split pattern (contains ～)
                                                            const isSplitPattern = t.compoundGrammar.includes('〜') || t.compoundGrammar.includes('～');

                                                            if (isSplitPattern) {
                                                                // For split patterns: check if this token is grammar root
                                                                if (isGrammarRoot(t.token) || t.pos === '助詞' || t.pos === '助動詞') {
                                                                    // This is a grammar root - show with grammar level
                                                                    mergedTokens.push({
                                                                        token: t.token,
                                                                        lemma: t.compoundGrammar,
                                                                        pos: '語法詞根',
                                                                        originalLevel: t.originalLevel,
                                                                        broadCEFR: t.broadCEFR,
                                                                        isCompound: true,
                                                                        isGrammarRoot: true,
                                                                    });
                                                                } else {
                                                                    // This is middle content - show as regular vocabulary
                                                                    mergedTokens.push({
                                                                        token: t.token,
                                                                        lemma: t.lemma !== t.token ? t.lemma : '-',
                                                                        pos: t.pos,
                                                                        // Remove grammar level from middle content
                                                                        originalLevel: t.originalLevel.replace(/grammar \(.*?\)/, 'vocab'),
                                                                        broadCEFR: t.broadCEFR,
                                                                        isCompound: false,
                                                                    });
                                                                }
                                                                i++;
                                                            } else {
                                                                // Non-split compound pattern: collect all consecutive tokens
                                                                const compoundTokens: string[] = [t.token];
                                                                let j = i + 1;
                                                                while (j < result.details.tokenList.length &&
                                                                    result.details.tokenList[j].compoundGrammar === t.compoundGrammar) {
                                                                    compoundTokens.push(result.details.tokenList[j].token);
                                                                    j++;
                                                                }

                                                                // Add merged entry
                                                                mergedTokens.push({
                                                                    token: compoundTokens.join(''),
                                                                    lemma: t.compoundGrammar,
                                                                    pos: '複合語法',
                                                                    originalLevel: t.originalLevel,
                                                                    broadCEFR: t.broadCEFR,
                                                                    isCompound: true,
                                                                });

                                                                i = j; // Skip merged tokens
                                                            }
                                                        } else {
                                                            // Regular token
                                                            mergedTokens.push({
                                                                token: t.token,
                                                                lemma: t.lemma !== t.token ? t.lemma : '-',
                                                                pos: t.pos,
                                                                originalLevel: t.originalLevel,
                                                                broadCEFR: t.broadCEFR,
                                                                isCompound: false,
                                                            });
                                                            i++;
                                                        }
                                                    }

                                                    return mergedTokens.map((t, idx) => (
                                                        <tr key={idx} className={`hover:bg-gray-50 ${t.isCompound ? (t.isGrammarRoot ? 'bg-indigo-50' : 'bg-purple-50') : ''}`}>
                                                            <td className="px-2 py-1 font-medium">
                                                                {t.isGrammarRoot && <span className="text-indigo-600 mr-1">◇</span>}
                                                                {t.isCompound && !t.isGrammarRoot && <span className="text-purple-600 mr-1">◆</span>}
                                                                {t.token}
                                                            </td>
                                                            <td className="px-2 py-1 text-gray-600">{t.lemma}</td>
                                                            <td className="px-2 py-1">
                                                                <span className={`px-1.5 py-0.5 rounded text-xs ${t.isGrammarRoot ? 'bg-indigo-100 text-indigo-700' : t.isCompound ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`}>
                                                                    {t.pos}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <span className={`px-1.5 py-0.5 rounded text-xs ${getLevelBadgeClass(t.broadCEFR)}`}>
                                                                    {t.originalLevel}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 未知词列表 */}
                                {result.details.unknownTokens.length > 0 && (
                                    <div className="bg-white p-6 rounded-lg shadow">
                                        <h3 className="text-lg font-semibold mb-4">
                                            未识别词汇 ({result.details.unknownTokens.length})
                                        </h3>
                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-auto">
                                            {result.details.unknownTokens.map((t, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 未匹配等级的语法词 */}
                                {(() => {
                                    const unmatchedGrammar = result.details.tokenList
                                        .filter(t => t.originalLevel === 'grammar')
                                        .map(t => t.token);
                                    const uniqueUnmatchedGrammar = [...new Set(unmatchedGrammar)];

                                    return uniqueUnmatchedGrammar.length > 0 && (
                                        <div className="bg-white p-6 rounded-lg shadow">
                                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                <span className="text-orange-500">📝</span>
                                                未匹配等级的语法词 ({uniqueUnmatchedGrammar.length})
                                            </h3>
                                            <p className="text-xs text-gray-500 mb-3">
                                                这些语法词在语法库和词汇库中都没有找到对应的JLPT等级
                                            </p>
                                            <div className="flex flex-wrap gap-1 max-h-32 overflow-auto">
                                                {uniqueUnmatchedGrammar.map((t, idx) => (
                                                    <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        ) : (
                            <div className="bg-white p-6 rounded-lg shadow">
                                <div className="text-center text-gray-500 py-12">
                                    <div className="text-5xl mb-4">📊</div>
                                    <p>选择测试用例或输入文本后点击 &quot;开始分析&quot;</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 组合性能对比表 */}
                <div className="mt-8 bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span>📊</span>
                        分词器 × 词汇库 组合性能对比
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                        基于 30 个日语跟读题目的测试结果 (2025-12-20)
                    </p>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border px-3 py-2 text-left">排名</th>
                                    <th className="border px-3 py-2 text-left">分词器</th>
                                    <th className="border px-3 py-2 text-left">词汇库</th>
                                    <th className="border px-3 py-2 text-right">词库大小</th>
                                    <th className="border px-3 py-2 text-right">覆盖率</th>
                                    <th className="border px-3 py-2 text-right">未知率</th>
                                    <th className="border px-3 py-2 text-right">处理时间</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-yellow-50 font-semibold">
                                    <td className="border px-3 py-2">🥇 1</td>
                                    <td className="border px-3 py-2">kuromoji</td>
                                    <td className="border px-3 py-2">default</td>
                                    <td className="border px-3 py-2 text-right">8,133</td>
                                    <td className="border px-3 py-2 text-right text-green-600">81.15%</td>
                                    <td className="border px-3 py-2 text-right">12.09%</td>
                                    <td className="border px-3 py-2 text-right">663ms</td>
                                </tr>
                                <tr className="bg-yellow-50/50">
                                    <td className="border px-3 py-2">🥈 2</td>
                                    <td className="border px-3 py-2">kuromoji</td>
                                    <td className="border px-3 py-2">tanos</td>
                                    <td className="border px-3 py-2 text-right">8,130</td>
                                    <td className="border px-3 py-2 text-right text-green-600">81.15%</td>
                                    <td className="border px-3 py-2 text-right">12.09%</td>
                                    <td className="border px-3 py-2 text-right">136ms</td>
                                </tr>
                                <tr className="bg-yellow-50/30">
                                    <td className="border px-3 py-2">🥉 3</td>
                                    <td className="border px-3 py-2">kuromoji</td>
                                    <td className="border px-3 py-2">elzup</td>
                                    <td className="border px-3 py-2 text-right">7,846</td>
                                    <td className="border px-3 py-2 text-right text-green-600">79.64%</td>
                                    <td className="border px-3 py-2 text-right">13.09%</td>
                                    <td className="border px-3 py-2 text-right">120ms</td>
                                </tr>
                                <tr>
                                    <td className="border px-3 py-2">4</td>
                                    <td className="border px-3 py-2">tinysegmenter</td>
                                    <td className="border px-3 py-2">default</td>
                                    <td className="border px-3 py-2 text-right">8,133</td>
                                    <td className="border px-3 py-2 text-right text-yellow-600">68.23%</td>
                                    <td className="border px-3 py-2 text-right">19.62%</td>
                                    <td className="border px-3 py-2 text-right">106ms</td>
                                </tr>
                                <tr>
                                    <td className="border px-3 py-2">5</td>
                                    <td className="border px-3 py-2">tinysegmenter</td>
                                    <td className="border px-3 py-2">tanos</td>
                                    <td className="border px-3 py-2 text-right">8,130</td>
                                    <td className="border px-3 py-2 text-right text-yellow-600">68.23%</td>
                                    <td className="border px-3 py-2 text-right">19.62%</td>
                                    <td className="border px-3 py-2 text-right">79ms</td>
                                </tr>
                                <tr>
                                    <td className="border px-3 py-2">6</td>
                                    <td className="border px-3 py-2">tinysegmenter</td>
                                    <td className="border px-3 py-2">elzup</td>
                                    <td className="border px-3 py-2 text-right">7,846</td>
                                    <td className="border px-3 py-2 text-right text-yellow-600">63.35%</td>
                                    <td className="border px-3 py-2 text-right">21.92%</td>
                                    <td className="border px-3 py-2 text-right">87ms</td>
                                </tr>
                                <tr className="text-gray-400">
                                    <td className="border px-3 py-2">7</td>
                                    <td className="border px-3 py-2">budoux</td>
                                    <td className="border px-3 py-2">default</td>
                                    <td className="border px-3 py-2 text-right">8,133</td>
                                    <td className="border px-3 py-2 text-right text-red-400">6.99%</td>
                                    <td className="border px-3 py-2 text-right">77.67%</td>
                                    <td className="border px-3 py-2 text-right">41ms</td>
                                </tr>
                                <tr className="text-gray-400">
                                    <td className="border px-3 py-2">8</td>
                                    <td className="border px-3 py-2">budoux</td>
                                    <td className="border px-3 py-2">tanos</td>
                                    <td className="border px-3 py-2 text-right">8,130</td>
                                    <td className="border px-3 py-2 text-right text-red-400">6.99%</td>
                                    <td className="border px-3 py-2 text-right">77.67%</td>
                                    <td className="border px-3 py-2 text-right">28ms</td>
                                </tr>
                                <tr className="text-gray-400">
                                    <td className="border px-3 py-2">9</td>
                                    <td className="border px-3 py-2">budoux</td>
                                    <td className="border px-3 py-2">elzup</td>
                                    <td className="border px-3 py-2 text-right">7,846</td>
                                    <td className="border px-3 py-2 text-right text-red-400">6.77%</td>
                                    <td className="border px-3 py-2 text-right">77.86%</td>
                                    <td className="border px-3 py-2 text-right">31ms</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <h3 className="font-semibold text-blue-800 mb-2">📊 分词器对比</h3>
                            <ul className="text-sm space-y-1">
                                <li><span className="font-medium text-green-600">kuromoji</span>: 80.6% 覆盖率 ✓ 最佳</li>
                                <li><span className="font-medium text-yellow-600">tinysegmenter</span>: 66.6% 覆盖率 - 中等</li>
                                <li><span className="font-medium text-red-500">budoux</span>: 6.9% 覆盖率 ✗ 不推荐</li>
                            </ul>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                            <h3 className="font-semibold text-purple-800 mb-2">📚 词汇库对比</h3>
                            <ul className="text-sm space-y-1">
                                <li><span className="font-medium">default</span> (8,133词): 52.1% 平均覆盖率</li>
                                <li><span className="font-medium">tanos</span> (8,130词): 52.1% 平均覆盖率</li>
                                <li><span className="font-medium">elzup</span> (7,846词): 49.9% 平均覆盖率</li>
                            </ul>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg">
                            <h3 className="font-semibold text-orange-800 mb-2">📖 语法库对比</h3>
                            <ul className="text-sm space-y-1">
                                <li><span className="font-medium">YAPAN</span>: 667 模式 (12.0 匹配/文本)</li>
                                <li><span className="font-medium text-green-600">Hagoromo 4.1</span>: 1,731 模式 (18.0 匹配/文本) ✓</li>
                                <li className="text-xs text-gray-500 mt-1">Hagoromo 语法覆盖率比 YAPAN 高 50%</li>
                            </ul>
                        </div>
                    </div>

                    {/* 最终综合测试报告 */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                        <h3 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                            🏆 最佳组合综合测试报告
                            <span className="text-xs font-normal text-gray-500">(50个日语题目)</span>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-white p-3 rounded shadow-sm text-center">
                                <div className="text-2xl font-bold text-green-600">81.01%</div>
                                <div className="text-xs text-gray-600">词汇覆盖率</div>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm text-center">
                                <div className="text-2xl font-bold text-blue-600">17.66</div>
                                <div className="text-xs text-gray-600">语法匹配/文本</div>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm text-center">
                                <div className="text-2xl font-bold text-orange-600">12.32%</div>
                                <div className="text-xs text-gray-600">词汇未知率</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="bg-white p-3 rounded shadow-sm">
                                <h4 className="font-semibold text-gray-700 mb-2">📚 词汇等级分布</h4>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span>N5</span><span className="font-mono">740 (28.7%)</span></div>
                                    <div className="flex justify-between"><span>N4</span><span className="font-mono">467 (18.1%)</span></div>
                                    <div className="flex justify-between"><span>N3</span><span className="font-mono">795 (30.9%)</span></div>
                                    <div className="flex justify-between"><span>N2</span><span className="font-mono">163 (6.3%)</span></div>
                                    <div className="flex justify-between"><span>N1</span><span className="font-mono">409 (15.9%)</span></div>
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                                <h4 className="font-semibold text-gray-700 mb-2">📖 语法等级分布</h4>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span>N5</span><span className="font-mono">310 (35.1%)</span></div>
                                    <div className="flex justify-between"><span>N4</span><span className="font-mono">383 (43.4%)</span></div>
                                    <div className="flex justify-between"><span>N3</span><span className="font-mono">115 (13.0%)</span></div>
                                    <div className="flex justify-between"><span>N2</span><span className="font-mono">70 (7.9%)</span></div>
                                    <div className="flex justify-between"><span>N1</span><span className="font-mono">5 (0.6%)</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
                            <h4 className="font-semibold text-green-800 mb-1">✅ 最终推荐配置</h4>
                            <div className="text-sm text-green-700 grid grid-cols-3 gap-2">
                                <div><strong>分词器:</strong> kuromoji</div>
                                <div><strong>词汇库:</strong> default (8,133词)</div>
                                <div><strong>语法库:</strong> Hagoromo (1,731模式)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
