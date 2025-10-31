'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { HeaderProgress } from '@/components/cloze-shadowing/HeaderProgress';
import { SentenceCard } from '@/components/cloze-shadowing/SentenceCard';
import { FooterBar } from '@/components/cloze-shadowing/FooterBar';

type SentencePayload = {
  index: number;
  text: string;
  blank: { start: number; length: number };
  options: string[];
  num_correct: number;
  is_placeholder?: boolean;
};

export default function ClozeShadowingPracticePage() {
  const params = useParams();
  const articleId = String(params?.articleId || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [article, setArticle] = useState<{ id: string; lang: string; level: number; title: string } | null>(null);
  const [sentences, setSentences] = useState<SentencePayload[]>([]);
  const [answersByIndex, setAnswersByIndex] = useState<Record<number, string[]>>({});
  const [showSolution, setShowSolution] = useState(false);
  const [solution, setSolution] = useState<null | { text: string; audio_url: string | null; translations: Record<string, string> | null; sentences: Array<{ index: number; text: string; blank_start: number; blank_length: number; correct_options: string[] }> }>(null);
  const [summary, setSummary] = useState<null | { total: number; correct: number; accuracy: number }>(null);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [animating, setAnimating] = useState<Record<string, boolean>>({});
  const [shaking, setShaking] = useState<Record<number, boolean>>({});
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, 'correct' | 'wrong' | null>>({});
  const [focusedSentenceIndex, setFocusedSentenceIndex] = useState<number | null>(null);

  const totalSentences = useMemo(() => sentences.length, [sentences]);
  const needCountForSentence = (s: SentencePayload) => (s.is_placeholder ? 0 : Math.max(1, s.num_correct || 1));
  const completedCount = useMemo(() => {
    return sentences.reduce((acc, s) => {
      const arr = answersByIndex[s.index] || [];
      const need = needCountForSentence(s);
      return acc + (arr.length >= need ? 1 : 0);
    }, 0);
  }, [sentences, answersByIndex]);

  const firstIncompleteIndex = useMemo(() => {
    for (const s of sentences) {
      const arr = answersByIndex[s.index] || [];
      const need = needCountForSentence(s);
      if (arr.length < need) return s.index;
    }
    return null;
  }, [sentences, answersByIndex]);

  const sentenceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollToIndex = useCallback((idx: number | null) => {
    if (idx == null) return;
    const el = sentenceRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleDotClick = (idx: number) => {
    const s = sentences.find((x) => x.index === idx);
    if (!s) return;
    const arr = answersByIndex[idx] || [];
    const need = Math.max(1, s.num_correct || 1);
    const done = arr.length >= need;
    if (showOnlyIncomplete && done) {
      setShowOnlyIncomplete(false);
      setTimeout(() => scrollToIndex(idx), 0);
    } else {
      scrollToIndex(idx);
    }
  };

  const displayedSentences = useMemo(() => {
    if (!showOnlyIncomplete) return sentences;
    return sentences.filter((s) => {
      const arr = answersByIndex[s.index] || [];
      const need = needCountForSentence(s);
      return arr.length < need;
    });
  }, [sentences, answersByIndex, showOnlyIncomplete]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('请先登录');
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/cloze-shadowing/all?article_id=${articleId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || '加载失败');
      setArticle(data.article);
      setSentences((data.sentences || []).map((s: any) => ({
        index: s.index,
        text: s.text,
        blank: s.blank,
        options: s.options || [],
        num_correct: s.num_correct || 0,
        is_placeholder: s.is_placeholder || ((s.blank?.length || 0) === 0 || (s.num_correct || 0) === 0),
      })));
      setAnswersByIndex({});
      setShowSolution(false);
      setSolution(null);
      setSummary(null);
    } catch (e: any) {
      setError(e?.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (articleId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  // 键盘快捷键处理
  useEffect(() => {
    if (showSolution || loading) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Backspace: 撤销当前聚焦句子的最近一次选择
      if (e.key === 'Backspace' && focusedSentenceIndex !== null) {
        e.preventDefault();
        const s = sentences.find((s) => s.index === focusedSentenceIndex);
        if (s && !s.is_placeholder) {
          const current = answersByIndex[focusedSentenceIndex] || [];
          const need = needCountForSentence(s);
          if (current.length > 0 && current.length < need) {
            handleUndo(focusedSentenceIndex);
          }
        }
        return;
      }

      // Enter: 跳到下一未完成题目
      if (e.key === 'Enter') {
        e.preventDefault();
        if (firstIncompleteIndex !== null) {
          scrollToIndex(firstIncompleteIndex);
          setFocusedSentenceIndex(firstIncompleteIndex);
        }
        return;
      }

      // 数字键 1-9: 选择当前聚焦句子的第 N 个选项
      if (e.key >= '1' && e.key <= '9' && focusedSentenceIndex !== null) {
        e.preventDefault();
        const s = sentences.find((s) => s.index === focusedSentenceIndex);
        if (s && !s.is_placeholder && s.options.length > 0) {
          const optionIndex = parseInt(e.key) - 1;
          if (optionIndex < s.options.length) {
            handleSelect(focusedSentenceIndex, s.options[optionIndex]);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSolution, loading, focusedSentenceIndex, sentences, answersByIndex, firstIncompleteIndex, handleUndo, handleSelect, scrollToIndex]);

  const handleUndo = useCallback((sIndex: number) => {
    setAnswersByIndex((prev) => {
      const current = prev[sIndex] || [];
      if (current.length === 0) return prev;
      const s = sentences.find((s) => s.index === sIndex);
      if (!s) return prev;
      const need = needCountForSentence(s);
      // 仅在未达到所需项数时允许撤销
      if (current.length >= need) return prev;
      const next = current.slice(0, -1);
      // 清除反馈
      setFeedbackByIndex((prevFb) => ({ ...prevFb, [sIndex]: null }));
      return { ...prev, [sIndex]: next };
    });
  }, [sentences]);

  const checkImmediateFeedback = useCallback(async (sIndex: number, picked: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/cloze-shadowing/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ article_id: articleId, sentence_index: sIndex, selected_options: picked }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        const isCorrect = data.is_correct;
        setFeedbackByIndex((prevFb) => ({ ...prevFb, [sIndex]: isCorrect ? 'correct' : 'wrong' }));
        // 错误时触发震动动画
        if (!isCorrect) {
          setShaking((prev) => ({ ...prev, [sIndex]: true }));
          setTimeout(() => {
            setShaking((prev) => ({ ...prev, [sIndex]: false }));
          }, 220);
        }
      }
    } catch (e) {
      // 忽略错误，避免打断用户流程
    }
  }, [articleId]);

  const handleSelect = useCallback((sIndex: number, opt: string) => {
    setAnswersByIndex((prev) => {
      const current = prev[sIndex] || [];
      const need = Math.max(1, (sentences.find((s) => s.index === sIndex)?.num_correct || 1));
      // 已选满或点击已选项时，不允许重选/更改
      if (current.length >= need || current.includes(opt)) {
        return prev;
      }
      let next: string[];
      // 仅允许追加，直到达到需要的数量
      if (need === 1) {
        next = [opt];
      } else {
        if (current.length < need) next = [...current, opt];
        else next = current;
      }
      // 选中时触发一次性弹跳动画；取消选中时触发一次性淡出缩放
      const key = `${sIndex}__${opt}`;
      setAnimating((prevAnim) => ({ ...prevAnim, [key]: false }));
      // 强制重置后再开启，确保重复点击也能触发
      requestAnimationFrame(() => {
        setAnimating((prevAnim) => ({ ...prevAnim, [key]: true }));
        setTimeout(() => {
          setAnimating((prevAnim) => ({ ...prevAnim, [key]: false }));
        }, 160);
      });

      // 达到需选数量时触发即时判定；否则清除反馈
      const reachNeed = (next.length >= need && need > 0);
      if (reachNeed) {
        void checkImmediateFeedback(sIndex, next);
      } else {
        setFeedbackByIndex((prevFb) => ({ ...prevFb, [sIndex]: null }));
      }
      return { ...prev, [sIndex]: next };
    });
  }, [sentences, articleId, checkImmediateFeedback]);

  const checkImmediateFeedback = useCallback(async (sIndex: number, picked: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/cloze-shadowing/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ article_id: articleId, sentence_index: sIndex, selected_options: picked }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        const isCorrect = data.is_correct;
        setFeedbackByIndex((prevFb) => ({ ...prevFb, [sIndex]: isCorrect ? 'correct' : 'wrong' }));
        // 错误时触发震动动画
        if (!isCorrect) {
          setShaking((prev) => ({ ...prev, [sIndex]: true }));
          setTimeout(() => {
            setShaking((prev) => ({ ...prev, [sIndex]: false }));
          }, 220);
        }
      }
    } catch (e) {
      // 忽略错误，避免打断用户流程
    }
  };

  const submitAll = async () => {
    if (!articleId || sentences.length === 0) return;
    const allDone = sentences.every((s) => (answersByIndex[s.index] || []).length >= needCountForSentence(s));
    if (!allDone) {
      setError('请先完成所有题目再提交');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('请先登录');
        setLoading(false);
        return;
      }

      // 统一写入：仅对需要作答的句子批量提交
      await Promise.all(
        sentences
          .filter((s) => needCountForSentence(s) > 0)
          .map((s) => {
            const picked = answersByIndex[s.index] || [];
            return fetch('/api/cloze-shadowing/attempt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                article_id: articleId,
                sentence_index: s.index,
                selected_options: picked,
              }),
            }).then((r) => r.json());
          }),
      );

      const sumResp = await fetch('/api/cloze-shadowing/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ article_id: articleId }),
      });
      const sumData = await sumResp.json();
      if (sumResp.ok && sumData?.success) {
        setSummary({ total: sumData.total, correct: sumData.correct, accuracy: sumData.accuracy });
      }

      const res = await fetch(`/api/cloze-shadowing/solution?article_id=${articleId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data?.success) {
        setSolution({
          text: data.article.text,
          audio_url: data.article.audio_url || null,
          translations: data.article.translations || null,
          sentences: (data.sentences || []).map((s: any) => ({
            index: s.sentence_index,
            text: s.sentence_text,
            blank_start: s.blank_start,
            blank_length: s.blank_length,
            correct_options: s.correct_options || [],
          })),
        });
        setShowSolution(true);
      }
    } catch (e: any) {
      setError(e?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <main className="p-6">
      <Container>
        <Breadcrumbs items={[{ href: '/', label: '首页' }, { label: 'Shadowing Cloze 挖空' }]} />
        <div className="max-w-4xl mx-auto space-y-4">
          <HeaderProgress
            article={article}
            totalSentences={totalSentences}
            completedCount={completedCount}
            showOnlyIncomplete={showOnlyIncomplete}
            sentences={sentences}
            answersByIndex={answersByIndex}
            needCountForSentence={needCountForSentence}
            onToggleFilter={setShowOnlyIncomplete}
            onDotClick={handleDotClick}
          />

          {error && (
            <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 mb-4 shadow-sm flex items-center justify-between gap-3">
              <span className="text-sm">{error}</span>
              <Button size="sm" variant="outline" onClick={() => loadAll()}>重试</Button>
            </div>
          )}

          {loading && !showSolution && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <Skeleton key={j} className="h-10 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showSolution && !loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displayedSentences.map((s) => (
                  <SentenceCard
                    key={s.index}
                    ref={(el) => { sentenceRefs.current[s.index] = el; }}
                    sentence={s}
                    selected={answersByIndex[s.index] || []}
                    feedback={feedbackByIndex[s.index] || null}
                    animating={animating}
                    shaking={shaking[s.index] || false}
                    needCount={needCountForSentence(s)}
                    onSelect={(opt) => handleSelect(s.index, opt)}
                    onUndo={() => handleUndo(s.index)}
                    onFocus={() => setFocusedSentenceIndex(s.index)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setFocusedSentenceIndex(null);
                      }
                    }}
                  />
                ))}
              </div>
              <FooterBar
                completedCount={completedCount}
                totalSentences={totalSentences}
                firstIncompleteIndex={firstIncompleteIndex}
                loading={loading}
                onJumpToNext={() => scrollToIndex(firstIncompleteIndex)}
                onSubmit={submitAll}
              />
            </>
          )}

          {showSolution && solution && (
            <div className="rounded-lg border bg-card text-card-foreground p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">参考答案与原文</h2>
                {solution.audio_url ? (
                  <audio controls src={solution.audio_url} />
                ) : null}
              </div>
              {summary && (
                <div className="text-sm">正确率：{Math.round((summary.accuracy || 0) * 100)}%（{summary.correct}/{summary.total}）</div>
              )}
              <div className="prose whitespace-pre-wrap p-4 bg-muted rounded">{solution.text}</div>
              {solution.translations && (
                <div className="space-y-2">
                  <div className="font-medium">翻译</div>
                  <div className="text-sm text-muted-foreground">
                    {Object.entries(solution.translations).map(([k, v]) => (
                      <div key={k}><span className="font-semibold mr-2">[{k}]</span>{String(v)}</div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="font-medium mb-2">逐句答案对照</div>
                <div className="space-y-2">
                  {solution.sentences.map((s) => {
                    const userAns = (answersByIndex[s.index] || []).map((x) => x.trim().toLowerCase());
                    const correct = (s.correct_options || []).map((x) => x.trim().toLowerCase());
                    const isCorrect = userAns.length === correct.length && userAns.every((x) => correct.includes(x));
                    return (
                      <div key={s.index} className={`p-3 rounded ${isCorrect ? 'bg-emerald-50 animate-answer-correct' : 'bg-rose-50 animate-answer-wrong'}`}>
                        <div className="mb-1 text-sm text-muted-foreground">{isCorrect ? '✅' : '❌'}</div>
                        <div className="mb-2 whitespace-pre-wrap">{s.text}</div>
                        <div className="text-sm mb-1">
                          你的答案：
                          {(answersByIndex[s.index] || []).length > 0 ? (
                            <span className={`ml-1 px-1.5 py-0.5 rounded ${isCorrect ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                              {(answersByIndex[s.index] || []).join(' / ')}
                            </span>
                          ) : '—'}
                        </div>
                        <div className="text-sm">
                          正确答案：<span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">{s.correct_options.join(' / ')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </main>
    </>
  );
}



