'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Map, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StorylineNode } from './StorylineNode';
import { cn } from '@/lib/utils';

interface SubtopicData {
    id: string;
    title: string;
    one_line: string | null;
    itemId: string | null;
    isPracticed: boolean;
    order: number;
    top_scenes?: { id: string; name: string; weight: number }[];
}

interface StorylineThemeCardProps {
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
    defaultExpanded?: boolean;
}

export function StorylineThemeCard({
    title,
    desc,
    lang,
    level,
    subtopics,
    progress,
    defaultExpanded = false,
}: StorylineThemeCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
    const isCompleted = progress.completed === progress.total && progress.total > 0;

    // 确定每个 subtopic 是否解锁：前一个完成才能解锁下一个
    const getUnlockStatus = (index: number): boolean => {
        if (index === 0) return true; // 第一个始终解锁
        return subtopics[index - 1].isPracticed; // 前一个完成才解锁
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card
                className={cn(
                    'bg-white/90 dark:bg-slate-900/80 border shadow-lg backdrop-blur overflow-hidden',
                    isCompleted
                        ? 'border-emerald-200 dark:border-emerald-800'
                        : 'border-slate-200 dark:border-slate-700',
                )}
            >
                <CardHeader
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center',
                                        isCompleted
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                            : 'bg-blue-100 dark:bg-blue-900/30',
                                    )}
                                >
                                    {isCompleted ? (
                                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                        <Map className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="font-medium">{lang.toUpperCase()}</span>
                                    <span>•</span>
                                    <span>L{level}</span>
                                </div>
                            </div>
                            <CardTitle className="text-lg sm:text-xl text-slate-900 dark:text-slate-50 truncate">
                                {title}
                            </CardTitle>
                            {desc && (
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                    {desc}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-slate-400" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                )}
                            </motion.div>
                            <span
                                className={cn(
                                    'text-xs font-medium px-2 py-1 rounded-full',
                                    isCompleted
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                                )}
                            >
                                {progress.completed}/{progress.total}
                            </span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                        <Progress
                            value={progressPercent}
                            className={cn(
                                'h-2',
                                isCompleted
                                    ? '[&>div]:bg-emerald-500'
                                    : '[&>div]:bg-blue-500',
                            )}
                        />
                    </div>
                </CardHeader>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <CardContent className="pt-0 pb-6">
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                    <div className="space-y-0">
                                        {subtopics.map((subtopic, index) => (
                                            <StorylineNode
                                                key={subtopic.id}
                                                id={subtopic.id}
                                                title={subtopic.title}
                                                oneLine={subtopic.one_line}
                                                itemId={subtopic.itemId}
                                                isPracticed={subtopic.isPracticed}
                                                isUnlocked={getUnlockStatus(index)}
                                                order={subtopic.order}
                                                lang={lang}
                                                isLast={index === subtopics.length - 1}
                                                top_scenes={subtopic.top_scenes}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
        </motion.div>
    );
}
