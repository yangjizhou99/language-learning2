'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import RetestComparisonChart from '@/components/pronunciation/RetestComparisonChart';

export default function RetestPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params ? parseInt(params.unit_id as string) : 0;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unitInfo, setUnitInfo] = useState<{
    symbol: string;
    lang: string;
  } | null>(null);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    loadUnitInfo();
  }, [unitId]);

  async function loadUnitInfo() {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('请先登录');
        return;
      }

      // 获取unit信息
      const response = await fetch(`/api/pronunciation/unit-info?unit_id=${unitId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取音节信息失败');
      }

      const result = await response.json();

      if (result.success) {
        setUnitInfo(result.data);
      } else {
        throw new Error(result.errorusa || '获取失败');
      }
    } catch (err) {
      console.error('获取音节信息失败:', err);
      setError(err instanceof Error ? err.message : '获取失败');
    } finally {
      setLoading(false);
    }
  }

  function handleBackClick() {
    router.back();
  }

  function handleDaysChange(days: number) {
    setSelectedDays(days);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !unitInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <div className="text-red-500 mb-4">
              <p className="text-xl font-semibold">加载失败</p>
              <p className="text-gray-600 mt-2">{error || '未知错误'}</p>
            </div>
            <Button onClick={handleBackClick} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 页面头部 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Button onClick={handleBackClick} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>

            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">时间范围</span>
              <select
                value={selectedDays}
                onChange={(e) => handleDaysChange(parseInt(e.target.value))}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value={3}>3天</option>
                <option value={7}>7天</option>
                <option value={14}>14天</option>
                <option value={30}>30天</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  再测对比分析
                </h1>
                <p className="text-gray-600">
                  音节 <span className="font-mono font-semibold text-blue-600">{unitInfo.symbol}</span>
                  的训练效果分析
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">语言</p>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {unitInfo.lang === 'zh-CN' ? '中文' : '英文'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 再测对比图表 */}
        <RetestComparisonChart
          unitId={unitId}
          lang={unitInfo.lang}
          days={selectedDays}
          className="mb-8"
        />

        {/* 操作建议 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">下一步建议</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => router.push(`/practice/pronunciation/verify/${unitId}`)}
              className="h-auto p-4 flex flex-col items-start"
            >
              <span className="font-semibold">重新验证</span>
              <span className="text-sm opacity-90 mt-1">
                进行二次验证，确认当前水平
              </span>
            </Button>

            <Button
              onClick={() => router.push(`/practice/pronunciation/train/${unitId}`)}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start"
            >
              <span className="font-semibold">继续训练</span>
              <span className="text-sm opacity-90 mt-1">
                进行针对性训练，提升发音水平
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
