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

import { useLanguage } from '@/contexts/LanguageContext';

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

export default function AlignmentMaterialPracticePage() {
  const { t } = useLanguage();
  const params = useParams();
  const materialId = params?.id as string;

  const STAGES = useMemo(() => [
    {
      key: 'learn' as StageKey,
      label: t.alignment.detail.stages.learn.label,
      description: t.alignment.detail.stages.learn.description,
    },
    {
      key: 'task' as StageKey,
      label: t.alignment.detail.stages.task.label,
      description: t.alignment.detail.stages.task.description,
    },
    {
      key: 'review' as StageKey,
      label: t.alignment.detail.stages.review.label,
      description: t.alignment.detail.stages.review.description,
    },
  ], [t]);

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
        throw new Error(json.error || t.alignment.detail.errors.load_failed);
      }
      setMaterial(json.item);
      setChatHistory([]);
      setChatInput('');
      setLatestCorrections([]);
      setNewlyCompletedObjectives([]);
      setObjectiveStates([]);
      setAutoKickoffDone(false);
    } catch (err: any) {
      setError(err?.message || t.alignment.detail.errors.load_failed);
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
        setAttemptError(t.alignment.detail.errors.turn_required);
        return;
      }
    } else if (!submission.trim()) {
      setAttemptError(t.alignment.detail.errors.submit_empty);
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
        throw new Error(json.error || t.alignment.detail.writing.scoring); // Reusing scoring or generic error? Maybe add generic 'submit_failed'
      }
      setLatestAttempt(json.attempt);
      setHistory((prev) => {
        const next = [json.attempt, ...prev];
        return next.slice(0, 10);
      });
      setActiveStage('review');
    } catch (err: any) {
      setAttemptError(err?.message || t.alignment.detail.errors.send_failed);
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
      <main className="max-w-6xl mx-auto p-6 text-muted-foreground">{t.alignment.states.loading}</main>
    );
  }

  if (error || !material) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-6">
          {error || t.alignment.detail.errors.load_failed}
        </div>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/practice/alignment">{t.alignment.card.start_practice}</Link> {/* Or 'Back to list' translated */}
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
          <h2 className="text-xl font-semibold">{t.alignment.detail.prompt.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.alignment.detail.prompt.hint}
          </p>
        </div>
        <div className="bg-muted/40 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {material.task_prompt}
        </div>
        {promptTranslations.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{t.alignment.detail.prompt.view_translation}</summary>
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
          <h2 className="text-xl font-semibold">{t.alignment.detail.knowledge.title}</h2>
          <p className="text-sm text-muted-foreground">{t.alignment.detail.knowledge.desc}</p>
          <div className="grid md:grid-cols-2 gap-4">
            {wordPoints.length > 0 && (
              <div className="space-y-2 text-sm">
                <div className="font-medium">{t.alignment.detail.knowledge.words}</div>
                <ul className="space-y-1.5">
                  {wordPoints.map((item: any, idx: number) => (
                    <li key={`word-${idx}`} className="bg-muted/30 rounded p-3 space-y-1">
                      <div className="font-medium text-foreground">{item.term}</div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {Object.entries(item.translations || {}).length === 0
                          ? t.alignment.detail.knowledge.no_translation
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
                <div className="font-medium">{t.alignment.detail.knowledge.sentences}</div>
                <ul className="space-y-1.5">
                  {sentencePoints.map((item: any, idx: number) => (
                    <li key={`sentence-${idx}`} className="bg-muted/30 rounded p-3 space-y-1">
                      <div className="font-medium text-foreground">{item.sentence}</div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {Object.entries(item.translations || {}).length === 0
                          ? t.alignment.detail.knowledge.no_translation
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
            <summary className="cursor-pointer text-xl font-semibold">{t.alignment.detail.exemplar.title}</summary>
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
            <h2 className="text-xl font-semibold">{t.alignment.detail.writing.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t.alignment.detail.writing.hint}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setActiveStage('learn')}>
            {t.alignment.detail.writing.view_learn}
          </Button>
        </div>
        <details className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            {t.alignment.detail.writing.quick_view_prompt}
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
          <h2 className="text-xl font-semibold">{t.alignment.detail.writing.requirements}</h2>
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
          <h2 className="text-xl font-semibold">{t.alignment.detail.writing.my_practice}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.alignment.detail.writing.my_practice_hint}
          </p>
        </div>
        <Textarea
          rows={10}
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          placeholder={t.alignment.detail.writing.placeholder}
          className="bg-background"
        />
        {attemptError && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">
            {attemptError}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSubmit} disabled={attempting}>
            {attempting ? t.alignment.detail.writing.scoring : t.alignment.detail.writing.submit}
          </Button>
          {latestAttempt && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveStage('review')}
            >
              {t.alignment.detail.writing.view_feedback}
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
            <h2 className="text-xl font-semibold">{t.alignment.detail.dialogue.scenario}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {scenario?.summary || "Complete a roleplay with AI per the prompt and objectives."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setActiveStage('learn')}>
            {t.alignment.detail.writing.view_learn}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">{t.alignment.detail.dialogue.user_role}</div>
            <div className="text-muted-foreground">
              {userRoleName} · {scenario?.user_role?.description || 'Please complete the task based on objectives'}
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">{t.alignment.detail.dialogue.ai_role}</div>
            <div className="text-muted-foreground">
              {aiRoleName} · {scenario?.ai_role?.description || 'AI will assist you'}
            </div>
          </div>
          <div className="rounded-lg bg-muted/20 p-3 text-sm md:col-span-2">
            <div className="font-medium text-foreground">{t.alignment.detail.dialogue.kickoff}</div>
            <div className="text-muted-foreground">
              {kickoffSpeaker === 'ai' ? t.alignment.detail.dialogue.kickoff_ai : t.alignment.detail.dialogue.kickoff_user}
            </div>
          </div>
        </div>
      </section>

      {objectiveStates.length > 0 && (
        <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-3">
          <h2 className="text-xl font-semibold">{t.alignment.detail.dialogue.objectives}</h2>
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
                    {obj.met ? t.alignment.detail.dialogue.met : t.alignment.detail.dialogue.unmet}
                  </Badge>
                </div>
                {obj.evidence && (
                  <div className="text-xs text-muted-foreground">{t.alignment.detail.dialogue.evidence}：{obj.evidence}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t.alignment.detail.dialogue.chat_title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t.alignment.detail.dialogue.chat_desc}
            </p>
          </div>
          <div className="flex items-center gap-2" />
        </div>

        <div className="border rounded-lg bg-muted/20 p-3 max-h-80 overflow-y-auto space-y-3">
          {chatHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {kickoffSpeaker === 'ai'
                ? chatLoading
                  ? t.alignment.detail.dialogue.ai_starting
                  : t.alignment.detail.dialogue.ai_wait
                : t.alignment.detail.dialogue.user_start}
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
            {t.alignment.detail.dialogue.congrats.replace('{goals}', newlyCompletedObjectives.join(', '))}
          </div>
        )}

        {latestCorrections.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-lg px-3 py-2 text-sm space-y-1">
            <div className="font-medium">{t.alignment.detail.dialogue.corrections}</div>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">
                {(t.vocabulary.language_labels as any)[material.lang] || material.lang}
              </Badge>
              {theme && (
                <Badge variant="outline">
                  {(t.alignment.genres as any)[theme.genre] || theme.genre}
                </Badge>
              )}
              <Badge variant="outline">
                {(t.alignment.task_types as any)[material.task_type] || material.task_type}
              </Badge>
              {theme && <span>L{theme.level}</span>}
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





