'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ALIGNMENT_GENRES, ALIGNMENT_LANGS, ALIGNMENT_LEVELS } from '@/lib/alignment/constants';
import type { AlignmentTheme } from '@/lib/alignment/types';
import type { AlignmentGenre, AlignmentLang, AlignmentLevel } from '@/lib/alignment/constants';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ThemeFormState = Partial<AlignmentTheme> & {
  title: string;
  summary: string | null;
  title_translations: Record<string, string>;
  summary_translations: Record<string, string>;
};

type GeneratedTheme = {
  title: string;
  title_normalized: string;
  title_translations: Record<string, string>;
  summary: string;
  summary_translations: Record<string, string>;
};

const LEVEL_OPTIONS = [{ label: '全部', value: 'all' }, ...ALIGNMENT_LEVELS.map((level) => ({
  label: `L${level}`,
  value: String(level),
}))];

const GENRE_LABEL: Record<AlignmentGenre, string> = {
  dialogue: '对话',
  article: '文章',
  task_email: '任务邮件',
  long_writing: '长写作',
};

const LANG_LABEL: Record<AlignmentLang, string> = {
  en: '英语',
  ja: '日语',
  zh: '中文',
};

export default function AlignmentThemesPage() {
  const [items, setItems] = useState<AlignmentTheme[]>([]);
  const [lang, setLang] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');
  const [genre, setGenre] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [editingItem, setEditingItem] = useState<ThemeFormState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState(5);
  const [generateTemperature, setGenerateTemperature] = useState(0.7);
  const [generatePreview, setGeneratePreview] = useState<GeneratedTheme[]>([]);
  const [generating, setGenerating] = useState(false);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, isSelected]) => isSelected).map(([id]) => id),
    [selected],
  );

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  const loadThemes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang !== 'all') params.set('lang', lang);
      if (level !== 'all') params.set('level', level);
      if (genre !== 'all') params.set('genre', genre);
      if (status !== 'all') params.set('status', status);
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(`/api/admin/alignment/themes?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '加载失败');
      setItems(json.items || []);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [lang, level, genre, status, q, getAuthHeaders]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const openCreateModal = useCallback(() => {
    setEditingItem({
      title: '',
      summary: '',
      lang: 'en',
      level: 1,
      genre: 'dialogue',
      status: 'draft',
      title_translations: { en: '', ja: '', zh: '' },
      summary_translations: { en: '', ja: '', zh: '' },
    });
    setEditorOpen(true);
  }, [getAuthHeaders]);

  const openEditModal = useCallback((item: AlignmentTheme) => {
    setEditingItem({
      ...item,
      title: item.title,
      summary: item.summary ?? '',
      title_translations: item.title_translations || { en: item.title, ja: item.title, zh: item.title },
      summary_translations: item.summary_translations || {
        en: item.summary || '',
        ja: item.summary || '',
        zh: item.summary || '',
      },
    });
    setEditorOpen(true);
  }, []);

  const saveTheme = useCallback(async () => {
    if (!editingItem) return;
    if (!editingItem.title?.trim()) {
      alert('标题不能为空');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/alignment/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          action: 'upsert',
          item: {
            ...editingItem,
            summary_translations: editingItem.summary_translations || {},
            title_translations: editingItem.title_translations || {},
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '保存失败');
      setEditorOpen(false);
      setEditingItem(null);
      await loadThemes();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [editingItem, loadThemes, getAuthHeaders]);

  const updateStatus = useCallback(
    async (next: 'draft' | 'active' | 'archived') => {
      if (selectedIds.length === 0) {
        alert('请先选择主题');
        return;
      }

      if (!window.confirm(`确认将 ${selectedIds.length} 个主题更新为 ${next} 状态吗？`)) return;

    try {
      const res = await fetch('/api/admin/alignment/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          action: 'bulk-status',
          ids: selectedIds,
          status: next,
        }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '更新失败');
        setSelected({});
        await loadThemes();
      } catch (error) {
        console.error(error);
        alert((error as Error).message || '更新失败');
      }
    },
    [selectedIds, loadThemes, getAuthHeaders],
  );

  const runGenerate = useCallback(async () => {
    setGenerating(true);
    setGeneratePreview([]);
    try {
      const res = await fetch('/api/admin/alignment/themes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          lang: lang === 'all' ? 'en' : lang,
          level: level === 'all' ? 1 : Number(level),
          genre: genre === 'all' ? 'dialogue' : genre,
          count: generateCount,
          temperature: generateTemperature,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '生成失败');
      setGeneratePreview(json.items || []);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [lang, level, genre, generateCount, generateTemperature, getAuthHeaders]);

  const applyGenerated = useCallback(async () => {
    if (generatePreview.length === 0) return;
    const confirmed = window.confirm(`确认保存 ${generatePreview.length} 个生成主题吗？`);
    if (!confirmed) return;

    try {
      const authHeaders = await getAuthHeaders();
      for (const preview of generatePreview) {
        await fetch('/api/admin/alignment/themes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            action: 'upsert',
            item: {
              title: preview.title,
              summary: preview.summary,
              lang: lang === 'all' ? 'en' : lang,
              level: level === 'all' ? 1 : Number(level),
              genre: genre === 'all' ? 'dialogue' : genre,
              status: 'draft',
              title_translations: preview.title_translations,
              summary_translations: preview.summary_translations,
            },
          }),
        });
      }
      setGeneratePreview([]);
      setGenerateOpen(false);
      await loadThemes();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '保存失败');
    }
  }, [generatePreview, lang, level, genre, loadThemes, getAuthHeaders]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">对齐练习 · 大主题管理</h1>
          <p className="text-sm text-muted-foreground">
            生成并维护大主题，后续可为每个主题创建小主题与训练包。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadThemes} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">AI 生成主题</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>批量生成大主题</DialogTitle>
                <DialogDescription>
                  将根据当前筛选条件（语言/等级/体裁）生成不重复的新主题。仅使用 DeepSeek 模型。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>生成数量</Label>
                    <Input
                      type="number"
                      min={1}
                      max={15}
                      value={generateCount}
                      onChange={(e) => setGenerateCount(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={0}
                      max={1}
                      value={generateTemperature}
                      onChange={(e) => setGenerateTemperature(Number(e.target.value) || 0.7)}
                    />
                  </div>
                </div>
                <Button onClick={runGenerate} disabled={generating}>
                  {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  生成
                </Button>
                {generatePreview.length > 0 && (
                  <div className="space-y-3 max-h-80 overflow-y-auto border rounded-md p-3 bg-muted/40">
                    {generatePreview.map((item, idx) => (
                      <div key={`${item.title}-${idx}`} className="space-y-2 border-b pb-2 last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{item.title}</div>
                          <Badge variant="outline">建议</Badge>
                        </div>
                        {item.summary && (
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{item.summary}</p>
                        )}
                        <div className="text-xs text-muted-foreground grid grid-cols-3 gap-2">
                          <div>EN: {item.title_translations.en}</div>
                          <div>JA: {item.title_translations.ja}</div>
                          <div>ZH: {item.title_translations.zh}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setGeneratePreview([])}>
                  清空
                </Button>
                <Button onClick={applyGenerated} disabled={generatePreview.length === 0}>
                  保存
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={openCreateModal}>新建</Button>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="搜索主题标题"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-60"
          />
          <div className="flex items-center gap-2">
            <Label>语言</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {ALIGNMENT_LANGS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LANG_LABEL[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>等级</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="全部等级" />
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
          <div className="flex items-center gap-2">
            <Label>体裁</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="全部体裁" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {ALIGNMENT_GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENRE_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="active">已发布</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => updateStatus('draft')}>
              转为草稿
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus('active')}>
              发布
            </Button>
            <Button size="sm" variant="destructive" onClick={() => updateStatus('archived')}>
              归档
            </Button>
            <div className="text-sm text-muted-foreground self-center">
              已选 {selectedIds.length} 项
            </div>
          </div>
        )}
      </section>

      <section className="border rounded-lg divide-y">
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">暂无数据</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-3 items-start md:items-center">
                <input
                  type="checkbox"
                  className="mt-1 md:mt-0"
                  checked={!!selected[item.id]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                />
                <div>
                  <div className="text-lg font-semibold">{item.title}</div>
                  {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                    <Badge variant="outline">{LANG_LABEL[item.lang]}</Badge>
                    <Badge variant="outline">L{item.level}</Badge>
                    <Badge variant="outline">{GENRE_LABEL[item.genre]}</Badge>
                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                      {item.status === 'active' ? '已发布' : item.status === 'draft' ? '草稿' : '已归档'}
                    </Badge>
                    <Badge variant="outline">
                      小主题 {item.subtopic_count ?? 0}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditModal(item)}>
                  编辑
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? '编辑主题' : '新建主题'}</DialogTitle>
            <DialogDescription>维护标题、翻译与概述信息。</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>语言</Label>
                  <Select
                    value={editingItem.lang || 'en'}
                    onValueChange={(val) =>
                      setEditingItem((prev) => (prev ? { ...prev, lang: val as AlignmentLang } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择语言" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALIGNMENT_LANGS.map((code) => (
                        <SelectItem key={code} value={code}>
                          {LANG_LABEL[code]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>等级</Label>
                  <Select
                    value={String(editingItem.level || 1)}
                    onValueChange={(val) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, level: Number(val) as AlignmentLevel } : prev,
                      )
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="选择等级" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALIGNMENT_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={String(lvl)}>
                          L{lvl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>体裁</Label>
                  <Select
                    value={editingItem.genre || 'dialogue'}
                    onValueChange={(val) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, genre: val as AlignmentGenre } : prev,
                      )
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="选择体裁" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALIGNMENT_GENRES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {GENRE_LABEL[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>标题（主语言）</Label>
                <Input
                  value={editingItem.title || ''}
                  onChange={(e) =>
                    setEditingItem((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ALIGNMENT_LANGS.map((code) => (
                  <div key={code}>
                    <Label>{`标题翻译 (${LANG_LABEL[code]})`}</Label>
                    <Input
                      value={editingItem.title_translations?.[code] || ''}
                      onChange={(e) =>
                        setEditingItem((prev) =>
                          prev
                            ? {
                                ...prev,
                                title_translations: {
                                  ...prev.title_translations,
                                  [code]: e.target.value,
                                },
                              }
                            : prev,
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              <div>
                <Label>主题概述（主语言）</Label>
                <Textarea
                  rows={3}
                  value={editingItem.summary || ''}
                  onChange={(e) =>
                    setEditingItem((prev) => (prev ? { ...prev, summary: e.target.value } : prev))
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ALIGNMENT_LANGS.map((code) => (
                  <div key={code}>
                    <Label>{`概述翻译 (${LANG_LABEL[code]})`}</Label>
                    <Textarea
                      rows={2}
                      value={editingItem.summary_translations?.[code] || ''}
                      onChange={(e) =>
                        setEditingItem((prev) =>
                          prev
                            ? {
                                ...prev,
                                summary_translations: {
                                  ...prev.summary_translations,
                                  [code]: e.target.value,
                                },
                              }
                            : prev,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button onClick={saveTheme} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
