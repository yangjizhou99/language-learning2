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
import { Plus, Edit, Archive, Trash2, Download, Upload, Play, Pause, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type Lang = 'en'|'ja'|'zh';
type Genre = 'dialogue'|'monologue'|'news'|'lecture';

const LANG_OPTIONS = [
  { value: 'ja', label: '日语' },
  { value: 'en', label: '英语' },
  { value: 'zh', label: '中文' }
];

const LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6];

const GENRE_OPTIONS = [
  { value: 'dialogue', label: '对话' },
  { value: 'monologue', label: '独白' },
  { value: 'news', label: '新闻' },
  { value: 'lecture', label: '讲座' }
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
const getAvailableGenres = (level: number): Genre[] => {
  return LEVEL_GENRE_RESTRICTIONS[level] || [];
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
  const [lang, setLang] = useState<Lang>('ja');
  const [level, setLevel] = useState<1|2|3|4|5|6>(3);
  const [genre, setGenre] = useState<Genre>('monologue');
  const [themeId, setThemeId] = useState<string>('');
  const [q, setQ] = useState('');
  
  const [themes, setThemes] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  
  // 生成相关状态
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, saved: 0, errors: 0, tokens: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [provider, setProvider] = useState<'openrouter' | 'deepseek' | 'openai'>('openrouter');
  const [models, setModels] = useState<{id: string; name: string}[]>([]);
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [concurrency, setConcurrency] = useState(4);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  // 从URL参数初始化
  useEffect(() => {
    const urlThemeId = searchParams.get('theme_id');
    if (urlThemeId) {
      setThemeId(urlThemeId);
    }
  }, [searchParams]);

  // 检查体裁与等级的匹配
  useEffect(() => {
    const availableGenres = getAvailableGenres(level);
    if (!availableGenres.includes(genre)) {
      // 如果当前体裁不可用，自动选择第一个可用的体裁
      setGenre(availableGenres[0]);
    }
  }, [level, genre]);

  // 加载主题列表
  async function loadThemes() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const qs = new URLSearchParams({ lang, level, genre });
      const r = await fetch(`/api/admin/shadowing/themes?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const j = await r.json();
      if (r.ok) {
        setThemes(j.items || []);
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
        lang, 
        level: String(level), 
        genre,
        limit: '100'
      });
      if (themeId) qs.set('theme_id', themeId);
      if (q) qs.set('q', q);
      
      const r = await fetch(`/api/admin/shadowing/subtopics?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const j = await r.json();
      if (r.ok) {
        setItems(j.items || []);
        setSelected({});
      }
    } catch (error) {
      console.error('Load failed:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadThemes();
  }, [lang, level, genre]);

  useEffect(() => {
    loadSubtopics();
  }, [lang, level, genre, themeId, q]);

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
    if (!themeId) {
      alert('请先选择大主题');
      return;
    }
    const theme = themes.find(t => t.id === themeId);
    setEditing({ 
      id: undefined, 
      theme_id: themeId,
      lang, 
      level, 
      genre, 
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
      const j = await r.json();
      if (!r.ok) {
        alert('保存失败：' + j.error);
        return;
      }
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
      const j = await r.json();
      if (!r.ok) {
        alert('保存失败：' + j.error);
        return;
      }
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
      const j = await r.json();
      if (!r.ok) {
        alert('操作失败：' + j.error);
        return;
      }
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
      const j = await r.json();
      if (!r.ok) {
        alert('删除失败：' + j.error);
        return;
      }
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
          lang,
          level,
          genre,
          concurrency,
          provider,
          model,
          temperature
        })
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
      setLogs(prev => [...prev, {
        type: 'error',
        message: `生成失败：${error}`
      }]);
    } finally {
      setGenerating(false);
    }
  }

  function stopGeneration() {
    setGenerating(false);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const dirtyCount = items.filter(item => item._dirty).length;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Shadowing 小主题批量生成</h1>
        <div className="flex gap-2">
          <Button onClick={loadSubtopics} variant="outline">
            刷新
          </Button>
          <Button onClick={openNew} disabled={!themeId}>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                const newLevel = parseInt(v) as 1|2|3|4|5|6;
                setLevel(newLevel);
                
                // 检查当前体裁是否在新等级中可用
                const availableGenres = getAvailableGenres(newLevel);
                if (!availableGenres.includes(genre)) {
                  // 如果当前体裁不可用，自动选择第一个可用的体裁
                  setGenre(availableGenres[0]);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={String(opt)}>
                      L{opt}
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
                <p>
                  <strong>等级 L{level}</strong> 可用体裁: {getAvailableGenres(level).map(g => 
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
              </div>
            </div>
            
            <div>
              <Label>大主题</Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择大主题" />
                </SelectTrigger>
                <SelectContent>
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
          </div>
        </CardContent>
      </Card>

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
              <CardTitle>小主题列表 ({items.length})</CardTitle>
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
                <Select value={provider} onValueChange={setProvider}>
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
                
                {generating ? (
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
        <DialogContent>
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
