'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AlignmentSubtopic, AlignmentTheme } from '@/lib/alignment/types';
import {
  ALIGNMENT_GENRES,
  ALIGNMENT_LANGS,
  ALIGNMENT_LEVELS,
  ALIGNMENT_LEVEL_REQUIREMENT_COUNTS,
} from '@/lib/alignment/constants';
import type { AlignmentGenre, AlignmentLang, AlignmentLevel } from '@/lib/alignment/constants';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Sparkles, Save, Edit2 } from 'lucide-react';

type GeneratedSubtopic = {
  title: string;
  title_translations: Record<string, string>;
  title_normalized: string;
  one_line: string;
  one_line_translations: Record<string, string>;
  objectives: Array<{ title: string; translations: Record<string, string> }>;
};

const LANG_LABEL: Record<AlignmentLang, string> = {
  en: '英语',
  ja: '日语',
  zh: '中文',
};

const GENRE_LABEL: Record<AlignmentGenre, string> = {
  dialogue: '对话',
  article: '文章',
  task_email: '任务邮件',
  long_writing: '长写作',
};

export default function AlignmentSubtopicsPage() {
  const [themes, setThemes] = useState<AlignmentTheme[]>([]);
  const [items, setItems] = useState<AlignmentSubtopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lang, setLang] = useState<'all' | AlignmentLang>('all');
  const [level, setLevel] = useState<'all' | AlignmentLevel>('all');
  const [genre, setGenre] = useState<'all' | AlignmentGenre>('all');
  const [themeId, setThemeId] = useState<string>('all');
  const [status, setStatus] = useState<'all' | 'draft' | 'needs_review' | 'active' | 'archived'>(
    'all',
  );
  const [query, setQuery] = useState('');

  const [generateThemeId, setGenerateThemeId] = useState<string>('');
  const [generateCount, setGenerateCount] = useState(6);
  const [generateTemperature, setGenerateTemperature] = useState(0.8);
  const [generatePreview, setGeneratePreview] = useState<GeneratedSubtopic[]>([]);
  const [generating, setGenerating] = useState(false);

  const [editing, setEditing] = useState<AlignmentSubtopic | null>(null);
  const [editOpen, setEditOpen] = useState(false);

