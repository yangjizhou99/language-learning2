'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

interface TestReminderProps {
  className?: string;
}

export default function PerformanceTestReminder({ className }: TestReminderProps) {
  const [lastTestDate, setLastTestDate] = useState<Date | null>(null);
  const [testStatus, setTestStatus] = useState<'good' | 'warning' | 'overdue'>('good');
  const [daysSinceLastTest, setDaysSinceLastTest] = useState(0);

  useEffect(() => {
    // 从 localStorage 获取上次测试时间
    const saved = localStorage.getItem('last-performance-test');
    if (saved) {
      const lastTest = new Date(saved);
      setLastTestDate(lastTest);

      const now = new Date();
      const diffTime = now.getTime() - lastTest.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      setDaysSinceLastTest(diffDays);

      if (diffDays > 14) {
        setTestStatus('overdue');
      } else if (diffDays > 7) {
        setTestStatus('warning');
      } else {
        setTestStatus('good');
      }
    } else {
      setTestStatus('overdue');
    }
  }, []);

  const getStatusIcon = () => {
    switch (testStatus) {
      case 'good':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'overdue':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (testStatus) {
      case 'good':
        return '性能测试正常';
      case 'warning':
        return '建议运行性能测试';
      case 'overdue':
        return '需要运行性能测试';
    }
  };

  const getStatusBadge = () => {
    switch (testStatus) {
      case 'good':
        return (
          <Badge variant="default" className="bg-green-500">
            正常
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-yellow-500">
            提醒
          </Badge>
        );
      case 'overdue':
        return <Badge variant="destructive">逾期</Badge>;
    }
  };

  const getRecommendation = () => {
    if (testStatus === 'good') {
      return '性能测试状态良好，建议每周定期运行测试。';
    } else if (testStatus === 'warning') {
      return `距离上次测试已过去 ${daysSinceLastTest} 天，建议尽快运行性能测试。`;
    } else {
      return `距离上次测试已过去 ${daysSinceLastTest} 天，强烈建议立即运行性能测试。`;
    }
  };

  const handleRunTest = () => {
    // 跳转到性能测试页面
    window.location.href = '/admin/performance-test';
  };

  if (testStatus === 'good' && daysSinceLastTest < 3) {
    return null; // 如果状态良好且最近测试过，不显示提醒
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            {getStatusIcon()}
            <span className="ml-2">性能测试提醒</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{getRecommendation()}</p>

          {lastTestDate && (
            <div className="text-sm text-gray-500">
              上次测试: {lastTestDate.toLocaleDateString()} ({daysSinceLastTest} 天前)
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              onClick={handleRunTest}
              size="sm"
              className={testStatus === 'overdue' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              运行测试
            </Button>
            {testStatus === 'overdue' && (
              <Button
                onClick={() => {
                  // 标记为已提醒，暂时隐藏
                  localStorage.setItem(
                    'performance-test-reminder-dismissed',
                    new Date().toISOString(),
                  );
                }}
                variant="outline"
                size="sm"
              >
                稍后提醒
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
