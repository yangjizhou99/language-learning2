'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Sparkles, PlayCircle, RefreshCw, ChevronRight, BookOpen, Heart, Target, HelpCircle, Brain, Gauge, Tags, ChevronDown, ChevronUp } from 'lucide-react';

interface SceneWeight {
    scene_id: string;
    name_cn: string;
    weight: number;
}

interface RecommendItem {
    item: {
        id: string;
        title: string;
        level: number;
        genre?: string;
        theme_id?: string;
        subtopic_id?: string;
        lang?: string;
    };
    score: number;
    scoreBreakdown?: {
        interest: number;
        difficulty: number;
        formula: string;
    };
    sceneWeights?: SceneWeight[];
    reason: string;
}

interface PracticeRecommendListProps {
    recommendations: RecommendItem[];
    isLoading?: boolean;
    onRefresh?: () => void;
}

const levelColors: Record<number, string> = {
    1: 'bg-green-100 text-green-700 border-green-200',
    2: 'bg-blue-100 text-blue-700 border-blue-200',
    3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    4: 'bg-orange-100 text-orange-700 border-orange-200',
    5: 'bg-red-100 text-red-700 border-red-200',
    6: 'bg-purple-100 text-purple-700 border-purple-200',
};

export function PracticeRecommendList({
    recommendations,
    isLoading = false,
    onRefresh,
}: PracticeRecommendListProps) {
    return (
        <Card className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        个性化推荐
                        {/* Algorithm Explanation Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-purple-600">
                                    <HelpCircle className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-purple-600" />
                                        推荐算法说明
                                    </DialogTitle>
                                    <DialogDescription>
                                        了解AI如何为你计算匹配度
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    {/* Formula */}
                                    <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                                        <h4 className="font-semibold text-sm mb-2">📊 总匹配度公式</h4>
                                        <code className="text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded">
                                            匹配度 = 60% × 兴趣分 + 40% × 难度分
                                        </code>
                                    </div>

                                    {/* Interest Score */}
                                    <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-900/20">
                                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                            <Heart className="w-4 h-4 text-pink-500" />
                                            兴趣分 (60%)
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            基于你的<strong>个人资料</strong>和<strong>学习目标</strong>，系统会分析每个主题与你兴趣的匹配程度：
                                        </p>
                                        <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                                            <li>你设定的学习领域（如商务、旅游、日常等）</li>
                                            <li>你的学习目标（如口语提升、听力训练等）</li>
                                            <li>历史练习中偏好的主题类型</li>
                                        </ul>
                                    </div>

                                    {/* Difficulty Score */}
                                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                            <Target className="w-4 h-4 text-blue-500" />
                                            难度匹配分 (40%)
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            衡量练习难度与你当前水平的匹配程度：
                                        </p>
                                        <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                                            <li><strong>等级匹配</strong>：练习等级与你的能力等级的差距</li>
                                            <li><strong>词汇匹配</strong>：预估的生词率是否在适合的范围（5%-20%为最佳）</li>
                                            <li><strong>学习策略</strong>：根据"巩固/主力/挑战"策略动态调整</li>
                                        </ul>
                                    </div>

                                    {/* Target Band */}
                                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                            <Gauge className="w-4 h-4 text-green-500" />
                                            学习策略选择
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            系统会随机选择一种策略来平衡学习效果：
                                        </p>
                                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded text-center">
                                                <div className="font-medium">巩固</div>
                                                <div className="text-muted-foreground">20%概率</div>
                                            </div>
                                            <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded text-center">
                                                <div className="font-medium">主力</div>
                                                <div className="text-muted-foreground">60%概率</div>
                                            </div>
                                            <div className="p-2 bg-orange-100 dark:bg-orange-800/30 rounded text-center">
                                                <div className="font-medium">挑战</div>
                                                <div className="text-muted-foreground">20%概率</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardTitle>
                    {onRefresh && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRefresh}
                            disabled={isLoading}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                            刷新
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 animate-pulse"
                            >
                                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                                <div className="h-4 bg-gray-100 dark:bg-gray-600 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : recommendations.length === 0 ? (
                    <div className="text-center py-8">
                        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">暂无推荐内容</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            完成更多练习后将获得个性化推荐
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recommendations.map((rec, index) => (
                            <div
                                key={rec.item.id}
                                className="group p-4 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200 hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            {index === 0 && (
                                                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 text-xs">
                                                    最佳匹配
                                                </Badge>
                                            )}
                                            <Badge
                                                variant="outline"
                                                className={`${levelColors[rec.item.level] || 'bg-gray-100'} text-xs`}
                                            >
                                                L{rec.item.level}
                                            </Badge>
                                            {rec.item.genre && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {rec.item.genre}
                                                </Badge>
                                            )}
                                        </div>
                                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                            {rec.item.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {rec.reason}
                                        </p>
                                        {/* Score Breakdown */}
                                        <div className="mt-3 p-2 rounded-lg bg-white/40 dark:bg-gray-900/40">
                                            <div className="flex items-center justify-between text-xs mb-2">
                                                <span className="text-muted-foreground font-medium">
                                                    匹配度计算: {rec.scoreBreakdown?.formula || '60% 兴趣 + 40% 难度'}
                                                </span>
                                                <span className="font-bold text-purple-600">
                                                    {(rec.score * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* Interest Score */}
                                                <div className="flex items-center gap-1.5">
                                                    <Heart className="w-3 h-3 text-pink-500" />
                                                    <span className="text-xs text-muted-foreground">兴趣:</span>
                                                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-pink-400 to-pink-600"
                                                            style={{ width: `${(rec.scoreBreakdown?.interest || 0) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-pink-600">
                                                        {((rec.scoreBreakdown?.interest || 0) * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                {/* Difficulty Score */}
                                                <div className="flex items-center gap-1.5">
                                                    <Target className="w-3 h-3 text-blue-500" />
                                                    <span className="text-xs text-muted-foreground">难度:</span>
                                                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                                                            style={{ width: `${(rec.scoreBreakdown?.difficulty || 0) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-blue-600">
                                                        {((rec.scoreBreakdown?.difficulty || 0) * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Scene Weights - Always show button */}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <button className="w-full mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-purple-600 transition-colors">
                                                        <Tags className="w-3 h-3" />
                                                        查看场景权重 ({rec.sceneWeights?.length || 0})
                                                    </button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <Tags className="w-5 h-5 text-purple-600" />
                                                            场景权重详情
                                                        </DialogTitle>
                                                        <DialogDescription>
                                                            {rec.item.title} 的场景分布
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-3 mt-4 max-h-64 overflow-y-auto">
                                                        {(rec.sceneWeights || []).map((scene, idx) => (
                                                            <div key={scene.scene_id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                                                                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900 text-xs font-medium text-purple-600">
                                                                    {idx + 1}
                                                                </span>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-sm truncate">
                                                                        {scene.name_cn}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-gradient-to-r from-purple-400 to-pink-500"
                                                                                style={{ width: `${scene.weight * 100}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs font-medium text-purple-600 w-12 text-right">
                                                                            {(scene.weight * 100).toFixed(0)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(!rec.sceneWeights || rec.sceneWeights.length === 0) && (
                                                            <div className="text-center py-4 text-muted-foreground text-sm">
                                                                暂无场景数据
                                                            </div>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </div>
                                    <Link href={`/practice/shadowing?lang=${rec.item.lang || 'zh'}&item=${rec.item.id}`}>
                                        <Button
                                            size="sm"
                                            className="shrink-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 group-hover:shadow-lg transition-all"
                                        >
                                            <PlayCircle className="w-4 h-4 mr-1" />
                                            开始
                                            <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
