'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Database, CheckCircle, Loader2, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function PronunciationAdminPage() {
  const [currentLang, setCurrentLang] = useState<'zh-CN' | 'en-US' | 'ja-JP'>('zh-CN');
  const [stats, setStats] = useState({
    total_sentences: 0,
    total_units: 0,
    sentence_units_count: 0,
    avg_coverage: 0,
    training_content_count: 0,
    minimal_pairs_count: 0,
  });

  const [generating, setGenerating] = useState(false);
  const [generatingSentences, setGeneratingSentences] = useState(false);
  const [generatingTraining, setGeneratingTraining] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [currentLang]);

  async function loadStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 获取统计数据
      const [sentencesRes, unitsRes, tcRes, mpRes] = await Promise.all([
        supabase.from('pron_sentences').select('sentence_id', { count: 'exact' }).eq('lang', currentLang),
        supabase.from('unit_catalog').select('*', { count: 'exact', head: true }).eq('lang', currentLang),
        supabase.from('training_content').select('*', { count: 'exact', head: true }).eq('lang', currentLang),
        supabase.from('minimal_pairs').select('*', { count: 'exact', head: true }).eq('lang', currentLang),
      ]);

      // 获取当前语言的句节关联数量
      let sentenceUnitsCount = 0;
      if (sentencesRes.data && sentencesRes.data.length > 0) {
        const sentenceIds = sentencesRes.data.map(s => s.sentence_id);
        const { data: sentenceUnitsData } = await supabase
          .from('sentence_units')
          .select('sentence_id, unit_id')
          .in('sentence_id', sentenceIds);
        
        sentenceUnitsCount = sentenceUnitsData?.length || 0;
      }
      const totalSentences = sentencesRes.count || 0;
      const avgCoverage = totalSentences > 0 ? sentenceUnitsCount / totalSentences : 0;

      setStats({
        total_sentences: totalSentences,
        total_units: unitsRes.count || 0,
        sentence_units_count: sentenceUnitsCount,
        avg_coverage: avgCoverage,
        training_content_count: tcRes.count || 0,
        minimal_pairs_count: mpRes.count || 0,
      });
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  }

  async function handleGenerateSentenceUnits() {
    if (!confirm('这将重新生成 sentence_units 数据，可能需要 30-60 秒。是否继续？')) {
      return;
    }

    try {
      setGenerating(true);
      setResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('请先登录');
        return;
      }

      const response = await fetch('/api/admin/pronunciation/complete-sentence-units', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          lang: currentLang,
          batch_size: 50
        }),
      });

      if (!response.ok) {
        throw new Error('生成失败');
      }

      const data = await response.json();

      if (data.success) {
        setResult(
          `✅ 句节关联数据补全成功！\n\n` +
          `• 总句子数：${data.stats.total_sentences}\n` +
          `• 处理完成：${data.stats.processed}\n` +
          `• 成功处理：${data.stats.success} 个\n` +
          `• 失败数量：${data.stats.failed} 个\n` +
          `${data.stats.errors.length > 0 ? `\n❌ 错误详情：\n${data.stats.errors.slice(0, 5).join('\n')}${data.stats.errors.length > 5 ? '\n...' : ''}` : ''}\n\n` +
          `💡 ${data.message}`
        );
        await loadStats();
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (err) {
      console.error('生成数据失败:', err);
      alert(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateSentences() {
    // 先询问生成模式
    const mode = confirm(
      '🎯 推荐使用"批量迭代生成"模式，效率更高！\n\n' +
      '• 点击"确定" = 批量迭代生成（推荐）\n' +
      '  - 分批生成，每批后重新分析\n' +
      '  - 更精准地补充薄弱音节\n\n' +
      '• 点击"取消" = 单次生成\n' +
      '  - 一次性生成所有句子\n' +
      '  - 速度稍快但效率较低'
    );

    if (mode) {
      // 批量迭代模式
      await handleBatchGeneration();
    } else {
      // 单次生成模式
      await handleSingleGeneration();
    }
  }

  async function handleSingleGeneration() {
    const countInput = prompt('请输入要生成的句子数量（建议 10-30）:', '25');
    if (!countInput) return;

    const count = parseInt(countInput);
    if (isNaN(count) || count < 1 || count > 100) {
      alert('请输入 1-100 之间的数字');
      return;
    }

    const levelInput = prompt('请输入难度等级（1-5，1=最简单，5=最复杂）:', '2');
    if (!levelInput) return;

    const level = parseInt(levelInput);
    if (isNaN(level) || level < 1 || level > 5) {
      alert('请输入 1-5 之间的数字');
      return;
    }

    if (!confirm(`将使用 DeepSeek 一次性生成 ${count} 个句子。\n\n这可能需要 30-60 秒，是否继续？`)) {
      return;
    }

    try {
      setGeneratingSentences(true);
      setResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('请先登录');
        return;
      }

      const response = await fetch('/api/admin/pronunciation/generate-sentences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count, level, lang: currentLang }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const data = await response.json();

      if (data.success) {
        setResult(
          `✅ AI 句子生成成功！\n\n` +
          `• 生成句子：${data.stats.generated_count} 个\n` +
          `• 音节关联：${data.stats.sentence_units_count} 条\n` +
          `• 难度等级：${data.stats.level}\n` +
          `${data.stats.smart_mode ? `• 智能模式：重点覆盖 ${data.stats.target_units_count} 个薄弱音节\n` : ''}` +
          `\n💡 ${data.message || '新句子已添加到练习库！'}`
        );
        await loadStats();
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (err) {
      console.error('生成句子失败:', err);
      alert(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGeneratingSentences(false);
    }
  }

  async function handleBatchGeneration() {
    const totalInput = prompt('请输入总共要生成的句子数量（建议 30-100）:', '50');
    if (!totalInput) return;

    const totalCount = parseInt(totalInput);
    if (isNaN(totalCount) || totalCount < 10 || totalCount > 200) {
      alert('请输入 10-200 之间的数字');
      return;
    }

    const batchInput = prompt('请输入每批生成数量（建议 8-15，数量越小越精准但耗时越长）:', '10');
    if (!batchInput) return;

    const batchSize = parseInt(batchInput);
    if (isNaN(batchSize) || batchSize < 5 || batchSize > 50) {
      alert('请输入 5-50 之间的数字');
      return;
    }

    const levelInput = prompt('请输入难度等级（1-5）:', '2');
    if (!levelInput) return;

    const level = parseInt(levelInput);
    if (isNaN(level) || level < 1 || level > 5) {
      alert('请输入 1-5 之间的数字');
      return;
    }

    const batches = Math.ceil(totalCount / batchSize);
    const estimatedTime = batches * 25; // 每批约25秒

    if (!confirm(
      `🎯 批量迭代生成配置：\n\n` +
      `• 总数量：${totalCount} 个句子\n` +
      `• 批次大小：${batchSize} 个/批\n` +
      `• 批次数：${batches} 批\n` +
      `• 难度等级：${level}\n` +
      `• 预计耗时：${Math.ceil(estimatedTime / 60)} 分钟\n\n` +
      `每批生成后会重新分析覆盖缺口，确保高效补充。\n\n` +
      `是否开始？`
    )) {
      return;
    }

    try {
      setGeneratingSentences(true);
      setResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('请先登录');
        return;
      }

      const response = await fetch('/api/admin/pronunciation/generate-batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          totalCount,
          batchSize,
          level,
          lang: currentLang,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const data = await response.json();

      if (data.success) {
        // 格式化批次详情
        const batchDetails = data.batches
          .map((b: any, idx: number) => 
            `  批次${b.batch}: 生成${b.generated}句，创建${b.units}条关联，目标音节：${b.target_units.slice(0, 5).join('、')}...`
          )
          .join('\n');

        setResult(
          `✅ 批量迭代生成完成！\n\n` +
          `📊 汇总统计：\n` +
          `• 总批次数：${data.summary.total_batches}\n` +
          `• 生成句子：${data.summary.total_generated} 个\n` +
          `• 音节关联：${data.summary.total_units} 条\n` +
          `• 平均覆盖：${data.summary.avg_units_per_sentence} 个音节/句\n` +
          `${data.errors.length > 0 ? `• 失败批次：${data.errors.length}\n` : ''}` +
          `\n📝 各批次详情：\n${batchDetails}\n` +
          `\n💡 ${data.message}`
        );
        await loadStats();
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (err) {
      console.error('批量生成失败:', err);
      alert(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGeneratingSentences(false);
    }
  }

  async function handleGenerateTrainingContent() {
    const totalInput = prompt(`请输入要生成训练内容的音素数量（当前${currentLang === 'zh-CN' ? '中文' : '英文'}有${stats.total_units}个音素）:`, '10');
    if (!totalInput) return;

    const totalCount = parseInt(totalInput);
    if (isNaN(totalCount) || totalCount < 1 || totalCount > stats.total_units) {
      alert(`请输入 1-${stats.total_units} 之间的数字`);
      return;
    }

    const batchInput = prompt('请输入每批处理数量（建议 5-10，避免API限制）:', '5');
    if (!batchInput) return;

    const batchSize = parseInt(batchInput);
    if (isNaN(batchSize) || batchSize < 1 || batchSize > 20) {
      alert('请输入 1-20 之间的数字');
      return;
    }

    const batches = Math.ceil(totalCount / batchSize);
    const estimatedTime = totalCount * 2; // 每个音素约2秒

    if (!confirm(
      `🎯 训练内容生成配置：\n\n` +
      `• 语言：${currentLang === 'zh-CN' ? '中文' : 'English'}\n` +
      `• 生成数量：${totalCount} 个音素\n` +
      `• 批次大小：${batchSize} 个/批\n` +
      `• 批次数：${batches} 批\n` +
      `• 预计耗时：${Math.ceil(estimatedTime / 60)} 分钟\n\n` +
      `将为每个音素生成：\n` +
      `• 发音要领\n` +
      `• 常见错误\n` +
      `• 练习技巧\n` +
      `• 练习词汇和短语\n\n` +
      `是否开始？`
    )) {
      return;
    }

    try {
      setGeneratingTraining(true);
      setResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('请先登录');
        return;
      }

      // 获取要处理的音素ID
      const { data: units, error: unitsError } = await supabase
        .from('unit_catalog')
        .select('unit_id')
        .eq('lang', currentLang)
        .order('unit_id', { ascending: true })
        .limit(totalCount);

      if (unitsError || !units) {
        throw new Error('获取音素列表失败');
      }

      const unitIds = units.map(u => u.unit_id);

      const response = await fetch('/api/pronunciation/generate-training-content', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          unit_ids: unitIds,
          lang: currentLang,
          batch_size: batchSize,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const data = await response.json();

      if (data.success) {
        setResult(
          `✅ 训练内容生成完成！\n\n` +
          `📊 处理统计：\n` +
          `• 总音素数：${data.stats.total_units}\n` +
          `• 处理完成：${data.stats.processed}\n` +
          `• 成功生成：${data.stats.success}\n` +
          `• 失败数量：${data.stats.failed}\n` +
          `${data.stats.errors.length > 0 ? `\n❌ 错误详情：\n${data.stats.errors.slice(0, 5).join('\n')}${data.stats.errors.length > 5 ? '\n...' : ''}` : ''}\n\n` +
          `💡 ${data.message}`
        );
        await loadStats();
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (err) {
      console.error('生成训练内容失败:', err);
      alert(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGeneratingTraining(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* 头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link href="/admin" className="hover:text-blue-600">管理员</Link>
            <span>/</span>
            <span className="text-gray-900">发音评测管理</span>
          </div>
          
          {/* 语言选择器 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">语言:</label>
            <select
              value={currentLang}
              onChange={(e) => setCurrentLang(e.target.value as 'zh-CN' | 'en-US' | 'ja-JP')}
              className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="zh-CN">🇨🇳 中文</option>
              <option value="en-US">🇺🇸 English</option>
              <option value="ja-JP">🇯🇵 日本語</option>
            </select>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          发音评测系统管理 - {currentLang === 'zh-CN' ? '中文' : currentLang === 'en-US' ? 'English' : '日本語'}
        </h1>
        <p className="text-gray-600 mt-2">管理句子库、训练内容和数据关联</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">句子总数</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.total_sentences}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">音节总数</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{stats.total_units}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">句节关联</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.sentence_units_count}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">平均覆盖</h3>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.avg_coverage.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">音节/句</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">训练内容</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.training_content_count}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">对立词对</h3>
          <p className="text-3xl font-bold text-pink-600 mt-2">{stats.minimal_pairs_count}</p>
        </div>
      </div>

      {/* 结果显示 */}
      {result && (
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
          <pre className="text-sm text-green-900 whitespace-pre-line font-mono">
            {result}
          </pre>
          <Button
            size="sm"
            onClick={() => setResult(null)}
            className="mt-4"
          >
            关闭
          </Button>
        </div>
      )}

      {/* 主要操作区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 卡片1: AI 生成句子 */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                AI 生成句子
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                使用 DeepSeek 自动生成发音练习句子
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">当前句子数</span>
              <span className="font-semibold text-gray-900">{stats.total_sentences}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">推荐生成数量</span>
              <span className="font-semibold text-purple-600">10-50 个/批次</span>
            </div>
          </div>

          <div className="bg-white/60 p-4 rounded-lg mb-4">
            <p className="text-xs text-gray-700 mb-2">
              <strong>🎯 批量迭代生成（推荐）：</strong>
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <strong>分批生成</strong>：每批 8-15 句，生成后重新分析</li>
              <li>• <strong>动态优化</strong>：每批都针对当前最薄弱的音节</li>
              <li>• <strong>高效补充</strong>：避免重复覆盖，效率提升 50%+</li>
              <li>• <strong>实时调整</strong>：第1批覆盖 zou/zao，第2批立即转向其他缺口</li>
            </ul>
            <p className="text-xs text-purple-700 mt-2 font-medium">
              💡 示例：生成50句分5批，每批10句，每批重新分析缺口
            </p>
          </div>

          <Button
            onClick={handleGenerateSentences}
            disabled={generatingSentences}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            size="lg"
          >
            {generatingSentences ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                AI 生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                开始生成句子
              </>
            )}
          </Button>
        </div>

        {/* 卡片2: 补全 sentence_units 数据 */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-2 border-blue-200 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                补全句节关联
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                分析所有句子，自动生成音节关联数据
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">当前关联数</span>
              <span className="font-semibold text-gray-900">{stats.sentence_units_count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">平均覆盖</span>
              <span className={`font-semibold ${
                stats.avg_coverage >= 8 ? 'text-green-600' : 'text-orange-600'
              }`}>
                {stats.avg_coverage.toFixed(1)} 音节/句
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">目标覆盖</span>
              <span className="font-semibold text-blue-600">≥ 8 音节/句</span>
            </div>
          </div>

          <div className="bg-white/60 p-4 rounded-lg mb-4">
            <p className="text-xs text-gray-700 mb-2">
              <strong>功能说明：</strong>
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• 使用 pinyin 库提取拼音</li>
              <li>• 自动匹配 unit_catalog 音节</li>
              <li>• 激活智能推荐功能</li>
              <li>• 激活二次验证功能</li>
            </ul>
          </div>

          <Button
            onClick={handleGenerateSentenceUnits}
            disabled={generating}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 mr-2" />
                开始补全数据
              </>
            )}
          </Button>
        </div>

        {/* 卡片3: 生成训练内容 */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-green-600" />
                生成训练内容
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                为音素生成发音训练指导内容
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">当前训练内容</span>
              <span className="font-semibold text-gray-900">{stats.training_content_count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">音素总数</span>
              <span className="font-semibold text-green-600">{stats.total_units}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">推荐批量大小</span>
              <span className="font-semibold text-green-600">5-10 个/批</span>
            </div>
          </div>

          <div className="bg-white/60 p-4 rounded-lg mb-4">
            <p className="text-xs text-gray-700 mb-2">
              <strong>📚 训练内容包含：</strong>
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <strong>发音要领</strong>：口型、舌位、气流指导</li>
              <li>• <strong>常见错误</strong>：典型错误及纠正方法</li>
              <li>• <strong>练习技巧</strong>：实用训练建议</li>
              <li>• <strong>练习词汇</strong>：5个包含该音素的单词</li>
              <li>• <strong>练习短语</strong>：3个实用短语</li>
              <li>• <strong>难度评估</strong>：1-5级难度分类</li>
            </ul>
            <p className="text-xs text-green-700 mt-2 font-medium">
              💡 支持中文和英文音素的训练内容生成
            </p>
          </div>

          <Button
            onClick={handleGenerateTrainingContent}
            disabled={generatingTraining}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            size="lg"
          >
            {generatingTraining ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5 mr-2" />
                开始生成训练内容
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 数据库管理区域 */}
      <div className="mt-8 bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Database className="w-6 h-6 text-gray-700" />
          数据库状态
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 核心表状态 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">核心数据表</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">pron_sentences</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{stats.total_sentences}</span>
                  {stats.total_sentences > 0 && <CheckCircle className="w-4 h-4 text-green-600" />}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">unit_catalog (zh-CN)</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{stats.total_units}</span>
                  {stats.total_units > 0 && <CheckCircle className="w-4 h-4 text-green-600" />}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">sentence_units</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{stats.sentence_units_count}</span>
                  {stats.sentence_units_count > 200 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : stats.sentence_units_count > 0 ? (
                    <span className="text-xs text-orange-600">待补全</span>
                  ) : (
                    <span className="text-xs text-red-600">未生成</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 扩展表状态 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">扩展功能表</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">training_content</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{stats.training_content_count}</span>
                  {stats.training_content_count > 0 && <CheckCircle className="w-4 h-4 text-green-600" />}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">minimal_pairs</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{stats.minimal_pairs_count}</span>
                  {stats.minimal_pairs_count > 0 && <CheckCircle className="w-4 h-4 text-green-600" />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 健康检查 */}
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">系统健康度</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {stats.total_sentences >= 25 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-orange-500" />
              )}
              <span className="text-sm text-gray-700">
                句子库: {stats.total_sentences >= 25 ? '✓ 充足' : '⚠ 建议增加到25+'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {stats.avg_coverage >= 8 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-orange-500" />
              )}
              <span className="text-sm text-gray-700">
                音节覆盖: {stats.avg_coverage >= 8 ? '✓ 达标' : '⚠ 需要补全数据'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {stats.training_content_count >= 10 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-orange-500" />
              )}
              <span className="text-sm text-gray-700">
                训练内容: {stats.training_content_count >= 10 ? '✓ 可用' : '⚠ 需要运行迁移'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 快速链接 */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/practice/pronunciation"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <h3 className="font-medium text-gray-900">🎤 前往练习页面</h3>
            <p className="text-sm text-gray-600 mt-1">测试录音和评测功能</p>
          </Link>
          <Link
            href="/practice/pronunciation/profile"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all"
          >
            <h3 className="font-medium text-gray-900">📊 查看学习画像</h3>
            <p className="text-sm text-gray-600 mt-1">查看统计和薄弱项</p>
          </Link>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
          >
            <h3 className="font-medium text-gray-900">🗄️ Supabase 控制台</h3>
            <p className="text-sm text-gray-600 mt-1">直接管理数据库</p>
          </a>
        </div>
      </div>
    </div>
  );
}

