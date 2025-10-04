'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
 

type SentencePayload = {
  index: number;
  text: string;
  blank: { start: number; length: number };
  options: string[];
  num_correct: number;
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
  const [animatingOut, setAnimatingOut] = useState<Record<string, boolean>>({});
  const [shaking, setShaking] = useState<Record<number, boolean>>({});
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, 'correct' | 'wrong' | null>>({});

  const totalSentences = useMemo(() => sentences.length, [sentences]);
  const completedCount = useMemo(() => {
    return sentences.reduce((acc, s) => {
      const arr = answersByIndex[s.index] || [];
      const need = Math.max(1, s.num_correct || 1);
      return acc + (arr.length >= need ? 1 : 0);
    }, 0);
  }, [sentences, answersByIndex]);

  const firstIncompleteIndex = useMemo(() => {
    for (const s of sentences) {
      const arr = answersByIndex[s.index] || [];
      const need = Math.max(1, s.num_correct || 1);
      if (arr.length < need) return s.index;
    }
    return null;
  }, [sentences, answersByIndex]);

  const sentenceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollToIndex = (idx: number | null) => {
    if (idx == null) return;
    const el = sentenceRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      const need = Math.max(1, s.num_correct || 1);
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
      setSentences(data.sentences || []);
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
  const handleSelect = (sIndex: number, opt: string) => {
    setAnswersByIndex((prev) => {
      const current = prev[sIndex] || [];
      const need = Math.max(1, (sentences.find((s) => s.index === sIndex)?.num_correct || 1));
      let next: string[];
      const isAdding = !current.includes(opt);
      if (!isAdding) {
        next = current.filter((o) => o !== opt);
      } else {
        if (need === 1) {
          next = [opt];
        } else {
          if (current.length < need) next = [...current, opt];
          else next = [...current.slice(0, need - 1), opt];
        }
      }
      // 选中时触发一次性弹跳动画；取消选中时触发一次性淡出缩放
      if (isAdding) {
        const key = `${sIndex}__${opt}`;
        setAnimating((prevAnim) => ({ ...prevAnim, [key]: false }));
        // 强制重置后再开启，确保重复点击也能触发
        requestAnimationFrame(() => {
          setAnimating((prevAnim) => ({ ...prevAnim, [key]: true }));
          setTimeout(() => {
            setAnimating((prevAnim) => ({ ...prevAnim, [key]: false }));
          }, 160);
        });
      } else {
        const key = `${sIndex}__${opt}`;
        setAnimatingOut((prevAnim) => ({ ...prevAnim, [key]: false }));
        requestAnimationFrame(() => {
          setAnimatingOut((prevAnim) => ({ ...prevAnim, [key]: true }));
          setTimeout(() => {
            setAnimatingOut((prevAnim) => ({ ...prevAnim, [key]: false }));
          }, 140);
        });
      }

      // 达到需选数量时触发即时判定；否则清除反馈
      const reachNeed = (next.length >= need && need > 0);
      if (reachNeed) {
        void checkImmediateFeedback(sIndex, next);
      } else {
        setFeedbackByIndex((prevFb) => ({ ...prevFb, [sIndex]: null }));
      }
      return { ...prev, [sIndex]: next };
    });
  };

  const checkImmediateFeedback = async (sIndex: number, picked: string[]) => {
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
        setFeedbackByIndex((prevFb) => ({ ...prevFb, [sIndex]: data.is_correct ? 'correct' : 'wrong' }));
      }
    } catch (e) {
      // 忽略错误，避免打断用户流程
    }
  };

  const handleClearOne = (sIndex: number, opt: string) => {
    setAnswersByIndex((prev) => {
      const current = prev[sIndex] || [];
      const next = current.filter((o) => o !== opt);
      return { ...prev, [sIndex]: next };
    });
  };

  const renderSentenceInline = (s: SentencePayload) => {
    const before = s.text.slice(0, s.blank.start);
    const after = s.text.slice(s.blank.start + s.blank.length);
    const selected = answersByIndex[s.index] || [];
    const fb = feedbackByIndex[s.index] || null;
    return (
      <div className="leading-7 text-base">
        <span>{before}</span>
        {selected.length > 0 ? (
          <span className="inline-flex flex-wrap gap-1.5 align-middle">
            {selected.map((opt) => (
              <span key={opt} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${fb === 'correct' ? 'bg-emerald-100 text-emerald-900' : fb === 'wrong' ? 'bg-rose-100 text-rose-900' : 'bg-muted'}`}>
                <span>{opt}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 bg-muted rounded">____</span>
        )}
        <span>{after}</span>
      </div>
    );
  };

  const renderOptions = (s: SentencePayload) => {
    const selected = answersByIndex[s.index] || [];
    const need = Math.max(1, s.num_correct || 1);
    const completed = selected.length >= need;
    if (completed) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {s.options.map((opt, i) => {
          const active = selected.includes(opt);
          const akey = `${s.index}__${opt}`;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(s.index, opt)}
              className={`text-left px-2 py-1.5 rounded border transition-transform will-change-transform focus:outline-none focus:ring-1 focus:ring-primary/40 active:scale-[0.98] ${active ? 'border-primary bg-primary/10' : 'hover:bg-muted'} ${animating[akey] ? 'animate-opt-pop' : ''} ${animatingOut[akey] ? 'animate-opt-out' : ''}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  };

  const submitAll = async () => {
    if (!articleId || sentences.length === 0) return;
    const allDone = sentences.every((s) => (answersByIndex[s.index] || []).length >= Math.max(1, s.num_correct || 1));
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

      await Promise.all(
        sentences.map((s) => {
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
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">基于 Shadowing 的 Cloze 挖空</h1>
            <div className="text-xs text-muted-foreground">
              {article ? `语言: ${article.lang.toUpperCase()} | 难度: L${article.level}` : ''}
            </div>
            {totalSentences > 0 && (
              <div className="mt-2">
                <div className="h-1.5 bg-muted rounded">
                  <div className="h-1.5 bg-primary rounded" style={{ width: `${Math.min(100, Math.round((completedCount / Math.max(1, totalSentences)) * 100))}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">进度：{completedCount}/{totalSentences}</div>
              </div>
            )}
            {totalSentences > 0 && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="inline-flex items-center rounded-full border bg-background p-1">
                  <button
                    type="button"
                    onClick={() => setShowOnlyIncomplete(false)}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${!showOnlyIncomplete ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOnlyIncomplete(true)}
                    className={`px-2 py-0.5 text-xs rounded-full transition-colors ${showOnlyIncomplete ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    仅未完成
                  </button>
                </div>
              </div>
            )}
            {totalSentences > 0 && (
              <div className="mt-2 overflow-x-auto">
                <div className="flex items-center justify-center gap-2 min-w-max px-1">
                  {sentences.map((s) => {
                    const arr = answersByIndex[s.index] || [];
                    const need = Math.max(1, s.num_correct || 1);
                    const done = arr.length >= need;
                    return (
                      <button
                        key={s.index}
                        type="button"
                        onClick={() => handleDotClick(s.index)}
                        className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-primary' : 'bg-muted-foreground/30'} hover:bg-primary/80`}
                        aria-label={`跳转到句子 ${s.index + 1}`}
                        title={`跳转到句子 ${s.index + 1}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 rounded border border-red-300 bg-red-50 text-red-700">{error}</div>
          )}

          {!showSolution && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displayedSentences.map((s) => (
                  <div
                    key={s.index}
                    ref={(el) => { sentenceRefs.current[s.index] = el; }}
                    className={`rounded-lg border bg-card text-card-foreground p-4 transition-shadow hover:shadow-md ${((answersByIndex[s.index] || []).length >= Math.max(1, s.num_correct || 1)) ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-muted'} ${shaking[s.index] ? 'animate-card-shake' : ''}`}
                  >
                    <div className="p-3 bg-muted rounded mb-2">{renderSentenceInline(s)}</div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] text-muted-foreground">
                        {feedbackByIndex[s.index] === 'correct' ? '正确' : feedbackByIndex[s.index] === 'wrong' ? '再试一次' : ((answersByIndex[s.index] || []).length >= Math.max(1, s.num_correct || 1)) ? '已完成' : `选择 ${Math.max(1, s.num_correct || 1)} 项`}
                      </div>
                      {(answersByIndex[s.index] || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAnswersByIndex((prev) => ({ ...prev, [s.index]: [] }));
                            setShaking((prev) => ({ ...prev, [s.index]: false }));
                            requestAnimationFrame(() => {
                              setShaking((prev) => ({ ...prev, [s.index]: true }));
                              setTimeout(() => {
                                setShaking((prev) => ({ ...prev, [s.index]: false }));
                              }, 220);
                            });
                          }}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline"
                        >
                          重选
                        </button>
                      )}
                    </div>
                    {renderOptions(s)}
                  </div>
                ))}
              </div>
              {sentences.length > 0 && (
                <div className="fixed left-0 right-0 bottom-4 pointer-events-none">
                  <div className="max-w-4xl mx-auto px-4">
                    <div className="pointer-events-auto rounded-full border bg-background/80 backdrop-blur shadow-lg px-3 py-2 flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">已完成 {completedCount}/{totalSentences}</div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => scrollToIndex(firstIncompleteIndex)}
                          disabled={firstIncompleteIndex == null}
                        >
                          跳到下一未完成
                        </Button>
                        <Button onClick={submitAll} disabled={loading || completedCount < totalSentences}>提交整篇</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
    <style jsx>{`
      @keyframes opt-pop {
        0% { transform: scale(0.94); }
        60% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      .animate-opt-pop { animation: opt-pop 150ms ease-out; }

      @keyframes opt-out {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(0.95); opacity: 0.75; }
        100% { transform: scale(1); opacity: 1; }
      }
      .animate-opt-out { animation: opt-out 140ms ease-in-out; }

      @keyframes card-shake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        50% { transform: translateX(2px); }
        75% { transform: translateX(-1px); }
        100% { transform: translateX(0); }
      }
      .animate-card-shake { animation: card-shake 220ms ease-in-out; }

      @keyframes answer-correct {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.0); }
        50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.15); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.0); }
      }
      .animate-answer-correct { animation: answer-correct 280ms ease-out; }
      @keyframes answer-wrong {
        0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.0); }
        50% { box-shadow: 0 0 0 6px rgba(244, 63, 94, 0.12); }
        100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.0); }
      }
      .animate-answer-wrong { animation: answer-wrong 280ms ease-out; }
    `}</style>
    </>
  );
}



