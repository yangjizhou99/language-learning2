'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Globe, Monitor, TrendingUp, TrendingDown } from 'lucide-react';

interface PerformanceMetrics {
  timestamp: string;
  database: {
    avgQueryTime: number;
    totalQueries: number;
    slowQueries: number;
  };
  api: {
    avgResponseTime: number;
    totalRequests: number;
    errorRate: number;
  };
  cache: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  };
  frontend: {
    avgLoadTime: number;
    avgFirstPaint: number;
    totalPageViews: number;
  };
}

interface CacheStats {
  memory: {
    total: number;
    active: number;
    expired: number;
    maxSize: number;
  };
  pendingRequests: number;
}

export default function PerformancePage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // 模拟获取性能指标
      const mockMetrics: PerformanceMetrics = {
        timestamp: new Date().toISOString(),
        database: {
          avgQueryTime: Math.random() * 100 + 20, // 20-120ms
          totalQueries: Math.floor(Math.random() * 1000) + 500,
          slowQueries: Math.floor(Math.random() * 50) + 5,
        },
        api: {
          avgResponseTime: Math.random() * 200 + 50, // 50-250ms
          totalRequests: Math.floor(Math.random() * 2000) + 1000,
          errorRate: Math.random() * 5, // 0-5%
        },
        cache: {
          hitRate: Math.random() * 30 + 70, // 70-100%
          totalHits: Math.floor(Math.random() * 500) + 200,
          totalMisses: Math.floor(Math.random() * 100) + 50,
        },
        frontend: {
          avgLoadTime: Math.random() * 1000 + 500, // 500-1500ms
          avgFirstPaint: Math.random() * 500 + 200, // 200-700ms
          totalPageViews: Math.floor(Math.random() * 5000) + 2000,
        },
      };

      const mockCacheStats: CacheStats = {
        memory: {
          total: Math.floor(Math.random() * 100) + 50,
          active: Math.floor(Math.random() * 80) + 30,
          expired: Math.floor(Math.random() * 20) + 5,
          maxSize: 1000,
        },
        pendingRequests: Math.floor(Math.random() * 10),
      };

      setMetrics(mockMetrics);
      setCacheStats(mockCacheStats);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // 每30秒自动刷新
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPerformanceStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { status: 'good', color: 'green', icon: TrendingUp };
    if (value <= thresholds.warning)
      return { status: 'warning', color: 'yellow', icon: TrendingUp };
    return { status: 'poor', color: 'red', icon: TrendingDown };
  };

  const formatTime = (ms: number) => `${ms.toFixed(1)}ms`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">性能监控面板</h1>
        <div className="flex items-center space-x-4">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              最后更新: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchMetrics} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {metrics && (
        <>
          {/* 数据库性能 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                数据库性能
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatTime(metrics.database.avgQueryTime)}
                  </div>
                  <div className="text-sm text-gray-500">平均查询时间</div>
                  <Badge
                    variant={
                      getPerformanceStatus(metrics.database.avgQueryTime, {
                        good: 50,
                        warning: 100,
                      }).status === 'good'
                        ? 'default'
                        : 'destructive'
                    }
                    className="mt-1"
                  >
                    {getPerformanceStatus(metrics.database.avgQueryTime, { good: 50, warning: 100 })
                      .status === 'good'
                      ? '优秀'
                      : getPerformanceStatus(metrics.database.avgQueryTime, {
                            good: 50,
                            warning: 100,
                          }).status === 'warning'
                        ? '良好'
                        : '需要优化'}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatNumber(metrics.database.totalQueries)}
                  </div>
                  <div className="text-sm text-gray-500">总查询数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {formatNumber(metrics.database.slowQueries)}
                  </div>
                  <div className="text-sm text-gray-500">慢查询数</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API 性能 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                API 性能
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatTime(metrics.api.avgResponseTime)}
                  </div>
                  <div className="text-sm text-gray-500">平均响应时间</div>
                  <Badge
                    variant={
                      getPerformanceStatus(metrics.api.avgResponseTime, { good: 200, warning: 500 })
                        .status === 'good'
                        ? 'default'
                        : 'destructive'
                    }
                    className="mt-1"
                  >
                    {getPerformanceStatus(metrics.api.avgResponseTime, { good: 200, warning: 500 })
                      .status === 'good'
                      ? '优秀'
                      : getPerformanceStatus(metrics.api.avgResponseTime, {
                            good: 200,
                            warning: 500,
                          }).status === 'warning'
                        ? '良好'
                        : '需要优化'}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatNumber(metrics.api.totalRequests)}
                  </div>
                  <div className="text-sm text-gray-500">总请求数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {formatPercentage(metrics.api.errorRate)}
                  </div>
                  <div className="text-sm text-gray-500">错误率</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 缓存性能 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Monitor className="w-5 h-5 mr-2" />
                缓存性能
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(metrics.cache.hitRate)}
                  </div>
                  <div className="text-sm text-gray-500">缓存命中率</div>
                  <Badge
                    variant={metrics.cache.hitRate >= 80 ? 'default' : 'destructive'}
                    className="mt-1"
                  >
                    {metrics.cache.hitRate >= 80
                      ? '优秀'
                      : metrics.cache.hitRate >= 60
                        ? '良好'
                        : '需要优化'}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumber(metrics.cache.totalHits)}
                  </div>
                  <div className="text-sm text-gray-500">缓存命中</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatNumber(metrics.cache.totalMisses)}
                  </div>
                  <div className="text-sm text-gray-500">缓存未命中</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatNumber(metrics.cache.totalHits + metrics.cache.totalMisses)}
                  </div>
                  <div className="text-sm text-gray-500">总请求数</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 前端性能 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Monitor className="w-5 h-5 mr-2" />
                前端性能
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatTime(metrics.frontend.avgLoadTime)}
                  </div>
                  <div className="text-sm text-gray-500">平均加载时间</div>
                  <Badge
                    variant={
                      getPerformanceStatus(metrics.frontend.avgLoadTime, {
                        good: 1000,
                        warning: 3000,
                      }).status === 'good'
                        ? 'default'
                        : 'destructive'
                    }
                    className="mt-1"
                  >
                    {getPerformanceStatus(metrics.frontend.avgLoadTime, {
                      good: 1000,
                      warning: 3000,
                    }).status === 'good'
                      ? '优秀'
                      : getPerformanceStatus(metrics.frontend.avgLoadTime, {
                            good: 1000,
                            warning: 3000,
                          }).status === 'warning'
                        ? '良好'
                        : '需要优化'}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatTime(metrics.frontend.avgFirstPaint)}
                  </div>
                  <div className="text-sm text-gray-500">首次绘制时间</div>
                  <Badge
                    variant={
                      getPerformanceStatus(metrics.frontend.avgFirstPaint, {
                        good: 500,
                        warning: 1500,
                      }).status === 'good'
                        ? 'default'
                        : 'destructive'
                    }
                    className="mt-1"
                  >
                    {getPerformanceStatus(metrics.frontend.avgFirstPaint, {
                      good: 500,
                      warning: 1500,
                    }).status === 'good'
                      ? '优秀'
                      : getPerformanceStatus(metrics.frontend.avgFirstPaint, {
                            good: 500,
                            warning: 1500,
                          }).status === 'warning'
                        ? '良好'
                        : '需要优化'}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatNumber(metrics.frontend.totalPageViews)}
                  </div>
                  <div className="text-sm text-gray-500">页面浏览量</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 缓存统计 */}
          {cacheStats && (
            <Card>
              <CardHeader>
                <CardTitle>缓存统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{cacheStats.memory.total}</div>
                    <div className="text-sm text-gray-500">总缓存条目</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {cacheStats.memory.active}
                    </div>
                    <div className="text-sm text-gray-500">活跃缓存</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {cacheStats.memory.expired}
                    </div>
                    <div className="text-sm text-gray-500">过期缓存</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{cacheStats.pendingRequests}</div>
                    <div className="text-sm text-gray-500">待处理请求</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
