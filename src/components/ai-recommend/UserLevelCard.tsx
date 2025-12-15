'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Brain, BookOpen, Target } from 'lucide-react';

interface UserLevelCardProps {
    level: number;
    vocabUnknownRate: Record<string, number>;
    comprehensionRate: number;
    exploreConfig: {
        mainRatio: number;
        downRatio: number;
        upRatio: number;
    };
}

const levelLabels: Record<number, string> = {
    1: 'A1 入门',
    2: 'A2 基础',
    3: 'B1 进阶',
    4: 'B2 中高',
    5: 'C1 高级',
    6: 'C2 精通',
};

export function UserLevelCard({ level, vocabUnknownRate, comprehensionRate, exploreConfig }: UserLevelCardProps) {
    const levelInt = Math.floor(level);
    const levelProgress = (level - levelInt) * 100;
    const levelLabel = levelLabels[levelInt] || `L${levelInt}`;

    // Calculate vocab stats
    const vocabEntries = Object.entries(vocabUnknownRate);
    const avgUnknownRate = vocabEntries.length > 0
        ? vocabEntries.reduce((sum, [, rate]) => sum + rate, 0) / vocabEntries.length
        : 0;

    return (
        <Card className="bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                        <Brain className="w-5 h-5 text-white" />
                    </div>
                    能力评估
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Main Level Display */}
                <div className="text-center py-4">
                    <div className="inline-flex items-baseline gap-1">
                        <span className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            L{levelInt}
                        </span>
                        <span className="text-2xl text-muted-foreground">.{((level - levelInt) * 10).toFixed(0)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{levelLabel}</p>
                    <div className="mt-3 max-w-xs mx-auto">
                        <Progress value={levelProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                            距离 L{levelInt + 1} 还需 {(100 - levelProgress).toFixed(0)}%
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Comprehension Rate */}
                    <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium">理解率</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                            {(comprehensionRate * 100).toFixed(0)}%
                        </div>
                    </div>

                    {/* Vocab Unknown Rate */}
                    <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium">生词率</span>
                        </div>
                        <div className="text-2xl font-bold text-orange-600">
                            {(avgUnknownRate * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>

                {/* Explore Config */}
                <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium">学习策略分配</span>
                    </div>
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                        <div
                            className="bg-blue-400 transition-all"
                            style={{ width: `${exploreConfig.downRatio * 100}%` }}
                            title="巩固练习"
                        />
                        <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${exploreConfig.mainRatio * 100}%` }}
                            title="主力练习"
                        />
                        <div
                            className="bg-orange-500 transition-all"
                            style={{ width: `${exploreConfig.upRatio * 100}%` }}
                            title="挑战练习"
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>巩固 {(exploreConfig.downRatio * 100).toFixed(0)}%</span>
                        <span>主力 {(exploreConfig.mainRatio * 100).toFixed(0)}%</span>
                        <span>挑战 {(exploreConfig.upRatio * 100).toFixed(0)}%</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
