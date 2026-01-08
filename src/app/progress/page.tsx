'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SessionExpandableRow } from '@/components/progress/SessionExpandableRow';

interface SessionHistoryItem {
    id: string;
    date: string;
    score: number;
    itemId: string;
    title: string;
    level: number;
    genre: string;
    newWordsCount: number;
}

export default function ProgressPage() {
    const [history, setHistory] = useState<SessionHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/progress/history');
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data.history || []);
                } else {
                    const errData = await res.json().catch(() => ({}));
                    setErrorMsg(`Error ${res.status}: ${errData.error || res.statusText}`);
                }
            } catch (error: any) {
                console.error('Failed to fetch history', error);
                setErrorMsg(`Fetch error: ${error.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, []);

    // Calculate stats
    const totalSessions = history.length;
    const avgScore = totalSessions > 0
        ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / totalSessions)
        : 0;
    const recentDate = history.length > 0
        ? format(new Date(history[0].date), 'yyyy年MM月dd日', { locale: zhCN })
        : '-';

    return (
        <div className="container max-w-4xl mx-auto p-4 sm:p-6 space-y-8 pb-20">
            <header className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">成长足迹</h1>
                <p className="text-muted-foreground">记录每一次练习，见证每一点进步</p>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-none shadow-sm">
                    <CardContent className="p-6 text-center space-y-1">
                        <div className="text-sm text-muted-foreground font-medium">累计练习</div>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {totalSessions} <span className="text-sm font-normal text-muted-foreground">篇</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-none shadow-sm">
                    <CardContent className="p-6 text-center space-y-1">
                        <div className="text-sm text-muted-foreground font-medium">平均得分</div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                            {avgScore}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-none shadow-sm">
                    <CardContent className="p-6 text-center space-y-1">
                        <div className="text-sm text-muted-foreground font-medium">最近练习</div>
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400 pt-1">
                            {recentDate}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* History List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    练习记录
                </h2>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : errorMsg ? (
                    <div className="p-4 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {errorMsg}
                    </div>
                ) : history.length > 0 ? (
                    <div className="space-y-3">
                        {history.map((session) => (
                            <SessionExpandableRow key={session.id} session={session} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <p className="text-muted-foreground mb-4">还没有练习记录，快去开始第一次练习吧！</p>
                        <Button asChild>
                            <Link href="/practice/shadowing">开始练习</Link>
                        </Button>
                    </div>
                )}
            </div>
            {/* Debug Info - Only shown if there's an error or debug data */}
            {(errorMsg || (history as any).debug) && (
                <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-mono overflow-auto max-h-60">
                    <h3 className="font-bold mb-2">Debug Info:</h3>
                    {errorMsg && <div className="text-red-500 mb-2">{errorMsg}</div>}
                    {(history as any).debug && (
                        <pre>{JSON.stringify((history as any).debug, null, 2)}</pre>
                    )}
                </div>
            )}
        </div>
    );
}
