import React from 'react';
import { Lightbulb, Target, TrendingUp, Calendar, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface InsightProps {
    stats: {
        totalAttempts: number;
        totalDays: number;
    };
    recentAccuracy: Array<{
        date: string;
        score: number;
    }>;
    activityChart: Array<{
        date: string;
        count: number;
    }>;
    interestVsProficiency: Array<{
        theme: string;
        interest: number;
        proficiency: number;
        fullMark: number;
    }>;
}

export const LearningInsights: React.FC<InsightProps> = ({
    stats,
    recentAccuracy,
    activityChart,
    interestVsProficiency,
}) => {
    const getInsights = () => {
        const insights = [];

        // 1. Focus Area Analysis
        // Find high interest (>70) but low proficiency (<60)
        const focusTheme = interestVsProficiency.find(
            item => item.interest > 70 && item.proficiency < 60
        );

        if (focusTheme) {
            insights.push({
                type: 'focus',
                icon: Target,
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                title: '重点突破建议',
                message: `你对 "${focusTheme.theme}" 很感兴趣，但熟练度还有提升空间。专注于这个主题练习，能让你获得最大的成就感！`,
                action: '去练习',
            });
        } else {
            // Fallback if no specific gap found
            const topInterest = [...interestVsProficiency].sort((a, b) => b.interest - a.interest)[0];
            if (topInterest) {
                insights.push({
                    type: 'focus',
                    icon: Target,
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-50',
                    title: '保持热爱',
                    message: `继续保持对 "${topInterest.theme}" 的热情！它是你学习动力的源泉。`,
                    action: '去练习',
                });
            }
        }

        // 2. Difficulty/Challenge Analysis
        const recentScores = recentAccuracy.slice(-5);
        if (recentScores.length >= 3) {
            const avgScore = recentScores.reduce((acc, curr) => acc + curr.score, 0) / recentScores.length;

            if (avgScore > 90) {
                insights.push({
                    type: 'challenge',
                    icon: TrendingUp,
                    color: 'text-purple-600',
                    bgColor: 'bg-purple-50',
                    title: '挑战升级',
                    message: '你最近的表现非常出色（平均分 >90%）！是时候走出舒适区，尝试更高难度的内容了。',
                    action: '挑战高难度',
                });
            } else if (avgScore < 60) {
                insights.push({
                    type: 'support',
                    icon: Lightbulb,
                    color: 'text-amber-600',
                    bgColor: 'bg-amber-50',
                    title: '巩固基础',
                    message: '最近的练习可能有点难。不妨降低一点难度，先找回自信和语感。',
                    action: '调整难度',
                });
            }
        }

        // 3. Consistency Analysis
        // Check activity in last 7 days (assuming activityChart has daily data)
        const recentActivity = activityChart.slice(-7);
        const activeDays = recentActivity.filter(day => day.count > 0).length;

        if (activeDays < 3) {
            insights.push({
                type: 'consistency',
                icon: Calendar,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                title: '保持连贯性',
                message: '语言学习贵在坚持。试着设定一个小目标：每周至少练习 3 天。',
                action: '设定提醒',
            });
        } else if (activeDays >= 5) {
            insights.push({
                type: 'praise',
                icon: Calendar,
                color: 'text-green-600',
                bgColor: 'bg-green-50',
                title: '习惯养成',
                message: '太棒了！你保持了极佳的练习频率。这种坚持是掌握语言的关键。',
                action: null,
            });
        }

        return insights;
    };

    const insights = getInsights();

    if (insights.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {insights.map((insight, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-300 group"
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-xl ${insight.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                            <insight.icon className={`w-6 h-6 ${insight.color}`} />
                        </div>
                        {insight.action && (
                            <button className="text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                                {insight.action}
                                <ArrowRight className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {insight.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {insight.message}
                    </p>
                </motion.div>
            ))}
        </div>
    );
};
