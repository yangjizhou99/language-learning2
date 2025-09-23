'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit,
  Archive,
  Trash2,
  Download,
  Upload,
  Eye,
  Sparkles,
  Brain,
  Pause,
  Play,
  X,
} from 'lucide-react';

type Lang = 'all' | 'en' | 'ja' | 'zh';
type Genre = 'all' | 'dialogue' | 'monologue' | 'news' | 'lecture';

const LANG_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'ja', label: '日语' },
  { value: 'en', label: '英语' },
  { value: 'zh', label: '中文' },
];

const LEVEL_OPTIONS = ['all', 1, 2, 3, 4, 5, 6] as const;

const GENRE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'dialogue', label: '对话' },
  { value: 'monologue', label: '独白' },
  { value: 'news', label: '新闻' },
  { value: 'lecture', label: '讲座' },
];

// 等级与体裁的对应关系（基于6级难度设计）
const LEVEL_GENRE_RESTRICTIONS: Record<number, Genre[]> = {
  1: ['dialogue'], // L1: 对话优先
  2: ['dialogue', 'monologue'], // L2: 对话/独白
  3: ['monologue', 'news'], // L3: 独白/新闻-lite
  4: ['news', 'dialogue'], // L4: 新闻/对话（正式）
  5: ['lecture', 'news'], // L5: 讲座/新闻（信息密度↑）
  6: ['lecture', 'news'], // L6: 讲座/社论
};

// 根据等级获取可用的体裁选项
const getAvailableGenres = (level: number | 'all'): Genre[] => {
  if (level === 'all') return ['all', 'dialogue', 'monologue', 'news', 'lecture'];
  return (LEVEL_GENRE_RESTRICTIONS[level] || []) as Genre[];
};

// 等级详细配置（基于6级难度设计）
const LEVEL_CONFIG: Record<
  number,
  {
    genrePriority: string;
    themeBandwidth: string;
    lengthTarget: {
      en: { min: number; max: number };
      ja: { min: number; max: number };
      zh: { min: number; max: number };
    };
    sentenceRange: { min: number; max: number };
    maxSentenceLength: {
      en: number;
      ja: number;
      zh: number;
    };
  }
> = {
  1: {
    genrePriority: 'dialogue（对话）',
    themeBandwidth: '高熟悉：问路、点餐、打招呼、校园办事',
    lengthTarget: {
      en: { min: 60, max: 90 },
      ja: { min: 180, max: 260 },
      zh: { min: 160, max: 240 },
    },
    sentenceRange: { min: 6, max: 8 },
    maxSentenceLength: { en: 12, ja: 35, zh: 35 },
  },
  2: {
    genrePriority: 'dialogue/monologue',
    themeBandwidth: '日常任务：购物、预约、住户问题、课程安排',
    lengthTarget: {
      en: { min: 90, max: 120 },
      ja: { min: 260, max: 360 },
      zh: { min: 240, max: 320 },
    },
    sentenceRange: { min: 7, max: 9 },
    maxSentenceLength: { en: 16, ja: 45, zh: 45 },
  },
  3: {
    genrePriority: 'monologue/news-lite',
    themeBandwidth: '泛新闻/校园新闻、社交媒体短评',
    lengthTarget: {
      en: { min: 120, max: 160 },
      ja: { min: 360, max: 480 },
      zh: { min: 320, max: 420 },
    },
    sentenceRange: { min: 8, max: 10 },
    maxSentenceLength: { en: 20, ja: 55, zh: 55 },
  },
  4: {
    genrePriority: 'news/dialogue（formal）',
    themeBandwidth: '主题扩展：科技、教育、健康政策入门',
    lengthTarget: {
      en: { min: 160, max: 200 },
      ja: { min: 480, max: 620 },
      zh: { min: 420, max: 560 },
    },
    sentenceRange: { min: 9, max: 11 },
    maxSentenceLength: { en: 24, ja: 65, zh: 65 },
  },
  5: {
    genrePriority: 'lecture/news（信息密度↑）',
    themeBandwidth: '专题：经济/科技/文化比较、数据引用',
    lengthTarget: {
      en: { min: 200, max: 260 },
      ja: { min: 620, max: 780 },
      zh: { min: 560, max: 720 },
    },
    sentenceRange: { min: 10, max: 12 },
    maxSentenceLength: { en: 28, ja: 75, zh: 75 },
  },
  6: {
    genrePriority: 'lecture/editorial',
    themeBandwidth: '深度议题：国际关系、AI伦理、产业趋势',
    lengthTarget: {
      en: { min: 260, max: 320 },
      ja: { min: 780, max: 980 },
      zh: { min: 720, max: 900 },
    },
    sentenceRange: { min: 11, max: 13 },
    maxSentenceLength: { en: 32, ja: 90, zh: 90 },
  },
};

