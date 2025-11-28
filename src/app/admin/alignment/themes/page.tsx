'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';
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

// Constants moved inside component for localization

export default function AlignmentThemesPage() {
  const t = useTranslation();
  const { language } = useLanguage();

  const LEVEL_OPTIONS = useMemo(() => [
    { label: t.alignment.labels.all, value: 'all' },
    ...ALIGNMENT_LEVELS.map((level) => ({
      label: `L${level}`,
      value: String(level),
    }))
  ], [t]);

  const GENRE_LABEL = useMemo(() => ({
    dialogue: t.alignment.genres.dialogue,
    article: t.alignment.genres.article,
    task_email: t.alignment.genres.task_email,
    long_writing: t.alignment.genres.long_writing,
  } as Record<AlignmentGenre, string>), [t]);

  const LANG_LABEL = useMemo(() => ({
    en: t.profile.language_labels.en,
    ja: t.profile.language_labels.ja,
    zh: t.profile.language_labels.zh,
  } as Record<AlignmentLang, string>), [t]);
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
      if (!res.ok) throw new Error(json.error || t.common.error);
      setItems(json.items || []);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || t.common.error);
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
      alert(t.admin.alignment_themes.alert_title_empty);
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
      if (!res.ok) throw new Error(json.error || t.profile.save_failed);
      setEditorOpen(false);
      setEditingItem(null);
      await loadThemes();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || t.profile.save_failed);
    } finally {
      setSaving(false);
    }
  }, [editingItem, loadThemes, getAuthHeaders]);

  const updateStatus = useCallback(
    async (next: 'draft' | 'active' | 'archived') => {
      if (selectedIds.length === 0) {
        alert(t.vocabulary.messages.no_vocab); // Use existing "No vocab" or similar "Please select"
        return;
      }

      if (!window.confirm(t.admin.alignment_themes.confirm_status_update.replace('{count}', selectedIds.length.toString()).replace('{status}', next))) return;

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
        if (!res.ok) throw new Error(json.error || t.vocabulary.messages.update_failed);
        setSelected({});
        await loadThemes();
      } catch (error) {
        console.error(error);
        alert((error as Error).message || t.vocabulary.messages.update_failed);
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
      if (!res.ok) throw new Error(json.error || t.vocabulary.messages.generation_failed.replace('{error}', ''));
      setGeneratePreview(json.items || []);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || t.vocabulary.messages.generation_failed.replace('{error}', ''));
    } finally {
      setGenerating(false);
    }
  }, [lang, level, genre, generateCount, generateTemperature, getAuthHeaders]);

  const applyGenerated = useCallback(async () => {
    if (generatePreview.length === 0) return;
    const confirmed = window.confirm(t.admin.alignment_themes.confirm_save_generated.replace('{count}', generatePreview.length.toString()));
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
          <h1 className="text-2xl font-semibold">{t.admin.alignment_themes.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.admin.alignment_themes.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadThemes} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {t.common.loading}
          </Button>
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">{t.admin.alignment_themes.ai_generate}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t.admin.alignment_themes.batch_generate_title}</DialogTitle>
                <DialogDescription>
                  {t.admin.alignment_themes.batch_generate_desc}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t.admin.alignment_themes.generate_count}</Label>
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
                  {t.admin.alignment_themes.generate}
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
                  {t.admin.alignment_themes.clear}
                </Button>
                <Button onClick={applyGenerated} disabled={generatePreview.length === 0}>
                  {t.common.save}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={openCreateModal}>{t.admin.alignment_themes.create}</Button>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder={t.admin.alignment_themes.search_placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-60"
          />
          <div className="flex items-center gap-2">
            <Label>{t.alignment.labels.language}</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t.vocabulary.filters.all_languages} />
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
            <Label>{t.alignment.labels.level}</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder={t.vocabulary.filters.all_levels} />
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
            <Label>{t.alignment.labels.genre}</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t.vocabulary.filters.all_genres} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.vocabulary.filters.all_genres}</SelectItem>
                {ALIGNMENT_GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENRE_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>{t.vocabulary.filters.status}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t.vocabulary.filters.all_status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.alignment.labels.all}</SelectItem>
                <SelectItem value="draft">{t.admin.alignment_themes.status_draft}</SelectItem>
                <SelectItem value="active">{t.admin.alignment_themes.status_active}</SelectItem>
                <SelectItem value="archived">{t.admin.alignment_themes.status_archived}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => updateStatus('draft')}>
              {t.admin.alignment_themes.action_draft}
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus('active')}>
              {t.admin.alignment_themes.action_publish}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => updateStatus('archived')}>
              {t.admin.alignment_themes.action_archive}
            </Button>
            <div className="text-sm text-muted-foreground self-center">
              {t.admin.alignment_themes.selected_count.replace('{count}', selectedIds.length.toString())}
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
          <div className="p-10 text-center text-muted-foreground">{t.admin.alignment_themes.no_data}</div>
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
                      {item.status === 'active' ? t.admin.alignment_themes.status_active : item.status === 'draft' ? t.admin.alignment_themes.status_draft : t.admin.alignment_themes.status_archived}
                    </Badge>
                    <Badge variant="outline">
                      {t.admin.alignment_themes.subtopic_count.replace('{count}', (item.subtopic_count ?? 0).toString())}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditModal(item)}>
                  {t.common.edit}
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem?.id ? t.admin.alignment_themes.edit_title : t.admin.alignment_themes.create_title}</DialogTitle>
            <DialogDescription>{t.admin.alignment_themes.modal_desc}</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>{t.alignment.labels.language}</Label>
                  <Select
                    value={editingItem.lang || 'en'}
                    onValueChange={(val) =>
                      setEditingItem((prev) => (prev ? { ...prev, lang: val as AlignmentLang } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t.alignment.labels.language} />
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
                  <Label>{t.alignment.labels.level}</Label>
                  <Select
                    value={String(editingItem.level || 1)}
                    onValueChange={(val) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, level: Number(val) as AlignmentLevel } : prev,
                      )
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder={t.alignment.labels.level} />
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
                  <Label>{t.alignment.labels.genre}</Label>
                  <Select
                    value={editingItem.genre || 'dialogue'}
                    onValueChange={(val) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, genre: val as AlignmentGenre } : prev,
                      )
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder={t.alignment.labels.genre} />
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
                <Label>{t.admin.alignment_themes.label_title_main}</Label>
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
                    <Label>{t.admin.alignment_themes.label_title_trans.replace('{lang}', LANG_LABEL[code])}</Label>
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
                <Label>{t.admin.alignment_themes.label_summary_main}</Label>
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
                    <Label>{t.admin.alignment_themes.label_summary_trans.replace('{lang}', LANG_LABEL[code])}</Label>
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
              {t.common.cancel}
            </Button>
            <Button onClick={saveTheme} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.common.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
