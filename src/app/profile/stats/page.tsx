
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AbilityRadar } from '@/components/stats/AbilityRadar';
import { ActivityChart } from '@/components/stats/ActivityChart';
import { RecentAccuracyChart } from '@/components/stats/RecentAccuracyChart';
import { ArrowLeft, Loader2, TrendingUp, Calendar, Target } from 'lucide-react';

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
        fullMark: number;
    }>;
    activityChart: Array<{
        date: string;
        count: number;
    }>;
}

export default function LearningStatsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<StatsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    router.push('/auth');
                    return;
                }

                const res = await fetch('/api/user/stats', {
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
                setError('无法加载统计数据，请稍后再试');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [router]);

    if (loading) {
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
                    返回
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">学习进度统计</h1>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Target className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500">总练习次数</h3>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{data?.stats?.totalAttempts || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <Calendar className="w-5 h-5 text-green-600" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500">活跃天数 (近30天)</h3>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{data?.stats?.totalDays || 0}</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-500">最近准确率</h3>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                            {data?.recentAccuracy && data.recentAccuracy.length > 0
                                ? `${data.recentAccuracy[data.recentAccuracy.length - 1].score}%`
                                : '-'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Ability Radar */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">能力雷达</h2>
                        <AbilityRadar data={data?.abilityRadar || []} />
                    </div>

                    {/* Recent Accuracy */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">近期准确率趋势</h2>
                        <RecentAccuracyChart data={data?.recentAccuracy || []} />
                    </div>
                </div>

                {/* Activity Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-6">学习活跃度 (近30天)</h2>
                    <ActivityChart data={data?.activityChart || []} />
                </div>
            </div>


        </div>
    );
}
