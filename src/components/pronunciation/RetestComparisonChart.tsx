'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Target, Clock } from 'lucide-react';

interface RetestDataPoint {
  date: string;
  score: number;
  count: number;
}

interface RetestComparison {
  unit_id: number;
  symbol: string;
  lang: string;
  before: {
    mean: number;
    count: number;
    period: string;
    dataPoints: RetestDataPoint[];
  };
  after: {
    mean: number;
    count: number;
    period: string;
    dataPoints: RetestDataPoint[];
  };
  improvement: {
    scoreChange: number;
    percentageChange: number;
    isSignificant: boolean;
  };
}

interface RetestComparisonChartProps {
  unitId: number;
  lang: string;
  days?: number;
  className?: string;
}

export default function RetestComparisonChart({ 
  unitId, 
  lang, 
  days = 7, 
  className 
}: RetestComparisonChartProps) {
  const [data, setData] = useState<RetestComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRetestData();
  }, [unitId, lang, days]);

  async function loadRetestData() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/pronunciation/retest?unit_id=${unitId}&lang=${lang}&days=${days}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('加载再测数据失败');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (err) {
      console.error('加载再测数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toFixed(1)}
              {entry.payload.count && ` (${entry.payload.count}次)`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // 准备趋势图数据
  const prepareTrendData = () => {
    if (!data) return [];
    
    const allDataPoints = [
      ...data.before.dataPoints.map(point => ({ ...point, period: '训练前' })),
      ...data.after.dataPoints.map(point => ({ ...point, period: '训练后' }))
    ];
    
    return allDataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // 准备对比图数据
  const prepareComparisonData = () => {
    if (!data) return [];
    
    return [
      {
        period: '训练前',
        score: data.before.mean,
        count: data.before.count,
      },
      {
        period: '训练后',
        score: data.after.mean,
        count: data.after.count,
      }
    ];
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            再测对比分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">加载中...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>再测对比分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-red-500">
              <p className="mb-2">加载失败</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.before.count === 0 && data.after.count === 0)) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>再测对比分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <p className="mb-2">暂无数据</p>
              <p className="text-sm">完成训练后，这里将显示进步对比</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendData = prepareTrendData();
  const comparisonData = prepareComparisonData();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>再测对比分析</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {data.symbol}
            </Badge>
            {data.improvement.isSignificant && (
              <Badge 
                variant={data.improvement.scoreChange > 0 ? "default" : "destructive"}
                className="text-xs"
              >
                {data.improvement.scoreChange > 0 ? '显著提升' : '需要关注'}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 改进统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">训练前</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{data.before.mean}</p>
              <p className="text-xs text-blue-600">
                {data.before.count} 次练习
              </p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Target className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">训练后</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{data.after.mean}</p>
              <p className="text-xs text-green-600">
                {data.after.count} 次练习
              </p>
            </div>
            
            <div className={`text-center p-4 rounded-lg ${
              data.improvement.scoreChange > 0 ? 'bg-emerald-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-2">
                {data.improvement.scoreChange > 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  data.improvement.scoreChange > 0 ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  改进幅度
                </span>
              </div>
              <p className={`text-2xl font-bold ${
                data.improvement.scoreChange > 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {data.improvement.scoreChange > 0 ? '+' : ''}{data.improvement.scoreChange}
              </p>
              <p className={`text-xs ${
                data.improvement.scoreChange > 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                ({data.improvement.percentageChange > 0 ? '+' : ''}{data.improvement.percentageChange}%)
              </p>
            </div>
          </div>

          {/* 分数趋势图 */}
          {trendData.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">分数趋势</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="分数"
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 前后对比柱状图 */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">训练前后对比</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="score" 
                    fill="#10b981"
                    name="平均分"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 分析建议 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">分析建议</h4>
            <div className="text-sm text-gray-700 space-y-2">
              {data.improvement.scoreChange > 5 ? (
                <p className="text-green-700">
                  🎉 恭喜！您的发音水平有了显著提升，继续保持这种练习节奏。
                </p>
              ) : data.improvement.scoreChange > 0 ? (
                <p className="text-blue-700">
                  📈 您的发音水平有所改善，建议继续针对性练习以取得更大进步。
                </p>
              ) : data.improvement.scoreChange === 0 ? (
                <p className="text-gray-700">
                  📊 您的发音水平保持稳定，建议增加练习频率以获得提升。
                </p>
              ) : (
                <p className="text-red-700">
                  ⚠️ 您的发音水平有所下降，建议重新审视训练方法或增加练习时间。
                </p>
              )}
              
              {data.after.count < 3 && (
                <p className="text-amber-700">
                  💡 建议增加练习次数以获得更准确的评估结果。
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
