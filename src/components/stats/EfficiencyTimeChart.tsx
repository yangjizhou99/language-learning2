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
    Legend,
} from 'recharts';

interface EfficiencyTimeChartProps {
    data: Array<{
        level: string;
        data: Array<{
            hour: number;
            efficiency: number;
            count: number;
        }>;
    }>;
}

const COLORS = [
    '#10B981', // Emerald 500
    '#3B82F6', // Blue 500
    '#F59E0B', // Amber 500
    '#EF4444', // Red 500
    '#8B5CF6', // Violet 500
    '#EC4899', // Pink 500
];

export function EfficiencyTimeChart({ data }: EfficiencyTimeChartProps) {
    // Transform data for Recharts
    // We need an array of objects like: { hour: 0, L1: 80, L2: 70, ... }
    const chartData = Array.from({ length: 24 }, (_, i) => {
        const hourData: any = { hour: i };
        data.forEach((group) => {
            const point = group.data.find((d) => d.hour === i);
            if (point && point.count > 0) {
                hourData[group.level] = point.efficiency;
                hourData[`${group.level}_count`] = point.count;
            }
        });
        return hourData;
    });

    const levels = data.map((d) => d.level);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-xl text-xs">
                    <p className="font-bold text-gray-700 mb-2">{`${label}:00 - ${label + 1}:00`}</p>
                    {payload.map((entry: any, index: number) => {
                        const level = entry.name;
                        const countKey = `${level}_count`;
                        const count = entry.payload[countKey];
                        return (
                            <div key={index} className="flex items-center gap-2 mb-1">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="font-medium text-gray-600">{level}:</span>
                                <span className="font-bold text-gray-900">{entry.value}</span>
                                <span className="text-gray-400">({count}次)</span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="hour"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        tickFormatter={(value) => `${value}`}
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        domain={[0, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    {levels.map((level, index) => (
                        <Line
                            key={level}
                            type="monotone"
                            dataKey={level}
                            stroke={COLORS[index % COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3, strokeWidth: 0 }}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
