'use client';

import React from 'react';
import { ResponsiveLine } from '@nivo/line';

interface RecentAccuracyChartProps {
    data: {
        date: string;
        score: number;
    }[];
}

export function RecentAccuracyChart({ data }: RecentAccuracyChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">暂无练习数据</p>
            </div>
        );
    }

    const chartData = [
        {
            id: 'accuracy',
            color: '#8b5cf6',
            data: data.map(item => ({
                x: new Date(item.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
                y: item.score
            }))
        }
    ];

    return (
        <div className="w-full h-64">
            <ResponsiveLine
                data={chartData}
                margin={{ top: 20, right: 20, bottom: 30, left: 30 }}
                xScale={{ type: 'point' }}
                yScale={{
                    type: 'linear',
                    min: 0,
                    max: 100,
                    stacked: false,
                    reverse: false
                }}
                yFormat=" >-.2f"
                curve="catmullRom"
                axisTop={null}
                axisRight={null}
                axisBottom={{
                    tickSize: 0,
                    tickPadding: 12,
                    tickRotation: 0,
                    legend: '',
                    legendOffset: 36,
                    legendPosition: 'middle'
                }}
                axisLeft={{
                    tickSize: 0,
                    tickPadding: 12,
                    tickRotation: 0,
                    legend: '',
                    legendOffset: -40,
                    legendPosition: 'middle'
                }}
                enableGridX={false}
                gridYValues={5}
                colors={['#8b5cf6']}
                lineWidth={3}
                enablePoints={true}
                pointSize={8}
                pointColor={{ theme: 'background' }}
                pointBorderWidth={2}
                pointBorderColor={{ from: 'serieColor' }}
                pointLabelYOffset={-12}
                enableArea={true}
                areaOpacity={0.15}
                useMesh={true}
                theme={{
                    axis: {
                        ticks: {
                            text: {
                                fontSize: 11,
                                fill: '#9ca3af',
                            },
                        },
                    },
                    grid: {
                        line: {
                            stroke: '#f3f4f6',
                            strokeDasharray: '4 4',
                        },
                    },
                    tooltip: {
                        container: {
                            background: '#ffffff',
                            color: '#333333',
                            fontSize: 12,
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            padding: '8px 12px',
                            border: 'none',
                        },
                    },
                }}
            />
        </div>
    );
}
