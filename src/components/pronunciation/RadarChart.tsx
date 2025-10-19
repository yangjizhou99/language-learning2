'use client';

import { useState, useEffect } from 'react';
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RadarDataPoint {
  category: string;
  value: number;
  count: number;
}

interface RadarChartProps {
  lang: 'zh-CN' | 'en-US' | 'ja-JP';
  className?: string;
}

const TITLE_MAP: Record<RadarChartProps['lang'], string> = {
  'zh-CN': '\u4e2d\u6587\u53d1\u97f3\u96f7\u8fbe\u56fe',
  'en-US': 'English Pronunciation Radar',
  'ja-JP': '\u65e5\u8a9e\u767a\u97f3\u30ec\u30fc\u30c0\u30fc',
};

const COLOR_CONFIG: Record<
  RadarChartProps['lang'],
  { fill: string; fillOpacity: number; stroke: string; strokeWidth: number }
> = {
  'zh-CN': { fill: '#3b82f6', fillOpacity: 0.3, stroke: '#3b82f6', strokeWidth: 2 },
  'en-US': { fill: '#10b981', fillOpacity: 0.3, stroke: '#10b981', strokeWidth: 2 },
  'ja-JP': { fill: '#f97316', fillOpacity: 0.3, stroke: '#f97316', strokeWidth: 2 },
};

const ZH_LABELS: Record<string, string> = {
  '\u58f0\u6bcd': '\u58f0\u6bcd',
  '\u97f5\u6bcd': '\u97f5\u6bcd',
  '1\u58f0': '\u4e00\u58f0',
  '2\u58f0': '\u4e8c\u58f0',
  '3\u58f0': '\u4e09\u58f0',
  '4\u58f0': '\u56db\u58f0',
  '\u8f7b\u58f0': '\u8f7b\u58f0',
};

const EN_LABELS: Record<string, string> = {
  vowel: 'Vowels',
  consonant: 'Consonants',
  diphthong: 'Diphthongs',
  combination: 'Combinations',
};

export default function RadarChart({ lang, className }: RadarChartProps) {
  const [data, setData] = useState<RadarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRadarData = async () => {
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

        const response = await fetch(`/api/pronunciation/radar-data?lang=${lang}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('\u52a0\u8f7d\u96f7\u8fbe\u56fe\u6570\u636e\u5931\u8d25');
        }

        const result = await response.json();

        if (!isMounted) return;

        if (result.success) {
          setData(result.data || []);
        } else {
          throw new Error(result.error || '\u52a0\u8f7d\u5931\u8d25');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('\u52a0\u8f7d\u96f7\u8fbe\u56fe\u6570\u636e\u5931\u8d25', err);
        setError(err instanceof Error ? err.message : '\u52a0\u8f7d\u5931\u8d25');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    void loadRadarData();

    return () => {
      isMounted = false;
    };
  }, [lang]);

  const formatCategoryName = (category: string) => {
    if (lang === 'zh-CN') {
      return ZH_LABELS[category] || category;
    }
    if (lang === 'en-US') {
      return EN_LABELS[category] || category;
    }
    return category;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as RadarDataPoint;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
          <p className="font-semibold text-gray-900">{formatCategoryName(point.category)}</p>
          <p className="text-gray-600">
            {'\u5e73\u5747\u5206\uff1a'}
            <span className="font-medium text-blue-600">{point.value}</span>
          </p>
          <p className="text-gray-600">
            {'\u97f3\u8282\u6570\uff1a'}
            <span className="font-medium">{point.count}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const totalCategories = data.length;
  const avgScore = totalCategories > 0 ? data.reduce((sum, item) => sum + item.value, 0) / totalCategories : 0;
  const maxScore = data.reduce((max, item) => Math.max(max, item.value), 0);
  const minScoreRaw = data.reduce((min, item) => Math.min(min, item.value), Number.POSITIVE_INFINITY);
  const minScore = minScoreRaw === Number.POSITIVE_INFINITY ? 0 : minScoreRaw;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {TITLE_MAP[lang]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p>{'\u52a0\u8f7d\u4e2d...'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{TITLE_MAP[lang]}</CardTitle>
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
          <CardTitle>{TITLE_MAP[lang]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="mb-2">{'\u6682\u65e0\u6570\u636e'}</p>
            <p className="text-sm">
              {'\u5b8c\u6210\u66f4\u591a\u53d1\u97f3\u7ec3\u4e60\u540e\uff0c\u8fd9\u91cc\u5c06\u663e\u793a\u5206\u5e03\u60c5\u51b5'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const color = COLOR_CONFIG[lang];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{TITLE_MAP[lang]}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {totalCategories} {'\u5206\u7c7b'}
            </Badge>
            <Badge
              variant={avgScore >= 80 ? 'default' : avgScore >= 70 ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {'\u5e73\u5747 '} {avgScore.toFixed(1)}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsRadarChart data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} tickFormatter={formatCategoryName} />
                <PolarRadiusAxis angle={0} domain={[0, 100]} tick={{ fontSize: 10 }} tickCount={6} />
                <Radar name="\u5e73\u5747\u5206" dataKey="value" {...color} />
                <Tooltip content={<CustomTooltip />} />
              </RechartsRadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t text-center text-sm">
            <div>
              <p className="text-2xl font-bold text-blue-600">{avgScore.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{'\u5e73\u5747\u5206'}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{maxScore.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{'\u6700\u9ad8\u5206'}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{minScore.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{'\u6700\u4f4e\u5206'}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{totalCategories}</p>
              <p className="text-xs text-gray-500">{'\u5206\u7c7b\u6570'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">{'\u5206\u7c7b\u8be6\u60c5'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.map(item => (
                <div key={item.category} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatCategoryName(item.category)}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.count}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold">{item.value.toFixed(1)}</span>
                    {item.value >= 80 ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : item.value < 70 ? (
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
