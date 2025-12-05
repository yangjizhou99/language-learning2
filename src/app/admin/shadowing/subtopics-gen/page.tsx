'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Edit,
  Archive,
  Trash2,
  Download,
  Upload,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
} from 'lucide-react';

type Lang = 'en' | 'ja' | 'zh' | 'ko' | 'all';
type Genre = 'dialogue' | 'monologue' | 'news' | 'lecture' | 'all';

const LANG_OPTIONS = [
  { value: 'all', label: '全部语言' },
  { value: 'ja', label: '日语' },
  { value: 'en', label: '英语' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '韩语' },
];

const LEVEL_OPTIONS = [
  { value: 'all', label: '全部等级' },
  { value: '1', label: 'L1' },
  { value: '2', label: 'L2' },
  { value: '3', label: 'L3' },
  { value: '4', label: 'L4' },
  { value: '5', label: 'L5' },
  { value: '6', label: 'L6' },
];

const GENRE_OPTIONS = [
  { value: 'all', label: '全部体裁' },
  { value: 'dialogue', label: '对话' },
  { value: 'monologue', label: '独白' },
  { value: 'news', label: '新闻' },
  { value: 'lecture', label: '讲座' },
];

const DIALOGUE_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'casual', label: '日常闲聊' },
  { value: 'task', label: '任务导向' },
  { value: 'emotion', label: '情感表达' },
  { value: 'opinion', label: '观点讨论' },
  { value: 'request', label: '请求建议' },
  { value: 'roleplay', label: '角色扮演' },
  { value: 'pattern', label: '句型操练' },
];

const HAS_ARTICLE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'yes', label: '已有文章' },
  { value: 'no', label: '暂无文章' },
];

const PROVIDER_OPTIONS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'deepseek', label: 'DeepSeek' },
];

const QUICK_CONFIGS = [
  {
    name: 'L1对话',
    lang: 'ja',
    level: 1,
    genre: 'dialogue',
    dialogue_type: 'casual',
    provider: 'openrouter',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    genrePriority: 'dialogue/monologue',
    themeBandwidth: '日常任务：购物、预约、住户问题、课程安排',
    lengthTarget: {
      en: { min: 90, max: 120 },
      ja: { min: 260, max: 360 },
      zh: { min: 240, max: 320 },
      ko: { min: 250, max: 340 },
    },
    sentenceRange: { min: 7, max: 9 },
    maxSentenceLength: { en: 16, ja: 45, zh: 45, ko: 45 },
  },
  {
    name: 'L3独白',
    lang: 'ja',
    level: 3,
    genre: 'monologue',
    provider: 'openrouter',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    genrePriority: 'monologue/news-lite',
    themeBandwidth: '泛新闻/校园新闻、社交媒体短评',
    lengthTarget: {
      en: { min: 120, max: 160 },
      ja: { min: 360, max: 480 },
      zh: { min: 320, max: 420 },
      ko: { min: 340, max: 450 },
    },
    sentenceRange: { min: 8, max: 10 },
    maxSentenceLength: { en: 20, ja: 55, zh: 55, ko: 55 },
  },
  {
    name: 'L2韩语对话',
    lang: 'ko',
    level: 2,
    genre: 'dialogue',
    provider: 'openrouter',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    genrePriority: 'dialogue/monologue',
    themeBandwidth: '日常任务：购物、预约、住户问题、课程安排',
    lengthTarget: {
      en: { min: 90, max: 120 },
      ja: { min: 260, max: 360 },
      zh: { min: 240, max: 320 },
      ko: { min: 250, max: 340 },
    },
    sentenceRange: { min: 7, max: 9 },
    maxSentenceLength: { en: 16, ja: 45, zh: 45, ko: 45 },
  },
];

