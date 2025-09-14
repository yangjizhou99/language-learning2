'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, AlertCircle, User, Globe } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth-headers';

interface UserLimits {
  user_id: string;
  daily_calls_limit: number;
  daily_tokens_limit: number;
  daily_cost_limit: number;
  monthly_calls_limit: number;
  monthly_tokens_limit: number;
  monthly_cost_limit: number;
  enabled: boolean;
}

interface UserLimitsPanelProps {
  userId?: string;
  userName?: string;
  userEmail?: string;
  onSave?: (limits: UserLimits) => void;
  onError?: (error: string) => void;
}

export function UserLimitsPanel({ userId, userName, userEmail, onSave, onError }: UserLimitsPanelProps) {
  const [limits, setLimits] = useState<UserLimits>({
    user_id: userId || '',
    daily_calls_limit: 0,
    daily_tokens_limit: 0,
    daily_cost_limit: 0,
    monthly_calls_limit: 0,
    monthly_tokens_limit: 0,
    monthly_cost_limit: 0,
    enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState<'global' | 'user'>('global');

  useEffect(() => {
    if (userId) {
      setScope('user');
      fetchUserLimits();
    } else {
      setScope('global');
      fetchGlobalLimits();
    }
  }, [userId]);

  const fetchUserLimits = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/users/${userId}/limits`, {
        headers
      });
      const data = await response.json();
      
      if (data.success && data.limits) {
        setLimits(data.limits);
      } else {
        console.error('Failed to fetch user limits:', data);
        onError?.(`获取用户限制失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error fetching user limits:', error);
      onError?.('获取用户限制失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalLimits = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/api-limits', {
        headers
      });
      const data = await response.json();
      
      if (data.success && data.limits) {
        setLimits({
          user_id: '',
          daily_calls_limit: data.limits.daily_calls_limit || 0,
          daily_tokens_limit: data.limits.daily_tokens_limit || 0,
          daily_cost_limit: data.limits.daily_cost_limit || 0,
          monthly_calls_limit: data.limits.monthly_calls_limit || 0,
          monthly_tokens_limit: data.limits.monthly_tokens_limit || 0,
          monthly_cost_limit: data.limits.monthly_cost_limit || 0,
          enabled: data.limits.enabled || false
        });
      }
    } catch (error) {
      console.error('Error fetching global limits:', error);
      onError?.('获取全局限制失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (field: keyof UserLimits, value: any) => {
    setLimits(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');

      if (scope === 'user' && userId) {
        // 保存用户特定限制
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/users/${userId}/limits`, {
          method: 'POST',
          headers,
          body: JSON.stringify(limits)
        });

        const data = await response.json();
        if (data.success) {
          setMessage('用户限制保存成功');
          onSave?.(limits);
          // 保存成功后重新获取数据以确保UI同步
          await fetchUserLimits();
        } else {
          throw new Error(data.error || '保存失败');
        }
      } else {
        // 保存全局限制
        const headers = await getAuthHeaders();
        const response = await fetch('/api/admin/api-limits', {
          method: 'POST',
          headers,
          body: JSON.stringify(limits)
        });

        const data = await response.json();
        if (data.success) {
          setMessage('全局限制保存成功');
          onSave?.(limits);
          // 保存成功后重新获取数据以确保UI同步
          await fetchGlobalLimits();
        } else {
          throw new Error(data.error || '保存失败');
        }
      }
    } catch (error) {
      console.error('Error saving limits:', error);
      const errorMsg = error instanceof Error ? error.message : '保存失败';
      setMessage(`保存失败: ${errorMsg}`);
      onError?.(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {scope === 'user' ? '用户使用限制' : '全局使用限制'}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {scope === 'user' ? (
            <>
              <User className="h-4 w-4" />
              <span>用户: {userName || userEmail || '未知用户'}</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" />
              <span>全局设置 - 应用于所有用户</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 限制开关 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">
              {scope === 'user' ? '启用用户限制' : '启用全局限制'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {scope === 'user' 
                ? '开启后将为此用户设置独立的使用限制'
                : '开启后将限制所有用户的API使用量'
              }
            </p>
          </div>
          <Switch
            checked={limits.enabled}
            onCheckedChange={(checked) => handleLimitChange('enabled', checked)}
          />
        </div>

        {/* 限制设置 - 只有启用限制时才显示 */}
        {limits.enabled && (
          <div className="space-y-6">
            {/* 日限制 */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium">每日限制</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-calls">调用次数限制</Label>
                  <Input
                    id="daily-calls"
                    type="number"
                    value={limits.daily_calls_limit}
                    onChange={(e) => handleLimitChange('daily_calls_limit', parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0表示无限制"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily-tokens">Token限制</Label>
                  <Input
                    id="daily-tokens"
                    type="number"
                    value={limits.daily_tokens_limit}
                    onChange={(e) => handleLimitChange('daily_tokens_limit', parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0表示无限制"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily-cost">费用限制 ($)</Label>
                  <Input
                    id="daily-cost"
                    type="number"
                    step="0.01"
                    value={limits.daily_cost_limit}
                    onChange={(e) => handleLimitChange('daily_cost_limit', parseFloat(e.target.value) || 0)}
                    min="0"
                    placeholder="0表示无限制"
                  />
                </div>
              </div>
            </div>

            {/* 月限制 */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium">每月限制</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthly-calls">调用次数限制</Label>
                  <Input
                    id="monthly-calls"
                    type="number"
                    value={limits.monthly_calls_limit}
                    onChange={(e) => handleLimitChange('monthly_calls_limit', parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0表示无限制"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-tokens">Token限制</Label>
                  <Input
                    id="monthly-tokens"
                    type="number"
                    value={limits.monthly_tokens_limit}
                    onChange={(e) => handleLimitChange('monthly_tokens_limit', parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0表示无限制"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-cost">费用限制 ($)</Label>
                  <Input
                    id="monthly-cost"
                    type="number"
                    step="0.01"
                    value={limits.monthly_cost_limit}
                    onChange={(e) => handleLimitChange('monthly_cost_limit', parseFloat(e.target.value) || 0)}
                    min="0"
                    placeholder="0表示无限制"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 保存按钮 - 始终显示 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>

        {/* 消息提示 */}
        {message && (
          <Alert className={message.includes('失败') ? 'border-red-500' : 'border-green-500'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
