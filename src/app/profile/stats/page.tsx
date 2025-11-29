
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AbilityRadar } from '@/components/stats/AbilityRadar';
import { ActivityChart } from '@/components/stats/ActivityChart';
import { RecentAccuracyChart } from '@/components/stats/RecentAccuracyChart';
import { ScoreDistributionChart } from '@/components/stats/ScoreDistributionChart';
import { ArrowLeft, Loader2, TrendingUp, Calendar, Target, PieChart as PieChartIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';

interface StatsData {
    stats: {
        totalAttempts: number;
        totalDays: number;
    };
    recentAccuracy: Array<{
        date: string;
        score: number;
    }>;
    abilityRadar: Array<{
        scene_name: string;
        score: number;
        accuracy: number;
        count: number;
        fullMark: number;
    }>;
    activityChart: Array<{
        date: string;
        count: number;
    }>;
    scoreDistribution: Array<{
        name: string;
        range: string;
        count: number;
        fill: string;
    }>;
}

export default function LearningStatsPage() {
    const router = useRouter();
    const { language } = useLanguage();
    const t = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<StatsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    router.push('/auth');
                    return;
                }

                const res = await fetch(`/api/user/stats?lang=${selectedLanguage}`, {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });

                if (!res.ok) {
                    throw new Error('Failed to fetch stats');
                }

                const jsonData = await res.json();
                setData(jsonData);
            } catch (err) {
                console.error(err);
                setError(t.stats.load_error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router, selectedLanguage, t.stats.load_error]);

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    {t.common.back}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-12">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">{t.stats.title}</h1>
                    </div>
                    <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage}>
                        <TabsList>
                            <TabsTrigger value="all">{t.stats.all_languages}</TabsTrigger>
                            <TabsTrigger value="zh">中文</TabsTrigger>
                            <TabsTrigger value="en">English</TabsTrigger>
                            <TabsTrigger value="ja">日本語</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards" style={{ animationDelay: '0ms' }}>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-blue-50 rounded-xl">
                                <Target className="w-6 h-6 text-blue-600" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500">{t.stats.total_attempts}</h3>
                        </div>
                        <p className="text-4xl font-bold text-gray-900 tracking-tight">{data?.stats?.totalAttempts || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards" style={{ animationDelay: '100ms' }}>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-green-50 rounded-xl">
                                <Calendar className="w-6 h-6 text-green-600" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500">{t.stats.active_days}</h3>
                        </div>
                        <p className="text-4xl font-bold text-gray-900 tracking-tight">{data?.stats?.totalDays || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards" style={{ animationDelay: '200ms' }}>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-purple-50 rounded-xl">
                                <TrendingUp className="w-6 h-6 text-purple-600" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500">{t.stats.recent_accuracy}</h3>
                        </div>
                        <p className="text-4xl font-bold text-gray-900 tracking-tight">
                            {data?.recentAccuracy && data.recentAccuracy.length > 0
                                ? `${data.recentAccuracy[data.recentAccuracy.length - 1].score}%`
                                : '-'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Ability Radar */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards" style={{ animationDelay: '300ms' }}>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-gray-900">{t.stats.ability_radar}</h2>
                            <span className="text-sm text-gray-400">{t.stats.ability_radar_desc}</span>
                        </div>
                        <AbilityRadar data={data?.abilityRadar || []} />
                    </div>

                    {/* Recent Accuracy */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards" style={{ animationDelay: '400ms' }}>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-gray-900">{t.stats.accuracy_trend}</h2>
                            <span className="text-sm text-gray-400">{t.stats.accuracy_trend_desc}</span>
                        </div>
                        <RecentAccuracyChart data={data?.recentAccuracy || []} />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Score Distribution */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards" style={{ animationDelay: '500ms' }}>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-orange-50 rounded-lg">
                                <PieChartIcon className="w-5 h-5 text-orange-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{t.stats.score_distribution}</h2>
                        </div>
                        <ScoreDistributionChart data={data?.scoreDistribution || []} />
                    </div>

                    {/* Activity Chart */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards" style={{ animationDelay: '600ms' }}>
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-gray-900">{t.stats.activity_chart}</h2>
                            <span className="text-sm text-gray-400">{t.stats.last_30_days}</span>
                        </div>
                        <ActivityChart data={data?.activityChart || []} />
                    </div>
                </div>
            </div>
        </div>
    );
}
