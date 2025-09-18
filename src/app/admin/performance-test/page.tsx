'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Database,
  Globe,
  Monitor,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  duration?: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  tests: TestResult[];
  totalDuration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export default function PerformanceTestPage() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([
    {
      id: 'database',
      name: '数据库性能测试',
      description: '测试数据库查询性能和索引使用情况',
      icon: <Database className="w-5 h-5" />,
      status: 'pending',
      tests: [
        { name: 'Shadowing题目查询', status: 'pending' },
        { name: 'Cloze题目查询', status: 'pending' },
        { name: '用户练习记录查询', status: 'pending' },
        { name: '文章草稿状态查询', status: 'pending' },
        { name: '索引使用情况检查', status: 'pending' },
      ],
    },
    {
      id: 'api',
      name: 'API性能测试',
      description: '测试API响应时间和缓存效果',
      icon: <Globe className="w-5 h-5" />,
      status: 'pending',
      tests: [
        { name: 'Shadowing下一题API', status: 'pending' },
        { name: 'Cloze下一题API', status: 'pending' },
        { name: 'Shadowing目录API', status: 'pending' },
        { name: '词汇表API', status: 'pending' },
      ],
    },
    {
      id: 'cache',
      name: '缓存性能测试',
      description: '测试缓存命中率和性能提升',
      icon: <Monitor className="w-5 h-5" />,
      status: 'pending',
      tests: [
        { name: '缓存命中率测试', status: 'pending' },
        { name: '缓存性能提升测试', status: 'pending' },
        { name: '缓存统计检查', status: 'pending' },
      ],
    },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [testHistory, setTestHistory] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  // 真实测试执行
  const runTest = async (suiteId: string, testName: string): Promise<TestResult> => {
    const startTime = Date.now();

    try {
      const response = await fetch('/api/admin/performance-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testType: suiteId,
          testName: testName,
        }),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (data.success) {
        return {
          name: testName,
          status: 'completed',
          duration,
          details: {
            avgTime: data.result?.duration || duration,
            recordCount: data.result?.recordCount || 0,
            successRate: 100,
            dataSize: data.result?.dataSize || 0,
            cacheStats: data.result?.cacheStats,
          },
        };
      } else {
        return {
          name: testName,
          status: 'failed',
          duration,
          error: data.error || '测试失败',
        };
      }
    } catch (error) {
      return {
        name: testName,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : '网络错误',
      };
    }
  };

  const runTestSuite = async (suiteId: string) => {
    const suiteIndex = testSuites.findIndex((s) => s.id === suiteId);
    if (suiteIndex === -1) return;

    // 更新测试套件状态
    setTestSuites((prev) =>
      prev.map((suite, index) =>
        index === suiteIndex ? { ...suite, status: 'running' as const } : suite,
      ),
    );

    const suite = testSuites[suiteIndex];
    const startTime = Date.now();

    // 逐个运行测试
    for (let i = 0; i < suite.tests.length; i++) {
      const test = suite.tests[i];
      setCurrentTest(`${suite.name} - ${test.name}`);

      // 更新测试状态为运行中
      setTestSuites((prev) =>
        prev.map((s, index) =>
          index === suiteIndex
            ? {
                ...s,
                tests: s.tests.map((t, testIndex) =>
                  testIndex === i ? { ...t, status: 'running' as const } : t,
                ),
              }
            : s,
        ),
      );

      const result = await runTest(suiteId, test.name);

      // 更新测试结果
      setTestSuites((prev) =>
        prev.map((s, index) =>
          index === suiteIndex
            ? {
                ...s,
                tests: s.tests.map((t, testIndex) => (testIndex === i ? result : t)),
              }
            : s,
        ),
      );

      // 更新进度
      const totalTests = testSuites.reduce((sum, s) => sum + s.tests.length, 0);
      const completedTests =
        testSuites.reduce(
          (sum, s) =>
            sum + s.tests.filter((t) => t.status === 'completed' || t.status === 'failed').length,
          0,
        ) + 1;
      setProgress((completedTests / totalTests) * 100);
    }

    // 完成测试套件
    const totalDuration = Date.now() - startTime;
    setTestSuites((prev) =>
      prev.map((suite, index) =>
        index === suiteIndex
          ? {
              ...suite,
              status: 'completed' as const,
              totalDuration,
            }
          : suite,
      ),
    );

    setCurrentTest('');
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setProgress(0);
    setCurrentTest('准备测试...');

    try {
      // 重置所有测试状态
      setTestSuites((prev) =>
        prev.map((suite) => ({
          ...suite,
          status: 'pending' as const,
          tests: suite.tests.map((test) => ({ ...test, status: 'pending' as const })),
        })),
      );

      for (const suite of testSuites) {
        await runTestSuite(suite.id);
      }

      // 保存测试历史
      const testResult = {
        timestamp: new Date().toISOString(),
        suites: testSuites,
        totalDuration: testSuites.reduce((sum, s) => sum + (s.totalDuration || 0), 0),
      };

      setTestHistory((prev) => [testResult, ...prev.slice(0, 9)]); // 保留最近10次测试
      localStorage.setItem(
        'performance-test-history',
        JSON.stringify([testResult, ...testHistory.slice(0, 9)]),
      );
    } finally {
      setIsRunning(false);
      setCurrentTest('');
      setProgress(100);
    }
  };

  const runQuickTest = async () => {
    setIsRunning(true);
    setCurrentTest('运行快速测试...');

    try {
      const response = await fetch('/api/admin/performance-test?runAll=true');
      const data = await response.json();

      if (data.success) {
        // 更新测试结果
        const updatedSuites = testSuites.map((suite) => {
          const suiteResults = data.results.filter((r: any) => r.testType === suite.id);
          return {
            ...suite,
            status: 'completed' as const,
            tests: suite.tests.map((test) => {
              const result = suiteResults.find((r: any) => r.testName === test.name);
              if (result) {
                return {
                  name: test.name,
                  status: result.success ? ('completed' as const) : ('failed' as const),
                  duration: result.duration,
                  details: result.success
                    ? {
                        avgTime: result.result?.duration || result.duration,
                        recordCount: result.result?.recordCount || 0,
                        successRate: 100,
                      }
                    : undefined,
                  error: result.success ? undefined : result.error,
                };
              }
              return test;
            }),
            totalDuration: suiteResults.reduce((sum: number, r: any) => sum + r.duration, 0),
          };
        });

        setTestSuites(updatedSuites);

        // 保存测试历史
        const testResult = {
          timestamp: new Date().toISOString(),
          suites: updatedSuites,
          totalDuration: data.summary.avgDuration * data.summary.total,
          summary: data.summary,
        };

        setTestHistory((prev) => [testResult, ...prev.slice(0, 9)]);
        localStorage.setItem(
          'performance-test-history',
          JSON.stringify([testResult, ...testHistory.slice(0, 9)]),
        );
      }
    } catch (error) {
      console.error('Quick test failed:', error);
    } finally {
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500">
            完成
          </Badge>
        );
      case 'failed':
        return <Badge variant="destructive">失败</Badge>;
      case 'running':
        return (
          <Badge variant="secondary" className="bg-blue-500">
            运行中
          </Badge>
        );
      default:
        return <Badge variant="outline">待执行</Badge>;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      testSuites,
      summary: {
        totalTests: testSuites.reduce((sum, s) => sum + s.tests.length, 0),
        completedTests: testSuites.reduce(
          (sum, s) => sum + s.tests.filter((t) => t.status === 'completed').length,
          0,
        ),
        failedTests: testSuites.reduce(
          (sum, s) => sum + s.tests.filter((t) => t.status === 'failed').length,
          0,
        ),
        totalDuration: testSuites.reduce((sum, s) => sum + (s.totalDuration || 0), 0),
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-test-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 加载测试历史
  useEffect(() => {
    const saved = localStorage.getItem('performance-test-history');
    if (saved) {
      try {
        setTestHistory(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load test history:', error);
      }
    }
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">性能测试中心</h1>
          <p className="text-gray-600 mt-2">定期测试系统性能，确保最佳用户体验</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={downloadReport} variant="outline" disabled={isRunning}>
            <Download className="w-4 h-4 mr-2" />
            下载报告
          </Button>
          <Button
            onClick={runQuickTest}
            disabled={isRunning}
            variant="outline"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? '测试中...' : '快速测试'}
          </Button>
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? '测试中...' : '完整测试'}
          </Button>
        </div>
      </div>

      {/* 进度条 */}
      {isRunning && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>测试进度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
              {currentTest && <p className="text-sm text-gray-600">正在执行: {currentTest}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 测试套件 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {testSuites.map((suite) => (
          <Card key={suite.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  {suite.icon}
                  <span className="ml-2">{suite.name}</span>
                </div>
                {getStatusBadge(suite.status)}
              </CardTitle>
              <p className="text-sm text-gray-600">{suite.description}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suite.tests.map((test, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center">
                      {getStatusIcon(test.status)}
                      <span className="ml-2 text-sm">{test.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {test.duration && (
                        <span className="text-xs text-gray-500">
                          {formatDuration(test.duration)}
                        </span>
                      )}
                      {test.details && (
                        <Badge variant="outline" className="text-xs">
                          {test.details.avgTime?.toFixed(1)}ms
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {suite.totalDuration && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span>总耗时:</span>
                      <span className="font-medium">{formatDuration(suite.totalDuration)}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 测试历史 */}
      {testHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>测试历史</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testHistory.slice(0, 5).map((history, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded border">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center">
                      {history.suites.every((s: any) => s.status === 'completed') ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{new Date(history.timestamp).toLocaleString()}</p>
                      <p className="text-sm text-gray-600">
                        总耗时: {formatDuration(history.totalDuration)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {history.suites.reduce(
                        (sum: number, s: any) =>
                          sum + s.tests.filter((t: any) => t.status === 'completed').length,
                        0,
                      )}{' '}
                      / {history.suites.reduce((sum: number, s: any) => sum + s.tests.length, 0)}{' '}
                      通过
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 测试建议 */}
      <Card>
        <CardHeader>
          <CardTitle>测试建议</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">定期测试</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 每周运行一次完整测试</li>
                <li>• 每次部署后运行测试</li>
                <li>• 性能下降时立即测试</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">性能基准</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 数据库查询: &lt; 100ms</li>
                <li>• API响应: &lt; 500ms</li>
                <li>• 缓存命中率: &gt; 80%</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
