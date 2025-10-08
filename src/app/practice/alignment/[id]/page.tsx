'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Container } from '@/components/Container';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type StageKey = 'learn' | 'task' | 'review';

const STAGES: Array<{ key: StageKey; label: string; description: string }> = [
  {
    key: 'learn',
    label: '步骤一 / 学习范文和知识点',
    description: '阅读任务提示、示例与核心表达。',
  },
  {
    key: 'task',
    label: '步骤二 / 完成任务',
    description: '根据要求完成对齐练习并提交。',
  },
  {
    key: 'review',
    label: '步骤三 / 总结评价',
    description: '查看评分、亮点与改进建议。',
  },
];

type AlignmentMaterialDetail = {
  id: string;
  lang: string;
  task_type: string;
  knowledge_points: Record<string, any>;
  requirements: Array<{ label: string; translations?: Record<string, string> }>;
  standard_answer: string;
  standard_answer_translations?: Record<string, string>;
  task_prompt: string;
  task_prompt_translations?: Record<string, string>;
  exemplar?: string;
  exemplar_translations?: Record<string, string>;
  rubric?: Record<string, any>;
  subtopic?: {
    id: string;
    title: string;
    one_line?: string | null;
    level: number;
    objectives?: Array<{ label?: string; title?: string }> | null;
    theme?: {
      id: string;
      title: string;
      level: number;
      genre: string;
    } | null;
  } | null;
};

type AttemptSummary = {
  id: string;
  attempt_number: number;
  score_total: number | null;
  scores: Record<string, number> | null;
  feedback: string | null;
  feedback_json: any;
  created_at: string;
};

const LANG_LABEL: Record<string, string> = {
  en: '英语',
  ja: '日语',
  zh: '中文',
};

const TASK_LABEL: Record<string, string> = {
  dialogue: '对话任务',
  article: '文章写作',
  task_email: '任务邮件',
  long_writing: '长写作',
};

const GENRE_LABEL: Record<string, string> = {
  dialogue: '对话',
  article: '文章',
  task_email: '任务邮件',
  long_writing: '长写作',
};

