'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Lang = 'en' | 'ja' | 'zh' | 'ko';

interface Theme {
    id: string;
    lang: Lang;
    level: number;
    title: string;
}

interface Subtopic {
    id: string;
    theme_id: string;
    title: string;
}

interface ShadowingItem {
    id: string;
    lang: Lang;
    level: number;
    title: string;
    text: string;
}

interface QuizQuestion {
    question: string;
    options: { A: string; B: string; C: string; D: string };
    answer: 'A' | 'B' | 'C' | 'D';
}

export default function QuizTestPage() {
    // 筛选状态
    const [lang, setLang] = useState<Lang>('ja');
    const [level, setLevel] = useState<number>(3);
    const [themes, setThemes] = useState<Theme[]>([]);
    const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
    const [themeId, setThemeId] = useState<string>('');
    const [subtopicId, setSubtopicId] = useState<string>('');

    // 文章列表
    const [items, setItems] = useState<ShadowingItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<ShadowingItem | null>(null);

    // AI 配置
    const [provider, setProvider] = useState<'deepseek' | 'openrouter' | 'openai'>('deepseek');
    const [model, setModel] = useState<string>('deepseek-chat');

    // 生成状态
    const [generating, setGenerating] = useState(false);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [showResults, setShowResults] = useState(false);
    const [usage, setUsage] = useState<any>(null);

    // 加载主题列表
    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('shadowing_themes')
                .select('id, lang, level, title')
                .eq('lang', lang)
                .eq('level', level)
                .eq('status', 'active');
            setThemes(data || []);
            setThemeId('');
            setSubtopicId('');
        };
        load();
    }, [lang, level]);

    // 加载子主题列表
    useEffect(() => {
        const load = async () => {
            if (!themeId) {
                setSubtopics([]);
                return;
            }
            const { data } = await supabase
                .from('shadowing_subtopics')
                .select('id, theme_id, title')
                .eq('theme_id', themeId)
                .eq('status', 'active');
            setSubtopics(data || []);
            setSubtopicId('');
        };
        load();
    }, [themeId]);

    // 加载 shadowing items
    useEffect(() => {
        const load = async () => {
            let q = supabase
                .from('shadowing_items')
                .select('id, lang, level, title, text')
                .eq('status', 'approved')
                .eq('lang', lang)
                .eq('level', level)
                .not('audio_url', 'is', null)
                .limit(50);

            if (themeId) q = q.eq('theme_id', themeId);
            if (subtopicId) q = q.eq('subtopic_id', subtopicId);

            const { data } = await q;
            setItems(data || []);
            setSelectedItemId('');
            setSelectedItem(null);
        };
        load();
    }, [lang, level, themeId, subtopicId]);

    // 选中文章时更新详情
    useEffect(() => {
        if (selectedItemId) {
            const item = items.find((i) => i.id === selectedItemId);
            setSelectedItem(item || null);
        } else {
            setSelectedItem(null);
        }
        // 清空之前的题目
        setQuestions([]);
        setUserAnswers({});
        setShowResults(false);
    }, [selectedItemId, items]);

    // 生成题目
    const generateQuiz = async () => {
        if (!selectedItemId) {
            toast.error('请先选择一个素材');
            return;
        }

        setGenerating(true);
        setQuestions([]);
        setUserAnswers({});
        setShowResults(false);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('请先登录');
                setGenerating(false);
                return;
            }

            const res = await fetch('/api/admin/shadowing/quiz-test/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    item_id: selectedItemId,
                    provider,
                    model,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '生成失败');
            }

            const data = await res.json();
            setQuestions(data.questions || []);
            setUsage(data.usage);
            toast.success(`成功生成 ${data.questions?.length || 0} 道题目`);
        } catch (e: any) {
            toast.error('生成失败：' + (e?.message || String(e)));
        } finally {
            setGenerating(false);
        }
    };

    // 选择答案
    const selectAnswer = (qIndex: number, option: string) => {
        if (showResults) return;
        setUserAnswers((prev) => ({ ...prev, [qIndex]: option }));
    };

    // 提交答案
    const submitAnswers = () => {
        setShowResults(true);
        const correct = questions.filter((q, i) => userAnswers[i] === q.answer).length;
        toast.info(`得分：${correct}/${questions.length}`);
    };

    // 重置测试
    const resetQuiz = () => {
        setUserAnswers({});
        setShowResults(false);
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
                            <span className="text-blue-600 font-medium">理解题生成测试</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Link href="/admin" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
                            返回控制台
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="p-8 max-w-6xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold">Shadowing 理解题生成测试</h1>
                <p className="text-gray-600">
                    选择一个 shadowing 素材，使用 LLM 生成理解力测试选择题
                </p>

                {/* 筛选区域 */}
                <div className="bg-white p-6 rounded-lg shadow space-y-4">
                    <div className="text-lg font-semibold">素材筛选</div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">语言</label>
                            <select
                                value={lang}
                                onChange={(e) => setLang(e.target.value as Lang)}
                                className="w-full p-2 border rounded"
                            >
                                <option value="ja">日本語</option>
                                <option value="en">English</option>
                                <option value="zh">简体中文</option>
                                <option value="ko">한국어</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">难度等级</label>
                            <select
                                value={level}
                                onChange={(e) => setLevel(parseInt(e.target.value))}
                                className="w-full p-2 border rounded"
                            >
                                {[1, 2, 3, 4, 5, 6].map((l) => (
                                    <option key={l} value={l}>L{l}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">大主题</label>
                            <select
                                value={themeId}
                                onChange={(e) => setThemeId(e.target.value)}
                                className="w-full p-2 border rounded"
                            >
                                <option value="">（全部）</option>
                                {themes.map((t) => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">小主题</label>
                            <select
                                value={subtopicId}
                                onChange={(e) => setSubtopicId(e.target.value)}
                                className="w-full p-2 border rounded"
                                disabled={!themeId}
                            >
                                <option value="">（全部）</option>
                                {subtopics.map((s) => (
                                    <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">素材数</label>
                            <div className="p-2 text-gray-600">{items.length} 个</div>
                        </div>
                    </div>

                    {/* 素材选择 */}
                    <div>
                        <label className="block text-sm font-medium mb-1">选择素材</label>
                        <select
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            className="w-full p-2 border rounded"
                        >
                            <option value="">-- 请选择 --</option>
                            {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 选中素材预览 */}
                    {selectedItem && (
                        <div className="p-4 bg-gray-50 rounded border">
                            <div className="text-sm font-medium text-gray-500 mb-2">
                                {selectedItem.lang.toUpperCase()} L{selectedItem.level} - {selectedItem.title}
                            </div>
                            <div className="text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                                {selectedItem.text}
                            </div>
                        </div>
                    )}
                </div>

                {/* AI 配置区域 */}
                <div className="bg-white p-6 rounded-lg shadow space-y-4">
                    <div className="text-lg font-semibold">AI 配置</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">AI 提供商</label>
                            <select
                                value={provider}
                                onChange={(e) => {
                                    const p = e.target.value as 'deepseek' | 'openrouter' | 'openai';
                                    setProvider(p);
                                    const defaults: Record<string, string> = {
                                        deepseek: 'deepseek-chat',
                                        openrouter: 'anthropic/claude-3.5-sonnet',
                                        openai: 'gpt-4o',
                                    };
                                    setModel(defaults[p] || 'deepseek-chat');
                                }}
                                className="w-full p-2 border rounded"
                            >
                                <option value="deepseek">DeepSeek</option>
                                <option value="openrouter">OpenRouter</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">模型</label>
                            <input
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={generateQuiz} disabled={generating || !selectedItemId}>
                                {generating ? '生成中...' : '生成题目'}
                            </Button>
                            <span className="ml-3 text-sm text-gray-500">
                                题数: L1-L2=1题, L3-L4=2题, L5-L6=3题
                            </span>
                        </div>
                    </div>
                    {usage && (
                        <div className="text-xs text-gray-500">
                            Token 用量: prompt={usage.prompt_tokens}, completion={usage.completion_tokens}
                        </div>
                    )}
                </div>

                {/* 题目展示区域 */}
                {questions.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold">理解测试题 ({questions.length} 道)</div>
                            <div className="flex items-center gap-3">
                                {!showResults && (
                                    <Button
                                        onClick={submitAnswers}
                                        disabled={Object.keys(userAnswers).length < questions.length}
                                    >
                                        提交答案
                                    </Button>
                                )}
                                {showResults && (
                                    <Button onClick={resetQuiz} variant="outline">
                                        重新作答
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {questions.map((q, idx) => {
                                const userAnswer = userAnswers[idx];
                                const isCorrect = userAnswer === q.answer;
                                return (
                                    <div key={idx} className="p-4 border rounded-lg">
                                        <div className="font-medium mb-3">
                                            {idx + 1}. {q.question}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                                                const isSelected = userAnswer === opt;
                                                const isAnswer = q.answer === opt;
                                                let bgClass = 'bg-gray-50 hover:bg-gray-100';
                                                if (showResults) {
                                                    if (isAnswer) bgClass = 'bg-green-100 border-green-500';
                                                    else if (isSelected && !isCorrect) bgClass = 'bg-red-100 border-red-500';
                                                } else if (isSelected) {
                                                    bgClass = 'bg-blue-100 border-blue-500';
                                                }
                                                return (
                                                    <button
                                                        key={opt}
                                                        onClick={() => selectAnswer(idx, opt)}
                                                        className={`p-3 border rounded text-left transition ${bgClass}`}
                                                        disabled={showResults}
                                                    >
                                                        <span className="font-medium mr-2">{opt}.</span>
                                                        {q.options[opt]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {showResults && (
                                            <div className={`mt-3 p-2 rounded text-sm ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                                <div className="font-medium">
                                                    {isCorrect ? '✓ 正确' : `✗ 错误 (正确答案: ${q.answer})`}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {showResults && (
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <div className="text-lg font-semibold">
                                    最终得分: {questions.filter((q, i) => userAnswers[i] === q.answer).length}/{questions.length}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
