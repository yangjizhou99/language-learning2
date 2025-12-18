import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Clock, TrendingUp } from 'lucide-react';

interface CumulativeTimeChartProps {
    data: Array<{
        date: string;
        minutes: number;
        dayMinutes: number;
    }>;
}

export const CumulativeTimeChart: React.FC<CumulativeTimeChartProps> = ({ data }) => {
    // Format dates for display (e.g., "12/18")
    const chartData = data.map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    }));

    const totalMinutes = data.length > 0 ? data[data.length - 1].minutes : 0;
    const totalHours = (totalMinutes / 60).toFixed(1);

    return (
        <div className="h-[300px] w-full relative">
            <div className="absolute top-0 right-0 bg-blue-50 px-3 py-1 rounded-full flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-700">Total: {totalHours} hrs</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                        dataKey="label"
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        interval={Math.floor(data.length / 5)}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-xl">
                                        <p className="text-sm font-medium text-gray-900 mb-1">{data.date}</p>
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-600 flex items-center justify-between gap-4">
                                                <span>累计:</span>
                                                <span className="font-bold text-blue-600">{data.minutes} min</span>
                                            </p>
                                            <p className="text-xs text-gray-400 flex items-center justify-between gap-4">
                                                <span>当日:</span>
                                                <span>+{data.dayMinutes} min</span>
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="minutes"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorMinutes)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