export default function AlignmentMaterialPracticePage() {
  const params = useParams();
  const materialId = params?.id as string;

  const [material, setMaterial] = useState<AlignmentMaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [submission, setSubmission] = useState('');
  const [attempting, setAttempting] = useState(false);
  const [attemptError, setAttemptError] = useState('');
  const [latestAttempt, setLatestAttempt] = useState<AttemptSummary | null>(null);
  const [history, setHistory] = useState<AttemptSummary[]>([]);

  const [activeStage, setActiveStage] = useState<StageKey>('learn');

  const isDialogue = material?.task_type === 'dialogue';

  const fetchDetail = useCallback(async () => {
    if (!materialId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/alignment/materials/${materialId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '加载失败');
      }
      setMaterial(json.item);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  const fetchHistory = useCallback(async () => {
    if (!materialId) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch(`/api/alignment/attempts?material_id=${materialId}`, {
        cache: 'no-store',
        headers,
      });
      const json = await res.json();
      if (res.ok) {
        const list: AttemptSummary[] = json.items || [];
        setHistory(list);
        setLatestAttempt(list[0] || null);
      }
    } catch {
      // ignore history errors
    }
  }, [materialId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSubmit = async () => {
    if (!material) return;
    if (!submission.trim()) {
      setAttemptError(isDialogue ? '请先填写对话内容' : '请先输入练习内容');
      return;
    }
    setAttemptError('');
    setAttempting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch('/api/alignment/attempts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          material_id: material.id,
          submission: isDialogue ? '' : submission,
          transcript: isDialogue ? submission : '',
          task_type: material.task_type,
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature: 0.2,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '评分失败');
      }
      setLatestAttempt(json.attempt);
      setHistory((prev) => {
        const next = [json.attempt, ...prev];
        return next.slice(0, 10);
      });
      setActiveStage('review');
    } catch (err: any) {
      setAttemptError(err?.message || '评分失败');
    } finally {
      setAttempting(false);
    }
  };

  const knowledgePoints = useMemo(() => {
    if (!material?.knowledge_points) return [];
    return Object.entries(material.knowledge_points)
      .map(([category, entries]) => ({
        category,
        entries: Array.isArray(entries) ? entries : [],
      }))
      .filter((group) => group.entries.length > 0);
  }, [material]);

  const requirements = material?.requirements || [];
  const evaluation = latestAttempt?.feedback_json || null;
  const requirementFeedback: Array<{ label: string; met?: boolean; comment?: string }> =
    evaluation?.requirements || [];

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6 text-muted-foreground">加载中...</main>
    );
  }

  if (error || !material) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-6">
          {error || '无法加载训练包'}
        </div>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/practice/alignment">返回列表</Link>
          </Button>
        </div>
      </main>
    );
  }

  const theme = material.subtopic?.theme;
  const activeIndex = STAGES.findIndex((stage) => stage.key === activeStage);
  const promptTranslations = material.task_prompt_translations
    ? Object.entries(material.task_prompt_translations)
    : [];
  const exemplarTranslations = material.exemplar_translations
    ? Object.entries(material.exemplar_translations)
    : [];
  const standardAnswerTranslations = material.standard_answer_translations
    ? Object.entries(material.standard_answer_translations)
    : [];

  const learningStage = (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">任务提示</h2>
          <p className="text-sm text-muted-foreground mt-1">
            请先理解任务背景，再学习范文与知识点。
          </p>
        </div>
        <div className="bg-muted/40 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {material.task_prompt}
        </div>
        {promptTranslations.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">查看提示翻译</summary>
            <div className="mt-2 bg-muted/30 rounded p-3 space-y-2">
              {promptTranslations.map(([key, value]) => (
                <div key={key}>
                  <div className="font-medium uppercase text-xs text-muted-foreground">{key}</div>
                  <p className="text-sm text-muted-foreground">{value}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {knowledgePoints.length > 0 && (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <h2 className="text-xl font-semibold">知识点</h2>
          <p className="text-sm text-muted-foreground">聚焦练习需要掌握的表达、结构或策略。</p>
          <div className="grid md:grid-cols-2 gap-4">
            {knowledgePoints.map((group) => (
              <div key={group.category} className="space-y-2 text-sm">
                <div className="font-medium capitalize">{group.category}</div>
                <ul className="space-y-1.5">
                  {group.entries.map((entry: any, idx: number) => (
                    <li key={idx} className="bg-muted/30 rounded p-3">
                      <div className="font-medium">{entry.label}</div>
                      {entry.explanation && (
                        <div className="text-muted-foreground">{entry.explanation}</div>
                      )}
                      {Array.isArray(entry.examples) && entry.examples.length > 0 && (
                        <ul className="mt-2 text-xs space-y-1 text-muted-foreground">
                          {entry.examples.map((ex: any, j: number) => (
                            <li key={j}>
                              <span className="font-medium">{ex.source}</span>
                              {ex.translation ? ` - ${ex.translation}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {material.exemplar && (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <details>
            <summary className="cursor-pointer text-xl font-semibold">示例范文</summary>
            <div className="mt-3 space-y-3">
              <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {material.exemplar}
              </div>
              {exemplarTranslations.length > 0 && (
                <div className="space-y-2 text-sm text-muted-foreground">
                  {exemplarTranslations.map(([key, value]) => (
                    <div key={key}>
                      <div className="font-medium uppercase text-xs">{key}</div>
                      <p>{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </section>
      )}

      {material.standard_answer?.trim() && (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <details>
            <summary className="cursor-pointer text-xl font-semibold">参考答案</summary>
            <div className="mt-3 space-y-3">
              <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {material.standard_answer}
              </div>
              {standardAnswerTranslations.length > 0 && (
                <div className="space-y-2 text-sm text-muted-foreground">
                  {standardAnswerTranslations.map(([key, value]) => (
                    <div key={key}>
                      <div className="font-medium uppercase text-xs">{key}</div>
                      <p>{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </section>
      )}
    </div>
  );

  const taskStage = (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">完成任务</h2>
            <p className="text-sm text-muted-foreground mt-1">
              按照提示完成练习。如需复习范文，可点击返回第一步。
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setActiveStage('learn')}>
            查看范文与知识点
          </Button>
        </div>
        <details className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            快速查看任务提示
          </summary>
          <div className="mt-2 space-y-3">
            <div className="whitespace-pre-wrap leading-relaxed">{material.task_prompt}</div>
            {promptTranslations.length > 0 && (
              <div className="space-y-2">
                {promptTranslations.map(([key, value]) => (
                  <div key={key}>
                    <div className="font-medium uppercase text-xs text-muted-foreground">{key}</div>
                    <p className="text-sm text-muted-foreground">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </section>

      {requirements.length > 0 && (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <h2 className="text-xl font-semibold">任务要求</h2>
          <ul className="space-y-2 text-sm">
            {requirements.map((req, idx) => (
              <li key={idx} className="bg-muted/30 rounded p-3 flex items-start gap-2">
                <span className="font-medium text-slate-600">{idx + 1}.</span>
                <div>
                  <div className="font-medium text-slate-900">{req.label}</div>
                  {req.translations?.en && (
                    <div className="text-xs text-muted-foreground mt-1">
                      EN: {req.translations.en}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">我的练习</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isDialogue
              ? '请以对话形式书写，可用“游客：…”、“工作人员：…”表示轮次。'
              : '请根据要求完成写作，建议使用所给知识点中的表达。'}
          </p>
        </div>
        <Textarea
          rows={10}
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          placeholder={
            isDialogue
              ? '示例：\n游客：你好，我想去……\n工作人员：您好，这里提供……'
              : '请在此写下你的文章或任务回复...'
          }
          className="bg-background"
        />
        {attemptError && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {attemptError}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={attempting}>
            {attempting ? '评分中...' : '提交并获取评价'}
          </Button>
          {latestAttempt && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStage('review')}
            >
              查看最近评价
            </Button>
          )}
        </div>
      </section>
    </div>
  );

  const reviewStage = (
    <div className="space-y-6">
      {!latestAttempt ? (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <h2 className="text-xl font-semibold">还没有提交记录</h2>
          <p className="text-sm text-muted-foreground">
            完成任务并提交后，这里会展示评分和详细的改进建议。
          </p>
          <div>
            <Button onClick={() => setActiveStage('task')}>前往完成任务</Button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">最新评价</h2>
                <p className="text-sm text-muted-foreground">
                  尝试次数：第 {latestAttempt.attempt_number} 次 / 时间：
                  {new Date(latestAttempt.created_at).toLocaleString()}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setActiveStage('task')}>
                再写一次
              </Button>
            </div>

            {evaluation?.summary && (
              <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed">
                {evaluation.summary}
              </div>
            )}

            {latestAttempt.score_total !== null && (
              <div className="text-3xl font-semibold text-blue-600">
                总分：{latestAttempt.score_total.toFixed(0)} / 100
              </div>
            )}

            {latestAttempt.scores && (
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                {Object.entries(latestAttempt.scores).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-muted/40 px-3 py-2">
                    <div className="text-xs uppercase text-muted-foreground">{key}</div>
                    <div className="font-semibold">
                      {typeof value === 'number' && Number.isFinite(value)
                        ? value.toFixed(0)
                        : '--'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {Array.isArray(requirementFeedback) && requirementFeedback.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-2">要求达成情况</h3>
                <ul className="space-y-2 text-sm">
                  {requirementFeedback.map((item, idx) => (
                    <li
                      key={idx}
                      className="border rounded-lg px-3 py-2 flex flex-col gap-1 bg-muted/20"
                    >
                      <div className="flex items-center justify-between">
                        <span>{item.label}</span>
                        <Badge
                          variant={item.met ? 'default' : 'destructive'}
                          className={item.met ? 'bg-green-500' : undefined}
                        >
                          {item.met ? '已满足' : '待改善'}
                        </Badge>
                      </div>
                      {item.comment && (
                        <p className="text-xs text-muted-foreground">{item.comment}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evaluation?.strengths?.length ? (
              <div>
                <h3 className="text-lg font-medium mb-1">亮点</h3>
                <ul className="list-disc list-inside text-sm text-green-700">
                  {evaluation.strengths.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {evaluation?.improvements?.length ? (
              <div>
                <h3 className="text-lg font-medium mb-1">改进建议</h3>
                <ul className="list-disc list-inside text-sm text-orange-700">
                  {evaluation.improvements.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {history.length > 1 && (
            <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
              <h2 className="text-xl font-semibold">历史记录</h2>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {history.map((attempt) => (
                  <div key={attempt.id} className="border rounded-lg px-3 py-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span>第 {attempt.attempt_number} 次</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(attempt.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-blue-600 mt-1">
                      总分：{attempt.score_total !== null ? attempt.score_total.toFixed(0) : '--'}
                    </div>
                    {attempt.feedback && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                        {attempt.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );

  return (
    <main className="p-6">
      <Container>
        <Breadcrumbs
          items={[
            { href: '/', label: '首页' },
            { href: '/practice/alignment', label: '对齐练习' },
            { label: material.subtopic?.title || '训练包' },
          ]}
        />

        <div className="max-w-5xl mx-auto space-y-6">
          <header className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{LANG_LABEL[material.lang] || material.lang}</Badge>
              {theme && (
                <Badge variant="outline" className="border-blue-300 text-blue-700">
                  {GENRE_LABEL[theme.genre] || theme.genre}
                </Badge>
              )}
              <Badge variant="outline">{TASK_LABEL[material.task_type] || material.task_type}</Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold">
                {material.subtopic?.title || '未命名小主题'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {material.subtopic?.one_line || theme?.title || '围绕该主题完成练习任务。'}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              等级：L{material.subtopic?.level ?? '?'} / 主题：
              {theme?.title || '未分类主题'}
            </div>
            {material.subtopic?.objectives?.length ? (
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {material.subtopic.objectives.map((obj, idx) => (
                  <li key={idx}>{obj.label || obj.title || ''}</li>
                ))}
              </ul>
            ) : null}
          </header>

          <nav className="grid gap-3 md:grid-cols-3">
            {STAGES.map((stage, index) => {
              const status =
                index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo';
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setActiveStage(stage.key)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    status === 'active' && 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm',
                    status === 'done' &&
                      'border-muted-foreground/20 bg-muted/20 hover:border-muted-foreground/30',
                    status === 'todo' &&
                      'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground',
                  )}
                  aria-current={stage.key === activeStage ? 'step' : undefined}
                >
                  <div className="text-sm font-semibold">{stage.label}</div>
                  <p className="text-xs text-muted-foreground mt-2">{stage.description}</p>
                </button>
              );
            })}
          </nav>

          {activeStage === 'learn' && learningStage}
          {activeStage === 'task' && taskStage}
          {activeStage === 'review' && reviewStage}
        </div>
      </Container>
    </main>
  );
}
