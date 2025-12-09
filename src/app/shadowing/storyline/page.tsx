'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Map, Filter, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import useUserPermissions from '@/hooks/useUserPermissions';
import { StorylineThemeCard } from '@/components/shadowing/StorylineThemeCard';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface SubtopicData {
    id: string;
    title: string;
    one_line: string | null;
    itemId: string | null;
    isPracticed: boolean;
    order: number;
    top_scenes?: { id: string; name: string; weight: number }[];
}

interface ThemeData {
    id: string;
    title: string;
    desc: string | null;
    lang: string;
    level: number;
    genre: string;
    subtopics: SubtopicData[];
    progress: {
        completed: number;
        total: number;
    };
}

const LANG_OPTIONS = [
    { value: 'all', label: '全部语言' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日语' },
    { value: 'en', label: '英语' },
    { value: 'ko', label: '韩语' },
];

const LEVEL_OPTIONS = [
    { value: 'all', label: '全部等级' },
    { value: '1', label: 'L1' },
    { value: '2', label: 'L2' },
    { value: '3', label: 'L3' },
    { value: '4', label: 'L4' },
    { value: '5', label: 'L5' },
    { value: '6', label: 'L6' },
];

export default function StorylinePage() {
    const t = useTranslation();
    const { getAuthHeaders, user } = useAuth();
    const { permissions } = useUserPermissions();

    const [themes, setThemes] = useState<ThemeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedLang, setSelectedLang] = useState('all');
    const [selectedLevel, setSelectedLevel] = useState('all');

    // 读取 URL 参数，获取要自动展开的主题 ID
    const searchParams = useSearchParams();
    const expandThemeId = searchParams?.get('expandTheme') || null;

    useEffect(() => {
        if (!user || !permissions.can_access_shadowing) return;

        const fetchStoryline = async () => {
            setLoading(true);
            setError(null);

            try {
                const headers = await getAuthHeaders();
                const params = new URLSearchParams();
                if (selectedLang !== 'all') params.set('lang', selectedLang);
                if (selectedLevel !== 'all') params.set('level', selectedLevel);

                const res = await fetch(`/api/shadowing/storyline?${params.toString()}`, {
                    credentials: 'include',
                    headers,
                });

                if (!res.ok) {
                    throw new Error('Failed to fetch storyline data');
                }

                const data = await res.json();
                setThemes(data.themes || []);
            } catch (err) {
                console.error('Storyline fetch error:', err);
                setError('加载故事线失败，请稍后重试');
            } finally {
                setLoading(false);
            }
        };

        fetchStoryline();
        fetchStoryline();
    }, [user, permissions.can_access_shadowing, selectedLang, selectedLevel, getAuthHeaders]);

    // 自动滚动到展开的主题
    useEffect(() => {
        if (expandThemeId && !loading && themes.length > 0) {
            // 给一点时间让 DOM 渲染和卡片展开
            const timer = setTimeout(() => {
                const element = document.getElementById(`theme-${expandThemeId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [expandThemeId, loading, themes]);

    // 计算总进度
    const totalProgress = themes.reduce(
        (acc, theme) => ({
            completed: acc.completed + theme.progress.completed,
            total: acc.total + theme.progress.total,
        }),
        { completed: 0, total: 0 }
    );

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
                <Card className="max-w-md mx-auto">
                    <CardContent className="p-6 text-center">
                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                            {t.shadowing.login_required_message}
                        </p>
                        <Button asChild>
                            <Link href="/auth">登录</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!permissions.can_access_shadowing) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
                <Card className="max-w-md mx-auto">
                    <CardContent className="p-6 text-center">
                        <p className="text-slate-600 dark:text-slate-300">
                            您没有访问此页面的权限
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 mb-4"
                    >
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                            <Map className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">故事线学习</h1>
                            <p className="text-amber-100 text-sm sm:text-base">
                                跟随故事线，解锁对话，逐步提升
                            </p>
                        </div>
                    </motion.div>

                    {/* Overall progress */}
                    {totalProgress.total > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/10 rounded-xl p-4 backdrop-blur"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">总体进度</span>
                                <span className="text-sm">
                                    {totalProgress.completed} / {totalProgress.total} 完成
                                </span>
                            </div>
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-white rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: `${(totalProgress.completed / totalProgress.total) * 100}%`,
                                    }}
                                    transition={{ duration: 0.8, delay: 0.3 }}
                                />
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Filter className="w-4 h-4" />
                        <span className="text-sm font-medium">筛选:</span>
                    </div>
                    <Select value={selectedLang} onValueChange={setSelectedLang}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {LANG_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                        <SelectTrigger className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {LEVEL_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    </div>
                )}

                {error && (
                    <Card className="max-w-md mx-auto">
                        <CardContent className="p-6 text-center">
                            <p className="text-red-600 dark:text-red-400">{error}</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => window.location.reload()}
                            >
                                重试
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {!loading && !error && themes.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20"
                    >
                        <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                            <Map className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                            暂无故事线
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            当前筛选条件下没有可用的故事线内容
                        </p>
                    </motion.div>
                )}

                {!loading && !error && themes.length > 0 && (
                    <div className="space-y-4">
                        {themes.map((theme, index) => (
                            <div key={theme.id} id={`theme-${theme.id}`}>
                                <StorylineThemeCard
                                    {...theme}
                                    defaultExpanded={expandThemeId ? theme.id === expandThemeId : index === 0}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
