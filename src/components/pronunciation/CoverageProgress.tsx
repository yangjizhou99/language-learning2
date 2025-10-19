'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, TrendingUp, BookOpen } from 'lucide-react';

interface UncoveredUnit {
  unit_id: number;
  symbol: string;
  category: string;
  subcategory?: string;
  frequency: number;
  recommended_sentences: Array<{
    sentence_id: number;
    text: string;
    level: number;
  }>;
}

interface CoverageStats {
  total_units: number;
  practiced_units: number;
  coverage_rate: number;
  category_stats: Array<{
    category: string;
    total: number;
    practiced: number;
    rate: number;
  }>;
}

interface CoverageProgressProps {
  lang: 'zh-CN' | 'en-US' | 'ja-JP';
  className?: string;
}

export default function CoverageProgress({ lang, className }: CoverageProgressProps) {
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [uncoveredUnits, setUncoveredUnits] = useState<UncoveredUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCoverageData();
  }, [lang]);

  async function loadCoverageData() {
    try {
      setLoading(true);
      setError(null);

      // 并行加载统计数据和未覆盖音节
      const [statsResponse, uncoveredResponse] = await Promise.all([
        fetch(`/api/pronunciation/coverage-stats?lang=${lang}`, {
          credentials: 'include',
        }),
        fetch(`/api/pronunciation/uncovered-units?lang=${lang}&limit=10`, {
          credentials: 'include',
        }),
      ]);

      if (!statsResponse.ok || !uncoveredResponse.ok) {
        throw new Error('加载覆盖度数据失败');
      }

      const [statsResult, uncoveredResult] = await Promise.all([
        statsResponse.json(),
        uncoveredResponse.json(),
      ]);

      if (statsResult.success && uncoveredResult.success) {
        setStats(statsResult.data);
        setUncoveredUnits(uncoveredResult.data);
      } else {
        throw new Error(statsResult.error || uncoveredResult.error || '加载失败');
      }
    } catch (err) {
      console.error('加载覆盖度数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  // 格式化分类名称
  const formatCategoryName = (category: string) => {
    const nameMap: Record<string, string> = {
      // 中文分类
      '声母': '声母',
      '韵母': '韵母',
      '声调': '声调',
      // 英文分类
      'vowel': '元音',
      'consonant': '辅音',
      'diphthong': '双元音',
      'combination': '组合音',
      // 日语分类
      'special': '特殊音',
    };
    return nameMap[category] || category;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            覆盖度进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
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
          <CardTitle>覆盖度进度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-red-500">
              <p className="mb-2">加载失败</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>覆盖度进度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center text-gray-500">
              <p className="mb-2">暂无数据</p>
              <p className="text-sm">完成一些发音练习后，这里将显示覆盖度进度</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>覆盖度进度</span>
          <Badge variant="outline" className="text-xs">
            {stats.practiced_units} / {stats.total_units}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 总体进度 */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {stats.coverage_rate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mb-4">
              总体覆盖度
            </div>
            <Progress value={stats.coverage_rate} className="h-3" />
          </div>

          {/* 分类进度 */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">分类进度</h4>
            <div className="space-y-2">
              {stats.category_stats.map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-16">
                      {formatCategoryName(category.category)}
                    </span>
                    <Progress value={category.rate} className="h-2 flex-1" />
                  </div>
                  <div className="text-xs text-gray-500 ml-2">
                    {category.practiced}/{category.total}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 未覆盖音节推荐 */}
          {uncoveredUnits.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">
                  最该练习的音节
                </h4>
                <Badge variant="secondary" className="text-xs">
                  {uncoveredUnits.length} 个
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {uncoveredUnits.slice(0, 6).map((unit) => (
                  <div
                    key={unit.unit_id}
                    className="p-2 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                    onClick={() => {
                      // 可以跳转到包含该音节的句子
                      console.log('跳转到音节练习:', unit.symbol);
                    }}
                  >
                    <div className="text-center">
                      <div className="font-mono font-semibold text-orange-700 text-sm">
                        {unit.symbol}
                      </div>
                      <div className="text-xs text-orange-600">
                        {formatCategoryName(unit.category)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {unit.frequency} 个句子
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {uncoveredUnits.length > 6 && (
                <div className="text-center">
                  <Button variant="outline" size="sm">
                    查看更多
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 学习建议 */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">学习建议</p>
                <p>
                  {stats.coverage_rate < 50 ? (
                    <>
                      您的覆盖度较低，建议优先练习高频音节。
                      点击上方的音节卡片，系统会为您推荐包含该音节的练习句子。
                    </>
                  ) : stats.coverage_rate < 80 ? (
                    <>
                      您的覆盖度中等，继续努力！
                      建议重点练习未覆盖的音节，提高整体发音水平。
                    </>
                  ) : (
                    <>
                      恭喜！您的覆盖度很高。
                      可以专注于提升薄弱音节的发音质量。
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
