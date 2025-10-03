'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import useUserPermissions from '@/hooks/useUserPermissions';

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
  const permissions = useUserPermissions();

  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [article, setArticle] = useState<{ id: string; lang: string; level: number; title: string } | null>(null);
  const [sentence, setSentence] = useState<SentencePayload | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [accHistory, setAccHistory] = useState<boolean[]>([]);
  const [showSolution, setShowSolution] = useState(false);
  const [solution, setSolution] = useState<null | { text: string; audio_url: string | null; translations: Record<string, string> | null; sentences: Array<{ index: number; text: string; blank_start: number; blank_length: number; correct_options: string[] }> }>(null);

  const accuracy = useMemo(() => {
    if (accHistory.length === 0) return 0;
    const correctCount = accHistory.filter(Boolean).length;
    return Math.round((correctCount / accHistory.length) * 100);
  }, [accHistory]);

  const loadCursor = async (idx: number) => {
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
      const res = await fetch(`/api/cloze-shadowing/next?article_id=${articleId}&cursor=${idx}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || '加载失败');
      if (data.done) {
        setDone(true);
        setSentence(null);
      } else {
        setArticle(data.article);
        setSentence(data.sentence);
        setSelected({});
      }
    } catch (e: any) {
      setError(e?.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (articleId) loadCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const submitCurrent = async () => {
    if (!sentence) return;
    const picked = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/cloze-shadowing/attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        article_id: articleId,
        sentence_index: sentence.index,
        selected_options: picked,
      }),
    });
    const data = await res.json();
    if (!data?.success) {
      setError(data?.error || '提交失败');
      return;
    }

    setAccHistory((prev) => [...prev, !!data.is_correct]);
    const next = (sentence.index || 0) + 1;
    setCursor(next);
    await loadCursor(next);
  };

  const finishAndShowSolution = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    // 汇总写入
    await fetch('/api/cloze-shadowing/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ article_id: articleId }),
    });

    // 获取参考答案
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
  };

  const renderSentence = () => {
    if (!sentence) return null;
    const before = sentence.text.slice(0, sentence.blank.start);
    const blankText = sentence.text.slice(
      sentence.blank.start,
      sentence.blank.start + sentence.blank.length,
    );
    const after = sentence.text.slice(sentence.blank.start + sentence.blank.length);
    return (
      <div className="leading-8 text-lg">
        <span>{before}</span>
        <span className="px-2 py-1 bg-muted rounded">____</span>
        <span>{after}</span>
      </div>
    );
  };

  return (
    <main className="p-6">
      <Container>
        <Breadcrumbs items={[{ href: '/', label: '首页' }, { label: 'Shadowing Cloze 挖空' }]} />
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">基于 Shadowing 的 Cloze 挖空</h1>
            <div className="text-sm text-muted-foreground">
              {article ? `语言: ${article.lang.toUpperCase()} | 难度: L${article.level}` : ''}
            </div>
            <div className="mt-2 text-sm">累计正确率：{accuracy}%（{accHistory.filter(Boolean).length}/{accHistory.length}）</div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded border border-red-300 bg-red-50 text-red-700">{error}</div>
          )}

          {!done && sentence && (
            <div className="rounded-lg border bg-card text-card-foreground p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2">第 {sentence.index + 1} 句</h2>
                <div className="p-4 bg-muted rounded mb-4">{renderSentence()}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sentence.options.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 p-2 rounded border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selected[opt]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [opt]: e.target.checked }))}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={submitCurrent} disabled={loading}>提交本句</Button>
              </div>
            </div>
          )}

          {done && !showSolution && (
            <div className="rounded-lg border bg-card text-card-foreground p-6 text-center">
              <div className="text-xl font-semibold mb-2">本篇已完成</div>
              <div className="text-muted-foreground mb-4">点击下方按钮查看参考答案与原文音频</div>
              <Button onClick={finishAndShowSolution}>查看参考答案</Button>
            </div>
          )}

          {showSolution && solution && (
            <div className="rounded-lg border bg-card text-card-foreground p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">参考答案与原文</h2>
                {solution.audio_url ? (
                  <audio controls src={solution.audio_url} />
                ) : null}
              </div>
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
                <div className="font-medium mb-2">逐句标准答案</div>
                <div className="space-y-2">
                  {solution.sentences.map((s) => (
                    <div key={s.index} className="p-3 bg-gray-50 rounded">
                      <div className="mb-1 text-sm text-muted-foreground">第 {s.index + 1} 句</div>
                      <div className="mb-2 whitespace-pre-wrap">{s.text}</div>
                      <div className="text-sm">正确答案：{s.correct_options.join(' / ')}</div>
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



