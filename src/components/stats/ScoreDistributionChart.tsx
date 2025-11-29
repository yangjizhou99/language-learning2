
'use client';

import React from 'react';
import { ResponsivePie } from '@nivo/pie';
import { useTranslation } from '@/contexts/LanguageContext';

interface ScoreDistributionChartProps {
    data: Array<{
        name: string;
        range: string;
        count: number;
        fill: string;
    }>;
}

export function ScoreDistributionChart({ data }: ScoreDistributionChartProps) {
    const t = useTranslation();
    const totalCount = data.reduce((sum, item) => sum + item.count, 0);

    if (totalCount === 0) {
        return (
            <div className="h-[300px] flex items-center justify-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">{t.stats.no_practice_data}</p>
            </div>
        );
    }

    // Transform data for Nivo
    const chartData = data.map(item => ({
        id: item.name,
        label: item.name,
        value: item.count,
        color: item.fill
    }));

    return (
        <div className="h-[300px] w-full">
            <ResponsivePie
                data={chartData}
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                innerRadius={0.6}
                padAngle={0.7}
                cornerRadius={6}
                activeOuterRadiusOffset={8}
                colors={{ datum: 'data.color' }}
                borderWidth={0}
                enableArcLinkLabels={false}
                enableArcLabels={false}
                tooltip={({ datum }) => (
                    <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-gray-100 text-sm ring-1 ring-black/5">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: datum.color }}></span>
                            <span className="font-medium text-gray-900">{datum.label}</span>
                        </div>
                        <div className="mt-1 text-gray-500">
                            {t.stats.practice_count}: <span className="font-bold text-gray-900">{datum.value}</span>
                        </div>
                    </div>
                )}
                legends={[
                    {
                        anchor: 'bottom',
                        direction: 'row',
                        justify: false,
                        translateX: 0,
                        translateY: 20,
                        itemsSpacing: 0,
                        itemWidth: 80,
                        itemHeight: 18,
                        itemTextColor: '#999',
                        itemDirection: 'left-to-right',
                        itemOpacity: 1,
                        symbolSize: 10,
                        symbolShape: 'circle',
                        effects: [
                            {
                                on: 'hover',
                                style: {
                                    itemTextColor: '#000'
                                }
                            }
                        ]
                    }
                ]}
                theme={{
                    tooltip: {
                        container: {
                            background: '#ffffff',
                            color: '#333333',
                            fontSize: 12,
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            padding: '12px',
                            border: 'none',
                        },
                    },
                }}
            />
        </div>
    );
}
