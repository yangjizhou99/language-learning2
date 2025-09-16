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

const PROVIDER_OPTIONS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'deepseek', label: 'DeepSeek' }
];

const QUICK_CONFIGS = [
  {
    name: 'L1对话',
    lang: 'ja',
    level: 1,
    genre: 'dialogue',
    provider: 'openrouter',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    genrePriority: 'dialogue/monologue',
    themeBandwidth: '日常任务：购物、预约、住户问题、课程安排',
    lengthTarget: { en: { min: 90, max: 120 }, ja: { min: 260, max: 360 }, zh: { min: 240, max: 320 } },
    sentenceRange: { min: 7, max: 9 },
    maxSentenceLength: { en: 16, ja: 45, zh: 45 }
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
    lengthTarget: { en: { min: 120, max: 160 }, ja: { min: 360, max: 480 }, zh: { min: 320, max: 420 } },
    sentenceRange: { min: 8, max: 10 },
    maxSentenceLength: { en: 20, ja: 55, zh: 55 }
  }
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
  const [themeId, setThemeId] = useState<string>('all');
  const [hasArticle, setHasArticle] = useState<string>('all');
  const [q, setQ] = useState('');
  
  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, saved: 0, errors: 0, tokens: 0 });
  const [logs, setLogs] = useState<Array<{type: 'info'|'success'|'error', message: string}>>([]);
  
  // AI配置
  const [provider, setProvider] = useState('deepseek');
  const [models, setModels] = useState<{id: string; name: string}[]>([]);
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0.7);
  const [concurrency, setConcurrency] = useState(6);
  
  // 并发控制
  const [maxConcurrent, setMaxConcurrent] = useState(6); // 后端并发处理，默认使用推荐值
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取认证头信息
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const qs = new URLSearchParams();
      if (lang !== 'all') qs.set('lang', lang);
      if (level !== 'all') qs.set('level', level);
      if (genre !== 'all') qs.set('genre', genre);
      if (hasArticle !== 'all') qs.set('has_article', hasArticle);
      
      const r = await fetch(`/api/admin/shadowing/themes?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const responseText = await r.text();
      if (r.ok) {
        try {
          const j = JSON.parse(responseText);
          setThemes(j.themes || []);
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
            { id: 'deepseek-reasoner', name: 'deepseek-reasoner' }
          ];
          setModels(staticModels);
          setModel(staticModels[0].id);
        } else {
          const staticModels = [
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

  async function saveItem() {
    if (!editing) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/subtopics', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(editing)
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

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 显示开始进度
      setProgress(prev => ({ ...prev, done: 0, total: selectedIds.length }));
      setLogs([{
        type: 'info',
        message: `开始批量生成 ${selectedIds.length} 个小主题...`
      }]);

      // 调试信息
      console.log('Generation parameters:', {
        selectedIds,
        lang: lang === 'all' ? 'all' : lang,
        level: level === 'all' ? 'all' : level,
        genre: genre === 'all' ? 'all' : genre
      });

      // 模拟进度更新
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev.done < prev.total) {
            return { ...prev, done: Math.min(prev.done + 1, prev.total) };
          }
          return prev;
        });
      }, 1000);

      const response = await fetch('/api/admin/shadowing/generate-batch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          subtopic_ids: selectedIds,
          lang: lang === 'all' ? 'all' : lang,
          level: level === 'all' ? 'all' : level,
          genre: genre === 'all' ? 'all' : genre,
          provider,
          model,
          temperature,
          concurrency: maxConcurrent
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // 清理进度定时器
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // 显示处理中进度
      setProgress(prev => ({ ...prev, done: selectedIds.length }));
      setLogs(prev => [...prev, {
        type: 'info',
        message: '正在处理生成结果...'
      }]);

      const result = await response.json();
      
      setProgress({
        done: result.total,
        total: result.total,
        saved: result.success_count,
        errors: result.error_count,
        tokens: 0
      });

      setLogs(prev => [...prev, {
        type: 'success',
        message: `批量生成完成：成功 ${result.success_count}，跳过 ${result.skipped_count}，失败 ${result.error_count}`
      }]);

      // 重新加载数据
      loadSubtopics();

    } catch (error: any) {
      console.error('Batch generation error:', error);
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setLogs([{
        type: 'error',
        message: `批量生成失败：${error.message}`
      }]);
    } finally {
      setGenerating(false);
      clearTimeout(timeoutId);
    }
  }

  function stopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setGenerating(false);
  }

  function applyQuickConfig(config: any) {
    setLang(config.lang);
    setLevel(String(config.level));
    setGenre(config.genre);
    setProvider(config.provider);
    setModel(config.model);
    setTemperature(config.temperature);
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const dirtyCount = items.filter(item => item._dirty).length;
  
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
                  {LANG_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                  {LEVEL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                  {GENRE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>大主题</Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部大主题</SelectItem>
                  {themes.map(theme => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.title_cn} ({theme.subtopic_count})
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
                  {HAS_ARTICLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                    <div key={index} className={`text-sm ${
                      log.type === 'error' ? 'text-red-600' : 
                      log.type === 'success' ? 'text-green-600' : 
                      'text-gray-600'
                    }`}>
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
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Checkbox 
                checked={selectedCount === items.length && items.length > 0}
                onCheckedChange={(checked) => toggleAll(checked as boolean)}
              />
              <span className="text-sm">
                全选 ({selectedCount}/{items.length})
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={startGeneration} 
                disabled={generating || selectedCount === 0}
                size="sm"
              >
                <Play className="w-4 h-4 mr-1" />
                批量生成 ({selectedCount})
              </Button>
              <Button 
                onClick={archiveSelected} 
                disabled={selectedCount === 0}
                size="sm"
                variant="outline"
              >
                <Archive className="w-4 h-4 mr-1" />
                归档选中
              </Button>
              <Button 
                onClick={deleteSelected} 
                disabled={selectedCount === 0}
                size="sm"
                variant="destructive"
              >
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
                  {PROVIDER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                  {models.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
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
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                  <Checkbox 
                    checked={selected[item.id] || false}
                    onCheckedChange={() => toggleOne(item.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.title_cn}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.seed_en} • {item.one_line_cn}
                    </div>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline">{item.lang}</Badge>
                      <Badge variant="outline">L{item.level}</Badge>
                      <Badge variant="outline">{item.genre}</Badge>
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
              <div className="text-sm text-muted-foreground">
                共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">每页显示:</span>
                <Select
                  value={pagination.limit.toString()}
                  onValueChange={(value) => {
                    setPagination(prev => ({
                      ...prev,
                      limit: parseInt(value),
                      page: 1 // 重置到第一页
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
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  上一页
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
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
                  <Select value={editing.lang} onValueChange={(v) => setEditing({...editing, lang: v})}>
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
                  <Select value={String(editing.level)} onValueChange={(v) => setEditing({...editing, level: parseInt(v)})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6].map(level => (
                        <SelectItem key={level} value={String(level)}>L{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>体裁</Label>
                <Select value={editing.genre} onValueChange={(v) => setEditing({...editing, genre: v})}>
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
              <div>
                <Label>中文标题</Label>
                <Input 
                  value={editing.title_cn} 
                  onChange={(e) => setEditing({...editing, title_cn: e.target.value})}
                />
              </div>
              <div>
                <Label>英文种子</Label>
                <Input 
                  value={editing.seed_en} 
                  onChange={(e) => setEditing({...editing, seed_en: e.target.value})}
                />
              </div>
              <div>
                <Label>一句话描述</Label>
                <Textarea 
                  value={editing.one_line_cn} 
                  onChange={(e) => setEditing({...editing, one_line_cn: e.target.value})}
                />
              </div>
              <div>
                <Label>标签 (用逗号分隔)</Label>
                <Input 
                  value={editing.tags?.join(', ') || ''} 
                  onChange={(e) => setEditing({...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeModal}>取消</Button>
                <Button onClick={saveItem}>保存</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}