export default function SubtopicsPage() {
  const searchParams = useSearchParams();

  // 基础状态
  const [loading, setLoading] = useState(false);
  const [themes, setThemes] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 筛选状态
  const [lang, setLang] = useState<Lang>('all');
  const [level, setLevel] = useState<string>('all');
  const [genre, setGenre] = useState<Genre>('all');
  const [dialogueType, setDialogueType] = useState<string>('all');
  const [themeId, setThemeId] = useState<string>('all');
  const [hasArticle, setHasArticle] = useState<string>('all');
  const [q, setQ] = useState('');

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, saved: 0, errors: 0, tokens: 0 });
  const [logs, setLogs] = useState<Array<{ type: 'info' | 'success' | 'error'; message: string }>>(
    [],
  );

  // AI配置
  const [provider, setProvider] = useState('deepseek');
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0.7);
  const [concurrency, setConcurrency] = useState(6);

  // 并发控制
  const [maxConcurrent, setMaxConcurrent] = useState(6); // 后端并发处理，默认使用推荐值

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 列表加载请求竞态防护
  const listRequestIdRef = useRef(0);

  // 任务队列（借鉴主题管理）
  const [taskQueue, setTaskQueue] = useState<
    Array<{
      id: string;
      status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
      progress: number; // 0-100
      title: string;
      params: any;
      result?: any;
      abortController?: AbortController;
      startedAt?: Date;
      completedAt?: Date;
      pausedAt?: Date;
      error?: string;
    }>
  >([]);
  const [runningTasks, setRunningTasks] = useState(0);
  const [queuePaused, setQueuePaused] = useState(false);
  const [autoStart, setAutoStart] = useState(true);
  const [drainOnce, setDrainOnce] = useState(false);

  // 获取认证头信息
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 从URL参数初始化
  useEffect(() => {
    if (!searchParams) return;
    const urlThemeId = searchParams.get('theme_id');
    if (urlThemeId) {
      setThemeId(urlThemeId);
    }
  }, [searchParams]);

  // 加载大主题列表
  async function loadThemes() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const qs = new URLSearchParams();
      if (lang !== 'all') qs.set('lang', lang);
      if (level !== 'all') qs.set('level', level);
      if (genre !== 'all') qs.set('genre', genre);
      if (dialogueType !== 'all') qs.set('dialogue_type', dialogueType);
      if (hasArticle !== 'all') qs.set('has_article', hasArticle);

      const r = await fetch(`/api/admin/shadowing/themes?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const responseText = await r.text();
      if (r.ok) {
        try {
          const j = JSON.parse(responseText);
          setThemes(j.items || []);
        } catch (jsonError) {
          console.error('Parse themes response failed:', responseText);
        }
      } else {
        console.error('Load themes failed:', responseText);
      }
    } catch (error) {
      console.error('Load themes failed:', error);
    }
  }

  // 加载小主题列表
  async function loadSubtopics() {
    setLoading(true);
    const requestId = ++listRequestIdRef.current;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const qs = new URLSearchParams({
        limit: pagination.limit.toString(),
        page: pagination.page.toString(),
      });
      // 包含归档与草稿，用于准确统计“暂无文章”=无已发布且无草稿
      qs.set('include_archived', '1');
      qs.set('include_drafts', '1');
      if (lang !== 'all') qs.set('lang', lang);
      if (level !== 'all') qs.set('level', String(level));
      if (genre !== 'all') qs.set('genre', genre);
      if (dialogueType !== 'all') qs.set('dialogue_type', dialogueType);
      if (themeId && themeId !== 'all') qs.set('theme_id', themeId);
      if (hasArticle !== 'all') qs.set('has_article', hasArticle);
      if (q) qs.set('q', q);

      const r = await fetch(`/api/admin/shadowing/subtopics?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const responseText = await r.text();
      if (r.ok) {
        try {
          const j = JSON.parse(responseText);
          if (requestId === listRequestIdRef.current) {
            setItems(j.items || []);
            setSelected({});
            setPagination((prev) => ({
              ...prev,
              total: j.total || 0,
              totalPages: j.totalPages || 0,
            }));
          }
        } catch (jsonError) {
          console.error('Parse subtopics response failed:', responseText);
        }
      } else {
        console.error('Load subtopics failed:', responseText);
      }
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      if (requestId === listRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadThemes();
  }, [lang, level, genre, dialogueType, hasArticle]);

  useEffect(() => {
    loadSubtopics();
  }, [lang, level, genre, dialogueType, themeId, hasArticle, q, pagination.page, pagination.limit]);

  // 当筛选条件变化时，重置到第一页，避免高页码下看起来“无数据”
  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [lang, level, genre, dialogueType, themeId, hasArticle, q]);

  // 加载模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (provider === 'openrouter') {
          const r = await fetch(`/api/admin/providers/models?provider=${provider}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (r.ok) {
            const j = await r.json();
            setModels(j.models || []);
            // 如果当前没有选择模型，才设置默认值
            if (!model && j.models && j.models.length > 0) {
              // 优先选择DeepSeek模型
              const deepseekModel = j.models.find((m: any) => m.id === 'deepseek/deepseek-chat');
              if (deepseekModel) {
                setModel('deepseek/deepseek-chat');
              } else {
                setModel(j.models[0].id);
              }
            }
          }
        } else if (provider === 'deepseek') {
          const staticModels = [
            { id: 'deepseek-chat', name: 'deepseek-chat' },
            { id: 'deepseek-coder', name: 'deepseek-coder' },
            { id: 'deepseek-reasoner', name: 'deepseek-reasoner' },
          ];
          setModels(staticModels);
          setModel(staticModels[0].id);
        } else {
          const staticModels = [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini' }];
          setModels(staticModels);
          setModel(staticModels[0].id);
        }
      } catch (error) {
        console.error('Load models failed:', error);
        setModels([]);
        setModel('');
      }
    };

    loadModels();
  }, [provider]);

  function toggleAll(v: boolean) {
    const m: Record<string, boolean> = {};
    items.forEach((it) => (m[it.id] = v));
    setSelected(m);
  }

  function toggleOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function openNew() {
    if (!themeId || themeId === 'all') {
      alert('请先选择具体的大主题（不能选择"全部大主题"）');
      return;
    }
    setEditing({
      id: undefined,
      theme_id: themeId,
      lang: lang === 'all' ? 'ja' : lang,
      level: level === 'all' ? 3 : level,
      genre: genre === 'all' ? 'monologue' : genre,
      dialogue_type: dialogueType === 'all' ? 'casual' : dialogueType,
      title: '',
      seed: '',
      one_line: '',
      tags: [],
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

  async function saveItem() {
    if (!editing) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics', {
        method: editing.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'upsert', item: editing }),
      });
      const responseText = await r.text();
      if (!r.ok) {
        try {
          const j = JSON.parse(responseText);
          alert('保存失败：' + j.error);
        } catch (jsonError) {
          alert('保存失败：' + responseText);
        }
        return;
      }
      const j = JSON.parse(responseText);
      closeModal();
      loadSubtopics();
    } catch (error) {
      alert('保存失败：' + error);
    }
  }

  async function saveAll() {
    const dirtyItems = items.filter((item) => item._dirty);
    if (!dirtyItems.length) {
      alert('没有需要保存的修改');
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'upsert', items: dirtyItems }),
      });
      const responseText = await r.text();
      if (!r.ok) {
        try {
          const j = JSON.parse(responseText);
          alert('保存失败：' + j.error);
        } catch (jsonError) {
          alert('保存失败：' + responseText);
        }
        return;
      }
      const j = JSON.parse(responseText);
      loadSubtopics();
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
    if (!confirm(`确认归档 ${ids.length} 个小主题？`)) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'archive', items: ids.map((id) => ({ id })) }),
      });
      const responseText = await r.text();
      if (!r.ok) {
        try {
          const j = JSON.parse(responseText);
          alert('操作失败：' + j.error);
        } catch (jsonError) {
          alert('操作失败：' + responseText);
        }
        return;
      }
      const j = JSON.parse(responseText);
      loadSubtopics();
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
    if (!confirm(`⚠️永久删除 ${ids.length} 个小主题？`)) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'delete', items: ids.map((id) => ({ id })) }),
      });
      const responseText = await r.text();
      if (!r.ok) {
        try {
          const j = JSON.parse(responseText);
          alert('删除失败：' + j.error);
        } catch (jsonError) {
          alert('删除失败：' + responseText);
        }
        return;
      }
      const j = JSON.parse(responseText);
      loadSubtopics();
    } catch (error) {
      alert('删除失败：' + error);
    }
  }

  function updateItem(id: string, field: string, value: any) {
    setItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value, _dirty: true } : item)),
    );
  }

  // 添加任务到队列
  function addTaskToQueue(params: any) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      status: 'pending' as const,
      progress: 0,
      title: `批量生成小主题 (${params.subtopic_ids?.length || 0} 项)`,
      params,
      createdAt: new Date(),
    } as any;
    setTaskQueue((prev) => [...prev, task]);
    return taskId;
  }

  // 执行任务（使用流式接口逐步更新进度）
  async function executeTask(taskId: string) {
    const task = taskQueue.find((t) => t.id === taskId);
    if (!task) return;

    const abortController = new AbortController();
    setTaskQueue((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'running', startedAt: new Date(), progress: 5, abortController }
          : t,
      ),
    );
    setRunningTasks((prev) => prev + 1);

    // 同步到页面顶层进度显示
    setGenerating(true);
    setProgress({ done: 0, total: task.params.subtopic_ids?.length || 0, saved: 0, errors: 0, tokens: 0 });
    setLogs([{ type: 'info', message: task.title }]);

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      } as Record<string, string>;

      const response = await fetch('/api/admin/shadowing/generate-from-subtopics/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify(task.params),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // 处理SSE流
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        let saved = 0;
        let errors = 0;
        let done = 0;
        let total = task.params.subtopic_ids?.length || 0;
        let tokens = 0;

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'start') {
                total = data.total || total;
                setTaskQueue((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: 10 } : t)));
                setProgress((p) => ({ ...p, total }));
              } else if (data.type === 'progress') {
                done = data.done ?? done + 1;
                saved = data.saved ?? saved;
                errors = data.errors ?? errors;
                tokens = data.tokens ?? tokens;
                // 将完成度映射到 10-99 之间，保留最后完成设置为100
                const pct = total > 0 ? Math.min(99, Math.max(10, Math.round((done / total) * 100))) : 50;
                setTaskQueue((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: pct } : t)));
                setProgress({ done, total, saved, errors, tokens });
              } else if (data.type === 'skip') {
                done += 1;
                const pct = total > 0 ? Math.min(99, Math.max(10, Math.round((done / total) * 100))) : 50;
                setTaskQueue((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: pct } : t)));
                setProgress((p) => ({ ...p, done }));
                setLogs((prev) => [...prev, { type: 'info', message: `跳过：${data.title}` }]);
              } else if (data.type === 'error') {
                errors += 1;
                done = Math.min(done + 1, total);
                const pct = total > 0 ? Math.min(99, Math.max(10, Math.round((done / total) * 100))) : 50;
                setTaskQueue((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress: pct } : t)));
                setProgress({ done, total, saved, errors, tokens });
                if (data.error) setLogs((prev) => [...prev, { type: 'error', message: String(data.error) }]);
              } else if (data.type === 'complete') {
                saved = data.saved ?? saved;
                errors = data.errors ?? errors;
                tokens = data.tokens ?? tokens;
                setTaskQueue((prev) =>
                  prev.map((t) => (t.id === taskId ? { ...t, progress: 100 } : t)),
                );
                setProgress({ done: total, total, saved, errors, tokens });
              }
            } catch (e) {
              console.error('Parse SSE data failed:', e);
            }
          }
        }

        // 标记完成
        setTaskQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'completed', progress: 100, completedAt: new Date(), abortController: undefined }
              : t,
          ),
        );
      } else {
        // 回退：非流式响应，直接按完成处理
        const text = await response.text();
        let j: any;
        try {
          j = JSON.parse(text);
        } catch {
          throw new Error(`Invalid response: ${text}`);
        }
        const total = j.total || (task.params.subtopic_ids?.length || 0);
        setProgress({ done: total, total, saved: j.success_count || 0, errors: j.error_count || 0, tokens: 0 });
        setTaskQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'completed', progress: 100, result: j, completedAt: new Date(), abortController: undefined }
              : t,
          ),
        );
      }

      // 刷新列表
      loadSubtopics();
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setTaskQueue((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled', abortController: undefined } : t)),
        );
      } else {
        setTaskQueue((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'failed', error: String(error?.message || error), abortController: undefined }
              : t,
          ),
        );
        setLogs((prev) => [...prev, { type: 'error', message: `批量生成失败：${String(error?.message || error)}` }]);
      }
    } finally {
      setRunningTasks((prev) => Math.max(0, prev - 1));
      setGenerating(false);
    }
  }

  // 队列处理器
  useEffect(() => {
    const processQueue = async () => {
      if (queuePaused || (!autoStart && !drainOnce)) return;
      const pending = taskQueue.filter((t) => t.status === 'pending');
      const canStart = Math.min(pending.length, maxConcurrent - runningTasks);
      for (let i = 0; i < canStart; i++) {
        executeTask(pending[i].id);
      }
      if (drainOnce) setDrainOnce(false);
    };
    processQueue();
  }, [taskQueue, maxConcurrent, runningTasks, queuePaused, autoStart, drainOnce]);

  async function startGeneration() {
    const selectedIds = Object.keys(selected).filter((id) => selected[id]);
    if (!selectedIds.length) {
      alert('请先选择要生成的小主题');
      return;
    }
    // 将任务添加到队列，并自动开始
    const params = {
      subtopic_ids: selectedIds,
      // lang/level/genre 可选，后端会以每条记录为准，这里仅用于日志
      lang: lang === 'all' ? 'all' : lang,
      level: level === 'all' ? 'all' : level,
      genre: genre === 'all' ? 'all' : genre,
      dialogue_type: dialogueType === 'all' ? 'all' : dialogueType,
      provider,
      model,
      temperature,
      concurrency: maxConcurrent,
    };
    const taskId = addTaskToQueue(params);
    setDrainOnce(true); // 触发队列启动一次
    setLogs([{ type: 'info', message: `已加入队列：${selectedIds.length} 个小主题` }]);
  }

  function stopGeneration() {
    // 取消所有运行中的任务
    setTaskQueue((prev) => {
      prev.forEach((t) => t.abortController?.abort());
      return prev.map((t) => (t.status === 'running' ? { ...t, status: 'cancelled', abortController: undefined } : t));
    });
    setGenerating(false);
  }

  function applyQuickConfig(config: any) {
    setLang(config.lang);
    setLevel(String(config.level));
    setGenre(config.genre);
    if (config.dialogue_type) setDialogueType(config.dialogue_type);
    setProvider(config.provider);
    setModel(config.model);
    setTemperature(config.temperature);
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const dirtyCount = items.filter((item) => item._dirty).length;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Shadowing 小主题批量生成</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            新建
          </Button>
          <Button onClick={saveAll} disabled={dirtyCount === 0} size="sm">
            <Download className="w-4 h-4 mr-1" />
            保存全部 ({dirtyCount})
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>体裁</Label>
              <Select
                value={genre}
                onValueChange={(v: Genre) => setGenre(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="体裁" />
                </SelectTrigger>
                <SelectContent>
                  {GENRE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {genre === 'dialogue' && (
              <div>
                <Label>对话类型</Label>
                <Select
                  value={dialogueType}
                  onValueChange={setDialogueType}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="对话类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIALOGUE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>大主题</Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择大主题" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部大主题</SelectItem>
                  {themes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>文章状态</Label>
              <Select value={hasArticle} onValueChange={setHasArticle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAS_ARTICLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label>搜索</Label>
            <Input
              placeholder="搜索标题、关键词..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 快速配置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>快速配置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {QUICK_CONFIGS.map((config, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => applyQuickConfig(config)}
              >
                {config.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 生成进度 */}
      {generating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>生成进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  进度: {progress.done}/{progress.total} (完成: {progress.saved}, 失败: {progress.errors})
                </div>
                <Button onClick={stopGeneration} size="sm" variant="destructive">
                  停止
                </Button>
              </div>
              <Progress value={(progress.done / progress.total) * 100} />
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`text-sm ${log.type === 'error'
                        ? 'text-red-600'
                        : log.type === 'success'
                          ? 'text-green-600'
                          : 'text-gray-600'
                        }`}
                    >
                      {log.message}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 批量操作 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>批量操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>体裁</Label>
            <Select value={genre} onValueChange={(v: Genre) => setGenre(v)}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="全部体裁" />
              </SelectTrigger>
              <SelectContent>
                {GENRE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {genre === 'dialogue' && (
              <div className="flex items-center gap-2">
                <Label>对话类型</Label>
                <Select value={dialogueType} onValueChange={setDialogueType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIALOGUE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={selectedCount === items.length && items.length > 0}
                onCheckedChange={(checked) => toggleAll(checked as boolean)}
              />
              <span className="text-sm">全选 ({selectedCount}/{items.length})</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={startGeneration} disabled={generating || selectedCount === 0} size="sm">
                <Play className="w-4 h-4 mr-1" />
                批量生成 ({selectedCount})
              </Button>
              <Button onClick={archiveSelected} disabled={selectedCount === 0} size="sm" variant="outline">
                <Archive className="w-4 h-4 mr-1" />
                归档选中
              </Button>
              <Button onClick={deleteSelected} disabled={selectedCount === 0} size="sm" variant="destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                删除选中
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 生成配置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>生成配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>AI提供商</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>模型</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>温度</Label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>并发数</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(parseInt(e.target.value) || 10)}
              />
            </div>
          </div>
          <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
            <strong>后端并发处理：</strong>
            使用后端批量API处理并发，避免浏览器连接限制。支持最多100个并发连接，更稳定可靠。
          </div>
        </CardContent>
      </Card>

      {/* 小主题列表 */}
      <Card>
        <CardHeader>
          <CardTitle>小主题列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                  <Checkbox checked={selected[item.id] || false} onCheckedChange={() => toggleOne(item.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {item.sequence_order && (
                        <span className="inline-flex items-center justify-center w-6 h-6 mr-2 text-xs font-bold text-white bg-blue-600 rounded-full">
                          {item.sequence_order}
                        </span>
                      )}
                      {item.title}
                    </div>
                    <div className="text-sm text-muted-foreground">{item.seed} • {item.one_line}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="outline">{item.lang}</Badge>
                      <Badge variant="outline">L{item.level}</Badge>
                      <Badge variant="outline">{item.genre}</Badge>
                      {item.dialogue_type && (
                        <Badge variant="secondary">{item.dialogue_type}</Badge>
                      )}
                      {item.roles && Object.keys(item.roles).length > 0 && (
                        <Badge variant="outline" className="text-purple-600 border-purple-300">
                          👥 {Object.keys(item.roles).length}角色
                        </Badge>
                      )}
                      {item.tags?.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 分页 */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">每页显示:</span>
                <Select
                  value={pagination.limit.toString()}
                  onValueChange={(value) => {
                    setPagination((prev) => ({
                      ...prev,
                      limit: parseInt(value),
                      page: 1, // 重置到第一页
                    }));
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                  上一页
                </Button>
                <Button size="sm" variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                  下一页
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? '编辑小主题' : '新建小主题'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>语言</Label>
                  <Select value={editing.lang} onValueChange={(v) => setEditing({ ...editing, lang: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ja">日语</SelectItem>
                      <SelectItem value="en">英语</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>等级</Label>
                  <Select value={String(editing.level)} onValueChange={(v) => setEditing({ ...editing, level: parseInt(v) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((level) => (
                        <SelectItem key={level} value={String(level)}>
                          L{level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>体裁</Label>
                <Select value={editing.genre} onValueChange={(v) => setEditing({ ...editing, genre: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dialogue">对话</SelectItem>
                    <SelectItem value="monologue">独白</SelectItem>
                    <SelectItem value="news">新闻</SelectItem>
                    <SelectItem value="lecture">讲座</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>章节顺序</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editing.sequence_order || ''}
                    onChange={(e) => setEditing({ ...editing, sequence_order: parseInt(e.target.value) || null })}
                    placeholder="1, 2, 3..."
                  />
                </div>
                <div>
                  <Label>标题</Label>
                  <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>关键词（逗号分隔）</Label>
                <Input value={editing.seed} onChange={(e) => setEditing({ ...editing, seed: e.target.value })} />
              </div>
              <div>
                <Label>一句话描述</Label>
                <Textarea value={editing.one_line} onChange={(e) => setEditing({ ...editing, one_line: e.target.value })} />
              </div>
              <div>
                <Label>标签 (用逗号分隔)</Label>
                <Input
                  value={editing.tags?.join(', ') || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              {/* 对话类型 - 仅对话体裁显示 */}
              {editing.genre === 'dialogue' && (
                <div>
                  <Label>对话类型</Label>
                  <Select value={editing.dialogue_type || ''} onValueChange={(v) => setEditing({ ...editing, dialogue_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择对话类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">日常闲聊</SelectItem>
                      <SelectItem value="task">任务导向</SelectItem>
                      <SelectItem value="emotion">情感表达</SelectItem>
                      <SelectItem value="opinion">观点讨论</SelectItem>
                      <SelectItem value="request">请求建议</SelectItem>
                      <SelectItem value="roleplay">角色扮演</SelectItem>
                      <SelectItem value="pattern">句型操练</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* 角色定义 - 用于连续故事生成 */}
              <div>
                <Label>角色定义 <span className="text-xs text-muted-foreground">(包含姓名和性别)</span></Label>
                {/* 角色快捷查看 */}
                {editing.roles && typeof editing.roles === 'object' && Object.keys(editing.roles).length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2 p-2 bg-muted rounded">
                    {Object.entries(editing.roles).map(([key, value]: [string, any]) => (
                      <Badge key={key} variant="outline" className="text-sm">
                        <span className="font-bold mr-1">{key}:</span>
                        {typeof value === 'object' ? (
                          <>
                            {value.name}
                            <span className={`ml-1 ${value.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}`}>
                              {value.gender === 'male' ? '♂' : '♀'}
                            </span>
                          </>
                        ) : (
                          value
                        )}
                      </Badge>
                    ))}
                  </div>
                )}
                <Textarea
                  value={typeof editing.roles === 'object' ? JSON.stringify(editing.roles, null, 2) : (editing.roles || '')}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditing({ ...editing, roles: parsed });
                    } catch {
                      // 如果不是有效JSON，暂存为字符串
                      setEditing({ ...editing, roles: e.target.value });
                    }
                  }}
                  placeholder='{"A": {"name": "李明", "gender": "male"}, "B": {"name": "王老师", "gender": "female"}}'
                  rows={4}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeModal}>
                  取消
                </Button>
                <Button onClick={saveItem}>保存</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

