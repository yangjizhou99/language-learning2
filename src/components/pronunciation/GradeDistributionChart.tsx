'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { UnitStats } from '@/types/pronunciation';

interface GradeData {
  grade: string;
  count: number;
  percentage: number;
  color: string;
  [key: string]: string | number;
}

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#ef4444',
};

const UNIT_LABELS: Record<'zh-CN' | 'en-US' | 'ja-JP', string> = {
  'zh-CN': '\u4e2a\u97f3\u8282',
  'en-US': 'phonemes',
  'ja-JP': '\u97f3\u7d20',
};

function processGradeData(stats: UnitStats[]): GradeData[] {
  const gradeMap = new Map<string, number>();

  stats.forEach(stat => {
    const count = gradeMap.get(stat.grade) || 0;
    gradeMap.set(stat.grade, count + 1);
  });

  const total = stats.length;

  return ['A', 'B', 'C']
    .map<GradeData>(grade => {
      const count = gradeMap.get(grade) || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return {
        grade,
        count,
        percentage,
        color: GRADE_COLORS[grade] ?? '#6b7280',
      };
    })
    .filter(item => item.count > 0);
}

interface GradeDistributionChartProps {
  lang: 'zh-CN' | 'en-US' | 'ja-JP';
  className?: string;
}

export default function GradeDistributionChart({ lang, className }: GradeDistributionChartProps) {
  const [data, setData] = useState<GradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadGradeData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const session = sessionData?.session;

        if (!session) {
          throw new Error('\u8bf7\u5148\u767b\u5f55');
        }

        const response = await fetch(`/api/pronunciation/unit-stats?lang=${lang}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('\u52a0\u8f7d\u7b49\u7ea7\u6570\u636e\u5931\u8d25');
        }

        const result = await response.json();

        if (!isMounted) return;

        if (result.success) {
          setData(processGradeData(result.stats || []));
        } else {
          throw new Error(result.error || '\u52a0\u8f7d\u5931\u8d25');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('\u52a0\u8f7d\u7b49\u7ea7\u6570\u636e\u5931\u8d25', err);
        setError(err instanceof Error ? err.message : '\u52a0\u8f7d\u5931\u8d25');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    void loadGradeData();

    return () => {
      isMounted = false;
    };
  }, [lang]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const tooltipData = payload[0].payload as GradeData;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
          <p className="font-semibold text-gray-900">{`${tooltipData.grade} \u7ea7`}</p>
          <p className="text-gray-600">
            {'\u6570\u91cf\uff1a'}
            <span className="font-medium">{tooltipData.count}</span>
          </p>
          <p className="text-gray-600">
            {'\u5360\u6bd4\uff1a'}
            <span className="font-medium">{tooltipData.percentage.toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    if (!payload) return null;

    return (
      <div className="flex justify-center gap-4 mt-4 text-sm text-gray-600">
        {payload.map((entry: any) => (
          <div key={entry.value} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>
              {entry.value} \u7ea7 ({entry.payload.count})
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{'\u7b49\u7ea7\u5206\u5e03\u997c\u56fe'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p>{'\u6b63\u5728\u52a0\u8f7d\u6570\u636e...'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{'\u7b49\u7ea7\u5206\u5e03\u997c\u56fe'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-red-500">
            <p className="mb-2">{'\u52a0\u8f7d\u5931\u8d25'}</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{'\u7b49\u7ea7\u5206\u5e03\u997c\u56fe'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="mb-2">{'\u6682\u65e0\u6570\u636e'}</p>
            <p className="text-sm">
              {'\u5b8c\u6210\u66f4\u591a\u53d1\u97f3\u7ec3\u4e60\u540e\uff0c\u8fd9\u91cc\u5c06\u663e\u793a\u7b49\u7ea7\u5206\u5e03'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalUnits = data.reduce((sum, item) => sum + item.count, 0);
  const aCount = data.find(item => item.grade === 'A')?.count ?? 0;
  const bCount = data.find(item => item.grade === 'B')?.count ?? 0;
  const cCount = data.find(item => item.grade === 'C')?.count ?? 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{'\u7b49\u7ea7\u5206\u5e03\u997c\u56fe'}</span>
          <Badge variant="outline" className="text-xs">
            {totalUnits} {UNIT_LABELS[lang]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ payload }) => {
                    const item = payload as GradeData | undefined;
                    if (!item) {
                      return '';
                    }
                    return item.percentage > 5 ? `${item.grade} \u7ea7 ${item.percentage.toFixed(1)}%` : '';
                  }}
                  outerRadius={80}
                  dataKey="count"
                >
                  {data.map(entry => (
                    <Cell key={entry.grade} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t text-center text-sm">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1 text-green-700">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                <span>A \u7ea7</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{aCount}</p>
              <p className="text-xs text-green-600">
                {totalUnits > 0 ? ((aCount / totalUnits) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1 text-blue-700">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full" />
                <span>B \u7ea7</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{bCount}</p>
              <p className="text-xs text-blue-600">
                {totalUnits > 0 ? ((bCount / totalUnits) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center justify-center gap-1 mb-1 text-red-700">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
                <span>C \u7ea7</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{cCount}</p>
              <p className="text-xs text-red-600">
                {totalUnits > 0 ? ((cCount / totalUnits) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg space-y-1">
            <p className="font-medium">{'\u7b49\u7ea7\u8bf4\u660e'}</p>
            <p>
              <span className="font-medium text-green-600">A \u7ea7:</span> {'\u5e73\u5747\u5206 \u2265 85 \u4e14\u4fe1\u5fc3\u533a\u95f4\u4e0b\u9650 \u2265 80'}
            </p>
            <p>
              <span className="font-medium text-blue-600">B \u7ea7:</span> {'\u5e73\u5747\u5206 \u2265 75 \u6216\u4fe1\u5fc3\u533a\u95f4\u7a7f\u8d8a 80'}
            </p>
            <p>
              <span className="font-medium text-red-600">C \u7ea7:</span> {'\u5e73\u5747\u5206 < 75'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
