import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Clock } from 'lucide-react';

interface PracticeHeatmapProps {
    data: Array<{
        hour: number;
        count: number;
    }>;
}

export const PracticeHeatmap: React.FC<PracticeHeatmapProps> = ({ data }) => {
    // Transform data for display
    // We want to show 0-23 hours.
    // Maybe group by "Morning", "Afternoon", "Evening", "Night" for color coding?

    const chartData = data.map(d => ({
        ...d,
        label: `${d.hour}:00`,
        period: d.hour >= 5 && d.hour < 12 ? 'Morning' :
            d.hour >= 12 && d.hour < 17 ? 'Afternoon' :
                d.hour >= 17 && d.hour < 22 ? 'Evening' : 'Night'
    }));

    const getBarColor = (period: string) => {
        switch (period) {
            case 'Morning': return '#f59e0b'; // Amber
            case 'Afternoon': return '#3b82f6'; // Blue
            case 'Evening': return '#8b5cf6'; // Purple
            case 'Night': return '#1e293b'; // Slate
            default: return '#cbd5e1';
        }
    };

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                        dataKey="hour"
                        tickFormatter={(val) => `${val}`}
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-xl">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-900">{data.label}</span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            练习次数: <span className="font-bold text-blue-600">{data.count}</span>
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry.period)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
