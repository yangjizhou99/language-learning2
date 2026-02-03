'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Volume2, Mic, CheckCircle } from 'lucide-react';
import TrainingContent from '@/components/pronunciation/TrainingContent';
import MinimalPairPractice from '@/components/pronunciation/MinimalPairPractice';

interface TrainingData {
  unit: {
    unit_id: number;
    symbol: string;
    current_mean: number;
    current_count: number;
    grade: string;
  };
  content: {
    articulation_points: string;
    common_errors: string;
    tips: string;
    ipa_symbol?: string;
    practice_words: string[];
    practice_phrases: string[];
  } | null;
  minimal_pairs: Array<{
    word_1: string;
    word_2: string;
    pinyin_1: string;
    pinyin_2: string;
  }>;
}

export default function TrainPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params ? parseInt(params.unit_id as string) : 0;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrainingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRetest, setShowRetest] = useState(false);

  useEffect(() => {
    loadTrainingData();
  }, [unitId]);

  async function loadTrainingData() {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('请先登录');
        return;
      }

      // 获取训练内容
      const response = await fetch(`/api/pronunciation/training/${unitId}?lang=zh-CN`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('加载训练数据失败');
      }

      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (err) {
      console.error('加载训练数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function handleRetestClick() {
    router.push(`/practice/pronunciation/verify/${unitId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
            <p className="text-red-600 mb-4">❌ {error || '无法加载数据'}</p>
            <Button onClick={() => router.push('/practice/pronunciation/profile')}>
              返回画像
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-green-600" />
              针对性训练
            </h1>
            <p className="text-gray-600 mt-2">掌握发音要领，突破薄弱环节</p>
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
              <p className="text-sm text-gray-500 mb-1">训练音节</p>
              <div className="flex items-baseline gap-3">
                <p className="text-5xl font-bold font-mono text-gray-900">
                  {data.unit.symbol}
                </p>
                {data.content?.ipa_symbol && (
                  <p className="text-2xl text-gray-500">
                    [{data.content.ipa_symbol}]
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">当前水平</p>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-semibold text-gray-900">
                  {data.unit.current_mean.toFixed(1)}
                </p>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${data.unit.grade === 'A'
                      ? 'bg-green-100 text-green-700'
                      : data.unit.grade === 'B'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                >
                  {data.unit.grade} 级
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {data.unit.current_count} 次练习
              </p>
            </div>
          </div>
        </div>

        {/* 训练内容 */}
        {data.content && (
          <TrainingContent
            content={data.content}
            unitSymbol={data.unit.symbol}
          />
        )}

        {/* 最小对立词练习 */}
        {data.minimal_pairs && data.minimal_pairs.length > 0 && (
          <MinimalPairPractice
            pairs={data.minimal_pairs}
            unitSymbol={data.unit.symbol}
          />
        )}

        {/* 完成训练提示 */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              训练内容已完成
            </h3>
            <p className="text-gray-600 mb-6">
              是否进行再测，检验学习成果？
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleRetestClick}
                size="lg"
                className="min-w-[200px]"
              >
                立即再测
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/practice/pronunciation/retest/${unitId}`)}
                size="lg"
                className="min-w-[200px]"
              >
                查看对比
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/practice/pronunciation/profile')}
                size="lg"
                className="min-w-[200px]"
              >
                稍后再测
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

