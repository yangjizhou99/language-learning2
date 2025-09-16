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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Archive, Trash2, Download, Upload, Play, Pause, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type Lang = 'en'|'ja'|'zh'|'all';
type Genre = 'dialogue'|'monologue'|'news'|'lecture'|'all';

const LANG_OPTIONS = [
  { value: 'all', label: '全部语言' },
  { value: 'ja', label: '日语' },
  { value: 'en', label: '英语' },
  { value: 'zh', label: '中文' }
];

const LEVEL_OPTIONS = [
  { value: 'all', label: '全部等级' },
  { value: '1', label: 'L1' },
  { value: '2', label: 'L2' },
  { value: '3', label: 'L3' },
  { value: '4', label: 'L4' },
  { value: '5', label: 'L5' },
  { value: '6', label: 'L6' }
];

const GENRE_OPTIONS = [
  { value: 'all', label: '全部体裁' },
  { value: 'dialogue', label: '对话' },
  { value: 'monologue', label: '独白' },
  { value: 'news', label: '新闻' },
  { value: 'lecture', label: '讲座' }
];

const HAS_ARTICLE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'yes', label: '已有文章' },
  { value: 'no', label: '暂无文章' }
];

// 等级与体裁的对应关系（基于6级难度设计）
const LEVEL_GENRE_RESTRICTIONS: Record<number, Genre[]> = {
  1: ['dialogue'], // L1: 对话优先
  2: ['dialogue', 'monologue'], // L2: 对话/独白
  3: ['monologue', 'news'], // L3: 独白/新闻-lite
  4: ['news', 'dialogue'], // L4: 新闻/对话（正式）
  5: ['lecture', 'news'], // L5: 讲座/新闻（信息密度↑）
  6: ['lecture', 'news']  // L6: 讲座/社论
};

// 根据等级获取可用的体裁选项
const getAvailableGenres = (level: number | 'all'): Genre[] => {
  if (level === 'all') {
    return ['all', 'dialogue', 'monologue', 'news', 'lecture'];
  }
  return ['all', ...(LEVEL_GENRE_RESTRICTIONS[level] || [])];
};

// 等级详细配置（基于6级难度设计）
const LEVEL_CONFIG: Record<number, {
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
}> = {
  1: {
    genrePriority: 'dialogue（对话）',
    themeBandwidth: '高熟悉：问路、点餐、打招呼、校园办事',
    lengthTarget: { en: { min: 60, max: 90 }, ja: { min: 180, max: 260 }, zh: { min: 160, max: 240 } },
    sentenceRange: { min: 6, max: 8 },
    maxSentenceLength: { en: 12, ja: 35, zh: 35 }
  },
  2: {
    genrePriority: 'dialogue/monologue',
    themeBandwidth: '日常任务：购物、预约、住户问题、课程安排',
    lengthTarget: { en: { min: 90, max: 120 }, ja: { min: 260, max: 360 }, zh: { min: 240, max: 320 } },
    sentenceRange: { min: 7, max: 9 },
    maxSentenceLength: { en: 16, ja: 45, zh: 45 }
  },
  3: {
    genrePriority: 'monologue/news-lite',
    themeBandwidth: '泛新闻/校园新闻、社交媒体短评',
    lengthTarget: { en: { min: 120, max: 160 }, ja: { min: 360, max: 480 }, zh: { min: 320, max: 420 } },
    sentenceRange: { min: 8, max: 10 },
    maxSentenceLength: { en: 20, ja: 55, zh: 55 }
  },
  4: {
    genrePriority: 'news/dialogue（formal）',
    themeBandwidth: '主题扩展：科技、教育、健康政策入门',
    lengthTarget: { en: { min: 160, max: 200 }, ja: { min: 480, max: 620 }, zh: { min: 420, max: 560 } },
    sentenceRange: { min: 9, max: 11 },
    maxSentenceLength: { en: 24, ja: 65, zh: 65 }
  },
  5: {
    genrePriority: 'lecture/news（信息密度↑）',
    themeBandwidth: '专题：经济/科技/文化比较、数据引用',
    lengthTarget: { en: { min: 200, max: 260 }, ja: { min: 620, max: 780 }, zh: { min: 560, max: 720 } },
    sentenceRange: { min: 10, max: 12 },
    maxSentenceLength: { en: 28, ja: 75, zh: 75 }
  },
  6: {
    genrePriority: 'lecture/editorial',
    themeBandwidth: '深度议题：国际关系、AI伦理、产业趋势',
    lengthTarget: { en: { min: 260, max: 320 }, ja: { min: 780, max: 980 }, zh: { min: 720, max: 900 } },
    sentenceRange: { min: 11, max: 13 },
    maxSentenceLength: { en: 32, ja: 90, zh: 90 }
  }
};

