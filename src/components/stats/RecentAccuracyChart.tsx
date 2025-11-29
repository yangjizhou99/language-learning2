
'use client';

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface RecentAccuracyChartProps {
    data: {
        date: string;
        score: number;
    }[];
}

export function RecentAccuracyChart({ data }: RecentAccuracyChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">暂无练习数据</p>
            </div>
        );
    }

    return (
        <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(value) => {
                            // Only show date part if it's a full ISO string, but here we expect formatted date or short date
                            // Just show simplified version
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                        interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                        labelFormatter={(value) => {
                            if (!value) return '';
                            const date = new Date(value);
                            return date.toLocaleDateString();
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="score"
                        name="准确率"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
