'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lang } from '@/types/lang';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import useUserPermissions from '@/hooks/useUserPermissions';
import { getFilteredAIProviders, getDefaultProvider, getDefaultModel } from '@/lib/ai-permissions';

interface ClozeBlank {
  id: number;
  type: string;
  answer: string;
  explanation: string;
}

interface ClozeItem {
  id: string;
  lang: string;
  level: number;
  topic: string;
  title: string;
  passage: string;
  blanks: ClozeBlank[];
}

interface ScoringResult {
  per_blank: Array<{
    id: number;
    score: number;
    reason: string;
    suggestion?: string;
  }>;
  overall: {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  };
}

export default function ClozePage() {
  const permissions = useUserPermissions();
  const [lang, setLang] = useState<Lang>('ja');
  const [level, setLevel] = useState<number>(3);

  // 根据权限初始化provider和model
  const defaultProvider = getDefaultProvider(permissions);
  const [provider, setProvider] = useState<'deepseek' | 'openrouter'>(defaultProvider);
  const [model, setModel] = useState<string>(getDefaultModel(permissions, defaultProvider));
  const [explanationLang, setExplanationLang] = useState<'zh' | 'en' | 'ja'>('zh');
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [currentItem, setCurrentItem] = useState<ClozeItem | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState<string>('');

  const loadNextItem = async () => {
    setLoading(true);
    setError('');
    setScoringResult(null);
    setShowAnswers(false);
    setAnswers({});

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('请先登录');
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/cloze/next?lang=${lang}&level=${level}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();

      if (result.success) {
        setCurrentItem(result.item);
      } else {
        setError(result.error || '获取题目失败');
      }
    } catch (error) {
      setError('网络错误: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswers = async () => {
    if (!currentItem) return;

    // 先显示参考答案
    setShowAnswers(true);
  };

  const proceedToScoring = async () => {
    if (!currentItem) return;

    setScoring(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('请先登录');
        setScoring(false);
        return;
      }
      const response = await fetch('/api/cloze/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          itemId: currentItem.id,
          answers,
          provider,
          model,
          explanationLang,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setScoringResult(result.result);
      } else {
        setError(result.error || '评分失败');
      }
    } catch (error) {
      setError('评分失败: ' + error);
    } finally {
      setScoring(false);
    }
  };

  const renderCloze = () => {
    if (!currentItem) return null;
    const parts: React.ReactNode[] = [];
    const re = /(\{\{(\d+)\}\})/g;
    const text = currentItem.passage;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const full = match[1];
      const idNum = Number(match[2]);
      const start = match.index;
      if (start > lastIndex)
        parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, start)}</span>);

      // 显示输入框
      parts.push(
        <input
          key={`i-${idNum}-${start}`}
          className="mx-1 min-w-20 px-2 py-1 bg-background border-0 border-b-2 border-input focus:outline-none focus:ring-2 focus:ring-ring rounded-none"
          placeholder="填空"
          value={answers[String(idNum)] || ''}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [String(idNum)]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitAnswers();
            }
          }}
          autoComplete="off"
        />,
      );
      lastIndex = start + full.length;
    }
    if (lastIndex < text.length) parts.push(<span key={`t-tail`}>{text.slice(lastIndex)}</span>);
    return <div className="leading-8 text-lg">{parts}</div>;
  };

  const renderUserAnswers = () => {
    if (!currentItem) return null;
    const parts: React.ReactNode[] = [];
    const re = /(\{\{(\d+)\}\})/g;
    const text = currentItem.passage;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const full = match[1];
      const idNum = Number(match[2]);
      const start = match.index;
      if (start > lastIndex)
        parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, start)}</span>);

      // 显示用户答案
      const userAnswer = answers[String(idNum)] || '';
      parts.push(
        <span
          key={`user-answer-${idNum}-${start}`}
          className="mx-1 px-2 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded"
        >
          {userAnswer || '(未填写)'}
        </span>,
      );
      lastIndex = start + full.length;
    }
    if (lastIndex < text.length) parts.push(<span key={`t-tail`}>{text.slice(lastIndex)}</span>);
    return <div className="leading-8 text-lg">{parts}</div>;
  };

  const renderCorrectAnswers = () => {
    if (!currentItem) return null;
    const parts: React.ReactNode[] = [];
    const re = /(\{\{(\d+)\}\})/g;
    const text = currentItem.passage;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const full = match[1];
      const idNum = Number(match[2]);
      const start = match.index;
      if (start > lastIndex)
        parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, start)}</span>);

      // 显示参考答案
      const correctAnswer = currentItem.blanks.find((b) => b.id === idNum)?.answer || '';
      parts.push(
        <span
          key={`correct-answer-${idNum}-${start}`}
          className="mx-1 px-2 py-1 bg-green-100 text-green-800 border border-green-300 rounded"
        >
          {correctAnswer}
        </span>,
      );
      lastIndex = start + full.length;
    }
    if (lastIndex < text.length) parts.push(<span key={`t-tail`}>{text.slice(lastIndex)}</span>);
    return <div className="leading-8 text-lg">{parts}</div>;
  };

  // 全局函数已移除，改为受控输入

  return (
    <main className="p-6">
      <Container>
        <Breadcrumbs items={[{ href: '/', label: '首页' }, { label: 'Cloze 挖空练习' }]} />
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Cloze 挖空练习</h1>
            <p className="text-muted-foreground">从题库中随机抽取题目，AI 智能评分</p>
          </div>

          {/* 设置区域 */}
          <div className="rounded-lg border bg-card text-card-foreground p-6">
            <div className="flex gap-4 items-center justify-center">
              <div>
                <Label className="mb-1 block">语言</Label>
                <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="选择语言" />
                  </SelectTrigger>
                  <SelectContent>
                    {permissions.permissions.allowed_languages.includes('ja') && (
                      <SelectItem value="ja">日本語</SelectItem>
                    )}
                    {permissions.permissions.allowed_languages.includes('en') && (
                      <SelectItem value="en">English</SelectItem>
                    )}
                    {permissions.permissions.allowed_languages.includes('zh') && (
                      <SelectItem value="zh">简体中文</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">难度等级</Label>
                <Select value={String(level)} onValueChange={(v) => setLevel(parseInt(v))}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="选择难度" />
                  </SelectTrigger>
                  <SelectContent>
                    {permissions.permissions.allowed_levels.includes(1) && (
                      <SelectItem value="1">L1 - 初级</SelectItem>
                    )}
                    {permissions.permissions.allowed_levels.includes(2) && (
                      <SelectItem value="2">L2 - 初中级</SelectItem>
                    )}
                    {permissions.permissions.allowed_levels.includes(3) && (
                      <SelectItem value="3">L3 - 中级</SelectItem>
                    )}
                    {permissions.permissions.allowed_levels.includes(4) && (
                      <SelectItem value="4">L4 - 中高级</SelectItem>
                    )}
                    {permissions.permissions.allowed_levels.includes(5) && (
                      <SelectItem value="5">L5 - 高级</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">AI 提供商</Label>
                <Select
                  value={provider}
                  onValueChange={(p: 'deepseek' | 'openrouter') => {
                    setProvider(p);
                    setModel(getDefaultModel(permissions, p));
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="选择提供商" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const filteredProviders = getFilteredAIProviders(permissions);
                      return Object.entries(filteredProviders).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.name}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">模型</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const filteredProviders = getFilteredAIProviders(permissions);
                      const providerConfig = filteredProviders[provider];
                      if (!providerConfig) return null;

                      return providerConfig.models.map((model: any) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">讲解语言</Label>
                <Select
                  value={explanationLang}
                  onValueChange={(v) => setExplanationLang(v as 'zh' | 'en' | 'ja')}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="选择讲解语言" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">简体中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-6">
                <Button onClick={loadNextItem} disabled={loading}>
                  {loading ? '加载中...' : '开始练习'}
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded border border-red-300 bg-red-50 text-red-700">
              {error}
            </div>
          )}

          {/* 题目区域 */}
          {currentItem && (
            <div className="rounded-lg border bg-card text-card-foreground p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2">{currentItem.title}</h2>
                <div className="text-sm text-muted-foreground">
                  语言: {currentItem.lang.toUpperCase()} | 难度: L{currentItem.level} | 主题:{' '}
                  {currentItem.topic}
                </div>
              </div>

              <div className="mb-6 p-4 bg-muted rounded">{renderCloze()}</div>

              <div className="flex gap-4 items-center">
                {!showAnswers ? (
                  <>
                    <Button onClick={submitAnswers} disabled={Object.keys(answers).length === 0}>
                      提交答案
                    </Button>
                    <Button variant="secondary" onClick={loadNextItem}>
                      下一题
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={proceedToScoring} disabled={scoring}>
                      {scoring ? '评分中...' : '查看评分'}
                    </Button>
                    <Button variant="secondary" onClick={loadNextItem}>
                      下一题
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 参考答案显示 */}
          {showAnswers && !scoringResult && (
            <div className="rounded-lg border bg-card text-card-foreground p-6">
              <h3 className="text-xl font-semibold mb-4">答案对比</h3>

              {/* 用户答案 */}
              <div className="mb-4">
                <h4 className="font-medium text-blue-600 mb-2">您的答案：</h4>
                <div className="p-4 bg-blue-50 rounded border border-blue-200">
                  {renderUserAnswers()}
                </div>
              </div>

              {/* 参考答案 */}
              <div className="mb-4">
                <h4 className="font-medium text-green-600 mb-2">参考答案：</h4>
                <div className="p-4 bg-green-50 rounded border border-green-200">
                  {renderCorrectAnswers()}
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                请仔细对比您的答案和参考答案，然后点击&ldquo;查看评分&rdquo;了解您的表现。
              </p>
            </div>
          )}

          {/* 评分结果 */}
          {scoringResult && (
            <div className="rounded-lg border bg-card text-card-foreground p-6">
              <h3 className="text-xl font-semibold mb-4">评分结果</h3>

              <div className="mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {Math.round(scoringResult.overall.score * 100)}%
                  </div>
                  <p className="text-gray-600">{scoringResult.overall.feedback}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-green-600 mb-2">优点</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {scoringResult.overall.strengths.map((strength, index) => (
                      <li key={index} className="text-sm">
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-orange-600 mb-2">改进建议</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {scoringResult.overall.improvements.map((improvement, index) => (
                      <li key={index} className="text-sm">
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold mb-3">详细评分</h4>
                <div className="space-y-3">
                  {scoringResult.per_blank.map((blank) => (
                    <div key={blank.id} className="p-3 bg-gray-50 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">第 {blank.id} 空</span>
                        <span
                          className={`px-2 py-1 rounded text-sm ${
                            blank.score === 1
                              ? 'bg-green-100 text-green-800'
                              : blank.score === 0.5
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {blank.score === 1
                            ? '完全正确'
                            : blank.score === 0.5
                              ? '部分正确'
                              : '需要改进'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{blank.reason}</p>
                      {blank.suggestion && (
                        <p className="text-sm text-blue-600">💡 {blank.suggestion}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
