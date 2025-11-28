'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  ALIGNMENT_GENRES,
  ALIGNMENT_LANGS,
  ALIGNMENT_LEVELS,
  ALIGNMENT_TASK_TYPES,
} from '@/lib/alignment/constants';
import { useLanguage } from '@/contexts/LanguageContext';

type CatalogTheme = {
  id: string;
  title: string;
  level: number;
  lang: string;
  genre: string;
} | null;

type CatalogSubtopic = {
  id: string;
  title: string;
  one_line: string | null;
  level: number;
  lang: string;
  objectives?: Array<{ label?: string; title?: string }> | null;
  theme: CatalogTheme;
} | null;

type CatalogItem = {
  id: string;
  lang: string;
  task_type: string;
  updated_at: string;
  subtopic: CatalogSubtopic;
};

export default function AlignmentCatalogPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [lang, setLang] = useState<'all' | string>('all');
  const [level, setLevel] = useState<'all' | number>('all');
  const [genre, setGenre] = useState<'all' | string>('all');
  const [taskType, setTaskType] = useState<'all' | string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (lang !== 'all') params.set('lang', lang);
      if (level !== 'all') params.set('level', String(level));
      if (genre !== 'all') params.set('genre', genre);
      if (taskType !== 'all') params.set('task_type', taskType);

      const res = await fetch(`/api/alignment/materials?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || t.alignment.states.error.replace('{error}', 'Failed to load'));
      }
      setItems(json.items || []);
    } catch (err: any) {
      setError(err?.message || t.alignment.states.error.replace('{error}', 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [lang, level, genre, taskType, t]);

  useEffect(() => {
    load();
  }, [load]);

  const themeGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        theme: CatalogTheme;
        materials: CatalogItem[];
      }
    >();
    items.forEach((item) => {
      const subtopic = item.subtopic;
      const theme = subtopic?.theme || null;
      const key = theme?.id || subtopic?.id || `material-${item.id}`;
      const record = map.get(key) || { theme, materials: [] };
      record.materials.push(item);
      map.set(key, record);
    });
    return Array.from(map.values());
  }, [items]);

  return (
    <main className="p-6">
      <Container>
        <Breadcrumbs items={[{ href: '/', label: t.nav.home }, { label: t.nav.alignment_practice }]} />

        <div className="max-w-6xl mx-auto space-y-6">
          <div className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-semibold">{t.alignment.title}</h1>
              <p className="text-muted-foreground mt-2">
                {t.alignment.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.alignment.labels.language}</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as typeof lang)}
                >
                  <option value="all">{t.alignment.labels.all}</option>
                  {ALIGNMENT_LANGS.map((code) => (
                    <option key={code} value={code}>
                      {(t.vocabulary.language_labels as any)[code] || code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.alignment.labels.level}</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                >
                  <option value="all">{t.alignment.labels.all}</option>
                  {ALIGNMENT_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      L{lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.alignment.labels.genre}</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value as typeof genre)}
                >
                  <option value="all">{t.alignment.labels.all}</option>
                  {ALIGNMENT_GENRES.map((g) => (
                    <option key={g} value={g}>
                      {(t.alignment.genres as any)[g] || g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.alignment.labels.task_type}</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as typeof taskType)}
                >
                  <option value="all">{t.alignment.labels.all}</option>
                  {ALIGNMENT_TASK_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {(t.alignment.task_types as any)[type] || type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-card text-card-foreground p-6 text-muted-foreground">
              {t.alignment.states.loading}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 p-6">
              {t.alignment.states.error.replace('{error}', error)}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border bg-card text-card-foreground p-10 text-center text-muted-foreground">
              {t.alignment.states.empty}
            </div>
          ) : (
            <div className="space-y-6">
              {themeGroups.map(({ theme, materials }) => (
                <section key={theme?.id || materials[0].id} className="space-y-3">
                  <header>
                    <h2 className="text-xl font-semibold">{theme?.title || t.alignment.card.unnamed_subtopic}</h2>
                    <p className="text-sm text-muted-foreground">
                      {theme
                        ? `${t.alignment.card.language}：${(t.vocabulary.language_labels as any)[theme.lang] || theme.lang} · ${t.alignment.card.level}：L${theme.level
                        } · ${t.alignment.card.genre}：${(t.alignment.genres as any)[theme.genre] || theme.genre}`
                        : t.alignment.card.missing_meta}
                    </p>
                  </header>

                  <div className="grid md:grid-cols-2 gap-4">
                    {materials.map((material) => {
                      const subtopic = material.subtopic;
                      const objectives = subtopic?.objectives || [];
                      return (
                        <article
                          key={material.id}
                          className="border rounded-xl p-4 bg-white shadow-sm hover:shadow transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                              {(t.vocabulary.language_labels as any)[material.lang] || material.lang}
                            </span>
                            <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">
                              {(t.alignment.task_types as any)[material.task_type] || material.task_type}
                            </span>
                          </div>

                          <h3 className="font-medium text-lg">
                            {subtopic?.title || t.alignment.card.unnamed_subtopic}
                          </h3>
                          {subtopic?.one_line && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {subtopic.one_line}
                            </p>
                          )}

                          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                            <li>{t.alignment.card.level}：L{subtopic?.level ?? '?'}</li>
                            <li>{t.alignment.card.updated_at}：{new Date(material.updated_at).toLocaleString()}</li>
                            {objectives.length > 0 && (
                              <li>
                                {t.alignment.card.objectives}：
                                {objectives
                                  .map((obj) => obj?.label || obj?.title || '')
                                  .filter(Boolean)
                                  .join('，')}
                              </li>
                            )}
                          </ul>

                          <Button asChild className="w-full mt-4">
                            <Link href={`/practice/alignment/${material.id}`}>{t.alignment.card.start_practice}</Link>
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div className="rounded-2xl p-6 bg-blue-50">
            <h3 className="font-medium text-blue-900 mb-2">{t.alignment.tips.title}</h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              {t.alignment.tips.content}
            </p>
          </div>
        </div>
      </Container>
    </main>
  );
}
