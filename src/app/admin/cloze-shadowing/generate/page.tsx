'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Lang = 'en' | 'ja' | 'zh';

interface Theme {
  id: string;
  lang: Lang;
  level: number;
  title: string;
  status?: string | null;
}

interface Subtopic {
  id: string;
  theme_id: string;
  lang: Lang;
  level: number;
  title: string;
  status?: string | null;
}

export default function ClozeShadowingGeneratePage() {
  const [lang, setLang] = useState<Lang>('ja');
  const [level, setLevel] = useState<number>(3);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [themeId, setThemeId] = useState<string>('');
  const [subtopicId, setSubtopicId] = useState<string>('');
  const [limit, setLimit] = useState<number>(20);
  // 固定为单一正确项与3个干扰项，不再提供范围配置
  const [provider, setProvider] = useState<'deepseek' | 'openrouter' | 'openai'>('deepseek');
  const [model, setModel] = useState<string>('deepseek-chat');
  const [running, setRunning] = useState(false);
  const [details, setDetails] = useState<Array<{ source_item_id: string; sentences: number; created: number }>>([]);
  const [articleRows, setArticleRows] = useState<Array<{ id: string; lang: Lang; level: number; title: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  // 并发、重试、节流与仅未生成，以及进度
  const [concurrency, setConcurrency] = useState<number>(20);
  const [retries, setRetries] = useState<number>(2);
  const [throttle, setThrottle] = useState<number>(100);
  const [onlyMissing, setOnlyMissing] = useState<boolean>(false);
  const [done, setDone] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [errors, setErrors] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  type GenTask = {
    id: string;
    label: string;
    body: any;
    status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
    done: number;
    total: number;
    errors: number;
    details?: Array<{ source_item_id: string; sentences: number; created: number }>;
  };
  const [taskQueue, setTaskQueue] = useState<GenTask[]>([]);
  const [queuePaused, setQueuePaused] = useState<boolean>(false);
  const [queueConcurrency, setQueueConcurrency] = useState<number>(2);
  const taskControllersRef = useRef<Record<string, AbortController>>({});
  const activeTaskIdsRef = useRef<Set<string>>(new Set());
  const [autoStart, setAutoStart] = useState<boolean>(false);
  const [drainOnce, setDrainOnce] = useState<boolean>(false);

  // 句子级明细（包含未挖空的占位句）
  type ClozeRow = {
    sentence_index: number;
    sentence_text: string;
    blank_start: number;
    blank_length: number;
    correct_options: string[];
    distractor_options: string[];
    is_published: boolean;
  };
  const [sentencesByArticle, setSentencesByArticle] = useState<Record<string, ClozeRow[]>>({});
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});

  const toggleArticleSentences = async (articleId: string) => {
    setExpandedArticles((m) => ({ ...m, [articleId]: !m[articleId] }));
    if (!sentencesByArticle[articleId]) {
      const { data } = await supabase
        .from('cloze_shadowing_items')
        .select('sentence_index,sentence_text,blank_start,blank_length,correct_options,distractor_options,is_published')
        .eq('source_item_id', articleId)
        .order('sentence_index', { ascending: true });
      setSentencesByArticle((m) => ({ ...m, [articleId]: (data as any) || [] }));
    }
  };

  // 加载可选的已发布 Shadowing 文章（带音频）
  useEffect(() => {
    const load = async () => {
      try {
        let q = supabase
          .from('shadowing_items')
          .select('id,lang,level,title,audio_url,status')
          .eq('status', 'approved')
          .not('audio_url', 'is', null)
          .limit(200);
        if (lang) q = q.eq('lang', lang);
        if (level) q = q.eq('level', level);
        if (themeId) q = q.eq('theme_id', themeId);
        if (subtopicId) q = q.eq('subtopic_id', subtopicId);
        const { data } = await q;
        const rows = (data || []).map((r: any) => ({ id: r.id as string, lang: r.lang as Lang, level: r.level as number, title: r.title as string }));
        setArticleRows(rows);
      } catch {
        setArticleRows([]);
      }
    };
    load();
  }, [lang, level, themeId, subtopicId]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('shadowing_themes')
          .select('id,lang,level,title,status')
          .eq('lang', lang)
          .eq('level', level)
          .eq('status', 'active');
        setThemes(data || []);
      } catch {
        setThemes([]);
      }
    };
    load();
  }, [lang, level]);

  useEffect(() => {
    const load = async () => {
      if (!themeId) {
        setSubtopics([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('shadowing_subtopics')
          .select('id,theme_id,lang,level,title,status')
          .eq('theme_id', themeId)
          .eq('status', 'active');
        setSubtopics(data || []);
      } catch {
        setSubtopics([]);
      }
    };
    load();
  }, [themeId]);

  // 筛选条件变化时，清空已勾选的文章
  useEffect(() => {
    setSelectedIds({});
  }, [lang, level, themeId, subtopicId]);

  const startGenerate = async () => {
    setRunning(true);
    setDetails([]);
    setDone(0);
    setTotal(0);
    setErrors(0);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('请先登录');
        setRunning(false);
        return;
      }

      const body: any = {
        lang,
        level,
        limit,
        provider,
        model,
        concurrency,
        retries,
        throttle,
        only_missing: onlyMissing,
      };
      const chosen = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k);
      if (chosen.length > 0) {
        body.item_ids = chosen;
      } else {
        if (themeId) body.theme_id = themeId;
        if (subtopicId) body.subtopic_id = subtopicId;
      }
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/admin/cloze-shadowing/generate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = 'unknown';
        try { const j = await res.json(); msg = j?.error || msg; } catch {}
        throw new Error(msg);
      }

      if (!res.body) throw new Error('无响应内容');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (!payload) continue;
          try {
            const ev = JSON.parse(payload);
            if (ev?.type === 'start') {
              setTotal(Number(ev.total) || 0);
            } else if (ev?.type === 'saved') {
              setDone(Number(ev.done) || 0);
              setTotal(Number(ev.total) || 0);
            } else if (ev?.type === 'error') {
              setErrors((e) => e + 1);
              setDone(Number(ev.done) || 0);
              setTotal(Number(ev.total) || 0);
            } else if (ev?.type === 'done') {
              setDone(Number(ev.done) || 0);
              setTotal(Number(ev.total) || 0);
              setDetails(Array.isArray(ev.details) ? ev.details : []);
            }
          } catch {}
        }
      }

      toast.success('生成完成');
    } catch (e: any) {
      toast.error('生成失败：' + (e?.message || String(e)));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const cancelGenerate = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setRunning(false);
      toast.info('已取消');
    }
  };

  // 将当前表单配置封装为任务并加入队列
  const enqueueTask = async () => {
    const chosen = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k);
    const taskBody: any = {
      lang,
      level,
      limit,
      provider,
      model,
      concurrency,
      retries,
      throttle,
      only_missing: onlyMissing,
    };
    let label = `${lang.toUpperCase()} L${level}`;
    if (chosen.length > 0) {
      taskBody.item_ids = chosen;
      label += ` | 指定${chosen.length}篇`;
    } else {
      if (themeId) { taskBody.theme_id = themeId; label += ` | 主题`; }
      if (subtopicId) { taskBody.subtopic_id = subtopicId; label += `-子主题`; }
      label += ` | 上限${limit}`;
    }
    const newTask: GenTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      body: taskBody,
      status: 'pending',
      done: 0,
      total: 0,
      errors: 0,
    };
    setTaskQueue((q) => [...q, newTask]);
  };

  // 队列处理器：并行执行多个任务（基于队列并发数），遵循暂停/自动开始/一次性开始控制
  useEffect(() => {
    let cancelled = false;

    const startOne = async (taskId: string) => {
      if (cancelled) return;
      if (activeTaskIdsRef.current.has(taskId)) return;
      activeTaskIdsRef.current.add(taskId);
      setTaskQueue((q) => q.map((t) => (t.id === taskId ? { ...t, status: 'running', done: 0, total: 0, errors: 0 } : t)));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('未登录');
        const controller = new AbortController();
        taskControllersRef.current[taskId] = controller;
        const body = (taskQueue.find((t) => t.id === taskId)?.body) || {};
        const res = await fetch('/api/admin/cloze-shadowing/generate/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          let msg = 'unknown';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          throw new Error(msg);
        }
        if (!res.body) throw new Error('无响应内容');
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const s = line.trim();
            if (!s.startsWith('data:')) continue;
            const payload = s.slice(5).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload);
              if (ev?.type === 'start') {
                setTaskQueue((q) => q.map((t) => (t.id === taskId ? { ...t, total: Number(ev.total) || 0 } : t)));
              } else if (ev?.type === 'saved') {
                setTaskQueue((q) => q.map((t) => (t.id === taskId ? { ...t, done: Number(ev.done) || 0, total: Number(ev.total) || 0 } : t)));
              } else if (ev?.type === 'error') {
                setTaskQueue((q) => q.map((t) => (t.id === taskId ? { ...t, errors: t.errors + 1, done: Number(ev.done) || t.done, total: Number(ev.total) || t.total } : t)));
              } else if (ev?.type === 'done') {
                setTaskQueue((q) => q.map((t) => (t.id === taskId ? { ...t, status: 'done', done: Number(ev.done) || t.done, total: Number(ev.total) || t.total, details: Array.isArray(ev.details) ? ev.details : t.details } : t)));
              }
            } catch {}
          }
        }
      } catch (e: any) {
        setTaskQueue((q) => q.map((t) => (t.id === taskId ? { ...t, status: 'error' } : t)));
      } finally {
        delete taskControllersRef.current[taskId];
        activeTaskIdsRef.current.delete(taskId);
        if (!cancelled) setTaskQueue((q) => [...q]);
      }
    };

    const maybeStartMore = () => {
      if (queuePaused || cancelled) return;
      if (!autoStart && !drainOnce) return;
      const runningCount = taskQueue.filter((t) => t.status === 'running').length;
      const capacity = Math.max(0, (parseInt(String(queueConcurrency)) || 1) - runningCount);
      if (capacity <= 0) return;
      const pendings = taskQueue.filter((t) => t.status === 'pending' && !activeTaskIdsRef.current.has(t.id)).slice(0, capacity);
      for (const t of pendings) startOne(t.id);
      const nextRunning = runningCount + pendings.length;
      const nextPending = taskQueue.filter((t) => t.status === 'pending').length - pendings.length;
      if (nextPending <= 0 && nextRunning === 0 && drainOnce) {
        setDrainOnce(false);
      }
    };

    maybeStartMore();
    return () => { cancelled = true; };
  }, [taskQueue, queuePaused, queueConcurrency, autoStart, drainOnce]);

  const pauseQueue = () => setQueuePaused(true);
  const resumeQueue = () => setQueuePaused(false);
  const clearQueue = () => setTaskQueue((q) => q.filter((t) => t.status === 'running'));

  const startAllPendingTasks = () => {
    setDrainOnce(true);
    // 触发 effect
    setTaskQueue((q) => [...q]);
  };

  const handleStartClick = () => {
    const pendingCount = taskQueue.filter((t) => t.status === 'pending').length;
    if (pendingCount > 0) {
      startAllPendingTasks();
    } else {
      startGenerate();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              Lang Trainer
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-700 hover:text-gray-900">
                控制台
              </Link>
              <span className="text-blue-600 font-medium">Cloze-Shadowing 生成</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
              返回控制台
            </Link>
            <Link href="/" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
              返回首页
            </Link>
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">基于 Shadowing 的 Cloze 句题生成</h1>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">语言</label>
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="w-full p-2 border rounded">
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="zh">简体中文</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">难度等级</label>
              <select value={level} onChange={(e) => setLevel(parseInt(e.target.value))} className="w-full p-2 border rounded">
                <option value={1}>L1</option>
                <option value={2}>L2</option>
                <option value={3}>L3</option>
                <option value={4}>L4</option>
                <option value={5}>L5</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">大主题</label>
              <select value={themeId} onChange={(e) => { setThemeId(e.target.value); setSubtopicId(''); }} className="w-full p-2 border rounded">
                <option value="">（全部/不限定）</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">小主题</label>
              <select value={subtopicId} onChange={(e) => setSubtopicId(e.target.value)} className="w-full p-2 border rounded" disabled={!themeId}>
                <option value="">（全部/不限定）</option>
                {subtopics.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">生成数量上限</label>
              <input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(parseInt(e.target.value))} className="w-full p-2 border rounded" />
            </div>
            <label className="flex items-end space-x-2 text-sm">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
              <span>仅处理未生成文章</span>
            </label>
            <div className="md:col-span-4 flex items-end text-sm text-gray-500">
              固定：每题 1 个正确项 + 3 个干扰项
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">AI 提供商</label>
              <select value={provider} onChange={(e) => {
                const p = e.target.value as 'deepseek' | 'openrouter' | 'openai';
                setProvider(p);
                const defaults: Record<string, string> = {
                  deepseek: 'deepseek-chat',
                  openrouter: 'anthropic/claude-3.5-sonnet',
                  openai: 'gpt-4o',
                };
                setModel(defaults[p] || 'deepseek-chat');
              }} className="w-full p-2 border rounded">
                <option value="deepseek">DeepSeek</option>
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">模型</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">并发（服务端）</label>
              <input type="number" min={1} value={concurrency} onChange={(e) => setConcurrency(parseInt(e.target.value) || 1)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">重试次数</label>
              <input type="number" min={0} max={10} value={retries} onChange={(e) => setRetries(parseInt(e.target.value) || 0)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">任务间隔(ms)</label>
              <input type="number" min={0} max={10000} value={throttle} onChange={(e) => setThrottle(parseInt(e.target.value) || 0)} className="w-full p-2 border rounded" />
            </div>
          </div>

          {/* 文章勾选 */}
          <div>
            <div className="text-sm font-medium mb-2">可选文章（勾选后将按选中生成；未勾选时使用上方筛选）</div>
            <div className="max-h-64 overflow-auto border rounded">
              {articleRows.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">暂无符合条件的文章</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 w-10">
                        <input
                          type="checkbox"
                          checked={articleRows.length > 0 && articleRows.every((r) => selectedIds[r.id])}
                          onChange={(e) => {
                            const all = e.target.checked;
                            const next: Record<string, boolean> = {};
                            if (all) articleRows.forEach((r) => (next[r.id] = true));
                            setSelectedIds(next);
                          }}
                        />
                      </th>
                      <th className="p-2 text-left">标题</th>
                      <th className="p-2 text-left">语言</th>
                      <th className="p-2 text-left">难度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articleRows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!!selectedIds[r.id]}
                            onChange={(e) => setSelectedIds((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                          />
                        </td>
                        <td className="p-2">{r.title}</td>
                        <td className="p-2">{r.lang.toUpperCase()}</td>
                        <td className="p-2">L{r.level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleStartClick} disabled={running && taskQueue.filter((t) => t.status === 'pending').length === 0}>
              {taskQueue.filter((t) => t.status === 'pending').length > 0 ? '开始队列' : (running ? '生成中...' : '开始生成')}
            </Button>
            {running && (
              <Button onClick={cancelGenerate} variant="outline">
                取消
              </Button>
            )}
            <div className="text-sm text-gray-600">
              进度：{done}/{total}（错误 {errors}）
            </div>
            <Button onClick={enqueueTask} variant="outline" disabled={running}>加入队列</Button>
            <div className="flex items-center gap-2 text-sm">
              <span>队列并发</span>
              <input type="number" min={1} max={10} value={queueConcurrency} onChange={(e) => setQueueConcurrency(parseInt(e.target.value) || 1)} className="w-20 p-1 border rounded" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input type="checkbox" id="autoStart" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
              <label htmlFor="autoStart">自动开始</label>
            </div>
            {!autoStart && taskQueue.filter((t) => t.status === 'pending').length > 0 && (
              <Button onClick={startAllPendingTasks} variant="outline">一键开始 ({taskQueue.filter((t) => t.status === 'pending').length})</Button>
            )}
            {queuePaused ? (
              <Button onClick={resumeQueue} variant="outline">恢复队列</Button>
            ) : (
              <Button onClick={pauseQueue} variant="outline">暂停队列</Button>
            )}
            <Button onClick={clearQueue} variant="outline">清空待队列</Button>
          </div>
        </div>

        {details.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-lg font-semibold mb-3">生成详情</div>
            <div className="space-y-2">
              {details.map((d) => (
                <div key={d.source_item_id} className="p-2 border rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Article: {d.source_item_id}</div>
                      <div>句子数：{d.sentences}，新增：{d.created}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" onClick={() => toggleArticleSentences(d.source_item_id)}>
                        {expandedArticles[d.source_item_id] ? '收起句子' : '展开句子'}
                      </Button>
                      <Link href={`/admin/cloze-shadowing/review/${d.source_item_id}`} className="text-blue-600 hover:underline">
                        在评审页查看
                      </Link>
                    </div>
                  </div>

                  {expandedArticles[d.source_item_id] && (
                    <div className="mt-2 border-t pt-2 space-y-2">
                      {(sentencesByArticle[d.source_item_id] || []).map((row) => {
                        const isBlanked = (row.blank_length || 0) > 0 && (row.correct_options || []).length > 0;
                        return (
                          <div key={row.sentence_index} className="text-sm p-2 rounded border">
                            <div className="text-gray-600">第 {row.sentence_index + 1} 句</div>
                            <div className="mt-1">{row.sentence_text}</div>
                            {isBlanked ? (
                              <div className="mt-1">
                                <div>正确项：{(row.correct_options || []).join(' / ')}</div>
                                <div>干扰项：{(row.distractor_options || []).join(' / ')}</div>
                                <div className="text-xs text-gray-500">{row.is_published ? '已发布' : '未发布'}</div>
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-orange-600">未挖空（占位）</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {taskQueue.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-lg font-semibold mb-3">任务队列</div>
            <div className="space-y-2">
              {taskQueue.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-gray-600">状态：{t.status} | 进度：{t.done}/{t.total} | 错误：{t.errors}</div>
                  </div>
                  {t.details && t.details.length > 0 && (
                    <div className="text-xs text-gray-500">完成后新增 {t.details.reduce((s, d) => s + (d.created || 0), 0)} 题</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


