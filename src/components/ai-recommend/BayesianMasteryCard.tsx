'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveRadar } from '@nivo/radar';
import { Brain, TrendingUp, BookOpen } from 'lucide-react';

interface BayesianMasteryCardProps {
    bayesianProfile: {
        jlptMastery: Record<string, number>;
        estimatedLevel: number;
        evidenceCount: number;
        frequencyThreshold: number;
    } | null;
}

export function BayesianMasteryCard({ bayesianProfile }: BayesianMasteryCardProps) {
    if (!bayesianProfile) {
        return (
            <Card className="h-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-purple-100 dark:border-purple-900">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Brain className="w-5 h-5 text-purple-500" />
                        能力模型
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                        暂无足够数据生成模型
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { jlptMastery, estimatedLevel, evidenceCount } = bayesianProfile;

    // Transform data for Nivo Radar
    // N5 -> N1 order for chart
    const data = [
        { level: 'N5', mastery: Math.round((jlptMastery.N5 || 0) * 100) },
        { level: 'N4', mastery: Math.round((jlptMastery.N4 || 0) * 100) },
        { level: 'N3', mastery: Math.round((jlptMastery.N3 || 0) * 100) },
        { level: 'N2', mastery: Math.round((jlptMastery.N2 || 0) * 100) },
        { level: 'N1', mastery: Math.round((jlptMastery.N1 || 0) * 100) },
    ];

    // Generate insight text
    let insight = '开始积累词汇量吧！';
    if (estimatedLevel >= 5.0) {
        insight = '您的词汇量已达到高级水平，建议挑战原版新闻或小说。';
    } else if (estimatedLevel >= 3.5) {
        insight = '中级基础扎实，正在向高级迈进。';
    } else if (estimatedLevel >= 2.0) {
        insight = '初级阶段已完成，建议多接触 N3/N2 级别的长难句。';
    } else {
        insight = '正在打基础阶段，建议多重复练习 N5/N4 内容。';
    }

    return (
        <Card className="h-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-purple-100 dark:border-purple-900 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
                        <Brain className="w-5 h-5 text-purple-500" />
                        能力模型 (Bayesian)
                    </CardTitle>
                    <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">
                        <TrendingUp className="w-3 h-3" />
                        Lv. {estimatedLevel.toFixed(1)}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Radar Chart */}
                    <div className="h-[200px] -ml-6">
                        <ResponsiveRadar
                            data={data}
                            keys={['mastery']}
                            indexBy="level"
                            maxValue={100}
                            margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
                            curve="linearClosed"
                            borderWidth={2}
                            borderColor={{ from: 'color' }}
                            gridLevels={5}
                            gridShape="circular"
                            gridLabelOffset={10}
                            enableDots={true}
                            dotSize={6}
                            dotColor={{ theme: 'background' }}
                            dotBorderWidth={2}
                            dotBorderColor={{ from: 'color' }}
                            enableDotLabel={false}
                            colors={['#8b5cf6']} // Purple-500
                            fillOpacity={0.25}
                            blendMode="multiply"
                            theme={{
                                axis: {
                                    ticks: {
                                        text: {
                                            fontSize: 12,
                                            fill: '#6b7280', // gray-500
                                        },
                                    },
                                },
                                grid: {
                                    line: {
                                        stroke: '#e5e7eb', // gray-200
                                        strokeWidth: 1,
                                    },
                                },
                            }}
                        />
                    </div>

                    {/* Stats & Insight */}
                    <div className="flex flex-col justify-center space-y-4">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                学习洞察
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {insight}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-1">
                                    <BookOpen className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs text-blue-600 dark:text-blue-300 font-medium">证据样本</span>
                                </div>
                                <div className="text-xl font-bold text-blue-700 dark:text-blue-200">
                                    {evidenceCount}
                                </div>
                            </div>
                            {/* Can add more stats here */}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
