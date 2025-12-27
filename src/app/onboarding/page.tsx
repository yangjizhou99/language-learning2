'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    initAdaptiveTest,
    selectNextWord,
    updateState,
    calculateResult,
    AdaptiveTestState,
    AdaptiveTestWord,
    AdaptiveTestResult,
    getPoolStats,
} from '@/lib/coldStart/adaptiveTest';

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'unsure';

export default function OnboardingPage() {
    const router = useRouter();

    const [step, setStep] = useState<'loading' | 'level' | 'test' | 'complete'>('loading');
    const [selectedLevel, setSelectedLevel] = useState<JLPTLevel | null>(null);

    // Adaptive test state
    const [testState, setTestState] = useState<AdaptiveTestState | null>(null);
    const [currentWord, setCurrentWord] = useState<AdaptiveTestWord | null>(null);
    const [testResult, setTestResult] = useState<AdaptiveTestResult | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        checkOnboardingStatus();
    }, []);

    const checkOnboardingStatus = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/auth/login');
                return;
            }

            const res = await fetch('/api/onboarding', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json();

            if (data.onboardingCompleted) {
                router.push('/');
                return;
            }

            setStep('level');
        } catch (error) {
            console.error('Error checking onboarding:', error);
            setStep('level');
        }
    };

    const handleLevelSelect = (level: JLPTLevel) => {
        setSelectedLevel(level);
    };

    const handleStartAdaptiveTest = useCallback(() => {
        if (!selectedLevel) return;

        // Initialize adaptive test
        const state = initAdaptiveTest();
        setTestState(state);

        // Select first word
        const firstWord = selectNextWord(state);
        if (firstWord) {
            setCurrentWord(firstWord);
            setStep('test');
        }
    }, [selectedLevel]);

    const handleSkipTest = async () => {
        await submitOnboarding(null);
    };

    const handleTestResponse = useCallback((isKnown: boolean) => {
        if (!testState || !currentWord) return;

        // Update state with response
        const newState = updateState(testState, currentWord, isKnown);
        setTestState(newState);

        if (newState.isComplete) {
            // Test complete - calculate result
            const result = calculateResult(newState);
            setTestResult(result);
            submitOnboarding(result);
        } else {
            // Select next word
            const nextWord = selectNextWord(newState);
            if (nextWord) {
                setCurrentWord(nextWord);
            } else {
                // No more words - force complete
                const result = calculateResult(newState);
                setTestResult(result);
                submitOnboarding(result);
            }
        }
    }, [testState, currentWord]);

    const submitOnboarding = async (result: AdaptiveTestResult | null) => {
        if (!selectedLevel) return;

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('请先登录');
                return;
            }

            const body: any = {
                selfReportedJlpt: selectedLevel,
                skipQuickTest: !result,
            };

            if (result) {
                body.adaptiveTestResult = {
                    estimatedLevel: result.estimatedLevel,
                    jlptMastery: result.jlptMastery,
                    questionsAnswered: result.questionsAnswered,
                    confidence: result.confidence,
                };
            }

            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setStep('complete');
            toast.success('设置完成！');
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('保存失败，请重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinish = () => {
        router.push('/');
    };

    // Progress bar calculation
    const testProgress = testState
        ? Math.min(100, (testState.responses.length / 15) * 100)
        : 0;

    if (step === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">加载中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="max-w-2xl mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        🎌 欢迎开始学习日语
                    </h1>
                    <p className="text-gray-600">让我们先了解一下你的水平</p>
                </div>

                {/* Step 1: Level Selection */}
                {step === 'level' && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-semibold mb-6 text-center">
                            你目前的日语水平是？
                        </h2>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                            {(['N5', 'N4', 'N3', 'N2', 'N1', 'unsure'] as JLPTLevel[]).map(level => (
                                <button
                                    key={level}
                                    onClick={() => handleLevelSelect(level)}
                                    className={`p-4 rounded-xl border-2 transition-all ${selectedLevel === level
                                            ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="text-2xl font-bold text-center">
                                        {level === 'unsure' ? '🤔' : level}
                                    </div>
                                    <div className="text-sm text-gray-500 text-center mt-1">
                                        {level === 'N5' && '入门'}
                                        {level === 'N4' && '初级'}
                                        {level === 'N3' && '中级'}
                                        {level === 'N2' && '中高级'}
                                        {level === 'N1' && '高级'}
                                        {level === 'unsure' && '不确定'}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleSkipTest}
                                disabled={!selectedLevel || isSubmitting}
                                className="flex-1 py-3 px-6 rounded-xl border-2 border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                跳过测试
                            </button>
                            <button
                                onClick={handleStartAdaptiveTest}
                                disabled={!selectedLevel}
                                className="flex-1 py-3 px-6 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                开始自适应测试 →
                            </button>
                        </div>

                        <p className="text-center text-sm text-gray-400 mt-4">
                            自适应测试会根据你的回答动态调整难度，8-15题后完成
                        </p>
                    </div>
                )}

                {/* Step 2: Adaptive Test */}
                {step === 'test' && testState && currentWord && (
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        {/* Progress */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-500">
                                    问题 {testState.responses.length + 1} / 8-15
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">
                                        Lv.{testState.currentEstimate.toFixed(1)}
                                    </span>
                                    {testState.confidence > 0 && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                            {Math.round(testState.confidence * 100)}% 置信度
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${testProgress}%` }}
                                />
                            </div>
                        </div>

                        {/* Word Card */}
                        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl mb-6">
                            <div className="text-6xl font-bold text-gray-800 mb-4">
                                {currentWord.word}
                            </div>
                            <div className="text-sm text-gray-400">
                                ({currentWord.level})
                            </div>
                        </div>

                        <div className="text-center mb-6 text-gray-600">
                            你认识这个词吗？
                        </div>

                        {/* Answer Buttons */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleTestResponse(false)}
                                className="flex-1 py-5 px-6 rounded-xl bg-gradient-to-br from-rose-100 to-red-100 text-rose-700 font-medium hover:from-rose-200 hover:to-red-200 transition-all text-xl active:scale-95"
                            >
                                ❌ 不认识
                            </button>
                            <button
                                onClick={() => handleTestResponse(true)}
                                className="flex-1 py-5 px-6 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 font-medium hover:from-green-200 hover:to-emerald-200 transition-all text-xl active:scale-95"
                            >
                                ✅ 认识
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Complete */}
                {step === 'complete' && (testResult || selectedLevel) && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="text-6xl mb-6">🎉</div>
                        <h2 className="text-2xl font-bold mb-4">设置完成！</h2>

                        {testResult ? (
                            <>
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 mb-6">
                                    <div className="text-sm text-gray-500 mb-2">预估能力等级</div>
                                    <div className="text-4xl font-bold text-indigo-600 mb-2">
                                        {testResult.jlptEquivalent}
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        Lv.{testResult.estimatedLevel} | {testResult.questionsAnswered}题 | {Math.round(testResult.confidence * 100)}%置信度
                                    </div>
                                </div>

                                <div className="grid grid-cols-5 gap-2 mb-8">
                                    {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map(level => {
                                        const mastery = testResult.jlptMastery[level] || 0;
                                        const percent = Math.round(mastery * 100);
                                        return (
                                            <div key={level} className="text-center">
                                                <div className="text-sm font-bold text-gray-600">{level}</div>
                                                <div className="h-20 bg-gray-100 rounded-lg relative overflow-hidden mt-1">
                                                    <div
                                                        className={`absolute bottom-0 left-0 right-0 transition-all ${percent >= 70 ? 'bg-green-400' : percent >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                                                            }`}
                                                        style={{ height: `${percent}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs mt-1">{percent}%</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="bg-gray-50 rounded-xl p-6 mb-6">
                                <div className="text-gray-500">已使用自报水平: {selectedLevel}</div>
                            </div>
                        )}

                        <button
                            onClick={handleFinish}
                            className="w-full py-4 px-6 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors text-lg"
                        >
                            开始学习 →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
