'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, Award, TrendingUp } from 'lucide-react';
import ProfileCard from '@/components/pronunciation/ProfileCard';
import WeakUnitsTable from '@/components/pronunciation/WeakUnitsTable';
import RadarChart from '@/components/pronunciation/RadarChart';
import GradeDistributionChart from '@/components/pronunciation/GradeDistributionChart';
import type { UnitStats } from '@/types/pronunciation';

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UnitStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState<'zh-CN' | 'en-US' | 'ja-JP'>('zh-CN');

  useEffect(() => {
    // 从URL参数获取语言设置
    if (!searchParams) return;
    const langParam = searchParams.get('lang');
    if (langParam && ['zh-CN', 'en-US', 'ja-JP'].includes(langParam)) {
      setCurrentLang(langParam as 'zh-CN' | 'en-US' | 'ja-JP');
    }
  }, [searchParams]);

  useEffect(() => {
    loadStats();
  }, [currentLang]);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('请先登录');
        return;
      }

      const response = await fetch(`/api/pronunciation/unit-stats?lang=${currentLang}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('加载数据失败');
      }

      const result = await response.json();

      if (result.success) {
        setStats(result.stats || []);
      } else {
        throw new Error(result.error || '加载失败');
      }
    } catch (err) {
      console.error('加载统计数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  // 计算统计数据
  const totalUnits = currentLang === 'zh-CN' ? 463 : 48; // 中文总音节数 vs 英文总音素数
  const practicedUnits = stats.length;
  const coverageRate = totalUnits > 0 ? (practicedUnits / totalUnits) * 100 : 0;
  const totalAttempts = stats.reduce((sum, s) => sum + s.n, 0);
  const avgScore = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.mean, 0) / stats.length
    : 0;

  // 等级分布
  const gradeA = stats.filter(s => s.grade === 'A').length;
  const gradeB = stats.filter(s => s.grade === 'B').length;
  const gradeC = stats.filter(s => s.grade === 'C').length;

  // Top-10 薄弱项（C 级优先，然后是低分 B 级）
  const weakUnits = [...stats]
    .filter(s => s.grade === 'C' || (s.grade === 'B' && s.mean < 80))
    .sort((a, b) => a.mean - b.mean)
    .slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-6xl mx-auto">
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
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <p className="text-red-600 mb-4">❌ {error}</p>
            <Button onClick={() => router.push('/practice/pronunciation')}>
              返回练习
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Award className="w-8 h-8 text-blue-600" />
              个人发音画像
            </h1>
            <p className="text-gray-600 mt-2">了解你的学习进度和薄弱环节</p>
          </div>
          <div className="flex items-center gap-4">
            {/* 语言选择器 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">语言:</span>
              <select
                value={currentLang}
                onChange={(e) => setCurrentLang(e.target.value as 'zh-CN' | 'en-US' | 'ja-JP')}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="zh-CN">🇨🇳 中文</option>
                <option value="en-US">🇺🇸 English</option>
                <option value="ja-JP">🇯🇵 日本語</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/practice/pronunciation')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回练习
            </Button>
          </div>
        </div>

        {/* 数据为空提示 */}
        {stats.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              还没有学习数据
            </h2>
            <p className="text-gray-500 mb-6">
              完成一些发音练习后，这里将展示你的学习画像
            </p>
            <Button onClick={() => router.push('/practice/pronunciation')}>
              开始练习
            </Button>
          </div>
        )}

        {/* 有数据时显示 */}
        {stats.length > 0 && (
          <>
            {/* 卡片1: 整体统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <ProfileCard
                title="已练习音节"
                value={`${practicedUnits} / ${totalUnits}`}
                subtitle={`覆盖率 ${coverageRate.toFixed(1)}%`}
                icon={<Target className="w-6 h-6" />}
                color="blue"
              />
              <ProfileCard
                title="总练习次数"
                value={totalAttempts.toString()}
                subtitle="样本总数"
                icon={<TrendingUp className="w-6 h-6" />}
                color="green"
              />
              <ProfileCard
                title="平均分数"
                value={avgScore.toFixed(1)}
                subtitle="整体表现"
                icon={<Award className="w-6 h-6" />}
                color="purple"
              />
              <ProfileCard
                title="等级分布"
                value={`${gradeA}A · ${gradeB}B · ${gradeC}C`}
                subtitle={gradeC > 0 ? `${gradeC} 个薄弱项` : '表现优秀'}
                icon={<Award className="w-6 h-6" />}
                color={gradeC > 0 ? 'red' : 'green'}
              />
            </div>

            {/* 图表区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 雷达图 */}
              <RadarChart lang={currentLang} />

              {/* 等级分布饼图 */}
              <GradeDistributionChart lang={currentLang} />
            </div>

            {/* 卡片3: Top-10 薄弱音节 */}
            {weakUnits.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    薄弱音节（需要加强）
                  </h2>
                  <span className="text-sm text-gray-500">
                    共 {weakUnits.length} 个
                  </span>
                </div>

                {/* 用户引导 */}
                <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-900">
                    <strong>💡 学习建议：</strong>
                    您有 <strong>{weakUnits.length}</strong> 个薄弱音节需要关注。
                    点击"开始验证"按钮，系统将通过额外测试确认薄弱项，
                    然后为您提供针对性的训练内容。
                  </p>
                </div>

                <WeakUnitsTable units={weakUnits} />
              </div>
            )}

            {/* 卡片4: 最近学习记录 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">最近练习的音节</h2>
              <div className="space-y-3">
                {stats.slice(0, 5).map((stat, idx) => (
                  <div
                    key={stat.unit_id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-mono font-semibold text-blue-700">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{stat.symbol}</p>
                        <p className="text-sm text-gray-500">{stat.n} 次练习</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {stat.mean.toFixed(1)}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stat.grade === 'A'
                            ? 'bg-green-100 text-green-700'
                            : stat.grade === 'B'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                      >
                        {stat.grade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

