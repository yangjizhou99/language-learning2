'use client';

import React from 'react';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';
import { useTranslation } from '@/contexts/LanguageContext';

interface VocabSweetSpotChartProps {
    data: {
        rate: number;
        score: number;
        level: number;
    }[];
}

export function VocabSweetSpotChart({ data }: VocabSweetSpotChartProps) {
    const t = useTranslation();

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-80 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">{t.stats.no_practice_data}</p>
            </div>
        );
    }

    const chartData = [
        {
            id: 'sessions',
            data: data.map(item => ({
                x: item.rate * 100, // Convert to percentage
                y: item.score,
                level: item.level
            }))
        }
    ];

    return (
        <div className="w-full h-80 relative">
            {/* Sweet Spot Background Highlight */}
            <div className="absolute top-[40px] bottom-[40px] left-[calc(80px+5%*0.8)] w-[15%] bg-green-50/50 border-x border-green-100 pointer-events-none z-0"
                style={{ left: 'calc(80px + (100% - 160px) * (5 / 30))', width: 'calc((100% - 160px) * (15 / 30))' }}>
                <div className="absolute top-2 left-2 text-xs font-medium text-green-600 opacity-50">
                    Sweet Spot (5-20%)
                </div>
            </div>

            <ResponsiveScatterPlot
                data={chartData}
                margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                xScale={{ type: 'linear', min: 0, max: 30 }}
                yScale={{ type: 'linear', min: 0, max: 100 }}
                blendMode="multiply"
                axisTop={null}
                axisRight={null}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: '生词率 (%)',
                    legendPosition: 'middle',
                    legendOffset: 36
                }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: '得分',
                    legendPosition: 'middle',
                    legendOffset: -60
                }}
                nodeSize={12}
                colors={['#10b981']}
                theme={{
                    axis: {
                        ticks: {
                            text: {
                                fontSize: 12,
                                fill: '#6b7280',
                            },
                        },
                        legend: {
                            text: {
                                fontSize: 12,
                                fill: '#6b7280',
                                fontWeight: 600
                            }
                        }
                    },
                    grid: {
                        line: {
                            stroke: '#e5e7eb',
                            strokeDasharray: '4 4',
                        },
                    },
                    tooltip: {
                        container: {
                            background: '#ffffff',
                            color: '#333333',
                            fontSize: 12,
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            padding: '8px 12px',
                        },
                    },
                }}
                tooltip={({ node }: { node: any }) => (
                    <div className="bg-white p-2 shadow rounded border border-gray-100 text-xs">
                        <strong>L{(node.data as any).level}</strong>
                        <div className="text-gray-500">
                            生词率: {node.data.x}%<br />
                            得分: {node.data.y}
                        </div>
                    </div>
                )}
            />
        </div>
    );
}
