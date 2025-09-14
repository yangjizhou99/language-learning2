'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

interface UsageStats {
  daily_calls: number;
  daily_tokens: number;
  daily_cost: number;
  monthly_calls: number;
  monthly_tokens: number;
  monthly_cost: number;
}

interface APILimits {
  enabled: boolean;
  daily_calls_limit: number;
  daily_tokens_limit: number;
  daily_cost_limit: number;
  monthly_calls_limit: number;
  monthly_tokens_limit: number;
  monthly_cost_limit: number;
  alert_threshold: number;
}

interface APIUsageAlertProps {
  userId: string;
  provider?: string;
}

export function APIUsageAlert({ userId, provider }: APIUsageAlertProps) {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [limits, setLimits] = useState<APILimits | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageStats();
  }, [userId, provider]);

  const fetchUsageStats = async () => {
    try {
      const params = new URLSearchParams({ userId });
      if (provider) params.append('provider', provider);
      
      const response = await fetch(`/api/admin/api-usage/user-stats?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setUsage(data.usage);
        setLimits(data.limits);
      }
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usage || !limits || !limits.enabled) {
    return null;
  }

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getAlertLevel = (percentage: number) => {
    if (percentage >= 100) return 'error';
    if (percentage >= limits.alert_threshold) return 'warning';
    return 'success';
  };

  const dailyCallsPercent = getUsagePercentage(usage.daily_calls, limits.daily_calls_limit);
  const dailyTokensPercent = getUsagePercentage(usage.daily_tokens, limits.daily_tokens_limit);
  const dailyCostPercent = getUsagePercentage(usage.daily_cost, limits.daily_cost_limit);
  const monthlyCallsPercent = getUsagePercentage(usage.monthly_calls, limits.monthly_calls_limit);
  const monthlyTokensPercent = getUsagePercentage(usage.monthly_tokens, limits.monthly_tokens_limit);
  const monthlyCostPercent = getUsagePercentage(usage.monthly_cost, limits.monthly_cost_limit);

  const maxDailyPercent = Math.max(dailyCallsPercent, dailyTokensPercent, dailyCostPercent);
  const maxMonthlyPercent = Math.max(monthlyCallsPercent, monthlyTokensPercent, monthlyCostPercent);
  const maxPercent = Math.max(maxDailyPercent, maxMonthlyPercent);

  if (maxPercent < limits.alert_threshold) {
    return null; // 不需要显示警告
  }

  const alertLevel = getAlertLevel(maxPercent);
  const Icon = alertLevel === 'error' ? XCircle : AlertTriangle;
  const color = alertLevel === 'error' ? 'text-red-600' : 'text-yellow-600';

  return (
    <Alert className={`border-l-4 ${alertLevel === 'error' ? 'border-red-500' : 'border-yellow-500'}`}>
      <Icon className={`h-4 w-4 ${color}`} />
      <AlertDescription>
        <div className="space-y-2">
          <div className="font-medium">
            {alertLevel === 'error' ? 'API使用量已达上限' : 'API使用量接近上限'}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-700 mb-1">今日使用情况</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>调用次数:</span>
                  <span className={dailyCallsPercent >= 100 ? 'text-red-600 font-medium' : ''}>
                    {usage.daily_calls} / {limits.daily_calls_limit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Token使用:</span>
                  <span className={dailyTokensPercent >= 100 ? 'text-red-600 font-medium' : ''}>
                    {usage.daily_tokens.toLocaleString()} / {limits.daily_tokens_limit.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>费用:</span>
                  <span className={dailyCostPercent >= 100 ? 'text-red-600 font-medium' : ''}>
                    ${usage.daily_cost.toFixed(2)} / ${limits.daily_cost_limit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <div className="font-medium text-gray-700 mb-1">本月使用情况</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>调用次数:</span>
                  <span className={monthlyCallsPercent >= 100 ? 'text-red-600 font-medium' : ''}>
                    {usage.monthly_calls} / {limits.monthly_calls_limit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Token使用:</span>
                  <span className={monthlyTokensPercent >= 100 ? 'text-red-600 font-medium' : ''}>
                    {usage.monthly_tokens.toLocaleString()} / {limits.monthly_tokens_limit.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>费用:</span>
                  <span className={monthlyCostPercent >= 100 ? 'text-red-600 font-medium' : ''}>
                    ${usage.monthly_cost.toFixed(2)} / ${limits.monthly_cost_limit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {alertLevel === 'error' && (
            <div className="text-red-600 text-sm font-medium">
              ⚠️ 已达到使用上限，无法继续调用API
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