// 根据等级和语言获取长度目标
const getLengthTarget = (level: number, lang: Lang) => {
  const config = LEVEL_CONFIG[level];
  if (!config) return { min: 0, max: 0 };
  
  switch (lang) {
    case 'en': return config.lengthTarget.en;
    case 'ja': return config.lengthTarget.ja;
    case 'zh': return config.lengthTarget.zh;
    default: return { min: 0, max: 0 };
  }
};

// 根据等级获取句子数范围
const getSentenceRange = (level: number) => {
  return LEVEL_CONFIG[level]?.sentenceRange || { min: 6, max: 8 };
};

// 根据等级和语言获取句长上限
const getMaxSentenceLength = (level: number, lang: Lang) => {
  const config = LEVEL_CONFIG[level];
  if (!config) return 0;
  
  switch (lang) {
    case 'en': return config.maxSentenceLength.en;
    case 'ja': 
    case 'zh': return config.maxSentenceLength.ja; // 日文和中文使用相同的字符数限制
    default: return 0;
  }
};

const PROVIDER_OPTIONS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI' }
];

export default function SubtopicsGenPage() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Lang>('all');
  const [level, setLevel] = useState<1|2|3|4|5|6|'all'>('all');
  const [genre, setGenre] = useState<Genre>('all');
  const [themeId, setThemeId] = useState<string>('all');
  const [hasArticle, setHasArticle] = useState<string>('all'); // 是否有对应文章
  const [q, setQ] = useState('');
  
  const [themes, setThemes] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0
  });
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  
  // 生成相关状态
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, saved: 0, errors: 0, tokens: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [provider, setProvider] = useState<'openrouter' | 'deepseek' | 'openai'>('deepseek');
  const [models, setModels] = useState<{id: string; name: string}[]>([]);
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [concurrency, setConcurrency] = useState(4);
  
  // 任务队列相关状态
  const [useTaskQueue, setUseTaskQueue] = useState(true);
  const [taskQueue, setTaskQueue] = useState<Array<{
    id: string;
    type: 'shadowing_generation';
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
  }>>([]);
  // 根据环境设置默认并发数
  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [maxConcurrent, setMaxConcurrent] = useState(30); // 现在本地和生产都支持30个并发
  const [runningTasks, setRunningTasks] = useState(0);
  const [queuePaused, setQueuePaused] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  
  // 任务队列分页
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  
  // 防重复启动的任务ID集合
  const [startingTasks, setStartingTasks] = useState<Set<string>>(new Set());
  
  // 执行进度
  const [executionProgress, setExecutionProgress] = useState({
    current: 0,
    total: 0,
    completed: 0,
    failed: 0
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取认证头信息
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 多域名支持 - 轮询使用不同域名突破浏览器并发限制
  const API_DOMAINS = [
    '', // 当前域名
    'api1', // 子域名1
    'api2', // 子域名2
    'api3', // 子域名3
    'api4', // 子域名4
    'api5', // 子域名5
  ];

  function getApiUrl(path: string, taskIndex: number = 0) {
    // 本地开发环境：使用子域名（需要配置hosts文件）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const domain = API_DOMAINS[taskIndex % API_DOMAINS.length];
      if (domain) {
        return `http://${domain}.localhost:${window.location.port || 3000}${path}`;
      } else {
        return path;
      }
    }
    
    // 生产环境：使用多域名
    const domain = API_DOMAINS[taskIndex % API_DOMAINS.length];
    if (domain) {
      return `https://${domain}.${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}${path}`;
    } else {
      return path;
    }
  }

  // 从URL参数初始化
  useEffect(() => {
    const urlThemeId = searchParams.get('theme_id');
    if (urlThemeId) {
      setThemeId(urlThemeId);
    } else {
      setThemeId('all'); // 默认为全部大主题
    }
  }, [searchParams]);

  // 检查体裁与等级的匹配
  useEffect(() => {
    if (level !== 'all') {
      const availableGenres = getAvailableGenres(level);
      if (!availableGenres.includes(genre)) {
        // 如果当前体裁不可用，自动选择第一个可用的体裁
        setGenre(availableGenres[0]);
      }
    }
  }, [level, genre]);

  // 加载主题列表
  async function loadThemes() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const qs = new URLSearchParams();
      if (lang !== 'all') qs.set('lang', lang);
      if (level !== 'all') qs.set('level', level.toString());
      if (genre !== 'all') qs.set('genre', genre);
      const r = await fetch(`/api/admin/shadowing/themes?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const qs = new URLSearchParams({ 
        limit: pagination.limit.toString(),
        page: pagination.page.toString()
      });
      if (lang !== 'all') qs.set('lang', lang);
      if (level !== 'all') qs.set('level', String(level));
      if (genre !== 'all') qs.set('genre', genre);
      if (themeId && themeId !== 'all') qs.set('theme_id', themeId);
      if (hasArticle !== 'all') qs.set('has_article', hasArticle);
      if (q) qs.set('q', q);
      
      const r = await fetch(`/api/admin/shadowing/subtopics?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const responseText = await r.text();
      if (r.ok) {
        try {
          const j = JSON.parse(responseText);
          setItems(j.items || []);
          setSelected({});
          setPagination(prev => ({
            ...prev,
            total: j.total || 0,
            totalPages: j.totalPages || 0
          }));
        } catch (jsonError) {
          console.error('Parse subtopics response failed:', responseText);
        }
      } else {
        console.error('Load subtopics failed:', responseText);
      }
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThemes();
  }, [lang, level, genre, hasArticle]);

  useEffect(() => {
    loadSubtopics();
  }, [lang, level, genre, themeId, hasArticle, q, pagination.page, pagination.limit]);

  // 处理任务队列 - 手动控制启动
  useEffect(() => {
    const processQueue = async () => {
      if (queuePaused || !autoStart) return; // 如果队列暂停或未开启自动启动，不处理新任务
      
      const pendingTasks = taskQueue.filter(t => t.status === 'pending' && !startingTasks.has(t.id));
      const canStart = Math.min(pendingTasks.length, maxConcurrent - runningTasks);

      console.log(`[AutoQueue] Processing: ${canStart} tasks can start (${pendingTasks.length} pending, ${runningTasks} running, ${startingTasks.size} starting, max: ${maxConcurrent})`);

      if (canStart > 0) {
        // 延迟一点时间再处理，避免状态更新冲突
        const timer = setTimeout(() => {
          for (let i = 0; i < canStart; i++) {
            const task = pendingTasks[i];
            console.log(`[AutoQueue] Starting task: ${task.id}`);
            executeTask(task.id);
          }
        }, 100);
        
        return () => clearTimeout(timer);
      }
    };

    processQueue();
  }, [runningTasks, queuePaused, autoStart, maxConcurrent, startingTasks]); // 移除taskQueue依赖

  // 加载模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (provider === 'openrouter') {
          const r = await fetch(`/api/admin/providers/models?provider=${provider}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          const j = await r.json();
          if (r.ok && Array.isArray(j.models)) {
            const sortedModels = [...j.models].sort((a: any, b: any) => 
              String(a.name || a.id).localeCompare(String(b.name || b.id))
            );
            setModels(sortedModels);
            setModel(sortedModels[0]?.id || '');
          } else {
            setModels([]);
            setModel('');
          }
        } else if (provider === 'deepseek') {
          const staticModels = [
            { id: 'deepseek-chat', name: 'deepseek-chat' },
            { id: 'deepseek-reasoner', name: 'deepseek-reasoner' }
          ];
          setModels(staticModels);
          setModel(staticModels[0].id);
        } else if (provider === 'openai') {
          const staticModels = [
            { id: 'gpt-4o', name: 'gpt-4o' },
            { id: 'gpt-4o-mini', name: 'gpt-4o-mini' }
          ];
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
    items.forEach(it => m[it.id] = v);
    setSelected(m);
  }

  function toggleOne(id: string) {
    setSelected(s => ({ ...s, [id]: !s[id] }));
  }

  function openNew() {
    if (!themeId || themeId === 'all') {
      alert('请先选择具体的大主题（不能选择"全部大主题"）');
      return;
    }
    const theme = themes.find(t => t.id === themeId);
    setEditing({ 
      id: undefined, 
      theme_id: themeId,
      lang: lang === 'all' ? 'ja' : lang, 
      level: level === 'all' ? 3 : level, 
      genre: genre === 'all' ? 'monologue' : genre, 
      title_cn: '', 
      seed_en: '',
      one_line_cn: '',
      tags: [],
      status: 'active' 
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
    if (!editing?.title_cn?.trim()) {
      alert('请填写小主题标题');
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: 'upsert', item: editing })
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
    const dirtyItems = items.filter(item => item._dirty);
    if (!dirtyItems.length) {
      alert('没有需要保存的修改');
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: 'upsert', items: dirtyItems })
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
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (!ids.length) {
      alert('未选择');
      return;
    }
    if (!confirm(`确认归档 ${ids.length} 个小主题？`)) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: 'archive', items: ids.map(id => ({ id })) })
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
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (!ids.length) {
      alert('未选择');
      return;
    }
    if (!confirm(`⚠️永久删除 ${ids.length} 个小主题？`)) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: 'delete', items: ids.map(id => ({ id })) })
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
    setItems(items => items.map(item => 
      item.id === id ? { ...item, [field]: value, _dirty: true } : item
    ));
  }

  async function startGeneration() {
    const selectedIds = Object.keys(selected).filter(id => selected[id]);
    if (!selectedIds.length) {
      alert('请先选择要生成的小主题');
      return;
    }

    setGenerating(true);
    setProgress({ done: 0, total: selectedIds.length, saved: 0, errors: 0, tokens: 0 });
    setLogs([]);

    // 创建超时控制器
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const timeoutId = setTimeout(() => {
      abortController.abort();
      setLogs(prev => [...prev, {
        type: 'error',
        message: '请求超时，请检查网络连接或重试'
      }]);
      setGenerating(false);
    }, 300000); // 5分钟超时

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/api/admin/shadowing/generate-from-subtopics/stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          subtopic_ids: selectedIds,
          lang: lang === 'all' ? 'ja' : lang,
          level: level === 'all' ? 3 : level,
          genre: genre === 'all' ? 'monologue' : genre,
          concurrency,
          provider,
          model,
          temperature
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                setProgress(prev => ({ ...prev, total: data.total }));
              } else if (data.type === 'progress') {
                setProgress(prev => ({
                  done: data.done,
                  total: data.total,
                  saved: data.saved,
                  errors: data.errors,
                  tokens: data.tokens
                }));
                setLogs(prev => [...prev, {
                  id: data.id,
                  title: data.title,
                  type: 'success',
                  message: `已生成并保存`
                }]);
              } else if (data.type === 'skip') {
                setLogs(prev => [...prev, {
                  id: data.id,
                  title: data.title,
                  type: 'skip',
                  message: data.reason
                }]);
              } else if (data.type === 'error') {
                setLogs(prev => [...prev, {
                  id: data.id,
                  title: data.title,
                  type: 'error',
                  message: data.error
                }]);
              } else if (data.type === 'complete') {
                setLogs(prev => [...prev, {
                  type: 'complete',
                  message: `生成完成！共生成 ${data.saved} 个，错误 ${data.errors} 个，消耗 ${data.tokens} tokens`
                }]);
              }
            } catch (e) {
              console.error('Parse SSE data failed:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setLogs(prev => [...prev, {
          type: 'error',
          message: '生成被用户取消或超时'
        }]);
      } else {
        setLogs(prev => [...prev, {
          type: 'error',
          message: `生成失败：${error instanceof Error ? error.message : String(error)}`
        }]);
      }
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setGenerating(false);
    }
  }

  function stopGeneration() {
    setGenerating(false);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLogs(prev => [...prev, {
      type: 'error',
      message: '生成已被用户停止'
    }]);
  }

  // 添加任务到队列 - 每个小主题作为独立任务
  function addTasksToQueue(subtopicIds: string[], params: any) {
    // 过滤掉已经在队列中的小主题
    const existingSubtopicIds = new Set(
      taskQueue.map(t => t.params.subtopic_id).filter(Boolean)
    );
    
    const newSubtopicIds = subtopicIds.filter(id => !existingSubtopicIds.has(id));
    
    if (newSubtopicIds.length === 0) {
      console.log('[AddTasks] All subtopics already in queue, skipping');
      return [];
    }
    
    console.log(`[AddTasks] Adding ${newSubtopicIds.length} new tasks (${subtopicIds.length - newSubtopicIds.length} already in queue)`);
    
    const tasks = newSubtopicIds.map(subtopicId => {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // 从当前items中找到对应的小主题标题
      const subtopic = items.find(item => item.id === subtopicId);
      const title = subtopic ? subtopic.title_cn : `小主题 ${subtopicId}`;
      
      return {
        id: taskId,
        type: 'shadowing_generation' as const,
        status: 'pending' as const,
        progress: 0,
        title: `生成: ${title}`,
        params: {
          ...params,
          subtopic_id: subtopicId
        },
        createdAt: new Date()
      };
    });
    
    setTaskQueue(prev => [...prev, ...tasks]);
    return tasks.map(t => t.id);
  }

  // 执行任务 - 处理单个小主题
  async function executeTask(taskId: string) {
    const task = taskQueue.find(t => t.id === taskId);
    if (!task) return;

    // 检查任务是否已经在启动中或运行中
    if (task.status !== 'pending' || startingTasks.has(taskId)) {
      console.log(`[ExecuteTask] Task ${taskId} is not pending or already starting, skipping`);
      return;
    }

    // 检查是否有相同subtopic_id的任务正在执行
    const sameSubtopicRunning = taskQueue.some(t => 
      t.params.subtopic_id === task.params.subtopic_id && 
      (t.status === 'running' || startingTasks.has(t.id))
    );
    
    if (sameSubtopicRunning) {
      console.log(`[ExecuteTask] Task ${taskId} for subtopic ${task.params.subtopic_id} is already running, skipping`);
      return;
    }

    // 标记任务为启动中
    setStartingTasks(prev => new Set(prev).add(taskId));

    // 创建 AbortController
    const abortController = new AbortController();

    // 更新任务状态为运行中
    setTaskQueue(prev => prev.map(t => 
      t.id === taskId 
        ? { 
            ...t, 
            status: 'running', 
            startedAt: new Date(), 
            progress: 10,
            abortController
          }
        : t
    ));
    setRunningTasks(prev => prev + 1);

    try {
      // 获取任务在队列中的索引，用于选择域名
      const taskIndex = taskQueue.findIndex(t => t.id === taskId);
      const apiUrl = getApiUrl('/api/admin/shadowing/generate-single', taskIndex);
      
      console.log(`[ExecuteTask] Using API URL: ${apiUrl} for task ${taskId}`);
      
      // 调用单个小主题生成API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({
          subtopic_id: task.params.subtopic_id,
          lang: task.params.lang,
          level: task.params.level,
          genre: task.params.genre,
          provider: task.params.provider,
          model: task.params.model,
          temperature: task.params.temperature
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      // 更新进度
      setTaskQueue(prev => prev.map(t => 
        t.id === taskId ? { ...t, progress: 50 } : t
      ));

      // 更新任务状态为完成
      setTaskQueue(prev => prev.map(t => 
        t.id === taskId 
          ? { 
              ...t, 
              status: 'completed', 
              progress: 100, 
              result,
              completedAt: new Date(),
              abortController: undefined
            }
          : t
      ));

      // 更新执行进度
      setExecutionProgress(prev => ({
        ...prev,
        current: prev.current + 1,
        completed: prev.completed + 1
      }));

      // 重新加载数据
      await loadSubtopics();

    } catch (error) {
      // 检查是否是被取消的任务
      if (error instanceof Error && error.name === 'AbortError') {
        setTaskQueue(prev => prev.map(t => 
          t.id === taskId 
            ? { 
                ...t, 
                status: 'cancelled', 
                completedAt: new Date(),
                abortController: undefined
              }
            : t
        ));

        // 更新执行进度
        setExecutionProgress(prev => ({
          ...prev,
          current: prev.current + 1
        }));
      } else {
        // 更新任务状态为失败
        setTaskQueue(prev => prev.map(t => 
          t.id === taskId 
            ? { 
                ...t, 
                status: 'failed', 
                error: error instanceof Error ? error.message : String(error),
                completedAt: new Date(),
                abortController: undefined
              }
            : t
        ));

        // 更新执行进度
        setExecutionProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          failed: prev.failed + 1
        }));
      }
    } finally {
      setRunningTasks(prev => prev - 1);
      // 清理启动中标记
      setStartingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  }

  // 任务控制函数
  function pauseTask(taskId: string) {
    const task = taskQueue.find(t => t.id === taskId);
    if (!task || task.status !== 'running') return;

    // 取消正在进行的请求
    if (task.abortController) {
      task.abortController.abort();
    }

    // 更新任务状态为暂停
    setTaskQueue(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'paused', pausedAt: new Date(), abortController: undefined }
        : t
    ));
    setRunningTasks(prev => prev - 1);
  }

  function resumeTask(taskId: string) {
    const task = taskQueue.find(t => t.id === taskId);
    if (!task || task.status !== 'paused') return;

    // 更新任务状态为等待中，让队列处理
    setTaskQueue(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'pending', pausedAt: undefined }
        : t
    ));
  }

  function cancelTask(taskId: string) {
    const task = taskQueue.find(t => t.id === taskId);
    if (!task) return;

    // 如果任务正在运行，取消请求
    if (task.status === 'running' && task.abortController) {
      task.abortController.abort();
    }

    // 更新任务状态为已取消
    setTaskQueue(prev => prev.map(t => 
      t.id === taskId 
        ? { 
            ...t, 
            status: 'cancelled', 
            completedAt: new Date(),
            abortController: undefined
          }
        : t
    ));

    if (task.status === 'running') {
      setRunningTasks(prev => prev - 1);
    }
  }

  function pauseAllTasks() {
    setQueuePaused(true);
    // 暂停所有运行中的任务
    taskQueue.forEach(task => {
      if (task.status === 'running') {
        pauseTask(task.id);
      }
    });
  }

  function resumeAllTasks() {
    setQueuePaused(false);
    // 恢复所有暂停的任务
    taskQueue.forEach(task => {
      if (task.status === 'paused') {
        resumeTask(task.id);
      }
    });
  }

  function cancelAllTasks() {
    // 取消所有未完成的任务
    taskQueue.forEach(task => {
      if (['pending', 'running', 'paused'].includes(task.status)) {
        cancelTask(task.id);
      }
    });
  }

  function startAllPendingTasks() {
    const pendingTasks = taskQueue.filter(t => t.status === 'pending' && !startingTasks.has(t.id));
    const canStart = Math.min(pendingTasks.length, maxConcurrent - runningTasks);

    console.log(`[StartAll] Pending tasks: ${pendingTasks.length}, Running: ${runningTasks}, Starting: ${startingTasks.size}, Max concurrent: ${maxConcurrent}, Can start: ${canStart}`);

    for (let i = 0; i < canStart; i++) {
      const task = pendingTasks[i];
      console.log(`[StartAll] Starting task: ${task.id}`);
      executeTask(task.id);
    }
  }

  function startTask(taskId: string) {
    const task = taskQueue.find(t => t.id === taskId);
    if (!task || task.status !== 'pending') return;

    executeTask(taskId);
  }

  // 清理重复任务
  function cleanupDuplicateTasks() {
    const seenSubtopicIds = new Set<string>();
    const uniqueTasks: any[] = [];
    const duplicates: string[] = [];
    
    taskQueue.forEach(task => {
      const subtopicId = task.params.subtopic_id;
      if (seenSubtopicIds.has(subtopicId)) {
        duplicates.push(task.id);
      } else {
        seenSubtopicIds.add(subtopicId);
        uniqueTasks.push(task);
      }
    });
    
    if (duplicates.length > 0) {
      console.log(`[Cleanup] Removing ${duplicates.length} duplicate tasks`);
      setTaskQueue(uniqueTasks);
    }
    
    return duplicates.length;
  }

  // 创建生成任务 - 为每个小主题创建独立任务
  function createTask() {
    const selectedIds = Object.keys(selected).filter(id => selected[id]);
    if (!selectedIds.length) {
      alert('请先选择要生成的小主题');
      return;
    }

    // 先清理重复任务
    const removedDuplicates = cleanupDuplicateTasks();
    if (removedDuplicates > 0) {
      console.log(`[CreateTask] Cleaned up ${removedDuplicates} duplicate tasks`);
    }

    const taskIds = addTasksToQueue(selectedIds, {
      lang: lang === 'all' ? 'ja' : lang,
      level: level === 'all' ? 3 : level,
      genre: genre === 'all' ? 'monologue' : genre,
      provider,
      model,
      temperature
    });

    // 重新计算执行进度
    const totalTasks = taskQueue.length + taskIds.length;
    const completedTasks = taskQueue.filter(t => t.status === 'completed').length;
    const failedTasks = taskQueue.filter(t => t.status === 'failed').length;
    
    setExecutionProgress({
      current: completedTasks + failedTasks,
      total: totalTasks,
      completed: completedTasks,
      failed: failedTasks
    });

    if (taskIds.length > 0) {
      alert(`已为 ${taskIds.length} 个小主题创建独立任务${removedDuplicates > 0 ? `，并清理了 ${removedDuplicates} 个重复任务` : ''}`);
    } else {
      alert('所有选中的小主题都已在队列中');
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const dirtyCount = items.filter(item => item._dirty).length;
  
  // 任务分页计算
  const filteredTasks = taskStatusFilter === 'all' 
    ? taskQueue 
    : taskQueue.filter(task => task.status === taskStatusFilter);
  const totalTasks = filteredTasks.length;
  const totalTaskPages = Math.ceil(totalTasks / taskPageSize);
  const startTaskIndex = (taskPage - 1) * taskPageSize;
  const endTaskIndex = startTaskIndex + taskPageSize;
  const currentTasks = filteredTasks.slice(startTaskIndex, endTaskIndex);
  
  // 自动翻页：当前页的任务都完成后自动翻到下一页
  useEffect(() => {
    if (totalTaskPages > 1 && currentTasks.length > 0) {
      const allCurrentTasksCompleted = currentTasks.every(task => 
        ['completed', 'failed', 'cancelled'].includes(task.status)
      );
      
      if (allCurrentTasksCompleted && taskPage < totalTaskPages) {
        console.log(`[AutoPage] All tasks on page ${taskPage} completed, moving to page ${taskPage + 1}`);
        setTaskPage(prev => prev + 1);
      }
    }
  }, [currentTasks, taskPage, totalTaskPages]);
  
  // 任务状态统计
  const taskStats = {
    pending: taskQueue.filter(t => t.status === 'pending').length,
    running: taskQueue.filter(t => t.status === 'running').length,
    paused: taskQueue.filter(t => t.status === 'paused').length,
    completed: taskQueue.filter(t => t.status === 'completed').length,
    failed: taskQueue.filter(t => t.status === 'failed').length,
    cancelled: taskQueue.filter(t => t.status === 'cancelled').length
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Shadowing 小主题批量生成</h1>
          {taskQueue.length > 0 && (
            <div className="mt-2 flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                执行进度: {executionProgress.current}/{executionProgress.total} 
                (完成: {executionProgress.completed}, 失败: {executionProgress.failed})
                {executionProgress.current < executionProgress.total && runningTasks > 0 && (
                  <span className="text-blue-600 ml-2">⏳ 执行中...</span>
                )}
                {executionProgress.current < executionProgress.total && runningTasks === 0 && (
                  <span className="text-orange-600 ml-2">⏸️ 等待开始</span>
                )}
                {executionProgress.current === executionProgress.total && (
                  <span className="text-green-600 ml-2">✅ 全部完成</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={loadSubtopics} variant="outline">
            刷新
          </Button>
          <Button onClick={openNew} disabled={!themeId || themeId === 'all'}>
            <Plus className="w-4 h-4 mr-2" />
            新建小主题
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <Label>语言</Label>
              <Select value={lang} onValueChange={(v: Lang) => setLang(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANG_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>等级</Label>
              <Select value={String(level)} onValueChange={(v) => {
                if (v === 'all') {
                  setLevel('all');
                } else {
                  const newLevel = parseInt(v) as 1|2|3|4|5|6;
                  setLevel(newLevel);
                  
                  // 检查当前体裁是否在新等级中可用
                  const availableGenres = getAvailableGenres(newLevel);
                  if (!availableGenres.includes(genre)) {
                    // 如果当前体裁不可用，自动选择第一个可用的体裁
                    setGenre(availableGenres[0]);
                  }
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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
                  {GENRE_OPTIONS
                    .filter(opt => getAvailableGenres(level).includes(opt.value as Genre))
                    .map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                {level !== 'all' ? (
                  <>
                    <p>
                      <strong>等级 L{level}</strong> 可用体裁: {getAvailableGenres(level).filter(g => g !== 'all').map(g => 
                        GENRE_OPTIONS.find(opt => opt.value === g)?.label
                      ).join('、')}
                    </p>
                    <p>
                      体裁优先: {LEVEL_CONFIG[level]?.genrePriority}
                    </p>
                    <p>
                      主题带宽: {LEVEL_CONFIG[level]?.themeBandwidth}
                    </p>
                    <p>
                      长度目标: {lang === 'en' ? 'EN' : lang === 'ja' ? 'JA' : 'ZH'} {getLengthTarget(level, lang).min}-{getLengthTarget(level, lang).max} {lang === 'en' ? '词' : '字'}
                    </p>
                    <p>
                      句子数: {getSentenceRange(level).min}-{getSentenceRange(level).max} | 句长上限: {getMaxSentenceLength(level, lang)} {lang === 'en' ? '词' : '字'}
                    </p>
                  </>
                ) : (
                  <p>选择"全部等级"时，所有体裁都可用</p>
                )}
              </div>
            </div>
            
            <div>
              <Label>文章状态</Label>
              <Select value={hasArticle} onValueChange={(v) => setHasArticle(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAS_ARTICLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>大主题</Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择大主题" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部大主题</SelectItem>
                  {themes.map(theme => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>搜索</Label>
              <Input
                placeholder="搜索小主题..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            
            <div>
              <Label>每页显示</Label>
              <Select 
                value={pagination.limit.toString()} 
                onValueChange={(value) => setPagination(prev => ({ ...prev, limit: parseInt(value), page: 1 }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 个</SelectItem>
                  <SelectItem value="100">100 个</SelectItem>
                  <SelectItem value="200">200 个</SelectItem>
                  <SelectItem value="500">500 个</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 执行进度 */}
      {executionProgress.total > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>执行进度</CardTitle>
            <p className="text-sm text-muted-foreground">
              任务已添加到队列，需要手动开始执行。可以随时暂停或继续。
            </p>
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded mt-2">
              <strong>多域名并发优化：</strong>
              使用多域名方案突破浏览器并发限制。当前配置支持最多36个并发连接（6个域名 × 6个连接/域名）。
              {isLocalDev ? (
                ' 本地开发需要配置hosts文件：127.0.0.1 api1.localhost 到 api5.localhost'
              ) : (
                ' 生产环境需要配置子域名：api1.yourdomain.com 到 api5.yourdomain.com'
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  进度: {executionProgress.current}/{executionProgress.total} 
                  (完成: {executionProgress.completed}, 失败: {executionProgress.failed})
                </div>
                <div className="flex items-center gap-2">
                  <Label>最大并发数:</Label>
                  <Input
                    type="number"
                    min="1"
                    max="36"
                    value={maxConcurrent}
                    onChange={(e) => setMaxConcurrent(parseInt(e.target.value) || 30)}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">
                    (6个域名 × 6个连接 = 36个并发)
                  </span>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(executionProgress.current / executionProgress.total) * 100}%` }}
                />
              </div>
              
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoStartControl"
                    checked={autoStart}
                    onChange={(e) => setAutoStart(e.target.checked)}
                  />
                  <Label htmlFor="autoStartControl" className="text-sm">
                    自动开始 (开启后任务会自动执行)
                  </Label>
                </div>
                
                <Button
                  onClick={cleanupDuplicateTasks}
                  size="sm"
                  variant="outline"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <X className="w-4 h-4 mr-1" />
                  清理重复任务
                </Button>
                
                {!autoStart && executionProgress.current < executionProgress.total && (
                  <Button
                    onClick={startAllPendingTasks}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={taskStats.pending === 0}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    开始执行 ({taskStats.pending} 个等待中)
                  </Button>
                )}
                
                {runningTasks > 0 && (
                  <Button
                    onClick={() => setQueuePaused(!queuePaused)}
                    size="sm"
                    variant="outline"
                    className={queuePaused ? "bg-green-600 text-white" : "bg-yellow-600 text-white"}
                  >
                    {queuePaused ? (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        继续执行
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 mr-1" />
                        暂停执行
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {executionProgress.current === executionProgress.total && (
                <div className="text-center text-green-600 font-medium">
                  ✅ 所有任务已完成！
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 批量操作 */}
      {(selectedCount > 0 || dirtyCount > 0) && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              {selectedCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedCount} 个小主题
                </span>
              )}
              {dirtyCount > 0 && (
                <span className="text-sm text-orange-600">
                  有 {dirtyCount} 个修改待保存
                </span>
              )}
              {dirtyCount > 0 && (
                <Button onClick={saveAll} variant="outline" size="sm">
                  保存修改
                </Button>
              )}
              {selectedCount > 0 && (
                <>
                  <Button onClick={archiveSelected} variant="outline" size="sm">
                    <Archive className="w-4 h-4 mr-2" />
                    归档
                  </Button>
                  <Button onClick={deleteSelected} variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 小主题列表 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>小主题列表 ({pagination.total} 个，当前页 {items.length} 个)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="p-4 text-left">
                        <Checkbox
                          checked={items.length > 0 && items.every(item => selected[item.id])}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="p-4 text-left">小主题</th>
                      <th className="p-4 text-left">关键词</th>
                      <th className="p-4 text-left">说明</th>
                      <th className="p-4 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          加载中...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      items.map(item => (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="p-4">
                            <Checkbox
                              checked={selected[item.id] || false}
                              onCheckedChange={() => toggleOne(item.id)}
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-medium">{item.title_cn}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.theme?.title || '未知主题'}
                            </div>
                          </td>
                          <td className="p-4">
                            <Input
                              value={item.seed_en || ''}
                              onChange={(e) => updateItem(item.id, 'seed_en', e.target.value)}
                              placeholder="英文关键词"
                              className="w-32"
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              value={item.one_line_cn || ''}
                              onChange={(e) => updateItem(item.id, 'one_line_cn', e.target.value)}
                              placeholder="一句话说明"
                              className="w-48"
                            />
                          </td>
                          <td className="p-4">
                            <Button
                              onClick={() => openEdit(item)}
                              variant="ghost"
                              size="sm"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
            
            {/* 分页控制 */}
            {pagination.totalPages > 1 && (
              <div className="p-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    第 {pagination.page} 页，共 {pagination.totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page <= 1}
                    >
                      上一页
                    </Button>
                    <span className="text-sm">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* 生成面板 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>批量生成</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Provider</Label>
                <Select value={provider} onValueChange={(value) => setProvider(value as "openrouter" | "deepseek" | "openai")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>温度: {temperature}</Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <Label>并发数: {concurrency}</Label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div className="pt-4">
                <div className="text-sm text-muted-foreground mb-2">
                  已选择 {selectedCount} 个小主题
                </div>
                
                <div className="mb-4">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useTaskQueue}
                      onChange={(e) => setUseTaskQueue(e.target.checked)}
                    />
                    使用任务队列（推荐）
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    任务队列可以处理大量任务，支持并发控制，不会阻塞页面
                  </p>
                </div>
                
                {useTaskQueue ? (
                  <Button 
                    onClick={createTask} 
                    disabled={selectedCount === 0}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    创建生成任务
                  </Button>
                ) : generating ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button onClick={stopGeneration} variant="destructive" size="sm">
                        <Pause className="w-4 h-4 mr-2" />
                        停止
                      </Button>
                      <span className="text-sm">生成中...</span>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>进度</span>
                        <span>{progress.done}/{progress.total}</span>
                      </div>
                      <Progress value={(progress.done / progress.total) * 100} />
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div>已保存: {progress.saved}</div>
                      <div>错误: {progress.errors}</div>
                      <div>Tokens: {progress.tokens}</div>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={startGeneration} 
                    disabled={selectedCount === 0}
                    className="w-full"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    开始生成
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 生成日志 */}
          {logs.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>生成日志</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        {log.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />}
                        {log.type === 'error' && <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                        {log.type === 'skip' && <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                        <div>
                          {log.title && <div className="font-medium">{log.title}</div>}
                          <div className="text-muted-foreground">{log.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>


      {/* 编辑对话框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent aria-describedby="subtopic-dialog-description">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? '编辑小主题' : '新建小主题'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>小主题标题 *</Label>
              <Input
                value={editing?.title_cn || ''}
                onChange={(e) => setEditing({...editing, title_cn: e.target.value})}
                placeholder="请输入小主题标题"
              />
            </div>
            
            <div>
              <Label>英文关键词</Label>
              <Input
                value={editing?.seed_en || ''}
                onChange={(e) => setEditing({...editing, seed_en: e.target.value})}
                placeholder="用于生成锚点的英文关键词"
              />
            </div>
            
            <div>
              <Label>一句话说明</Label>
              <Textarea
                value={editing?.one_line_cn || ''}
                onChange={(e) => setEditing({...editing, one_line_cn: e.target.value})}
                placeholder="一句话描述这个小主题的意图"
                rows={2}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button onClick={closeModal} variant="outline">
                取消
              </Button>
              <Button onClick={saveOne}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
