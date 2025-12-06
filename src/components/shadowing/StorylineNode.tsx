'use client';

import { motion } from 'framer-motion';
import { Lock, Check, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface StorylineNodeProps {
    id: string;
    title: string;
    oneLine: string | null;
    itemId: string | null;
    isPracticed: boolean;
    isUnlocked: boolean;
    order: number;
    lang: string;
    isLast: boolean;
}

export function StorylineNode({
    title,
    oneLine,
    itemId,
    isPracticed,
    isUnlocked,
    order,
    lang,
    isLast,
}: StorylineNodeProps) {
    const router = useRouter();

    const handleClick = () => {
        if (!isUnlocked || !itemId) return;
        router.push(`/practice/shadowing?lang=${lang}&item=${itemId}&src=storyline`);
    };

    const getNodeStatus = () => {
        if (isPracticed) return 'completed';
        if (isUnlocked) return 'unlocked';
        return 'locked';
    };

    const status = getNodeStatus();

    return (
        <div className="flex items-start gap-3 sm:gap-4">
            {/* Node with connecting line */}
            <div className="flex flex-col items-center">
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
