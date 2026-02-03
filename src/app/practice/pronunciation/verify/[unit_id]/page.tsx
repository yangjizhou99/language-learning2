'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import VerificationFlow from '@/components/pronunciation/VerificationFlow';

interface UnitInfo {
  unit_id: number;
  symbol: string;
  current_mean: number;
  current_count: number;
  needs_verification: boolean;
}

interface VerificationSentence {
  sentence_id: number;
  text: string;
  level: number;
}

interface VerificationReport {
  before: { mean: number; count: number };
  after: { mean: number; count: number };
  change: number;
  changePercent: number;
  replaced: boolean;
  advice: {
    conclusion: string;
    advice: string;
    severity: 'high' | 'medium' | 'low';
  };
}

export default function VerifyPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params ? parseInt(params.unit_id as string) : 0;

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<UnitInfo | null>(null);
  const [sentences, setSentences] = useState<VerificationSentence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);

  useEffect(() => {
    loadVerificationData();
  }, [unitId]);

  async function loadVerificationData() {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('请先登录');
        return;
      }

      // 首先获取音素的语言信息
      const { data: unitData, error: unitError } = await supabase
        .from('unit_catalog')
        .select('lang')
        .eq('unit_id', unitId)
        .single();

      if (unitError || !unitData) {
        throw new Error('找不到该音素信息');
      }

      const lang = unitData.lang;

      const response = await fetch(
        `/api/pronunciation/verify/sentences?unit_id=${unitId}&lang=${lang}&count=6`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('加载验证数据失败');
      }

      const result = await response.json();

      if (result.success) {
        setUnit(result.unit);
        setSentences(result.sentences);
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (err) {
      console.error('加载验证数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificationComplete(scores: Array<{ sentence_id: number; score: number; valid: boolean }>) {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('请先登录');
      }

      // 获取音素的语言信息
      const { data: unitData, error: unitError } = await supabase
        .from('unit_catalog')
        .select('lang')
        .eq('unit_id', unitId)
        .single();

      if (unitError || !unitData) {
        throw new Error('找不到该音素信息');
      }

      const lang = unitData.lang;

      const response = await fetch('/api/pronunciation/verify/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unit_id: unitId,
          lang: lang,
          scores,
        }),
      });

      if (!response.ok) {
        throw new Error('提交验证结果失败');
      }

      const result = await response.json();

      if (result.success) {
        setReport(result.report);
        setVerificationComplete(true);
      } else {
        throw new Error(result.error || '提交失败');
      }
    } catch (err) {
      console.error('提交验证结果失败:', err);
      alert(err instanceof Error ? err.message : '提交失败');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <p className="text-red-600 mb-4">❌ {error}</p>
            <Button onClick={() => router.push('/practice/pronunciation/profile')}>
              返回画像
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!unit || sentences.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <p className="text-gray-600 mb-4">没有找到验证数据</p>
            <Button onClick={() => router.push('/practice/pronunciation/profile')}>
              返回画像
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
              二次验证
            </h1>
            <p className="text-gray-600 mt-2">确认薄弱项，排除偶发错误</p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/practice/pronunciation/profile')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回画像
          </Button>
        </div>

        {/* 音节信息卡片 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">验证音节</p>
              <p className="text-4xl font-bold font-mono text-gray-900">{unit.symbol}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">当前统计</p>
              <p className="text-2xl font-semibold text-gray-900">
                {unit.current_mean.toFixed(1)} 分
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {unit.current_count} 次练习
              </p>
            </div>
          </div>

          {unit.needs_verification && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>检测到薄弱项：</strong>该音节分数较低且数据已收敛，建议进行二次验证以确认真实水平。
              </p>
            </div>
          )}
        </div>

        {/* 验证完成 - 显示报告 */}
        {verificationComplete && report ? (
          <div className="space-y-6">
            {/* 对比卡片 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">验证结果</h2>

              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* 验证前 */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-3">验证前</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">平均分</span>
                      <span className="font-semibold">{report.before.mean}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">样本数</span>
                      <span className="font-semibold">{report.before.count}</span>
                    </div>
                  </div>
                </div>

                {/* 验证后 */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 mb-3">验证后</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-blue-600">平均分</span>
                      <span className="font-semibold text-blue-900 flex items-center gap-1">
                        {report.after.mean}
                        {report.change > 0 && <TrendingUp className="w-4 h-4 text-green-600" />}
                        {report.change < 0 && <TrendingDown className="w-4 h-4 text-red-600" />}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-blue-600">样本数</span>
                      <span className="font-semibold text-blue-900">{report.after.count}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 变化 */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">分数变化</span>
                  <span className={`text-2xl font-bold ${report.change > 0 ? 'text-green-600' : report.change < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                    {report.change > 0 ? '+' : ''}{report.change} ({report.changePercent > 0 ? '+' : ''}{report.changePercent}%)
                  </span>
                </div>
                {report.replaced && (
                  <p className="text-xs text-gray-600 mt-2">
                    * 差异显著，已使用验证后的数据替换原统计
                  </p>
                )}
              </div>

              {/* 结论和建议 */}
              <div className={`p-4 rounded-lg ${report.advice.severity === 'high' ? 'bg-red-50 border border-red-200' :
                  report.advice.severity === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-green-50 border border-green-200'
                }`}>
                <p className="font-semibold text-gray-900 mb-2">
                  {report.advice.conclusion}
                </p>
                <p className="text-sm text-gray-700">
                  {report.advice.advice}
                </p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4">
              <Button
                onClick={() => router.push(`/practice/pronunciation/train/${unitId}`)}
                className="flex-1"
              >
                开始训练
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/practice/pronunciation/profile')}
                className="flex-1"
              >
                返回画像
              </Button>
            </div>
          </div>
        ) : (
          /* 验证流程 */
          <VerificationFlow
            sentences={sentences}
            onComplete={handleVerificationComplete}
          />
        )}
      </div>
    </div>
  );
}