export default function ThemesPage() {
  const [lang, setLang] = useState<Lang>('all');
  const [level, setLevel] = useState<'all' | 1 | 2 | 3 | 4 | 5 | 6>('all');
  const [genre, setGenre] = useState<Genre>('all');
  const [q, setQ] = useState('');

  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  // AI 生成相关状态
  const [aiGenerationType, setAiGenerationType] = useState<'themes' | 'subtopics' | null>(null);
  const [aiGenerationCount, setAiGenerationCount] = useState(5);
  const [aiProvider, setAiProvider] = useState<'openrouter' | 'deepseek' | 'openai'>('openrouter');
  const [aiModels, setAiModels] = useState<{ id: string; name: string }[]>([]);
  const [aiModel, setAiModel] = useState('');
  const [aiTemperature, setAiTemperature] = useState(0.7);
  const [selectedThemeForSubtopic, setSelectedThemeForSubtopic] = useState<any>(null);

  // 任务队列相关状态
  const [taskQueue, setTaskQueue] = useState<
    Array<{
      id: string;
      type: 'themes' | 'subtopics';
      status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
      progress: number;
      title: string;
      params: any;
      result?: any;
      error?: string;
      createdAt: Date;
      startedAt?: Date;
      pausedAt?: Date;
      completedAt?: Date;
      abortController?: AbortController;
    }>
  >([]);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [runningTasks, setRunningTasks] = useState(0);
  const [queuePaused, setQueuePaused] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [drainOnce, setDrainOnce] = useState(false);

  // 获取认证头信息
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (lang !== 'all') qs.set('lang', lang);
      if (level !== 'all') qs.set('level', String(level));
      if (genre !== 'all') qs.set('genre', genre);
      const r = await fetch(`/api/admin/shadowing/themes?${qs.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const j = await r.json();
      if (r.ok) {
        const data = (j.items || []).filter((t: any) => !q || (t.title || '').includes(q));
        setItems(data);
        setSelected({});
      }
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [lang, level, genre, q]);

  // 加载 AI 模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (aiProvider === 'openrouter') {
          const r = await fetch(`/api/admin/providers/models?provider=${aiProvider}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const j = await r.json();
          if (r.ok && Array.isArray(j.models)) {
            const sortedModels = [...j.models].sort((a: any, b: any) =>
              String(a.name || a.id).localeCompare(String(b.name || b.id)),
            );
            setAiModels(sortedModels);
            setAiModel(sortedModels[0]?.id || '');
          } else {
            setAiModels([]);
            setAiModel('');
          }
        } else if (aiProvider === 'deepseek') {
          const staticModels = [
            { id: 'deepseek-chat', name: 'deepseek-chat' },
            { id: 'deepseek-reasoner', name: 'deepseek-reasoner' },
          ];
          setAiModels(staticModels);
          setAiModel(staticModels[0].id);
        } else if (aiProvider === 'openai') {
          const staticModels = [
            { id: 'gpt-4o', name: 'gpt-4o' },
            { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
          ];
          setAiModels(staticModels);
          setAiModel(staticModels[0].id);
        }
      } catch (error) {
        console.error('Load models failed:', error);
        setAiModels([]);
        setAiModel('');
      }
    };

    loadModels();
  }, [aiProvider]);

  // 检查体裁与等级的匹配
  useEffect(() => {
    const availableGenres = getAvailableGenres(level);
    if (!availableGenres.includes(genre)) {
      // 当等级为全部时，允许体裁选择全部
      setGenre(availableGenres[0]);
    }
  }, [level]);

  function toggleAll(v: boolean) {
    const m: Record<string, boolean> = {};
    items.forEach((it) => (m[it.id] = v));
    setSelected(m);
  }

  function toggleOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function openNew() {
    const defaultLevel: 1 | 2 | 3 | 4 | 5 | 6 = (level === 'all' ? 1 : level);
    const defaultLang: Exclude<Lang, 'all'> = (lang === 'all' ? 'ja' : lang);
    const defaultGenre: Exclude<Genre, 'all'> = (genre === 'all'
      ? (getAvailableGenres(defaultLevel).find((g) => g !== 'all') as Exclude<Genre, 'all'>)
      : genre);

    setEditing({
      id: undefined,
      lang: defaultLang,
      level: defaultLevel,
      genre: defaultGenre,
      title: '',
      desc: '',
      status: 'active',
    });
    setModalOpen(true);
  }

  function openEdit(it: any) {
    setEditing({ ...it });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function saveOne() {
    if (!editing?.title?.trim()) {
      alert('请填写主题标题');
      return;
    }

    try {
      const r = await fetch('/api/admin/shadowing/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ action: 'upsert', item: editing }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert('保存失败：' + j.error);
        return;
      }
      closeModal();
      load();
    } catch (error) {
      alert('保存失败：' + error);
    }
  }

  async function archiveSelected() {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (!ids.length) {
      alert('未选择');
      return;
    }
    if (!confirm(`确认归档 ${ids.length} 个大主题？`)) return;

    try {
      const r = await fetch('/api/admin/shadowing/themes/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ action: 'archive', items: ids.map((id) => ({ id })) }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert('操作失败：' + j.error);
        return;
      }
      load();
    } catch (error) {
      alert('操作失败：' + error);
    }
  }

  async function deleteSelected() {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (!ids.length) {
      alert('未选择');
      return;
    }
    if (!confirm(`⚠️永久删除 ${ids.length} 个大主题？其下小主题也会被删除。`)) return;

    try {
      const r = await fetch('/api/admin/shadowing/themes/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ action: 'delete', items: ids.map((id) => ({ id })) }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert('删除失败：' + j.error);
        return;
      }
      load();
    } catch (error) {
      alert('删除失败：' + error);
    }
  }

  // 删除单个主题
  async function deleteTheme(theme: any) {
    if (!confirm(`⚠️永久删除主题"${theme.title}"？其下所有小主题也会被删除。`)) {
      return;
    }

    try {
      const r = await fetch('/api/admin/shadowing/themes/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ theme_id: theme.id }),
      });

      const j = await r.json();
      if (!r.ok) {
        alert('删除失败：' + j.error);
        return;
      }

      // 重新加载数据
      await load();
      alert(`成功删除主题"${theme.title}"及其下 ${j.deleted_subtopics || 0} 个小主题`);
    } catch (error) {
      alert('删除失败：' + error);
    }
  }

  function exportData() {
    const data = items.filter((item) => selected[item.id] || Object.keys(selected).length === 0);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `themes_${lang}_L${level}_${genre}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    if (fileInput) {
      fileInput.click();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) {
          alert('文件格式错误');
          return;
        }

        const r = await fetch('/api/admin/shadowing/themes/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({ action: 'upsert', items: data }),
        });
        const j = await r.json();
        if (!r.ok) {
          alert('导入失败：' + j.error);
          return;
        }
        load();
        alert(`成功导入 ${j.count} 个主题`);
      } catch (error) {
        alert('导入失败：' + error);
      }
    };
    reader.readAsText(file);
  }

  // 添加任务到队列
  function addTaskToQueue(type: 'themes' | 'subtopics', params: any) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      type,
      status: 'pending' as const,
      progress: 0,
      title:
        type === 'themes'
          ? `生成 ${params.count} 个大主题 (${LANG_OPTIONS.find((l) => l.value === params.lang)?.label} L${params.level} ${GENRE_OPTIONS.find((g) => g.value === params.genre)?.label})`
          : `为主题"${params.theme_title_cn}"生成 ${params.count} 个小主题`,
      params,
      createdAt: new Date(),
    };

    setTaskQueue((prev) => [...prev, task]);
    return taskId;
  }

  // 执行任务
  async function executeTask(taskId: string) {
    const task = taskQueue.find((t) => t.id === taskId);
    if (!task) return;

    // 创建 AbortController
    const abortController = new AbortController();

    // 更新任务状态为运行中
    setTaskQueue((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'running',
              startedAt: new Date(),
              progress: 10,
              abortController,
            }
          : t,
      ),
    );
    setRunningTasks((prev) => prev + 1);

    try {
      // 对于小主题生成，使用流式API
      const endpoint =
        task.type === 'themes'
          ? '/api/admin/shadowing/themes/generate'
          : '/api/admin/shadowing/subtopics/generate';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(task.params),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // 如果是流式响应
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let result: any = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // 更新进度
                if (data.type === 'start') {
                  setTaskQueue((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, progress: 20 } : t)),
                  );
                } else if (data.type === 'ai_start') {
                  setTaskQueue((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, progress: 40 } : t)),
                  );
                } else if (data.type === 'ai_complete') {
                  setTaskQueue((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, progress: 70 } : t)),
                  );
                } else if (data.type === 'parse_complete') {
                  setTaskQueue((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, progress: 90 } : t)),
                  );
                } else if (data.type === 'complete') {
                  result = data.data;
                  setTaskQueue((prev) =>
                    prev.map((t) => (t.id === taskId ? { ...t, progress: 100 } : t)),
                  );
                } else if (data.type === 'error') {
                  throw new Error(data.message || 'Generation failed');
                }
              } catch (parseError) {
                console.error('Parse SSE data failed:', parseError);
              }
            }
          }
        }

        if (!result) {
          throw new Error('No result received from stream');
        }

        // 更新任务状态为完成
        setTaskQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'completed',
                  progress: 100,
                  result,
                  completedAt: new Date(),
                  abortController: undefined,
                }
              : t,
          ),
        );
      } else {
        // 非流式响应处理
        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (jsonError) {
          throw new Error(`API返回非JSON格式响应: ${responseText}`);
        }

        if (!response.ok) {
          throw new Error(result.error || '生成失败');
        }

        // 更新任务状态为完成
        setTaskQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'completed',
                  progress: 100,
                  result,
                  completedAt: new Date(),
                  abortController: undefined,
                }
              : t,
          ),
        );
      }

      // 重新加载数据
      await load();
    } catch (error) {
      // 检查是否是被取消的任务
      if (error instanceof Error && error.name === 'AbortError') {
        setTaskQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'cancelled',
                  completedAt: new Date(),
                  abortController: undefined,
                }
              : t,
          ),
        );
      } else {
        // 更新任务状态为失败
        setTaskQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'failed',
                  error: error instanceof Error ? error.message : String(error),
                  completedAt: new Date(),
                  abortController: undefined,
                }
              : t,
          ),
        );
      }
    } finally {
      setRunningTasks((prev) => prev - 1);
    }
  }

  // 处理任务队列
  useEffect(() => {
    const processQueue = async () => {
      if (queuePaused || (!autoStart && !drainOnce)) return;

      const pendingTasks = taskQueue.filter((t) => t.status === 'pending');
      const canStart = Math.min(pendingTasks.length, maxConcurrent - runningTasks);

      for (let i = 0; i < canStart; i++) {
        const task = pendingTasks[i];
        executeTask(task.id);
      }

      if (pendingTasks.length === 0 && runningTasks === 0 && drainOnce) {
        setDrainOnce(false);
      }
    };

    processQueue();
  }, [taskQueue, maxConcurrent, runningTasks, queuePaused, autoStart, drainOnce]);

  // 当运行中的任务数量变化时，自动处理队列
  useEffect(() => {
    if ((autoStart || drainOnce) && !queuePaused) {
      const pendingTasks = taskQueue.filter((t) => t.status === 'pending');
      const canStart = Math.min(pendingTasks.length, maxConcurrent - runningTasks);

      if (canStart > 0) {
        const timer = setTimeout(() => {
          pendingTasks.slice(0, canStart).forEach((task) => {
            executeTask(task.id);
          });
        }, 100);

        return () => clearTimeout(timer);
      }

      if (pendingTasks.length === 0 && runningTasks === 0 && drainOnce) {
        setDrainOnce(false);
      }
    }
  }, [runningTasks, autoStart, drainOnce, queuePaused, maxConcurrent, taskQueue]);

  // 任务控制函数
  function pauseTask(taskId: string) {
    const task = taskQueue.find((t) => t.id === taskId);
    if (!task || task.status !== 'running') return;

    // 取消正在进行的请求
    if (task.abortController) {
      task.abortController.abort();
    }

    // 更新任务状态为暂停
    setTaskQueue((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'paused', pausedAt: new Date(), abortController: undefined }
          : t,
      ),
    );
    setRunningTasks((prev) => prev - 1);
  }

  function resumeTask(taskId: string) {
    const task = taskQueue.find((t) => t.id === taskId);
    if (!task || task.status !== 'paused') return;

    // 更新任务状态为等待中，让队列处理
    setTaskQueue((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'pending', pausedAt: undefined } : t)),
    );
  }

  function cancelTask(taskId: string) {
    const task = taskQueue.find((t) => t.id === taskId);
    if (!task) return;

    // 如果任务正在运行，取消请求
    if (task.status === 'running' && task.abortController) {
      task.abortController.abort();
    }

    // 更新任务状态为已取消
    setTaskQueue((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'cancelled',
              completedAt: new Date(),
              abortController: undefined,
            }
          : t,
      ),
    );

    if (task.status === 'running') {
      setRunningTasks((prev) => prev - 1);
    }
  }

  function pauseAllTasks() {
    setQueuePaused(true);
    // 暂停所有运行中的任务
    taskQueue.forEach((task) => {
      if (task.status === 'running') {
        pauseTask(task.id);
      }
    });
  }

  function resumeAllTasks() {
    setQueuePaused(false);
    // 恢复所有暂停的任务
    taskQueue.forEach((task) => {
      if (task.status === 'paused') {
        resumeTask(task.id);
      }
    });
  }

  function cancelAllTasks() {
    // 取消所有未完成的任务
    taskQueue.forEach((task) => {
      if (['pending', 'running', 'paused'].includes(task.status)) {
        cancelTask(task.id);
      }
    });
  }

  function startAllPendingTasks() {
    setDrainOnce(true);
    const pendingTasks = taskQueue.filter((t) => t.status === 'pending');
    const canStart = Math.min(pendingTasks.length, maxConcurrent - runningTasks);

    for (let i = 0; i < canStart; i++) {
      const task = pendingTasks[i];
      executeTask(task.id);
    }
  }

  function startTask(taskId: string) {
    const task = taskQueue.find((t) => t.id === taskId);
    if (!task || task.status !== 'pending') return;

    executeTask(taskId);
  }

  // 批量添加选中的主题到队列
  function batchAddToQueue() {
    if (!aiModel) {
      alert('请选择 AI 模型');
      return;
    }

    const selectedThemes = items.filter((theme) => selected[theme.id]);
    if (selectedThemes.length === 0) {
      alert('请先选择要生成小主题的大主题');
      return;
    }

    let added = 0;
    let skipped = 0;
    // 为每个选中的主题添加生成小主题的任务
    selectedThemes.forEach((theme) => {
      const effectiveLang = (lang !== 'all' ? lang : (theme.lang as Exclude<Lang, 'all'>));
      const effectiveLevel = (level !== 'all' ? level : (theme.level as 1 | 2 | 3 | 4 | 5 | 6));
      const effectiveGenre = (genre !== 'all' ? genre : (theme.genre as Exclude<Genre, 'all'>));

      if (!effectiveLang || !effectiveLevel || !effectiveGenre) {
        skipped += 1;
        return;
      }

      addTaskToQueue('subtopics', {
        theme_id: theme.id,
        theme_title_cn: theme.title,
        lang: effectiveLang,
        level: effectiveLevel,
        genre: effectiveGenre,
        count: aiGenerationCount,
        provider: aiProvider,
        model: aiModel,
        temperature: aiTemperature,
      });
      added += 1;
    });

    if (added > 0) {
      alert(`已为 ${added} 个主题添加生成小主题任务到队列${skipped > 0 ? `，另有 ${skipped} 个因缺少信息被跳过` : ''}`);
    } else {
      alert('所选主题缺少语言/等级/体裁信息，无法添加到队列');
    }
  }

  // AI 生成大主题（添加到队列）
  function generateThemes() {
    if (!aiModel) {
      alert('请选择 AI 模型');
      return;
    }

    if (lang === 'all' || level === 'all' || genre === 'all') {
      alert('请先在筛选中选择具体的语言、等级和体裁（不能为“全部”）');
      return;
    }

    addTaskToQueue('themes', {
      lang,
      level,
      genre,
      count: aiGenerationCount,
      provider: aiProvider,
      model: aiModel,
      temperature: aiTemperature,
    });

    setAiGenerationType(null);
  }

  // AI 生成小主题（添加到队列）
  function generateSubtopics(theme: any) {
    if (!aiModel) {
      alert('请选择 AI 模型');
      return;
    }

    const effectiveLang = (lang !== 'all' ? lang : (theme.lang as Exclude<Lang, 'all'>));
    const effectiveLevel = (level !== 'all' ? level : (theme.level as 1 | 2 | 3 | 4 | 5 | 6));
    const effectiveGenre = (genre !== 'all' ? genre : (theme.genre as Exclude<Genre, 'all'>));

    if (!effectiveLang || !effectiveLevel || !effectiveGenre) {
      alert('该主题缺少语言/等级/体裁信息，无法添加到队列');
      return;
    }

    addTaskToQueue('subtopics', {
      theme_id: theme.id,
      theme_title_cn: theme.title,
      lang: effectiveLang,
      level: effectiveLevel,
      genre: effectiveGenre,
      count: aiGenerationCount,
      provider: aiProvider,
      model: aiModel,
      temperature: aiTemperature,
    });

    setAiGenerationType(null);
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Shadowing 主题管理</h1>
          {taskQueue.length > 0 && (
            <div className="mt-2 flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                任务队列: {taskQueue.filter((t) => t.status === 'pending').length} 等待中,
                {taskQueue.filter((t) => t.status === 'running').length} 执行中,
                {taskQueue.filter((t) => t.status === 'paused').length} 暂停,
                {taskQueue.filter((t) => t.status === 'completed').length} 已完成,
                {taskQueue.filter((t) => t.status === 'failed').length} 失败
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoStart"
                    checked={autoStart}
                    onChange={(e) => setAutoStart(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="autoStart" className="text-sm text-muted-foreground">
                    自动开始
                  </label>
                </div>
                {!autoStart && taskQueue.filter((t) => t.status === 'pending').length > 0 && (
                  <Button
                    onClick={startAllPendingTasks}
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    开始所有 ({taskQueue.filter((t) => t.status === 'pending').length})
                  </Button>
                )}
                {queuePaused ? (
                  <Button onClick={resumeAllTasks} size="sm" variant="outline">
                    恢复队列
                  </Button>
                ) : (
                  <Button onClick={pauseAllTasks} size="sm" variant="outline">
                    暂停队列
                  </Button>
                )}
                <Button onClick={cancelAllTasks} size="sm" variant="destructive">
                  取消所有
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={exportData} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button onClick={handleImport} variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            导入
          </Button>
          <Button
            onClick={() => setAiGenerationType('themes')}
            variant="outline"
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI 生成大主题
          </Button>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            新建主题
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>语言</Label>
              <Select value={lang} onValueChange={(v: Lang) => setLang(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANG_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>等级</Label>
              <Select
                value={String(level)}
                onValueChange={(v) => {
                  const newLevel = (v === 'all' ? 'all' : (parseInt(v) as 1 | 2 | 3 | 4 | 5 | 6));
                  setLevel(newLevel);
                  const availableGenres = getAvailableGenres(newLevel);
                  if (!availableGenres.includes(genre)) {
                    setGenre(availableGenres[0]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((opt) => (
                    <SelectItem key={String(opt)} value={String(opt)}>
                      {opt === 'all' ? '全部' : `L${opt}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>体裁</Label>
              <Select value={genre} onValueChange={(v: Genre) => setGenre(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENRE_OPTIONS.filter((opt) =>
                    getAvailableGenres(level).includes(opt.value as Genre),
                  ).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                <p>
                  <strong>{level === 'all' ? '全部等级' : `等级 L${level}`}</strong> 可用体裁:{' '}
                  {getAvailableGenres(level)
                    .map((g) => GENRE_OPTIONS.find((opt) => opt.value === g)?.label)
                    .join('、')}
                </p>
                {level !== 'all' && (
                  <>
                    <p>体裁优先: {LEVEL_CONFIG[level]?.genrePriority}</p>
                    <p>主题带宽: {LEVEL_CONFIG[level]?.themeBandwidth}</p>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label>搜索</Label>
              <Input
                placeholder="搜索主题标题..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 任务队列 */}
      {taskQueue.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>任务队列</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  任务添加到队列后不会自动开始，需要手动点击开始按钮或开启自动开始模式
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>最大并发数:</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={maxConcurrent}
                    onChange={(e) => setMaxConcurrent(parseInt(e.target.value) || 3)}
                    className="w-20"
                  />
                </div>
                <Button
                  onClick={startAllPendingTasks}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={taskQueue.filter((t) => t.status === 'pending').length === 0}
                >
                  <Play className="w-4 h-4 mr-1" />
                  一键开始 ({taskQueue.filter((t) => t.status === 'pending').length})
                </Button>
                <Button onClick={() => setTaskQueue([])} variant="outline" size="sm">
                  清空队列
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {taskQueue.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg border ${
                    task.status === 'completed'
                      ? 'bg-green-50 border-green-200'
                      : task.status === 'failed'
                        ? 'bg-red-50 border-red-200'
                        : task.status === 'cancelled'
                          ? 'bg-gray-50 border-gray-200'
                          : task.status === 'running'
                            ? 'bg-blue-50 border-blue-200'
                            : task.status === 'paused'
                              ? 'bg-yellow-50 border-yellow-200'
                              : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            task.status === 'completed'
                              ? 'bg-green-500'
                              : task.status === 'failed'
                                ? 'bg-red-500'
                                : task.status === 'cancelled'
                                  ? 'bg-gray-500'
                                  : task.status === 'running'
                                    ? 'bg-blue-500'
                                    : task.status === 'paused'
                                      ? 'bg-yellow-500'
                                      : 'bg-gray-400'
                          }`}
                        />
                        <span className="font-medium">{task.title}</span>
                        <Badge
                          variant={
                            task.status === 'completed'
                              ? 'default'
                              : task.status === 'failed'
                                ? 'destructive'
                                : task.status === 'cancelled'
                                  ? 'secondary'
                                  : task.status === 'running'
                                    ? 'secondary'
                                    : task.status === 'paused'
                                      ? 'outline'
                                      : 'outline'
                          }
                        >
                          {task.status === 'pending'
                            ? '等待中'
                            : task.status === 'running'
                              ? '执行中'
                              : task.status === 'paused'
                                ? '暂停'
                                : task.status === 'cancelled'
                                  ? '已取消'
                                  : task.status === 'completed'
                                    ? '已完成'
                                    : '失败'}
                        </Badge>
                      </div>
                      {task.status === 'running' && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {task.status === 'failed' && task.error && (
                        <div className="mt-2 text-sm text-red-600">错误: {task.error}</div>
                      )}
                      {task.status === 'completed' && task.result && (
                        <div className="mt-2 text-sm text-green-600">{task.result.message}</div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        创建时间: {task.createdAt.toLocaleTimeString()}
                        {task.startedAt && ` | 开始时间: ${task.startedAt.toLocaleTimeString()}`}
                        {task.pausedAt && ` | 暂停时间: ${task.pausedAt.toLocaleTimeString()}`}
                        {task.completedAt &&
                          ` | 完成时间: ${task.completedAt.toLocaleTimeString()}`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {task.status === 'pending' && (
                        <Button
                          onClick={() => startTask(task.id)}
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          title="开始任务"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      {task.status === 'running' && (
                        <Button
                          onClick={() => pauseTask(task.id)}
                          variant="ghost"
                          size="sm"
                          className="text-yellow-600 hover:text-yellow-700"
                          title="暂停任务"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}
                      {task.status === 'paused' && (
                        <Button
                          onClick={() => resumeTask(task.id)}
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                          title="恢复任务"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      {['pending', 'running', 'paused'].includes(task.status) && (
                        <Button
                          onClick={() => cancelTask(task.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          title="取消任务"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {['completed', 'failed', 'cancelled'].includes(task.status) && (
                        <Button
                          onClick={() => {
                            setTaskQueue((prev) => prev.filter((t) => t.id !== task.id));
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-gray-700"
                          title="删除任务"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 批量操作 */}
      {selectedCount > 0 && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">已选择 {selectedCount} 个主题</span>
              <Button
                onClick={batchAddToQueue}
                variant="default"
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Brain className="w-4 h-4 mr-2" />
                批量生成小主题
              </Button>
              <Button onClick={archiveSelected} variant="outline" size="sm">
                <Archive className="w-4 h-4 mr-2" />
                归档
              </Button>
              <Button onClick={deleteSelected} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                删除
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 主题列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="p-4 text-left">
                    <Checkbox
                      checked={items.length > 0 && items.every((item) => selected[item.id])}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="p-4 text-left">主题标题</th>
                  <th className="p-4 text-left">描述</th>
                  <th className="p-4 text-left">小主题数</th>
                  <th className="p-4 text-left">创建时间</th>
                  <th className="p-4 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <Checkbox
                          checked={selected[item.id] || false}
                          onCheckedChange={() => toggleOne(item.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {LANG_OPTIONS.find((l) => l.value === item.lang)?.label} L{item.level}{' '}
                          {GENRE_OPTIONS.find((g) => g.value === item.genre)?.label}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground max-w-xs truncate">
                          {item.desc || '-'}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{item.subtopic_count || 0}</Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button onClick={() => openEdit(item)} variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedThemeForSubtopic(item);
                              setAiGenerationType('subtopics');
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-purple-600 hover:text-purple-700"
                          >
                            <Brain className="w-4 h-4" />
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/admin/shadowing/subtopics-gen?theme_id=${item.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            onClick={() => deleteTheme(item)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle>{editing?.id ? '编辑主题' : '新建主题'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>语言</Label>
                <Select
                  value={editing?.lang || ''}
                  onValueChange={(v: Lang) => setEditing({ ...editing, lang: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANG_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>等级</Label>
                <Select
                  value={String(editing?.level || '')}
                  onValueChange={(v) => {
                    const newLevel = parseInt(v) as 1 | 2 | 3 | 4 | 5 | 6;
                    const newEditing = { ...editing, level: newLevel };

                    // 检查当前体裁是否在新等级中可用
                    const availableGenres = getAvailableGenres(newLevel);
                    if (editing?.genre && !availableGenres.includes(editing.genre)) {
                      // 如果当前体裁不可用，自动选择第一个可用的体裁
                      newEditing.genre = availableGenres[0];
                    }

                    setEditing(newEditing);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={String(opt)}>
                        L{opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>体裁</Label>
              <Select
                value={editing?.genre || ''}
                onValueChange={(v: Genre) => setEditing({ ...editing, genre: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENRE_OPTIONS.filter((opt) =>
                    getAvailableGenres(editing?.level || level).includes(opt.value as Genre),
                  ).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                <p>
                  <strong>等级 L{editing?.level || level}</strong> 可用体裁:{' '}
                  {getAvailableGenres(editing?.level || level)
                    .map((g) => GENRE_OPTIONS.find((opt) => opt.value === g)?.label)
                    .join('、')}
                </p>
                <p>体裁优先: {LEVEL_CONFIG[editing?.level || level]?.genrePriority}</p>
                <p>主题带宽: {LEVEL_CONFIG[editing?.level || level]?.themeBandwidth}</p>
              </div>
            </div>

            <div>
              <Label>主题标题 *</Label>
              <Input
                value={editing?.title || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="请输入主题标题"
              />
            </div>

            <div>
              <Label>描述</Label>
              <Textarea
                value={editing?.desc || ''}
                onChange={(e) => setEditing({ ...editing, desc: e.target.value })}
                placeholder="请输入主题描述（可选）"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={closeModal} variant="outline">
                取消
              </Button>
              <Button onClick={saveOne}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 隐藏的文件输入 */}
      <input
        ref={setFileInput}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* AI 生成对话框 */}
      <Dialog open={!!aiGenerationType} onOpenChange={(open) => !open && setAiGenerationType(null)}>
        <DialogContent className="max-w-md" aria-describedby="ai-dialog-description">
          <DialogHeader>
            <DialogTitle>
              {aiGenerationType === 'themes' ? 'AI 生成大主题' : 'AI 生成小主题'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {aiGenerationType === 'subtopics' && selectedThemeForSubtopic && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">目标主题：</p>
                <p className="text-sm text-muted-foreground">{selectedThemeForSubtopic.title}</p>
              </div>
            )}

            <div>
              <Label>生成数量</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={aiGenerationCount}
                onChange={(e) => setAiGenerationCount(parseInt(e.target.value) || 5)}
              />
            </div>

            <div>
              <Label>AI 提供者</Label>
              <Select value={aiProvider} onValueChange={(v: any) => setAiProvider(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>AI 模型</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模型..." />
                </SelectTrigger>
                <SelectContent>
                  {aiModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>温度: {aiTemperature}</Label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={aiTemperature}
                onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => setAiGenerationType(null)} variant="outline">
                取消
              </Button>
              <Button
                onClick={
                  aiGenerationType === 'themes'
                    ? generateThemes
                    : () => generateSubtopics(selectedThemeForSubtopic)
                }
                disabled={!aiModel}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
              >
                添加到队列
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
