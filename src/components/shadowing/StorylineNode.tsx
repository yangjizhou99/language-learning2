'use client';

import { motion } from 'framer-motion';
import { Lock, Check, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StorylineNodeProps {
    id: string;
    title: string;
    oneLine: string | null;
    itemId: string | null;
    isPracticed: boolean;
    score: number | null;
    isUnlocked: boolean;
    order: number;
    lang: string;
    isLast: boolean;
    themeId: string;
    top_scenes?: { id: string; name: string; weight: number }[];
}

export function StorylineNode({
    id,
    title,
    oneLine,
    itemId,
    isPracticed,
    score,
    isUnlocked,
    order,
    lang,
    isLast,
    themeId,
    top_scenes = [],
}: StorylineNodeProps) {
    const router = useRouter();

    const handleClick = () => {
        if (!isUnlocked || !itemId) return;
        router.push(`/practice/shadowing?lang=${lang}&item=${itemId}&src=storyline&themeId=${themeId}&subtopicId=${id}&autostart=1`);
    };


    const getNodeStatus = () => {
        if (isPracticed) return 'completed';
        if (isUnlocked) return 'unlocked';
        return 'locked';
    };

    const status = getNodeStatus();

    // Helper to get score color class
    const getScoreColorClass = (score: number) => {
        if (score >= 80) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (score >= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    };

    return (
        <div className="flex items-start gap-3 sm:gap-4">
            {/* Node with connecting line */}
            <div className="flex flex-col items-center">
                {/* Score Badge */}
                {score !== null && (
                    <div className="mb-1">
                        <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            getScoreColorClass(score)
                        )}>
                            {score}
                        </span>
                    </div>
                )}

                {/* Node circle */}
                <motion.button
                    onClick={handleClick}
                    disabled={!isUnlocked || !itemId}
                    className={cn(
                        'relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center',
                        'border-2 transition-all duration-300',
                        status === 'completed' && 'bg-emerald-500 border-emerald-500 text-white',
                        status === 'unlocked' && 'bg-blue-500 border-blue-500 text-white cursor-pointer hover:scale-110',
                        status === 'locked' && 'bg-slate-200 border-slate-300 text-slate-400 dark:bg-slate-700 dark:border-slate-600 cursor-not-allowed',
                    )}
                    whileHover={status === 'unlocked' ? { scale: 1.1 } : undefined}
                    whileTap={status === 'unlocked' ? { scale: 0.95 } : undefined}
                >
                    {status === 'completed' && <Check className="w-5 h-5 sm:w-6 sm:h-6" />}
                    {status === 'unlocked' && <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
                    {status === 'locked' && <Lock className="w-4 h-4 sm:w-5 sm:h-5" />}

                    {/* Pulse animation for unlocked node */}
                    {status === 'unlocked' && (
                        <motion.span
                            className="absolute inset-0 rounded-full border-2 border-blue-400"
                            animate={{
                                scale: [1, 1.3, 1.3],
                                opacity: [0.8, 0, 0],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeOut',
                            }}
                        />
                    )}
                </motion.button>

                {/* Connecting line */}
                {!isLast && (
                    <div
                        className={cn(
                            'w-0.5 h-12 sm:h-16',
                            status === 'completed' ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600',
                            status !== 'completed' && 'border-l-2 border-dashed',
                        )}
                    />
                )}
            </div>

            {/* Content */}
            <motion.div
                className={cn(
                    'flex-1 pt-1 pb-4',
                    status === 'locked' && 'opacity-60',
                    // Adjust padding if score is present to align text with node center
                    score !== null ? 'mt-4' : ''
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: order * 0.1 }}
            >
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        #{order}
                    </span>
                    <h4
                        className={cn(
                            'font-medium text-sm sm:text-base truncate',
                            status === 'completed' && 'text-emerald-700 dark:text-emerald-400',
                            status === 'unlocked' && 'text-blue-700 dark:text-blue-400',
                            status === 'locked' && 'text-slate-500 dark:text-slate-400',
                        )}
                    >
                        {title}
                    </h4>
                </div>
                {oneLine && (
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                        {oneLine}
                    </p>
                )}

                {/* Scene Tags */}
                {top_scenes && top_scenes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {top_scenes.map((scene) => (
                            <Badge
                                key={scene.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-none"
                            >
                                {scene.name}
                            </Badge>
                        ))}
                    </div>
                )}

                {status === 'unlocked' && itemId && (
                    <button
                        onClick={handleClick}
                        className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        开始练习 →
                    </button>
                )}
                {status === 'completed' && (
                    <span className="inline-block mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        ✓ 已完成
                    </span>
                )}
            </motion.div>
        </div>
    );
}
