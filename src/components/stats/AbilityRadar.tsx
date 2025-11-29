
'use client';

import React from 'react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

interface AbilityRadarProps {
    data: {
        scene_name: string;
        score: number;
        accuracy: number;
        count: number;
        fullMark: number;
    }[];
}

export function AbilityRadar({ data }: AbilityRadarProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">暂无能力数据，快去练习吧！</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/95 p-3 rounded-lg shadow-lg border border-gray-100 text-sm">
                    <p className="font-bold text-gray-900 mb-2">{data.scene_name}</p>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-blue-600 font-medium">综合能力:</span>
                            <span className="font-bold">{data.score}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-gray-600">
                            <span>练习准确率:</span>
                            <span>{data.accuracy}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-gray-600">
                            <span>练习量:</span>
                            <span>{data.count}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                        dataKey="scene_name"
                        tick={{ fill: '#4b5563', fontSize: 12 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="能力值"
                        dataKey="score"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="#3b82f6"
                        fillOpacity={0.3}
                    />
                    <Tooltip content={<CustomTooltip />} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
