'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LanguageContext';
import { Target, Pencil } from 'lucide-react';

interface GoalCardProps {
  goals?: string | null;
  maxChars?: number; // 默认 500
  variant?: 'default' | 'hero';
}

export default function GoalCard({ goals, maxChars = 500, variant = 'default' }: GoalCardProps) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { text, isOverflow } = useMemo(() => {
    const safe = (goals || '').trim();
    if (!safe) return { text: '', isOverflow: false };
    if (safe.length <= maxChars) return { text: safe, isOverflow: false };
    return { text: expanded ? safe : safe.slice(0, maxChars) + '…', isOverflow: true };
  }, [goals, maxChars, expanded]);

  const hero = variant === 'hero';

  return (
    <Card
      className={
        hero
          ? 'relative overflow-hidden bg-white/70 dark:bg-slate-900/40 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md border-2 border-slate-200/80 dark:border-slate-700/60 shadow-[0_10px_30px_rgba(0,0,0,0.08)]'
          : 'bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 shadow-lg backdrop-blur'
      }
    >
      <CardHeader className={hero ? 'pb-3' : 'pb-3'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={
                hero
                  ? 'w-12 h-12 rounded-xl bg-slate-900/5 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm'
                  : 'w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center'
              }
            >
              <Target className={hero ? 'w-6 h-6' : 'w-5 h-5'} />
            </div>
            <div className={hero ? 'text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100 truncate' : 'text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100 truncate'}>
              {t.home.goals_title}
            </div>
          </div>
          <Button asChild variant="outline" size="icon" className={hero ? 'shrink-0 border-slate-300 dark:border-slate-700' : 'shrink-0 border-slate-300 dark:border-slate-700'}>
            <Link href="/profile" aria-label={t.home.goals_edit} title={t.home.goals_edit}>
              <Pencil className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className={hero ? 'pt-0' : 'pt-0'}>
        {text ? (
          <div
            className={
              hero
                ? 'text-gray-800 dark:text-slate-200 whitespace-pre-wrap text-[15px] sm:text-base leading-7 sm:leading-8 tracking-tight border-l-2 border-slate-200/70 dark:border-slate-700/60 pl-4'
                : 'text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed'
            }
          >
            {text}
            {isOverflow && (
              <div className="mt-3">
                <Button variant={hero ? 'ghost' : 'ghost'} size="sm" onClick={() => setExpanded((v) => !v)} className="px-2">
                  {expanded ? t.common.collapse : t.common.expand}
                </Button>
                <span className={'ml-2 text-xs text-gray-500 dark:text-slate-400'}>{t.home.goals_char_limit_hint}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className={hero ? 'text-sm font-semibold text-gray-900 dark:text-slate-100' : 'text-sm font-semibold text-gray-900 dark:text-slate-100'}>
                {t.home.goals_empty_title}
              </div>
              <div className={hero ? 'text-sm text-gray-600 dark:text-slate-400' : 'text-sm text-gray-600 dark:text-slate-400'}>
                {t.home.goals_empty_desc}
              </div>
            </div>
            <div className="shrink-0">
              <Button asChild variant="outline" className={hero ? 'border-slate-300 dark:border-slate-700' : 'border-slate-300 dark:border-slate-700'}>
                <Link href="/profile">{t.home.goals_fill_button}</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      {hero && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/50 dark:bg-white/10 blur-3xl opacity-20" />
          <div className="absolute -bottom-10 -left-10 w-52 h-52 rounded-full bg-white/50 dark:bg-white/10 blur-3xl opacity-20" />
        </div>
      )}
    </Card>
  );
}


