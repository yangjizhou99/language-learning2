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

const LANG_LABEL: Record<string, string> = {
  en: '英语',
  ja: '日语',
  zh: '中文',
};

const GENRE_LABEL: Record<string, string> = {
  dialogue: '对话',
  article: '文章',
  task_email: '任务邮件',
  long_writing: '长写作',
};

const TASK_LABEL: Record<string, string> = {
  dialogue: '对话任务',
  article: '文章写作',
  task_email: '任务邮件',
  long_writing: '长写作',
};

export default function AlignmentCatalogPage() {
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
        throw new Error(json.error || '加载失败');
      }
      setItems(json.items || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [lang, level, genre, taskType]);

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
        <Breadcrumbs items={[{ href: '/', label: '首页' }, { label: '对齐练习' }]} />

        <div className="max-w-6xl mx-auto space-y-6">
          <div className="rounded-2xl border bg-card text-card-foreground p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-semibold">对齐练习 · 训练包列表</h1>
              <p className="text-muted-foreground mt-2">
                根据语言和等级选择训练包，阅读范文与知识点后完成任务，获取实时 AI 反馈。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">语言</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as typeof lang)}
                >
                  <option value="all">全部</option>
                  {ALIGNMENT_LANGS.map((code) => (
                    <option key={code} value={code}>
                      {LANG_LABEL[code]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">等级</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                >
                  <option value="all">全部</option>
                  {ALIGNMENT_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      L{lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">主题体裁</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value as typeof genre)}
                >
                  <option value="all">全部</option>
                  {ALIGNMENT_GENRES.map((g) => (
                    <option key={g} value={g}>
                      {GENRE_LABEL[g]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">任务类型</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as typeof taskType)}
                >
                  <option value="all">全部</option>
                  {ALIGNMENT_TASK_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TASK_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-card text-card-foreground p-6 text-muted-foreground">
              加载中…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 p-6">
              错误：{error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border bg-card text-card-foreground p-10 text-center text-muted-foreground">
              暂无符合条件的训练包
            </div>
          ) : (
            <div className="space-y-6">
              {themeGroups.map(({ theme, materials }) => (
                <section key={theme?.id || materials[0].id} className="space-y-3">
                  <header>
                    <h2 className="text-xl font-semibold">{theme?.title || '未分类主题'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {theme
                        ? `语言：${LANG_LABEL[theme.lang] || theme.lang} · 等级：L${
                            theme.level
                          } · 体裁：${GENRE_LABEL[theme.genre] || theme.genre}`
                        : '该主题缺少元信息'}
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
                              {LANG_LABEL[material.lang] || material.lang}
                            </span>
                            <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">
                              {TASK_LABEL[material.task_type] || material.task_type}
                            </span>
                          </div>

                          <h3 className="font-medium text-lg">
                            {subtopic?.title || '未命名小主题'}
                          </h3>
                          {subtopic?.one_line && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {subtopic.one_line}
                            </p>
                          )}

                          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                            <li>等级：L{subtopic?.level ?? '?'}</li>
                            <li>更新时间：{new Date(material.updated_at).toLocaleString()}</li>
                            {objectives.length > 0 && (
                              <li>
                                训练目标：
                                {objectives
                                  .map((obj) => obj?.label || obj?.title || '')
                                  .filter(Boolean)
                                  .join('，')}
                              </li>
                            )}
                          </ul>

                          <Button asChild className="w-full mt-4">
                            <Link href={`/practice/alignment/${material.id}`}>开始练习</Link>
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
            <h3 className="font-medium text-blue-900 mb-2">练习提示</h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              每个训练包包含任务提示、范文、知识点与评分标准。请先阅读范文并标记核心表达，再按照要求逐条完成任务，提交后可以获得 AI 总分与改进建议。
            </p>
          </div>
        </div>
      </Container>
    </main>
  );
}
