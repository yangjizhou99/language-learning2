'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Users,
  Activity,
  DollarSign,
  Calendar,
  Search,
  Download,
  RefreshCw,
  Settings,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { APIUsageAlert } from '@/components/APIUsageAlert';
import { AIConfigPanel } from '@/components/AIConfigPanel';
import { UserLimitsPanel } from '@/components/UserLimitsPanel';

interface APIUsageStats {
  user_id: string;
  user_email: string;
  user_name: string;
  total_calls: number;
  total_tokens: number;
  total_cost: number;
  deepseek_calls: number;
  deepseek_tokens: number;
  deepseek_cost: number;
  openrouter_calls: number;
  openrouter_tokens: number;
  openrouter_cost: number;
  last_used: string;
  created_at: string;
}

interface UsageTimeSeries {
  date: string;
  calls: number;
  tokens: number;
  cost: number;
}

interface APILimits {
  enabled: boolean;
  daily_calls_limit: number;
  daily_tokens_limit: number;
  daily_cost_limit: number;
  monthly_calls_limit: number;
  monthly_tokens_limit: number;
  monthly_cost_limit: number;
  alert_threshold: number; // 百分比，如80表示80%时警告
}

export default function APIUsageStatsPage() {
  const [stats, setStats] = useState<APIUsageStats[]>([]);
  const [timeSeries, setTimeSeries] = useState<UsageTimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'calls' | 'tokens' | 'cost'>('calls');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [creatingTable, setCreatingTable] = useState(false);
  const [limits, setLimits] = useState<APILimits | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<APIUsageStats | null>(null);
  const [showUserLimits, setShowUserLimits] = useState(false);

  // 创建API使用日志表
  const createUsageTable = async () => {
    setCreatingTable(true);
    try {
      const response = await fetch('/api/admin/create-usage-table', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert('表创建成功！');
        fetchUsageStats();
      } else {
        alert('表创建失败：' + data.error);
      }
    } catch (error) {
      alert('创建表时出错：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setCreatingTable(false);
    }
  };

  // 获取API用量统计数据
  const fetchUsageStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        timeRange,
        sortBy,
        search: searchTerm,
      });

      const response = await fetch(`/api/admin/api-usage?${params}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.stats || []);
        setTimeSeries(data.timeSeries || []);

        // 若当前时间范围无数据，且不是“全部时间”，自动回退到“全部时间”再试（避免空白）
        if ((data.stats?.length || 0) === 0 && timeRange !== 'all' && !searchTerm) {
          setTimeRange('all');
          return;
        }
      }
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageStats();
  }, [timeRange, sortBy, searchTerm]);

  useEffect(() => {
    fetchLimits();
  }, []);

  // 获取API限制设置
  const fetchLimits = async () => {
    try {
      const response = await fetch('/api/admin/api-limits');
      const data = await response.json();
      if (data.success && data.limits) {
        setLimits(data.limits);
      }
    } catch (error) {
      console.error('Failed to fetch limits:', error);
    }
  };

  // 保存API限制设置
  const saveLimits = async () => {
    if (!limits) {
      setMessage({ type: 'error', text: '没有可保存的限制设置' });
      return;
    }

    setSavingLimits(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/api-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limits),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: '限制设置已保存' });
        // 保存成功后重新获取限制设置
        await fetchLimits();
      } else {
        setMessage({ type: 'error', text: '保存失败：' + data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSavingLimits(false);
    }
  };

  // 计算总计数据
  const totalStats = stats.reduce(
    (acc, stat) => ({
      totalCalls: acc.totalCalls + stat.total_calls,
      totalTokens: acc.totalTokens + stat.total_tokens,
      totalCost: acc.totalCost + stat.total_cost,
      deepseekCalls: acc.deepseekCalls + stat.deepseek_calls,
      openrouterCalls: acc.openrouterCalls + stat.openrouter_calls,
    }),
    {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0,
      deepseekCalls: 0,
      openrouterCalls: 0,
    },
  );

  // 格式化数字
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // 格式化费用
  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  // 导出数据
  const exportData = () => {
    const csvContent = [
      [
        '用户邮箱',
        '用户名',
        '总调用次数',
        '总Token数',
        '总费用',
        'DeepSeek调用',
        'OpenRouter调用',
        '最后使用时间',
      ],
      ...stats.map((stat) => [
        stat.user_email,
        stat.user_name || 'N/A',
        stat.total_calls,
        stat.total_tokens,
        stat.total_cost.toFixed(4),
        stat.deepseek_calls,
        stat.openrouter_calls,
        new Date(stat.last_used).toLocaleString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-usage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API用量统计</h1>
          <p className="text-gray-600">监控和管理用户的API使用情况</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createUsageTable} disabled={creatingTable} variant="outline" size="sm">
            {creatingTable ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {creatingTable ? '创建表中...' : '创建表'}
          </Button>
          <Button onClick={fetchUsageStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {/* 标签页导航 */}
      <Tabs defaultValue="usage" className="space-y-6">
        <TabsList>
          <TabsTrigger value="usage">使用统计</TabsTrigger>
          <TabsTrigger value="limits">使用限制</TabsTrigger>
          <TabsTrigger value="ai-config">AI配置</TabsTrigger>
        </TabsList>

        {/* 使用统计标签页 */}
        <TabsContent value="usage" className="space-y-6">
          {/* API使用警告 */}
          {stats.length > 0 && (
            <div className="space-y-2">
              {stats.slice(0, 5).map((stat) => (
                <APIUsageAlert key={stat.user_id} userId={stat.user_id} />
              ))}
            </div>
          )}

          {/* 筛选控件 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="搜索用户邮箱或姓名..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calls">调用次数</SelectItem>
                    <SelectItem value="tokens">Token数量</SelectItem>
                    <SelectItem value="cost">费用</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="时间范围" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">最近7天</SelectItem>
                    <SelectItem value="30d">最近30天</SelectItem>
                    <SelectItem value="90d">最近90天</SelectItem>
                    <SelectItem value="all">全部时间</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 总计统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">总调用次数</p>
                    <p className="text-2xl font-bold">{formatNumber(totalStats.totalCalls)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">总Token数</p>
                    <p className="text-2xl font-bold">{formatNumber(totalStats.totalTokens)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">总费用</p>
                    <p className="text-2xl font-bold">{formatCost(totalStats.totalCost)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">活跃用户</p>
                    <p className="text-2xl font-bold">{stats.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 详细统计表格 */}
          <Card>
            <CardHeader>
              <CardTitle>用户API使用详情</CardTitle>
              <CardDescription>显示每个用户的详细API使用情况</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  加载中...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">用户</th>
                        <th className="text-right p-4">总调用</th>
                        <th className="text-right p-4">总Token</th>
                        <th className="text-right p-4">总费用</th>
                        <th className="text-right p-4">DeepSeek</th>
                        <th className="text-right p-4">OpenRouter</th>
                        <th className="text-right p-4">最后使用</th>
                        <th className="text-center p-4">管理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((stat) => (
                        <tr key={stat.user_id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div>
                              <div className="font-medium">{stat.user_email}</div>
                              <div className="text-sm text-gray-500">
                                {stat.user_name || '未设置姓名'}
                              </div>
                            </div>
                          </td>
                          <td className="text-right p-4">
                            <Badge variant="outline">{formatNumber(stat.total_calls)}</Badge>
                          </td>
                          <td className="text-right p-4">{formatNumber(stat.total_tokens)}</td>
                          <td className="text-right p-4 font-medium">
                            {formatCost(stat.total_cost)}
                          </td>
                          <td className="text-right p-4">
                            <div className="text-sm">
                              <div>{formatNumber(stat.deepseek_calls)} 次</div>
                              <div className="text-gray-500">{formatCost(stat.deepseek_cost)}</div>
                            </div>
                          </td>
                          <td className="text-right p-4">
                            <div className="text-sm">
                              <div>{formatNumber(stat.openrouter_calls)} 次</div>
                              <div className="text-gray-500">
                                {formatCost(stat.openrouter_cost)}
                              </div>
                            </div>
                          </td>
                          <td className="text-right p-4 text-sm text-gray-500">
                            {new Date(stat.last_used).toLocaleDateString()}
                          </td>
                          <td className="text-center p-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(stat);
                                setShowUserLimits(true);
                              }}
                            >
                              <Settings className="h-4 w-4 mr-1" />
                              用户管理
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {stats.length === 0 && (
                    <div className="text-center py-8 text-gray-500">没有找到匹配的用户数据</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 使用限制标签页 */}
        <TabsContent value="limits" className="space-y-6">
          {/* API使用限制设置 */}
          {limits === null ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <span className="ml-2">加载限制设置中...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  API使用限制设置
                </CardTitle>
                <CardDescription>设置全局API使用限制，防止过度使用</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 消息提示 */}
                {message && (
                  <Alert
                    className={
                      message.type === 'success'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription
                      className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}
                    >
                      {message.text}
                    </AlertDescription>
                  </Alert>
                )}

                {/* 启用限制开关 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">启用API使用限制</Label>
                    <p className="text-sm text-gray-600">
                      开启后将限制用户的API使用量，超过限制时将拒绝请求
                    </p>
                  </div>
                  <Switch
                    checked={limits?.enabled || false}
                    onCheckedChange={(checked) =>
                      setLimits((prev) => (prev ? { ...prev, enabled: checked } : null))
                    }
                  />
                </div>

                {/* 限制设置表单 */}
                {limits?.enabled && (
                  <div className="space-y-6">
                    {/* 每日限制 */}
                    <div>
                      <h4 className="text-lg font-medium mb-4">每日限制</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="daily-calls">每日调用次数限制</Label>
                          <Input
                            id="daily-calls"
                            type="number"
                            min="0"
                            value={limits?.daily_calls_limit || 0}
                            onChange={(e) =>
                              setLimits((prev) =>
                                prev
                                  ? { ...prev, daily_calls_limit: parseInt(e.target.value) || 0 }
                                  : null,
                              )
                            }
                            placeholder="1000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="daily-tokens">每日Token限制</Label>
                          <Input
                            id="daily-tokens"
                            type="number"
                            min="0"
                            value={limits?.daily_tokens_limit || 0}
                            onChange={(e) =>
                              setLimits((prev) =>
                                prev
                                  ? { ...prev, daily_tokens_limit: parseInt(e.target.value) || 0 }
                                  : null,
                              )
                            }
                            placeholder="1000000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="daily-cost">每日费用限制 ($)</Label>
                          <Input
                            id="daily-cost"
                            type="number"
                            min="0"
                            step="0.01"
                            value={limits?.daily_cost_limit || 0}
                            onChange={(e) =>
                              setLimits((prev) =>
                                prev
                                  ? { ...prev, daily_cost_limit: parseFloat(e.target.value) || 0 }
                                  : null,
                              )
                            }
                            placeholder="10.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 每月限制 */}
                    <div>
                      <h4 className="text-lg font-medium mb-4">每月限制</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="monthly-calls">每月调用次数限制</Label>
                          <Input
                            id="monthly-calls"
                            type="number"
                            min="0"
                            value={limits?.monthly_calls_limit || 0}
                            onChange={(e) =>
                              setLimits((prev) =>
                                prev
                                  ? { ...prev, monthly_calls_limit: parseInt(e.target.value) || 0 }
                                  : null,
                              )
                            }
                            placeholder="30000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="monthly-tokens">每月Token限制</Label>
                          <Input
                            id="monthly-tokens"
                            type="number"
                            min="0"
                            value={limits?.monthly_tokens_limit || 0}
                            onChange={(e) =>
                              setLimits((prev) =>
                                prev
                                  ? { ...prev, monthly_tokens_limit: parseInt(e.target.value) || 0 }
                                  : null,
                              )
                            }
                            placeholder="30000000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="monthly-cost">每月费用限制 ($)</Label>
                          <Input
                            id="monthly-cost"
                            type="number"
                            min="0"
                            step="0.01"
                            value={limits?.monthly_cost_limit || 0}
                            onChange={(e) =>
                              setLimits((prev) =>
                                prev
                                  ? { ...prev, monthly_cost_limit: parseFloat(e.target.value) || 0 }
                                  : null,
                              )
                            }
                            placeholder="300.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 警告阈值 */}
                    <div>
                      <h4 className="text-lg font-medium mb-4">警告设置</h4>
                      <div className="max-w-xs">
                        <Label htmlFor="alert-threshold">警告阈值 (%)</Label>
                        <Input
                          id="alert-threshold"
                          type="number"
                          min="0"
                          max="100"
                          value={limits?.alert_threshold || 80}
                          onChange={(e) =>
                            setLimits((prev) =>
                              prev
                                ? { ...prev, alert_threshold: parseInt(e.target.value) || 80 }
                                : null,
                            )
                          }
                          placeholder="80"
                        />
                        <p className="text-sm text-gray-600 mt-1">
                          当使用量达到限制的此百分比时发出警告
                        </p>
                      </div>
                    </div>

                    {/* 保存按钮 */}
                    <div className="flex justify-end">
                      <Button onClick={saveLimits} disabled={savingLimits} className="min-w-32">
                        {savingLimits ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {savingLimits ? '保存中...' : '保存设置'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI配置标签页 */}
        <TabsContent value="ai-config" className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI功能配置管理</CardTitle>
                <p className="text-sm text-muted-foreground">
                  为用户配置AI功能和模型权限。点击用户表格中的"管理限制"按钮可以为特定用户设置AI配置。
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>选择用户进行AI配置管理</p>
                  <p className="text-sm">在用户表格中点击"管理限制"按钮</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 用户管理模态框 */}
        {showUserLimits && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  用户管理 - {selectedUser.user_name || selectedUser.user_email}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowUserLimits(false);
                    setSelectedUser(null);
                  }}
                >
                  ✕
                </Button>
              </div>

              <Tabs defaultValue="limits" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="limits">使用限制</TabsTrigger>
                  <TabsTrigger value="ai-config">AI配置</TabsTrigger>
                </TabsList>

                <TabsContent value="limits" className="space-y-6">
                  <UserLimitsPanel
                    userId={selectedUser.user_id}
                    userName={selectedUser.user_name}
                    userEmail={selectedUser.user_email}
                    onSave={(limits) => {
                      console.log('用户限制已保存:', limits);
                      setMessage({ type: 'success', text: '用户限制保存成功' });
                    }}
                    onError={(error) => {
                      setMessage({ type: 'error', text: error });
                    }}
                  />
                </TabsContent>

                <TabsContent value="ai-config" className="space-y-6">
                  <AIConfigPanel
                    userId={selectedUser.user_id}
                    onSave={(config) => {
                      console.log('AI配置已保存:', config);
                      setMessage({ type: 'success', text: 'AI配置保存成功' });
                    }}
                    onError={(error) => {
                      setMessage({ type: 'error', text: error });
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}
