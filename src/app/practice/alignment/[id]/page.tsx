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
import type {
  AlignmentKnowledgePoints,
  AlignmentPracticeScenario,
  AlignmentStandardDialogue,
} from '@/lib/alignment/types';

type StageKey = 'learn' | 'task' | 'review';

const STAGES: Array<{ key: StageKey; label: string; description: string }> = [
  {
    key: 'learn',
    label: '步骤一 / 学习范文和知识点',
    description: '阅读任务提示、示例与核心表达',
  },
  {
    key: 'task',
    label: '步骤二 / 完成任务',
    description: '根据要求完成对齐练习并提交',
  },
  {
    key: 'review',
    label: '步骤三 / 总结评价',
    description: '查看评分、亮点与改进建议',
  },
];

type AlignmentMaterialDetail = {
  id: string;
  lang: string;
  task_type: string;
  knowledge_points: AlignmentKnowledgePoints;
  requirements: Array<{ label: string; translations?: Record<string, string> }>;
  standard_answer: string;
  standard_answer_translations?: Record<string, string>;
  task_prompt: string;
  task_prompt_translations?: Record<string, string>;
  exemplar?: string;
  exemplar_translations?: Record<string, string>;
  rubric?: Record<string, any>;
  practice_scenario?: AlignmentPracticeScenario | null;
  standard_dialogue?: AlignmentStandardDialogue | null;
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

type DialogueTurn = {
  speaker: 'user' | 'ai';
  text: string;
};

type ObjectiveState = {
  index: number;
  label: string;
  met: boolean;
  evidence?: string;
};

type CorrectionItem = {
  original: string;
  corrected: string;
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

  const [chatHistory, setChatHistory] = useState<DialogueTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [objectiveStates, setObjectiveStates] = useState<ObjectiveState[]>([]);
  const [latestCorrections, setLatestCorrections] = useState<CorrectionItem[]>([]);
  const [newlyCompletedObjectives, setNewlyCompletedObjectives] = useState<number[]>([]);
  const [autoKickoffDone, setAutoKickoffDone] = useState(false);

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
      setChatHistory([]);
      setChatInput('');
      setLatestCorrections([]);
      setNewlyCompletedObjectives([]);
      setObjectiveStates([]);
      setAutoKickoffDone(false);
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
    if (isDialogue) {
      const hasUserTurn = chatHistory.some((turn) => turn.speaker === 'user');
      if (!hasUserTurn) {
        setAttemptError("Please complete at least one dialogue turn first");
        return;
      }
    } else if (!submission.trim()) {
      setAttemptError('请先输入练习内容');
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

      const transcript = isDialogue
        ? chatHistory
            .map((turn) => `${turn.speaker === 'user' ? userRoleName : aiRoleName}: ${turn.text}`)
            .join('\n')
        : '';

      const res = await fetch('/api/alignment/attempts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          material_id: material.id,
          submission: isDialogue ? '' : submission,
          transcript: isDialogue ? transcript : '',
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

  const { wordPoints, sentencePoints } = useMemo(() => {
    const words = Array.isArray(material?.knowledge_points?.words)
      ? material!.knowledge_points.words
      : [];
    const sentences = Array.isArray(material?.knowledge_points?.sentences)
      ? material!.knowledge_points.sentences
      : [];
    return { wordPoints: words, sentencePoints: sentences };
  }, [material]);

  const scenario = material?.practice_scenario || null;
  const standardDialogue = material?.standard_dialogue || null;
  const kickoffSpeaker: 'user' | 'ai' = scenario?.kickoff_speaker === 'user' ? 'user' : 'ai';
  const userRoleName = scenario?.user_role?.name || '学员';
  const aiRoleName = scenario?.ai_role?.name || 'AI';
  const scenarioObjectiveLabels = useMemo(() => {
    const labels: string[] = [];
    if (Array.isArray(scenario?.objectives)) {
      scenario.objectives.forEach((obj: any) => {
        const label = obj?.label;
        if (label) labels.push(label);
      });
    }
    if (
      labels.length === 0 &&
      Array.isArray(material?.subtopic?.objectives) &&
      material.subtopic?.objectives
    ) {
      material.subtopic.objectives.forEach((obj: any) => {
        const label = obj?.label || obj?.title;
        if (label) labels.push(label);
      });
    }
    return labels;
  }, [material, scenario]);

  const requirements = material?.requirements || [];
  const evaluation = latestAttempt?.feedback_json || null;
  const evaluationErrors: Array<{ type?: string; original: string; correction: string }> =
    Array.isArray(evaluation?.errors)
      ? evaluation.errors.map((item: any) => ({
          type: item?.type || 'error',
          original: item?.original || '',
          correction: item?.correction || '',
        }))
      : [];
  const evaluationSuggestions: string[] = Array.isArray(evaluation?.suggestions)
    ? evaluation.suggestions
        .filter((s: any) => typeof s === 'string' && s.trim())
        .map((s: string) => s.trim())
    : [];
  const evaluationCompleted = evaluation ? Boolean(evaluation.task_completed) : null;

  const sendTurn = useCallback(
    async (historyForRequest: DialogueTurn[]) => {
      if (!material) return;
      setChatLoading(true);
      setChatError('');
      setLatestCorrections([]);
      setNewlyCompletedObjectives([]);
      try {
        const res = await fetch('/api/alignment/roleplay/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            material_id: material.id,
            history: historyForRequest,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || '对话生成失败');
        }
        if (json.wait_for_user) {
          setAutoKickoffDone(true);
          return;
        }
        const aiReply = typeof json.reply === 'string' ? json.reply : '';
        const updatedHistory = [...historyForRequest, { speaker: 'ai' as const, text: aiReply }];
        setChatHistory(updatedHistory);
        setLatestCorrections(Array.isArray(json.corrections) ? json.corrections : []);
        setNewlyCompletedObjectives(
          Array.isArray(json.newly_completed) ? json.newly_completed : [],
        );
        if (Array.isArray(json.objectives) && json.objectives.length > 0) {
          setObjectiveStates(
            json.objectives.map((item: any) => ({
              index: item.index,
              label: item.label,
              met: Boolean(item.met),
              evidence: item.evidence || '',
            })),
          );
        }
        setAutoKickoffDone(true);
      } catch (error: any) {
        setChatError(error instanceof Error ? error.message : String(error));
      } finally {
        setChatLoading(false);
      }
    },
    [material],
  );

  const handleSendChat = useCallback(async () => {
    if (!material || chatLoading) return;
    const message = chatInput.trim();
    if (!message) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setChatError('请先登录后再继续对话');
        return;
      }
    } catch (err) {
      console.error(err);
      setChatError('登录状态校验失败，请稍后重试');
      return;
    }

    const nextHistory = [...chatHistory, { speaker: 'user' as const, text: message }];
    setChatHistory(nextHistory);
    setChatInput('');
    setAttemptError('');
    try {
      await sendTurn(nextHistory);
    } catch (err) {
      console.error(err);
      setChatError('发送失败，请稍后重试');
    }
  }, [material, chatLoading, chatInput, chatHistory, sendTurn]);

  const handleKickoff = useCallback(async () => {
    if (!material || chatLoading) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setChatError('请先登录后再开始对话');
        return;
      }
      await sendTurn([]);
    } catch (err) {
      console.error(err);
      setChatError('开始对话失败，请稍后重试');
    }
  }, [material, chatLoading, sendTurn]);

  useEffect(() => {
    if (!material || material.task_type !== 'dialogue') return;
    if (scenarioObjectiveLabels.length === 0) {
      setObjectiveStates([]);
      return;
    }
    setObjectiveStates(
      scenarioObjectiveLabels.map((label, idx) => ({
        index: idx + 1,
        label,
        met: false,
        evidence: '',
      })),
    );
  }, [material?.id, material?.task_type, scenarioObjectiveLabels]);

  useEffect(() => {
    if (!material || material.task_type !== 'dialogue') return;
    if (kickoffSpeaker !== 'ai') return;
    if (chatHistory.length > 0 || autoKickoffDone || chatLoading) return;
    sendTurn([]);
  }, [material, kickoffSpeaker, chatHistory.length, autoKickoffDone, chatLoading, sendTurn]);

  useEffect(() => {
    if (!material || material.task_type !== 'dialogue') return;
    if (scenarioObjectiveLabels.length === 0) {
      setObjectiveStates([]);
      return;
    }
    setObjectiveStates(
      scenarioObjectiveLabels.map((label, idx) => ({
        index: idx + 1,
        label,
        met: false,
        evidence: '',
      })),
    );
  }, [material?.id, material?.task_type, scenarioObjectiveLabels]);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6 text-muted-foreground">加载中...</main>
    );
  }

  if (error || !material) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-6">
          {error || "Unable to load practice pack"}
        </div>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/practice/alignment">Back to list</Link>
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

      {(wordPoints.length > 0 || sentencePoints.length > 0) && (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <h2 className="text-xl font-semibold">知识点</h2>
          <p className="text-sm text-muted-foreground">聚焦练习需要掌握的表达、结构或策略。</p>
          <div className="grid md:grid-cols-2 gap-4">
            {wordPoints.length > 0 && (
              <div className="space-y-2 text-sm">
                <div className="font-medium">核心词汇</div>
                <ul className="space-y-1.5">
                  {wordPoints.map((item: any, idx: number) => (
                    <li key={`word-${idx}`} className="bg-muted/30 rounded p-3 space-y-1">
                      <div className="font-medium text-foreground">{item.term}</div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {Object.entries(item.translations || {}).length === 0
                          ? '暂无翻译'
                          : Object.entries(item.translations || {}).map(([code, value]) => (
                              <div key={code}>
                                <span className="uppercase font-semibold mr-1">{code}</span>
                                {String(value)}
                              </div>
                            ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sentencePoints.length > 0 && (
              <div className="space-y-2 text-sm">
                <div className="font-medium">关键句型</div>
                <ul className="space-y-1.5">
                  {sentencePoints.map((item: any, idx: number) => (
                    <li key={`sentence-${idx}`} className="bg-muted/30 rounded p-3 space-y-1">
                      <div className="font-medium text-foreground">{item.sentence}</div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {Object.entries(item.translations || {}).length === 0
                          ? '暂无翻译'
                          : Object.entries(item.translations || {}).map(([code, value]) => (
                              <div key={code}>
                                <span className="uppercase font-semibold mr-1">{code}</span>
                                {String(value)}
                              </div>
                            ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

      {/* 标准答案在任务完成后展示，这里不再显示 */}
    </div>
  );

  const writingTaskStage = (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">完成写作任务</h2>
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
            请根据要求完成写作，建议使用所给知识点中的表达。
          </p>
        </div>
        <Textarea
          rows={10}
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          placeholder="请在此写下你的文章或任务回复..."
          className="bg-background"
        />
        {attemptError && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {attemptError}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={attempting}>
            {attempting ? 'Scoring...' : 'Submit and get feedback'}
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

  const dialogueTaskStage = (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">练习场景</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {scenario?.summary || "Complete a roleplay with AI per the prompt and objectives."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setActiveStage('learn')}>
            查看范文与知识点
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">学员角色</div>
            <div className="text-muted-foreground">
              {userRoleName} · {scenario?.user_role?.description || '请根据目标完成任务'}
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">AI 角色</div>
            <div className="text-muted-foreground">
              {aiRoleName} · {scenario?.ai_role?.description || 'AI 将协助你完成目标'}
            </div>
          </div>
          <div className="rounded-lg bg-muted/20 p-3 text-sm md:col-span-2">
            <div className="font-medium text-foreground">开场顺序</div>
            <div className="text-muted-foreground">
              {kickoffSpeaker === 'ai' ? 'AI 先开场，你紧随其后回应' : '请先由你发言来开启对话'}
            </div>
          </div>
        </div>
      </section>

      {objectiveStates.length > 0 && (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <h2 className="text-xl font-semibold">目标进度</h2>
          <ul className="space-y-2 text-sm">
            {objectiveStates.map((obj) => (
              <li
                key={obj.index}
                className={cn(
                  'border rounded-lg px-3 py-2 flex flex-col gap-1',
                  obj.met ? 'border-green-300 bg-green-50' : 'border-muted',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {obj.index}. {obj.label}
                  </span>
                  <Badge variant={obj.met ? 'default' : 'secondary'}>
                    {obj.met ? '已完成' : '待完成'}
                  </Badge>
                </div>
                {obj.evidence && (
                  <div className="text-xs text-muted-foreground">关键句：{obj.evidence}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold">实时对话</h2>
            <p className="text-sm text-muted-foreground mt-1">
              使用上方知识点，完成对话并满足目标。AI 会在必要时纠正你的表达。
            </p>
          </div>
          <div className="flex items-center gap-2" />
        </div>

        <div className="border rounded-lg bg-muted/20 p-3 max-h-80 overflow-y-auto space-y-3">
          {chatHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {kickoffSpeaker === 'ai'
                ? chatLoading
                  ? 'AI 正在开启对话...'
                  : '点击"让 AI 开始"或稍候等待 AI 发言。'
                : '请先输入第一句对话来开启练习。'}
            </div>
          ) : (
            chatHistory.map((turn, idx) => (
              <div
                key={`${turn.speaker}-${idx}`}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm',
                  turn.speaker === 'user'
                    ? 'bg-white border border-blue-200'
                    : 'bg-blue-50 border border-blue-200 text-blue-900',
                )}
              >
                <div className="font-medium mb-1">
                  {turn.speaker === 'user' ? userRoleName : aiRoleName}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{turn.text}</div>
              </div>
            ))
          )}
        </div>

        {newlyCompletedObjectives.length > 0 && (
          <div className="text-sm text-green-700 border border-green-200 bg-green-50 rounded px-3 py-2">
            恭喜完成目标 {newlyCompletedObjectives.join(', ')}！
          </div>
        )}

        {latestCorrections.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-lg px-3 py-2 text-sm space-y-1">
            <div className="font-medium">纠正建议</div>
            {latestCorrections.map((item, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="line-through decoration-red-400">{item.original}</span>
                <span className="text-foreground">{item.corrected}</span>
              </div>
            ))}
          </div>
        )}

        {chatError && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {chatError}
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            rows={3}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="请输入你的下一句对话..."
            disabled={chatLoading}
            className="bg-background"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}>
              {chatLoading ? '生成中...' : '发送'}
            </Button>
            {kickoffSpeaker === 'ai' && chatHistory.length === 0 && !chatLoading && (
              <Button type="button" variant="outline" onClick={handleKickoff}>
                让 AI 开始
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setChatInput('');
                setChatError('');
              }}
            >
              清空输入
            </Button>
          </div>
        </div>

        {attemptError && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {attemptError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={attempting || chatLoading}>
            {attempting ? '评分中...' : '结束对话并提交评价'}
          </Button>
          {latestAttempt && (
            <Button variant="outline" onClick={() => setActiveStage('review')}>
              查看最近评价
            </Button>
          )}
        </div>
      </section>
    </div>
  );

  const taskStage = isDialogue ? dialogueTaskStage : writingTaskStage;


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

            {latestAttempt.score_total !== null && (
              <div className="text-3xl font-semibold text-blue-600">
                总分：{latestAttempt.score_total.toFixed(0)} / 100
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              当前状态：
              {evaluationCompleted === null
                ? '未评价'
                : evaluationCompleted
                  ? '任务已完成'
                  : '任务未完成'}
            </div>

            {evaluationErrors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium">发现的错误</h3>
                <ul className="space-y-2 text-sm">
                  {evaluationErrors.map((err, idx) => (
                    <li
                      key={idx}
                      className="border rounded-lg px-3 py-2 bg-rose-50 text-rose-700 space-y-1"
                    >
                      <div className="text-xs uppercase font-semibold">
                        {err.type || 'error'}
                      </div>
                      <div className="line-through decoration-rose-400">{err.original}</div>
                      <div className="text-foreground">{err.correction}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evaluationSuggestions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium">改进建议</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {evaluationSuggestions.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
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
            { label: material.subtopic?.title || '训练页' },
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





