'use client';

import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import { useTranslation } from '@/contexts/LanguageContext';

interface DifficultyTrendChartProps {
    data: {
        date: string;
        level: number;
    }[];
}

export function DifficultyTrendChart({ data }: DifficultyTrendChartProps) {
    const t = useTranslation();

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">{t.stats.no_practice_data}</p>
            </div>
        );
    }

    // Sort by date
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const chartData = [
        {
            id: 'level',
            color: '#3b82f6',
            data: sortedData.map(item => ({
                x: new Date(item.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
                y: item.level
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
                    min: 1,
                    max: 6,
                    stacked: false,
                    reverse: false
                }}
                yFormat=" >-.0f"
                curve="monotoneX"
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
                    legendPosition: 'middle',
                    tickValues: [1, 2, 3, 4, 5, 6]
                }}
                enableGridX={false}
                gridYValues={[1, 2, 3, 4, 5, 6]}
                colors={['#3b82f6']}
                lineWidth={3}
                enablePoints={true}
                pointSize={8}
                pointColor={{ theme: 'background' }}
                pointBorderWidth={2}
                pointBorderColor={{ from: 'serieColor' }}
                pointLabelYOffset={-12}
                enableArea={true}
                areaOpacity={0.1}
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
