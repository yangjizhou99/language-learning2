'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Play,
  Settings,
  Zap,
  Target,
} from 'lucide-react';

interface OptimizationData {
  queryOptimization: {
    slowQueries: any[];
    indexUsage: any[];
    tableStats: any[];
    recommendations: string[];
  };
  errorAnalysis: {
    errorAnalysis: any;
    connectionStatus: any;
    lockAnalysis: any;
    longRunningQueries: any[];
    recommendations: string[];
  };
}

export default function AdvancedOptimizationPage() {
  const [data, setData] = useState<OptimizationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOptimizationData = async () => {
    setLoading(true);
    try {
      const [queryResponse, errorResponse] = await Promise.all([
        fetch('/api/admin/query-optimization'),
        fetch('/api/admin/error-analysis'),
      ]);

      const queryData = await queryResponse.json();
      const errorData = await errorResponse.json();

      setData({
        queryOptimization: queryData.success ? queryData.optimization : null,
        errorAnalysis: errorData.success ? errorData.analysis : null,
      });
    } catch (error) {
      console.error('Failed to fetch optimization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (action: string, endpoint: string) => {
    setActionLoading(action);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
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

  const getPerformanceLevel = (value: number, thresholds: { good: number; excellent: number }) => {
    if (value <= thresholds.excellent) return { level: 'excellent', color: 'green', text: '优秀' };
    if (value <= thresholds.good) return { level: 'good', color: 'blue', text: '良好' };
    return { level: 'needs-improvement', color: 'orange', text: '需改进' };
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">高级性能优化</h1>
          <p className="text-gray-600 mt-2">深度分析和优化系统性能</p>
        </div>
        <Button onClick={fetchOptimizationData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新分析
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>正在深度分析系统性能...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* 查询优化 */}
          {data.queryOptimization && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  数据库查询优化
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {data.queryOptimization.slowQueries.length}
                    </div>
                    <div className="text-sm text-gray-500">慢查询</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {data.queryOptimization.indexUsage.length}
                    </div>
                    <div className="text-sm text-gray-500">索引数量</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {data.queryOptimization.tableStats.length}
                    </div>
                    <div className="text-sm text-gray-500">数据表</div>
                  </div>
                </div>

                {/* 慢查询详情 */}
                {data.queryOptimization.slowQueries.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">慢查询详情</h4>
                    <div className="space-y-2">
                      {data.queryOptimization.slowQueries
                        .slice(0, 3)
                        .map((query: any, index: number) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium">
                                平均时间: {query.mean_time?.toFixed(1)}ms
                              </span>
                              <Badge variant="outline">{query.calls} 次调用</Badge>
                            </div>
                            <div className="text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded">
                              {query.query?.substring(0, 150)}...
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 索引使用情况 */}
                <div className="mb-4">
                  <h4 className="font-medium mb-2">索引使用情况</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {data.queryOptimization.indexUsage
                      .slice(0, 6)
                      .map((index: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-2 border rounded"
                        >
                          <span className="text-sm">{index.indexname}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">{index.idx_scan} 次扫描</span>
                            <Badge
                              variant={
                                index.usage_status === 'ACTIVE'
                                  ? 'default'
                                  : index.usage_status === 'LOW_USAGE'
                                    ? 'secondary'
                                    : 'destructive'
                              }
                              className="text-xs"
                            >
                              {index.usage_status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => executeAction('vacuum', '/api/admin/query-optimization')}
                    disabled={actionLoading === 'vacuum'}
                    variant="outline"
                    size="sm"
                  >
                    {actionLoading === 'vacuum' ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="w-4 h-4 mr-2" />
                    )}
                    清理数据库
                  </Button>
                  <Button
                    onClick={() => executeAction('reset_stats', '/api/admin/query-optimization')}
                    disabled={actionLoading === 'reset_stats'}
                    variant="outline"
                    size="sm"
                  >
                    {actionLoading === 'reset_stats' ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    重置统计
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 错误分析 */}
          {data.errorAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  错误分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {data.errorAnalysis.errorAnalysis?.commonErrors?.length || 0}
                    </div>
                    <div className="text-sm text-gray-500">错误类型</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {data.errorAnalysis.connectionStatus?.total_connections || 0}
                    </div>
                    <div className="text-sm text-gray-500">总连接数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {data.errorAnalysis.connectionStatus?.active_connections || 0}
                    </div>
                    <div className="text-sm text-gray-500">活跃连接</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {data.errorAnalysis.lockAnalysis?.waiting_locks || 0}
                    </div>
                    <div className="text-sm text-gray-500">等待锁</div>
                  </div>
                </div>

                {/* 常见错误 */}
                {data.errorAnalysis.errorAnalysis?.commonErrors && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">常见错误</h4>
                    <div className="space-y-2">
                      {data.errorAnalysis.errorAnalysis.commonErrors.map(
                        (error: any, index: number) => (
                          <div
                            key={index}
                            className="flex justify-between items-center p-2 border rounded"
                          >
                            <span className="text-sm">{error.error}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">{error.count} 次</span>
                              <Badge variant="outline" className="text-xs">
                                {error.percentage}%
                              </Badge>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* 长时间运行查询 */}
                {data.errorAnalysis.longRunningQueries.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2 text-red-600">长时间运行查询</h4>
                    <div className="space-y-2">
                      {data.errorAnalysis.longRunningQueries.map((query: any, index: number) => (
                        <div key={index} className="p-3 border border-red-200 rounded-lg bg-red-50">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">运行时间: {query.duration}</span>
                            <Badge variant="destructive" className="text-xs">
                              PID: {query.pid}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600 font-mono bg-white p-2 rounded">
                            {query.query?.substring(0, 100)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={() => executeAction('kill_long_queries', '/api/admin/error-analysis')}
                    disabled={actionLoading === 'kill_long_queries'}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {actionLoading === 'kill_long_queries' ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mr-2" />
                    )}
                    终止长查询
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 优化建议 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="w-5 h-5 mr-2" />
                优化建议
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 查询优化建议 */}
                {data.queryOptimization?.recommendations && (
                  <div>
                    <h4 className="font-medium mb-3">数据库优化建议</h4>
                    <div className="space-y-2">
                      {data.queryOptimization.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="flex items-start">
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                          <p className="text-sm text-gray-700">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 错误优化建议 */}
                {data.errorAnalysis?.recommendations && (
                  <div>
                    <h4 className="font-medium mb-3">错误处理建议</h4>
                    <div className="space-y-2">
                      {data.errorAnalysis.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="flex items-start">
                          <div className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-2 mr-3"></div>
                          <p className="text-sm text-gray-700">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速优化操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => (window.location.href = '/admin/performance-test')}
                  className="h-16 flex flex-col items-center justify-center"
                >
                  <Play className="w-5 h-5 mb-1" />
                  <span className="text-sm">运行性能测试</span>
                </Button>
                <Button
                  onClick={() => (window.location.href = '/admin/performance')}
                  variant="outline"
                  className="h-16 flex flex-col items-center justify-center"
                >
                  <TrendingUp className="w-5 h-5 mb-1" />
                  <span className="text-sm">查看性能监控</span>
                </Button>
                <Button
                  onClick={() => (window.location.href = '/admin/performance-optimization')}
                  variant="outline"
                  className="h-16 flex flex-col items-center justify-center"
                >
                  <Zap className="w-5 h-5 mb-1" />
                  <span className="text-sm">基础优化</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
