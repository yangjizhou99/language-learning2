'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Sparkles } from 'lucide-react';

interface ScenePreference {
    scene_id: string;
    name_cn: string;
    weight: number;
}

interface UserScenePreferencesCardProps {
    preferences: ScenePreference[];
    isLoading?: boolean;
}

export function UserScenePreferencesCard({
    preferences,
    isLoading = false,
}: UserScenePreferencesCardProps) {
    // Group by weight level
    const highInterest = preferences.filter(p => p.weight >= 0.7);
    const mediumInterest = preferences.filter(p => p.weight >= 0.4 && p.weight < 0.7);
    const lowInterest = preferences.filter(p => p.weight > 0 && p.weight < 0.4);

    if (isLoading) {
        return (
            <Card className="bg-gradient-to-br from-pink-500/10 via-rose-500/10 to-red-500/10 border-white/20 backdrop-blur-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                            <Heart className="w-5 h-5 text-white" />
                        </div>
                        兴趣偏好
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        <div className="flex gap-2 flex-wrap">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (preferences.length === 0) {
        return (
            <Card className="bg-gradient-to-br from-pink-500/10 via-rose-500/10 to-red-500/10 border-white/20 backdrop-blur-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                            <Heart className="w-5 h-5 text-white" />
                        </div>
                        兴趣偏好
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4 text-muted-foreground">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 text-rose-400" />
                        <p className="text-sm">暂无场景偏好数据</p>
                        <p className="text-xs mt-1">请在个人资料中设置学习目标和兴趣领域</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-pink-500/10 via-rose-500/10 to-red-500/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
                        <Heart className="w-5 h-5 text-white" />
                    </div>
                    兴趣偏好
                    <Badge variant="secondary" className="ml-auto text-xs">
                        {preferences.length} 个场景
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* High Interest */}
                {highInterest.length > 0 && (
                    <div>
                        <div className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            高度感兴趣 ({highInterest.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {highInterest.slice(0, 8).map(pref => (
                                <Badge
                                    key={pref.scene_id}
                                    className="bg-gradient-to-r from-rose-500 to-pink-500 text-white border-0 text-xs"
                                >
                                    {pref.name_cn}
                                    <span className="ml-1 opacity-75">{(pref.weight * 100).toFixed(0)}%</span>
                                </Badge>
                            ))}
                            {highInterest.length > 8 && (
                                <Badge variant="outline" className="text-xs">
                                    +{highInterest.length - 8}
                                </Badge>
                            )}
                        </div>
                    </div>
                )}

                {/* Medium Interest */}
                {mediumInterest.length > 0 && (
                    <div>
                        <div className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1.5 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            中度感兴趣 ({mediumInterest.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {mediumInterest.slice(0, 6).map(pref => (
                                <Badge
                                    key={pref.scene_id}
                                    variant="outline"
                                    className="border-orange-300 text-orange-700 dark:text-orange-300 text-xs"
                                >
                                    {pref.name_cn}
                                    <span className="ml-1 opacity-75">{(pref.weight * 100).toFixed(0)}%</span>
                                </Badge>
                            ))}
                            {mediumInterest.length > 6 && (
                                <Badge variant="outline" className="text-xs">
                                    +{mediumInterest.length - 6}
                                </Badge>
                            )}
                        </div>
                    </div>
                )}

                {/* Low Interest - Collapsed */}
                {lowInterest.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                        还有 {lowInterest.length} 个低兴趣场景
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
