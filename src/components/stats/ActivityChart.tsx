
'use client';

import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface ActivityChartProps {
    data: {
        date: string;
        count: number;
    }[];
}

export function ActivityChart({ data }: ActivityChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">暂无活动数据</p>
            </div>
        );
    }

    // Transform data for Nivo if needed, but the current structure works fine
    // We just need to ensure date is formatted nicely for the axis
    const chartData = data.map(item => ({
        ...item,
        dateDisplay: new Date(item.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
    }));

    return (
        <div className="w-full h-64">
            <ResponsiveBar
                data={chartData}
                keys={['count']}
                indexBy="dateDisplay"
                margin={{ top: 10, right: 10, bottom: 50, left: 30 }}
                padding={0.3}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                colors={['#10b981']}
                borderRadius={4}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                    tickSize: 0,
                    tickPadding: 12,
                    tickRotation: -45,
                    legend: '',
                    legendPosition: 'middle',
                    legendOffset: 32
                }}
                axisLeft={{
                    tickSize: 0,
                    tickPadding: 12,
                    tickRotation: 0,
                    legend: '',
                    legendPosition: 'middle',
                    legendOffset: -40
                }}
                enableLabel={false}
                role="application"
                ariaLabel="Activity chart"
                theme={{
                    axis: {
                        ticks: {
                            text: {
                                fontSize: 10,
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
