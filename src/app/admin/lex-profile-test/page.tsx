'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RepairRequest, RepairResponse } from '@/lib/nlp/repair-service';

type Lang = 'en' | 'ja' | 'zh';

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
        tokenList: Array<{ token: string; lemma: string; pos: string; originalLevel: string; broadCEFR: 'A1_A2' | 'B1_B2' | 'C1_plus' | 'unknown'; isContentWord: boolean }>;
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
                body: JSON.stringify({ text, lang }),
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





    const selectTestCase = (testCase: typeof testCases[0]) => {
        setLang(testCase.lang);
        setText(testCase.text);
        setResult(null);
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
                                                {result.details.tokenList.map((t, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-2 py-1 font-medium">{t.token}</td>
                                                        <td className="px-2 py-1 text-gray-600">
                                                            {t.lemma !== t.token ? t.lemma : '-'}
                                                        </td>
                                                        <td className="px-2 py-1">
                                                            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                                                                {t.pos}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                            <span className={`px-1.5 py-0.5 rounded text-xs ${getLevelBadgeClass(t.broadCEFR)}`}>
                                                                {t.originalLevel}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
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
            </div>
        </div >
    );
}
