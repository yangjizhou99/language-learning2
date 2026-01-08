'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Loader2, BookOpen, Trophy, Target } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip
} from 'recharts';

interface SessionSummary {
    id: string;
    date: string;
    score: number;
    itemId: string;
    title: string;
    level: number;
    genre: string;
    newWordsCount: number;
}

interface WordDetail {
    id: string;
    word: string;
    definition: string;
    jlpt_level: string;
    mastery: number;
}

interface SessionDetails {
    id: string;
    newWords: WordDetail[];
    stats: {
        levelDistribution: Record<string, number>;
        quizScore: number;
        quizTotal: number;
    };
}

interface SessionExpandableRowProps {
    session: SessionSummary;
}

export function SessionExpandableRow({ session }: SessionExpandableRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [details, setDetails] = useState<SessionDetails | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const toggleExpand = async () => {
        if (!isExpanded && !details) {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/progress/session/${session.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setDetails(data.data);
                }
            } catch (error) {
                console.error('Failed to fetch session details', error);
            } finally {
                setIsLoading(false);
            }
        }
        setIsExpanded(!isExpanded);
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
        if (score >= 80) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400';
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
    };

    // Prepare chart data from level distribution
    const chartData = details ? [
        { subject: 'N5', count: details.stats.levelDistribution['N5'] || 0, fullMark: 10 },
        { subject: 'N4', count: details.stats.levelDistribution['N4'] || 0, fullMark: 10 },
        { subject: 'N3', count: details.stats.levelDistribution['N3'] || 0, fullMark: 10 },
        { subject: 'N2', count: details.stats.levelDistribution['N2'] || 0, fullMark: 10 },
        { subject: 'N1', count: details.stats.levelDistribution['N1'] || 0, fullMark: 10 },
    ] : [];

    return (
        <Card className="overflow-hidden transition-all hover:shadow-md bg-white/80 dark:bg-gray-800/80 border-transparent hover:border-blue-200 dark:hover:border-blue-800">
            <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={toggleExpand}
            >
                <div className="flex items-center gap-4 flex-1">
                    {/* Date Box */}
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium shrink-0">
                        <span className="text-xs uppercase">
                            {format(new Date(session.date), 'MMM', { locale: zhCN })}
                        </span>
                        <span className="text-xl font-bold">
                            {format(new Date(session.date), 'dd')}
                        </span>
                    </div>

                    {/* Title & Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 truncate">
                            {session.title}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium">
                                L{session.level}
                            </span>
                            <span className="truncate">{session.genre}</span>
                            {session.newWordsCount > 0 && (
                                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                    <BookOpen className="w-3 h-3" />
                                    +{session.newWordsCount} 词
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Score & Toggle */}
                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getScoreColor(session.score)}`}>
                        {Math.round(session.score)}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-4 sm:p-6 animate-in slide-in-from-top-2 duration-200">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        </div>
                    ) : details ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Stats Chart */}
                            <div className="lg:col-span-1 space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                                    <Target className="w-4 h-4" />
                                    能力分布
                                </h4>
                                <div className="h-[200px] w-full bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                            <Radar
                                                name="Words"
                                                dataKey="count"
                                                stroke="#3b82f6"
                                                fill="#3b82f6"
                                                fillOpacity={0.3}
                                            />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-muted-foreground">理解测试</span>
                                        <span className="font-bold text-green-600">
                                            {details.stats.quizTotal > 0
                                                ? Math.round((details.stats.quizScore / details.stats.quizTotal) * 100)
                                                : 0}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                        <div
                                            className="bg-green-500 h-2 rounded-full transition-all"
                                            style={{ width: `${details.stats.quizTotal > 0 ? (details.stats.quizScore / details.stats.quizTotal) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right: Vocabulary List */}
                            <div className="lg:col-span-2 space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground">
                                    <Trophy className="w-4 h-4" />
                                    新学单词 ({details.newWords.length})
                                </h4>
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                                    {details.newWords.length > 0 ? (
                                        <div className="max-h-[300px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>单词</TableHead>
                                                        <TableHead>释义</TableHead>
                                                        <TableHead className="w-[80px]">等级</TableHead>
                                                        <TableHead className="w-[100px]">掌握度</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {details.newWords.map((word) => (
                                                        <TableRow key={word.id}>
                                                            <TableCell className="font-medium">{word.word}</TableCell>
                                                            <TableCell className="text-muted-foreground text-sm truncate max-w-[150px]">
                                                                {word.definition}
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium
                                                                    ${word.jlpt_level === 'N1' ? 'bg-red-100 text-red-700' :
                                                                        word.jlpt_level === 'N2' ? 'bg-orange-100 text-orange-700' :
                                                                            word.jlpt_level === 'N3' ? 'bg-yellow-100 text-yellow-700' :
                                                                                word.jlpt_level === 'N4' ? 'bg-green-100 text-green-700' :
                                                                                    'bg-blue-100 text-blue-700'}`}>
                                                                    {word.jlpt_level}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                                                        <div
                                                                            className="bg-blue-500 h-1.5 rounded-full"
                                                                            style={{ width: `${word.mastery}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground">{word.mastery}%</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-muted-foreground text-sm">
                                            本次练习没有标记生词
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-red-500">
                            加载详情失败
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
