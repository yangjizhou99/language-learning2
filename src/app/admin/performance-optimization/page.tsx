'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  Zap, 
  TrendingUp,
  RefreshCw,
  Play,
  Settings
} from 'lucide-react';

interface OptimizationData {
  cache: {
    working: boolean;
    hitRate: number;
    stats: any;
  };
  database: {
    slowQueries: any[];
    indexStats: any[];
    tableSizes: any[];
    connections: any[];
  };
  recommendations: string[];
}

export default function PerformanceOptimizationPage() {
  const [data, setData] = useState<OptimizationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOptimizationData = async () => {
    setLoading(true);
    try {
      // 获取缓存诊断数据
      const cacheResponse = await fetch('/api/admin/cache-diagnostic');
      const cacheData = await cacheResponse.json();

      // 获取数据库优化数据
      const dbResponse = await fetch('/api/admin/db-optimization');
      const dbData = await dbResponse.json();

      // 生成优化建议
      const recommendations = generateRecommendations(cacheData, dbData);

      setData({
        cache: {
          working: cacheData.success && cacheData.diagnostic?.dataMatch,
          hitRate: cacheData.success ? 100 : 0,
          stats: cacheData.success ? cacheData.diagnostic?.stats : null
        },
        database: {
          slowQueries: dbData.success ? dbData.optimization?.slowQueries || [] : [],
          indexStats: dbData.success ? dbData.optimization?.indexStats || [] : [],
          tableSizes: dbData.success ? dbData.optimization?.tableSizes || [] : [],
          connections: dbData.success ? dbData.optimization?.connections || [] : []
        },
        recommendations
      });
    } catch (error) {
      console.error('Failed to fetch optimization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = (cacheData: any, dbData: any): string[] => {
    const recommendations: string[] = [];

    // 缓存相关建议
    if (!cacheData.success || !cacheData.diagnostic?.dataMatch) {
      recommendations.push('缓存系统未正常工作，需要检查缓存配置');
    }

    // 数据库相关建议
    if (dbData.success) {
      const slowQueries = dbData.optimization?.slowQueries || [];
      if (slowQueries.length > 0) {
        recommendations.push(`发现 ${slowQueries.length} 个慢查询，需要优化`);
      }

      const indexStats = dbData.optimization?.indexStats || [];
      const unusedIndexes = indexStats.filter((idx: any) => idx.idx_scan === 0);
      if (unusedIndexes.length > 0) {
        recommendations.push(`发现 ${unusedIndexes.length} 个未使用的索引，建议清理`);
      }
    }

    // 通用建议
    recommendations.push('建议定期运行 ANALYZE 更新数据库统计信息');
    recommendations.push('考虑增加数据库连接池大小');
    recommendations.push('监控内存使用情况，避免内存泄漏');

    return recommendations;
  };

  const executeAction = async (action: string) => {
    setActionLoading(action);
    try {
      let response;
      if (action === 'analyze' || action === 'vacuum') {
        response = await fetch('/api/admin/db-optimization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
      } else if (action === 'clear-cache') {
        response = await fetch('/api/admin/cache-diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear' })
        });
      }

      if (response?.ok) {
        const result = await response.json();
        if (result.success) {
          // 重新获取数据
          await fetchOptimizationData();
        }
      }
    } catch (error) {
      console.error(`Failed to execute ${action}:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchOptimizationData();
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <AlertTriangle className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusBadge = (status: boolean) => {
    return status ? (
      <Badge variant="default" className="bg-green-500">正常</Badge>
    ) : (
      <Badge variant="destructive">异常</Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">性能优化中心</h1>
          <p className="text-gray-600 mt-2">诊断和优化系统性能问题</p>
        </div>
        <Button onClick={fetchOptimizationData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新数据
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>正在分析系统性能...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* 缓存状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  缓存系统状态
                </div>
                {getStatusBadge(data.cache.working)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data.cache.working ? '100%' : '0%'}
                  </div>
                  <div className="text-sm text-gray-500">缓存命中率</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data.cache.stats?.memory?.active || 0}
                  </div>
                  <div className="text-sm text-gray-500">活跃缓存条目</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data.cache.stats?.pendingRequests || 0}
                  </div>
                  <div className="text-sm text-gray-500">待处理请求</div>
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <Button 
                  onClick={() => executeAction('clear-cache')}
                  disabled={actionLoading === 'clear-cache'}
                  variant="outline"
                  size="sm"
                >
                  {actionLoading === 'clear-cache' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4 mr-2" />
                  )}
                  清理缓存
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 数据库状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2" />
                数据库状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {data.database.slowQueries.length}
                  </div>
                  <div className="text-sm text-gray-500">慢查询</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data.database.indexStats.length}
                  </div>
                  <div className="text-sm text-gray-500">索引数量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data.database.connections[0]?.active_connections || 0}
                  </div>
                  <div className="text-sm text-gray-500">活跃连接</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data.database.tableSizes.length}
                  </div>
                  <div className="text-sm text-gray-500">数据表</div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={() => executeAction('analyze')}
                  disabled={actionLoading === 'analyze'}
                  variant="outline"
                  size="sm"
                >
                  {actionLoading === 'analyze' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4 mr-2" />
                  )}
                  更新统计信息
                </Button>
                <Button 
                  onClick={() => executeAction('vacuum')}
                  disabled={actionLoading === 'vacuum'}
                  variant="outline"
                  size="sm"
                >
                  {actionLoading === 'vacuum' ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4 mr-2" />
                  )}
                  清理数据库
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 慢查询详情 */}
          {data.database.slowQueries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-red-600">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  慢查询列表
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.database.slowQueries.slice(0, 5).map((query: any, index: number) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-medium">
                          平均时间: {query.mean_time?.toFixed(2)}ms
                        </div>
                        <Badge variant="destructive">
                          {query.calls} 次调用
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded">
                        {query.query?.substring(0, 200)}...
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 优化建议 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                优化建议
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                    <p className="text-sm text-gray-700">{recommendation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速优化操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={() => window.location.href = '/admin/performance-test'}
                  className="h-20 flex flex-col items-center justify-center"
                >
                  <Play className="w-6 h-6 mb-2" />
                  <span>运行性能测试</span>
                </Button>
                <Button 
                  onClick={() => window.location.href = '/admin/performance'}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center"
                >
                  <TrendingUp className="w-6 h-6 mb-2" />
                  <span>查看性能监控</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