const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
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
    try {
      const res = await fetch('/api/admin/alignment/themes', {
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        const list: AlignmentTheme[] = json.items || [];
        setThemes(list);
        if (list.length > 0 && !generateThemeId) {
          setGenerateThemeId(list[0].id);
        }
      } else {
        console.error('加载主题失败', json.error);
      }
    } catch (error) {
      console.error('加载主题失败', error);
    }
  }, [getAuthHeaders, generateThemeId]);

  const loadSubtopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang !== 'all') params.set('lang', lang);
      if (level !== 'all') params.set('level', String(level));
      if (genre !== 'all') params.set('genre', genre);
      if (themeId !== 'all') params.set('theme_id', themeId);
      if (status !== 'all') params.set('status', status);
      if (query.trim()) params.set('q', query.trim());

      const res = await fetch(`/api/admin/alignment/subtopics?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setItems(json.items || []);
      } else {
        console.error('加载小主题失败', json.error);
      }
    } catch (error) {
      console.error('加载小主题失败', error);
    } finally {
      setLoading(false);
    }
  }, [lang, level, genre, themeId, status, query, getAuthHeaders]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    loadSubtopics();
  }, [loadSubtopics]);

  const selectedTheme = useMemo(() => {
    const targetId = generateThemeId || (themeId !== 'all' ? themeId : '');
    if (!targetId) return undefined;
    return themes.find((theme) => theme.id === targetId);
  }, [themes, generateThemeId, themeId]);

  const handleGenerate = useCallback(async () => {
    if (!generateThemeId) {
      alert('请选择要生成小主题的主题');
      return;
    }
    setGenerating(true);
    setGeneratePreview([]);
    try {
      const res = await fetch('/api/admin/alignment/subtopics/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          theme_id: generateThemeId,
          count: generateCount,
          temperature: generateTemperature,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '生成失败');
      }
      const list: GeneratedSubtopic[] = (json.items || []).map((item: any) => ({
        title: item.title,
        title_translations: {
          en: item.title_translations?.en || item.title,
          ja: item.title_translations?.ja || item.title,
          zh: item.title_translations?.zh || item.title,
        },
        title_normalized: item.title_normalized || '',
        one_line: item.one_line || '',
        one_line_translations: {
          en: item.one_line_translations?.en || item.one_line || '',
          ja: item.one_line_translations?.ja || item.one_line || '',
          zh: item.one_line_translations?.zh || item.one_line || '',
        },
        objectives: (item.objectives || []).map((obj: any) => ({
          title: obj.label || obj.title || '',
          translations: {
            en: obj.translations?.en || obj.label || obj.title || '',
            ja: obj.translations?.ja || obj.label || obj.title || '',
            zh: obj.translations?.zh || obj.label || obj.title || '',
          },
        })),
      }));
      setGeneratePreview(list);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [generateThemeId, generateCount, generateTemperature, getAuthHeaders]);

  const handleSaveGenerated = useCallback(async () => {
    if (!generatePreview.length) return;
    if (!generateThemeId) {
      alert('缺少主题');
      return;
    }
    setSaving(true);
    try {
      for (const item of generatePreview) {
        await fetch('/api/admin/alignment/subtopics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({
            action: 'upsert',
            item: {
              theme_id: generateThemeId,
              lang: selectedTheme?.lang,
              level: selectedTheme?.level,
              genre: selectedTheme?.genre,
              title: item.title,
              title_translations: item.title_translations,
              one_line: item.one_line,
              one_line_translations: item.one_line_translations,
              objectives: item.objectives,
              status: 'draft',
            },
          }),
        });
      }
      setGeneratePreview([]);
      await loadSubtopics();
      alert('已保存生成的小主题');
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [generatePreview, generateThemeId, selectedTheme, getAuthHeaders, loadSubtopics]);

  const openEdit = useCallback((subtopic: AlignmentSubtopic) => {
    setEditing(subtopic);
    setEditOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/alignment/subtopics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          action: 'upsert',
          item: editing,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '保存失败');
      }
      setEditOpen(false);
      await loadSubtopics();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [editing, getAuthHeaders, loadSubtopics]);

  const requirementRange = useMemo(() => {
    if (!selectedTheme) return null;
    return ALIGNMENT_LEVEL_REQUIREMENT_COUNTS[selectedTheme.level];
  }, [selectedTheme]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">对齐练习 · 小主题管理</h1>
          <p className="text-sm text-muted-foreground">
            在选择主题的基础上批量生成或手工维护小主题，并预览生成结果。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadSubtopics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>筛选</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>语言</Label>
                <Select value={lang} onValueChange={(val) => setLang(val as typeof lang)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择语言" />
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
              <div className="space-y-2">
                <Label>等级</Label>
                <Select value={String(level)} onValueChange={(val) => setLevel(val === 'all' ? 'all' : (Number(val) as AlignmentLevel))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {ALIGNMENT_LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={String(lvl)}>
                        L{lvl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>体裁</Label>
                <Select value={genre} onValueChange={(val) => setGenre(val as typeof genre)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择体裁" />
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
              <div className="space-y-2">
                <Label>所属主题</Label>
                <Select value={themeId} onValueChange={setThemeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择主题" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">全部主题</SelectItem>
                    {themes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        {theme.title} · {LANG_LABEL[theme.lang]} L{theme.level} · {GENRE_LABEL[theme.genre]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={status} onValueChange={(val) => setStatus(val as typeof status)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="needs_review">待审核</SelectItem>
                    <SelectItem value="active">已发布</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关键词</Label>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="标题搜索"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI 批量生成小主题
            </CardTitle>
            {selectedTheme && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="outline">{LANG_LABEL[selectedTheme.lang]}</Badge>
                <Badge variant="outline">L{selectedTheme.level}</Badge>
                <Badge variant="outline">{GENRE_LABEL[selectedTheme.genre]}</Badge>
                {requirementRange && (
                  <span>
                    要求数量：{requirementRange[0]}~{requirementRange[1]}
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>选择主题</Label>
                <Select value={generateThemeId} onValueChange={setGenerateThemeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择目标主题" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {themes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        {theme.title} · {LANG_LABEL[theme.lang]} L{theme.level} · {GENRE_LABEL[theme.genre]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>生成数量</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                />
              </div>
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={generateTemperature}
                  onChange={(e) => setGenerateTemperature(Math.max(0, Math.min(1, Number(e.target.value))))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleGenerate} disabled={generating || !generateThemeId}>
                {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                生成小主题
              </Button>
              {generatePreview.length > 0 && (
                <>
                  <Button onClick={handleSaveGenerated} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    批量保存
                  </Button>
                  <Button variant="outline" onClick={() => setGeneratePreview([])}>
                    清空预览
                  </Button>
                </>
              )}
            </div>
            {generatePreview.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  生成预览（{generatePreview.length} 条） - 保存前可编辑字段
                </h3>
                <div className="grid gap-3">
                  {generatePreview.map((item, index) => (
                    <Card key={`${item.title}-${index}`} className="border-dashed">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        {item.one_line && <p>{item.one_line}</p>}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div>EN: {item.title_translations.en}</div>
                          <div>JA: {item.title_translations.ja}</div>
                          <div>ZH: {item.title_translations.zh}</div>
                        </div>
                          <div className="text-xs">
                            目标：{item.objectives.map((obj) => obj.title || '').join(' / ')}
                          </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle>小主题列表</CardTitle>
            <div className="text-sm text-muted-foreground">
              共 {items.length} 条小主题
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">暂无数据</div>
            ) : (
              <div className="grid gap-3">
                {items.map((item) => (
                  <Card key={item.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{item.title}</h3>
                            <Badge variant="outline">{LANG_LABEL[item.lang]}</Badge>
                            <Badge variant="outline">L{item.level}</Badge>
                            <Badge variant="outline">{GENRE_LABEL[item.genre]}</Badge>
                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                              {item.status === 'draft'
                                ? '草稿'
                                : item.status === 'needs_review'
                                  ? '待审核'
                                  : item.status === 'active'
                                    ? '已发布'
                                    : '已归档'}
                            </Badge>
                          </div>
                          {item.one_line && (
                            <p className="text-sm text-muted-foreground mt-1">{item.one_line}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                            <Edit2 className="w-4 h-4 mr-1" />
                            编辑
                          </Button>
                        </div>
                      </div>
                      {item.objectives?.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">目标：</span>
                          {item.objectives
                            .map((obj: any) => obj.title || obj.label || '')
                            .filter(Boolean)
                            .join(' ｜ ')}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        创建时间：{new Date(item.created_at).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑小主题</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>语言</Label>
                  <Select
                    value={editing.lang}
                    onValueChange={(val) =>
                      setEditing((prev) => (prev ? { ...prev, lang: val as AlignmentLang } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                    value={String(editing.level)}
                    onValueChange={(val) =>
                      setEditing((prev) =>
                        prev ? { ...prev, level: Number(val) as AlignmentLevel } : prev,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                    value={editing.genre}
                    onValueChange={(val) =>
                      setEditing((prev) => (prev ? { ...prev, genre: val as AlignmentGenre } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                <Label>标题</Label>
                <Input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                  }
                />
              </div>
              <div>
                <Label>标题翻译 JSON</Label>
                <Textarea
                  rows={3}
                  value={JSON.stringify(editing.title_translations || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditing((prev) =>
                        prev ? { ...prev, title_translations: parsed } : prev,
                      );
                    } catch {
                      // ignore invalid json while typing
                    }
                  }}
                />
              </div>
              <div>
                <Label>一句话简介</Label>
                <Textarea
                  rows={2}
                  value={editing.one_line || ''}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, one_line: e.target.value } : prev))
                  }
                />
              </div>
              <div>
                <Label>简介翻译 JSON</Label>
                <Textarea
                  rows={3}
                  value={JSON.stringify(editing.one_line_translations || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditing((prev) =>
                        prev ? { ...prev, one_line_translations: parsed } : prev,
                      );
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>
              <div>
                <Label>目标（对象数组 JSON）</Label>
                <Textarea
                  rows={6}
                  value={JSON.stringify(editing.objectives || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setEditing((prev) => (prev ? { ...prev, objectives: parsed } : prev));
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-1" />
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
