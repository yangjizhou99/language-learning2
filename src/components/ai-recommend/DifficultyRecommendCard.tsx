'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge, ArrowDown, ArrowRight, ArrowUp, Sparkles } from 'lucide-react';

interface DifficultyRecommendCardProps {
    targetBand: 'down' | 'main' | 'up';
    levelRange: { min: number; max: number };
    reason: string;
    userLevel: number;
}

const bandConfig = {
    down: {
        label: '巩固练习',
        description: '夯实基础，提升信心',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'from-blue-500/10 to-cyan-500/10',
        icon: ArrowDown,
        badgeVariant: 'secondary' as const,
    },
    main: {
        label: '主力练习',
        description: '稳步提升，保持节奏',
        color: 'from-green-500 to-emerald-500',
        bgColor: 'from-green-500/10 to-emerald-500/10',
        icon: ArrowRight,
        badgeVariant: 'default' as const,
    },
    up: {
        label: '挑战练习',
        description: '突破瓶颈，拓展能力',
        color: 'from-orange-500 to-red-500',
        bgColor: 'from-orange-500/10 to-red-500/10',
        icon: ArrowUp,
        badgeVariant: 'destructive' as const,
    },
};

export function DifficultyRecommendCard({
    targetBand,
    levelRange,
    reason,
    userLevel,
}: DifficultyRecommendCardProps) {
    const config = bandConfig[targetBand];
    const IconComponent = config.icon;

    return (
        <Card className={`bg-gradient-to-br ${config.bgColor} border-white/20 backdrop-blur-sm`}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color}`}>
                        <Gauge className="w-5 h-5 text-white" />
                    </div>
                    难度推荐
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Target Band Display */}
                <div className="text-center py-4">
                    <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r ${config.color}`}>
                        <IconComponent className="w-8 h-8 text-white" />
                        <div className="text-left">
                            <div className="text-2xl font-bold text-white">{config.label}</div>
                            <div className="text-sm text-white/80">{config.description}</div>
                        </div>
                    </div>
                </div>

                {/* Level Range */}
                <div className="flex justify-center gap-4">
                    <div className="text-center">
                        <div className="text-3xl font-bold bg-gradient-to-r from-gray-700 to-gray-500 bg-clip-text text-transparent">
                            L{levelRange.min} - L{levelRange.max}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">推荐难度范围</p>
                    </div>
                </div>

                {/* Visual Level Indicator */}
                <div className="px-4">
                    <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        {/* Level markers */}
                        {[1, 2, 3, 4, 5, 6].map((l) => (
                            <div
                                key={l}
                                className="absolute top-0 bottom-0 w-px bg-white/50"
                                style={{ left: `${((l - 1) / 5) * 100}%` }}
                            />
                        ))}
                        {/* Recommended range highlight */}
                        <div
                            className={`absolute top-0 bottom-0 bg-gradient-to-r ${config.color} opacity-60`}
                            style={{
                                left: `${((levelRange.min - 1) / 5) * 100}%`,
                                width: `${((levelRange.max - levelRange.min + 1) / 6) * 100}%`,
                            }}
                        />
                        {/* User level marker */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-purple-600 rounded-full shadow-lg"
                            style={{ left: `calc(${((userLevel - 1) / 5) * 100}% - 8px)` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>L1</span>
                        <span>L3</span>
                        <span>L6</span>
                    </div>
                </div>

                {/* Reason */}
                <div className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
                    <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground">{reason}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
