
'use client';

import React from 'react';
import { ResponsiveRadar } from '@nivo/radar';
import { useTranslation } from '@/contexts/LanguageContext';

interface AbilityRadarProps {
    data: {
        scene_name: string;
        score: number;
        accuracy: number;
        count: number;
        interest: number;
        fullMark: number;
    }[];
}

export function AbilityRadar({ data }: AbilityRadarProps) {
    const t = useTranslation();

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-80 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">{t.stats.no_ability_data}</p>
            </div>
        );
    }

    return (
        <div className="w-full h-80">
            <ResponsiveRadar
                data={data}
                keys={['score', 'interest']}
                indexBy="scene_name"
                valueFormat=">-.0f"
                maxValue={100}
                margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                borderColor={{ from: 'color' }}
                gridLabelOffset={36}
                dotSize={10}
                dotColor={{ theme: 'background' }}
                dotBorderWidth={2}
                colors={['#3b82f6', '#f59e0b']} // Blue (Score), Amber (Interest)
                blendMode="multiply"
                motionConfig="wobbly"
                fillOpacity={0.25}
                legends={[
                    {
                        anchor: 'top-left',
                        direction: 'column',
                        translateX: -50,
                        translateY: -40,
                        itemWidth: 80,
                        itemHeight: 20,
                        itemTextColor: '#999',
                        symbolSize: 12,
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
