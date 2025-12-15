'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UserLevelCard } from '@/components/ai-recommend/UserLevelCard';
import { DifficultyRecommendCard } from '@/components/ai-recommend/DifficultyRecommendCard';
import { PracticeRecommendList } from '@/components/ai-recommend/PracticeRecommendList';
import { UserScenePreferencesCard } from '@/components/ai-recommend/UserScenePreferencesCard';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AIRecommendData {
    userLevel: {
        level: number;
        vocabUnknownRate: Record<string, number>;
        comprehensionRate: number;
        exploreConfig: {
            mainRatio: number;
            downRatio: number;
            upRatio: number;
        };
    };
    difficultyRecommend: {
        targetBand: 'down' | 'main' | 'up';
        levelRange: { min: number; max: number };
        reason: string;
    };
    userScenePreferences?: Array<{
        scene_id: string;
        name_cn: string;
        weight: number;
    }>;
    recommendations: Array<{
        item: {
            id: string;
            title: string;
            level: number;
            genre?: string;
            theme_id?: string;
        };
        score: number;
        reason: string;
    }>;
}

export default function AIRecommendPage() {
    const router = useRouter();
    const [data, setData] = useState<AIRecommendData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Check authentication
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/auth');
                return;
            }

            const response = await fetch('/api/ai-recommend', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch recommendations');
            }

            const result = await response.json();
            if (result.success) {
                setData(result);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (err) {
            console.error('Error fetching AI recommendations:', err);
            setError(err instanceof Error ? err.message : 'Failed to load recommendations');
            toast.error('加载推荐数据失败，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        fetchData();
        toast.success('正在刷新推荐...');
    };

    if (error && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <div className="text-center py-16">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-700 mb-2">加载失败</h2>
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <Button onClick={handleRefresh}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            重试
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-950">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                AI 智能推荐
                            </h1>
                            <p className="text-muted-foreground">
                                基于你的学习数据，个性化推荐练习内容
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="bg-white/50 backdrop-blur-sm"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        刷新
                    </Button>
                </div>

                {isLoading && !data ? (
                    <div className="space-y-6">
                        {/* Loading skeletons */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="h-80 bg-white/50 rounded-xl animate-pulse" />
                            <div className="h-80 bg-white/50 rounded-xl animate-pulse" />
                        </div>
                        <div className="h-96 bg-white/50 rounded-xl animate-pulse" />
                    </div>
                ) : data ? (
                    <div className="space-y-6">
                        {/* Top Row: User Level + Difficulty Recommend */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <UserLevelCard
                                level={data.userLevel.level}
                                vocabUnknownRate={data.userLevel.vocabUnknownRate}
                                comprehensionRate={data.userLevel.comprehensionRate}
                                exploreConfig={data.userLevel.exploreConfig}
                            />
                            <DifficultyRecommendCard
                                targetBand={data.difficultyRecommend.targetBand}
                                levelRange={data.difficultyRecommend.levelRange}
                                reason={data.difficultyRecommend.reason}
                                userLevel={data.userLevel.level}
                            />
                        </div>

                        {/* User Scene Preferences */}
                        <UserScenePreferencesCard
                            preferences={data.userScenePreferences || []}
                            isLoading={isLoading}
                        />

                        {/* Bottom Row: Practice Recommendations */}
                        <PracticeRecommendList
                            recommendations={data.recommendations}
                            isLoading={isLoading}
                            onRefresh={handleRefresh}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
