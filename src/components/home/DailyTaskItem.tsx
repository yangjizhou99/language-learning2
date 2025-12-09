'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import { translations } from '@/lib/i18n';

/**
 * 每日任务数据类型
 */
export interface DailyTaskData {
    lang?: 'zh' | 'ja' | 'en' | 'ko';
    level?: number;
    phase?: 'next' | 'unfinished' | 'cleared' | 'unpracticed';
    item?: {
        id: string;
        title: string;
        duration_ms?: number;
        tokens?: number;
        cefr?: string;
        theme?: { id: string; title: string; desc?: string };
        subtopic?: { id: string; title: string };
    } | null;
    today_done?: boolean;
    error?: string;
}

/**
 * 每日任务条目组件的属性
 */
export interface DailyTaskItemProps {
    /** 任务数据 */
    data: DailyTaskData | null;
    /** 国际化翻译对象 */
    t: (typeof translations)['zh'];
    /** 主题颜色类名（渐变） e.g. 'from-blue-500 to-indigo-500' */
    colorClass: string;
    /** 按钮颜色类名 e.g. 'bg-blue-600 hover:bg-blue-700' */
    buttonColorClass: string;
    /** 回退链接（当没有具体任务时） */
    fallbackHref: string;
}

/**
 * 每日 Shadowing 任务条目组件
 * 可复用于主目标语言、次目标语言、韩语任务
 */
export function DailyTaskItem({
    data,
    t,
    colorClass,
    buttonColorClass,
    fallbackHref,
}: DailyTaskItemProps) {
    if (!data) return null;

    const isCompleted = data.today_done;
    const hasItem = !!data.item;
    const isCleared = data.phase === 'cleared';
    const isUnfinished = data.phase === 'unfinished';

    return (
        <div className="flex items-start justify-between gap-4 sm:gap-6 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                {/* 级别徽章 */}
                <div
                    className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${isCompleted
                        ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        : `bg-gradient-to-br ${colorClass} text-white`
                        } flex items-center justify-center text-lg sm:text-xl font-bold shadow-sm`}
                    aria-label={isCompleted ? t.home.tasks_completed_badge : undefined}
                >
                    {hasItem ? `L${data.level}` : '--'}
                </div>

                {/* 任务信息 */}
                <div className="min-w-0 flex-1">
                    <div
                        className={`text-base sm:text-lg font-semibold truncate ${isCompleted
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-slate-900 dark:text-slate-50'
                            }`}
                        title={data.item?.title || ''}
                    >
                        {data.item?.title ||
                            (isCleared
                                ? t.home.daily_cleared
                                : t.home.daily_fetching.replace(
                                    '{hint}',
                                    data.error ? `（${data.error}）` : '...'
                                ))}
                    </div>

                    {/* 元数据 */}
                    {hasItem && (
                        <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1">
                            <span>
                                {t.home.daily_language}
                                {data.lang?.toUpperCase()}
                            </span>
                            {typeof data.item!.duration_ms === 'number' && (
                                <span>
                                    {t.home.daily_duration.replace(
                                        '{seconds}',
                                        String(Math.round((data.item!.duration_ms || 0) / 1000))
                                    )}
                                </span>
                            )}
                            {data.item!.tokens != null && (
                                <span>
                                    {t.home.daily_length.replace('{tokens}', String(data.item!.tokens))}
                                </span>
                            )}
                            {data.item!.cefr && (
                                <span>{t.home.daily_cefr.replace('{level}', data.item!.cefr)}</span>
                            )}
                            {isUnfinished && (
                                <span className="text-orange-600 dark:text-orange-400 font-medium">
                                    {t.home.daily_last_unfinished}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex-shrink-0">
                {isCompleted ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-sm font-medium shadow-sm">
                        {t.home.tasks_completed_badge}
                    </span>
                ) : hasItem ? (
                    <Link
                        className={`inline-flex items-center px-4 py-2 rounded-lg ${buttonColorClass} text-white shadow-md hover:shadow-lg transition-all min-h-[44px] text-sm sm:text-base font-medium`}
                        href={`/practice/shadowing?lang=${data.lang}&item=${data.item!.id}&autostart=1&src=daily`}
                    >
                        {t.home.daily_quick_start}
                        <Play className="w-4 h-4 ml-2" />
                    </Link>
                ) : (
                    <Link
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm min-h-[44px] text-sm sm:text-base font-medium"
                        href={fallbackHref}
                    >
                        {t.home.daily_open_practice}
                    </Link>
                )}
            </div>
        </div>
    );
}
