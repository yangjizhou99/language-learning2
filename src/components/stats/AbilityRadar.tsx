
'use client';

import React from 'react';
import { ResponsiveRadar } from '@nivo/radar';

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
            <div className="flex items-center justify-center h-80 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">暂无能力数据，快去练习吧！</p>
            </div>
        );
    }

    return (
        <div className="w-full h-80">
            <ResponsiveRadar
                data={data}
                keys={['score']}
                indexBy="scene_name"
                valueFormat=">-.2f"
                maxValue={100}
                margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                borderColor={{ from: 'color' }}
                gridLabelOffset={36}
                dotSize={10}
                dotColor={{ theme: 'background' }}
                dotBorderWidth={2}
                colors={['#3b82f6']}
                blendMode="multiply"
                motionConfig="wobbly"
                fillOpacity={0.25}
                theme={{
                    axis: {
                        ticks: {
                            text: {
                                fontSize: 12,
                                fill: '#6b7280',
                                fontWeight: 500,
                            },
                        },
                    },
                    grid: {
                        line: {
                            stroke: '#e5e7eb',
                            strokeDasharray: '4 4',
                        },
                    },
                    dots: {
                        text: {
                            fontSize: 12,
                            fill: '#374151',
                        },
                    },
                    tooltip: {
                        container: {
                            background: '#ffffff',
                            color: '#333333',
                            fontSize: 12,
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            padding: '12px',
                            border: '1px solid #f3f4f6',
                        },
                    },
                }}
            />
        </div>
    );
}
