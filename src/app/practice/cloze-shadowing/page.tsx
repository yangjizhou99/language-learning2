'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { loadFilters as loadClozeFilters, saveFilters as saveClozeFilters } from '@/lib/clozeShadowingFilterStorage';
import { Input } from '@/components/ui/input';
import { Menu, X, Filter, Shuffle, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type Lang = 'en' | 'ja' | 'zh';
type SortKey = 'recommended' | 'recent' | 'levelAsc' | 'levelDesc' | 'completion';

interface ShadowingItem {
  id: string;
  lang: Lang;
  level: number;
  title: string;
  isPracticed?: boolean;
  theme_id?: string | null;
  subtopic_id?: string | null;
  status?: 'draft' | 'completed' | null;
  stats?: {
    sentenceCount?: number;
    lastPracticed?: string | null;
    accuracy?: number | null;
    totalSentences?: number | null;
  };
}

export default function ClozeShadowingEntryPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ShadowingItem[]>([]);
  const [lang, setLang] = useState<Lang | ''>('');
  const [level, setLevel] = useState<number | ''>('');
  const [practiced, setPracticed] = useState<'all' | 'practiced' | 'unpracticed'>('all');
  const [theme, setTheme] = useState<string>('');
  const [subtopic, setSubtopic] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  const [genre, setGenre] = useState<string>('all');

  const [themes, setThemes] = useState<Array<{ id: string; title: string }>>([]);
  const [subtopics, setSubtopics] = useState<Array<{ id: string; title: string }>>([]);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('recommended');
  const abortRef = useRef<AbortController | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 初始化：URL 优先，其次本地存储
  useEffect(() => {
    const params = searchParams;
    const urlLang = (params?.get('lang') as Lang | null) || null;
    const urlLevel = params?.get('level');
    const urlPracticed = params?.get('practiced') as 'all' | 'practiced' | 'unpracticed' | null;
    const urlTheme = params?.get('theme') || '';
    const urlSubtopic = params?.get('subtopic') || '';
    const urlQ = params?.get('q') || '';
    const urlGenre = params?.get('genre') || 'all';
    const urlSort = params?.get('sort');
    const urlLimit = params?.get('limit');
    const urlOffset = params?.get('offset');

    if (urlLang) setLang(urlLang);
    if (urlLevel && !Number.isNaN(parseInt(urlLevel))) setLevel(parseInt(urlLevel));
    if (urlPracticed && ['all', 'practiced', 'unpracticed'].includes(urlPracticed)) setPracticed(urlPracticed);
    if (urlTheme) setTheme(urlTheme);
    if (urlSubtopic) setSubtopic(urlSubtopic);
    if (urlQ) setQ(urlQ);
    if (urlGenre) setGenre(urlGenre);
    if (urlSort && ['recommended', 'recent', 'levelAsc', 'levelDesc', 'completion'].includes(urlSort)) setSortBy(urlSort as SortKey);
    if (urlLimit && !Number.isNaN(parseInt(urlLimit))) setPageSize(Math.max(1, Math.min(200, parseInt(urlLimit))));
    if (urlOffset && !Number.isNaN(parseInt(urlOffset))) {
      const off = Math.max(0, parseInt(urlOffset));
      const effLimit = (urlLimit && !Number.isNaN(parseInt(urlLimit))) ? Math.max(1, Math.min(200, parseInt(urlLimit))) : 20;
      setPage(Math.floor(off / effLimit) + 1);
    }

    if (!urlLang && !urlLevel && !urlPracticed) {
      const persisted = loadClozeFilters();
      if (persisted) {
        if (persisted.lang) setLang(persisted.lang);
        if (persisted.level != null) setLevel(persisted.level || '');
        if (persisted.practiced) setPracticed(persisted.practiced);
        if (persisted.theme) setTheme(persisted.theme || '');
        if (persisted.subtopic) setSubtopic(persisted.subtopic || '');
        if (persisted.q) setQ(persisted.q || '');
        if (typeof persisted.genre === 'string') setGenre(persisted.genre || 'all');
        if (persisted.sort) setSortBy(persisted.sort);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步 URL 与本地存储
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams?.entries() || []));
    if (lang) params.set('lang', String(lang)); else params.delete('lang');
    if (level) params.set('level', String(level)); else params.delete('level');
    if (practiced) params.set('practiced', practiced); else params.delete('practiced');
    if (theme) params.set('theme', theme); else params.delete('theme');
    if (subtopic) params.set('subtopic', subtopic); else params.delete('subtopic');
    if (q) params.set('q', q); else params.delete('q');
    if (genre && genre !== 'all') params.set('genre', genre); else params.delete('genre');
    if (sortBy && sortBy !== 'recommended') params.set('sort', sortBy); else params.delete('sort');
    params.set('limit', String(pageSize));
    params.set('offset', String(Math.max(0, (page - 1) * pageSize)));
    router.replace(`${pathname}?${params.toString()}`);
    saveClozeFilters({
      lang: lang || undefined,
      level: level === '' ? null : level,
      practiced,
      theme: theme || null,
      subtopic: subtopic || null,
      q: q || null,
      genre: genre && genre !== 'all' ? genre : null,
      sort: sortBy !== 'recommended' ? sortBy : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, level, practiced, theme, subtopic, q, genre, sortBy, page, pageSize]);

  // 条件变化时回到第 1 页
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, level, practiced, theme, subtopic, q, genre, sortBy]);

  const fetchItems = async () => {
      // 取消上一次请求
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError('');
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError('请先登录');
          setItems([]);
          setLoading(false);
          return;
        }

        const params = new URLSearchParams();
        if (lang) params.set('lang', String(lang));
        if (level) params.set('level', String(level));
        if (practiced !== 'all') params.set('practiced', practiced === 'practiced' ? 'true' : 'false');
        if (theme) params.set('theme', theme);
        if (subtopic) params.set('subtopic', subtopic);
        if (q) params.set('q', q);
        if (genre && genre !== 'all') params.set('genre', genre);
        params.set('limit', String(pageSize));
        params.set('offset', String(Math.max(0, (page - 1) * pageSize)));

        const resp = await fetch(`/api/cloze-shadowing/catalog?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await resp.json();
        if (!resp.ok || !data?.success) throw new Error(data?.error || '加载失败');
        setItems(data.items || []);
        setThemes(data.themes || []);
        setSubtopics(data.subtopics || []);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        if (!selectedId && (data.items || []).length > 0) setSelectedId(data.items[0].id);
      } catch (e: any) {
        // 忽略中止错误
        if (e?.name === 'AbortError') return;
        let msg = '加载失败';
        try {
          msg = e?.message ? String(e.message) : msg;
        } catch {}
        setError(msg);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => {
      clearTimeout(t);
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, level, practiced, theme, subtopic, q, genre, page, pageSize]);

  const filtered = useMemo(() => {
    const arr = [...items];
    const getLastTs = (it: ShadowingItem) => (it.stats?.lastPracticed ? new Date(it.stats.lastPracticed).getTime() : 0);
    if (sortBy === 'recent') {
      return arr.sort((a, b) => getLastTs(b) - getLastTs(a));
    }
    if (sortBy === 'levelAsc') {
      return arr.sort((a, b) => a.level - b.level);
    }
    if (sortBy === 'levelDesc') {
      return arr.sort((a, b) => b.level - a.level);
    }
    if (sortBy === 'completion') {
      return arr.sort((a, b) => {
        const pa = a.isPracticed ? 1 : 0;
        const pb = b.isPracticed ? 1 : 0;
        if (pb !== pa) return pb - pa; // 已完成优先
        return getLastTs(b) - getLastTs(a);
      });
    }
    // recommended
    if (recommendedLevel != null) {
      return arr.sort((a, b) => {
        const ua = a.isPracticed ? 1 : 0;
        const ub = b.isPracticed ? 1 : 0;
        if (ua !== ub) return ua - ub; // 未完成优先
        const da = Math.abs(a.level - recommendedLevel);
        const db = Math.abs(b.level - recommendedLevel);
        if (da !== db) return da - db; // 更接近推荐等级
        return getLastTs(b) - getLastTs(a); // 最近练习优先
      });
    }
    // 无推荐等级时退化为最近练习
    return arr.sort((a, b) => getLastTs(b) - getLastTs(a));
  }, [items, sortBy, recommendedLevel]);

  const selectedItem = useMemo(() => filtered.find((x) => x.id === selectedId) || null, [filtered, selectedId]);

  const unpracticedPool = useMemo(() => filtered.filter((x) => !x.isPracticed), [filtered]);
  const lastPracticedItem = useMemo(() => {
    const withTs = filtered
      .filter((x) => !!x.stats?.lastPracticed)
      .map((x) => ({ it: x, ts: new Date(x.stats!.lastPracticed as string).getTime() }));
    if (withTs.length === 0) return null;
    withTs.sort((a, b) => b.ts - a.ts);
    return withTs[0].it;
  }, [filtered]);

  const totalCount = filtered.length;
  const completedCount = useMemo(() => filtered.filter((x) => x.isPracticed).length, [filtered]);
  const draftCount = useMemo(() => filtered.filter((x) => x.status === 'draft').length, [filtered]);
  const unstartedCount = Math.max(0, totalCount - completedCount - draftCount);
  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = (page - 1) * pageSize + items.length;
  const hasPrev = page > 1;
  const hasNext = pageEnd < total;

  const gotoItem = (id: string) => router.push(`/practice/cloze-shadowing/${id}`);

  const getRandomUnpracticed = () => {
    if (unpracticedPool.length === 0) return;
    const idx = Math.floor(Math.random() * unpracticedPool.length);
    gotoItem(unpracticedPool[idx].id);
  };

  const getNextUnpracticed = () => {
    if (unpracticedPool.length === 0) return;
    gotoItem(unpracticedPool[0].id);
  };

  // 推荐等级（与 Shadowing 页面对齐）
  useEffect(() => {
    const doFetch = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const effectiveLang = (lang || 'zh') as string;
        const resp = await fetch(`/api/shadowing/recommended?lang=${effectiveLang}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (typeof data?.recommended === 'number') setRecommendedLevel(data.recommended);
      } catch {
        // ignore
      }
    };
    doFetch();
  }, [lang]);

  // 筛选胶囊
  const themeTitle = useMemo(() => themes.find((t) => t.id === theme)?.title || '', [themes, theme]);
  const subtopicTitle = useMemo(() => subtopics.find((s) => s.id === subtopic)?.title || '', [subtopics, subtopic]);
  const activeChips = useMemo(
    () => {
      const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
      const langMap: Record<Lang, string> = { ja: '日本語', en: 'English', zh: '中文（普通话）' };
      if (lang) chips.push({ key: 'lang', label: `语言: ${langMap[lang]}`, onRemove: () => setLang('') });
      if (level !== '') chips.push({ key: 'level', label: `难度: L${level}`, onRemove: () => setLevel('') });
      if (practiced !== 'all') {
        const label = practiced === 'practiced' ? '已完成' : '未开始';
        chips.push({ key: 'practiced', label: `状态: ${label}`, onRemove: () => setPracticed('all') });
      }
      if (genre && genre !== 'all') {
        const genreMap: Record<string, string> = { dialogue: '对话', monologue: '独白', news: '新闻', lecture: '讲座' };
        chips.push({ key: 'genre', label: `体裁: ${genreMap[genre] || genre}`, onRemove: () => setGenre('all') });
      }
      if (theme) chips.push({ key: 'theme', label: `主题: ${themeTitle || theme}`, onRemove: () => { setTheme(''); setSubtopic(''); } });
      if (subtopic) chips.push({ key: 'subtopic', label: `小主题: ${subtopicTitle || subtopic}`, onRemove: () => setSubtopic('') });
      if (q) chips.push({ key: 'q', label: `搜索: ${q}`, onRemove: () => setQ('') });
      return chips;
    }, [lang, level, practiced, theme, subtopic, q, genre, themeTitle, subtopicTitle]
  );

  const resetAllFilters = () => {
    setLang('');
    setLevel('');
    setPracticed('all');
    setTheme('');
    setSubtopic('');
    setQ('');
    setGenre('all');
  };

  return (
    <main className="p-6">
      <Container>
        <Breadcrumbs items={[{ href: '/', label: '首页' }, { label: 'Shadowing 题库' }]} />
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Shadowing 题库</h1>
              <p className="text-muted-foreground text-sm">筛选并选择题目进行 Cloze 挖空练习</p>
            </div>
            <div className="flex items-center gap-2">
              {/* 移动端排序 */}
              <div className="md:hidden">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">推荐</SelectItem>
                    <SelectItem value="recent">最近练习</SelectItem>
                    <SelectItem value="levelAsc">难度从低到高</SelectItem>
                    <SelectItem value="levelDesc">难度从高到低</SelectItem>
                    <SelectItem value="completion">完成度优先</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">排序</span>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">推荐</SelectItem>
                    <SelectItem value="recent">最近练习</SelectItem>
                    <SelectItem value="levelAsc">难度从低到高</SelectItem>
                    <SelectItem value="levelDesc">难度从高到低</SelectItem>
                    <SelectItem value="completion">完成度优先</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="md:hidden" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="w-4 h-4 mr-2" /> 筛选
              </Button>
              <Button variant="outline" onClick={() => setSidebarCollapsed((v) => !v)}>
                {sidebarCollapsed ? '展开侧栏' : '隐藏侧栏'}
              </Button>
              <Button variant="outline" onClick={() => lastPracticedItem && gotoItem(lastPracticedItem.id)} disabled={!lastPracticedItem}>
                继续上次
              </Button>
              <Button variant="outline" onClick={getRandomUnpracticed} disabled={unpracticedPool.length === 0}>
                <Shuffle className="w-4 h-4 mr-2" /> 随机
              </Button>
              <Button variant="outline" onClick={getNextUnpracticed} disabled={unpracticedPool.length === 0}>
                <ArrowRight className="w-4 h-4 mr-2" /> 下一题
              </Button>
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-700 flex flex-wrap items-center gap-4">
            <span>共 {totalCount} 题</span>
            <span>已完成 {completedCount}</span>
            <span>草稿中 {draftCount}</span>
            <span>未开始 {unstartedCount}</span>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  onClick={c.onRemove}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                >
                  {c.label}
                  <X className="w-3 h-3" />
                </button>
              ))}
              <button onClick={resetAllFilters} className="text-xs text-muted-foreground underline hover:text-foreground">清空</button>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 mb-4 shadow-sm flex items-center justify-between gap-3">
              <span className="text-sm">{error}</span>
              <Button size="sm" variant="outline" onClick={() => fetchItems()}>重试</Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* 侧栏（桌面） */}
            {!sidebarCollapsed && (
            <aside className="hidden md:block md:col-span-3">
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-medium flex items-center gap-2"><Filter className="w-4 h-4" /> 筛选</div>
                </div>
                <div className="p-3 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">语言</label>
                    <Select value={lang || 'all'} onValueChange={(v) => setLang(v === 'all' ? '' : (v as Lang))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">中文（普通话）</SelectItem>
                      </SelectContent>
                    </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">难度</label>
                    <Select value={(level === '' ? 'all' : String(level))} onValueChange={(v) => setLevel(v === 'all' ? '' : parseInt(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="1">L1 - 初学</SelectItem>
                        <SelectItem value="2">L2 - 初中级</SelectItem>
                        <SelectItem value="3">L3 - 中级</SelectItem>
                        <SelectItem value="4">L4 - 中高级</SelectItem>
                        <SelectItem value="5">L5 - 高级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <div>
                      {total > 0 ? (
                        <span>
                          显示 {pageStart}-{Math.min(total, pageEnd)} / {total}
                        </span>
                      ) : (
                        <span>无结果</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={!hasPrev} onClick={() => { if (hasPrev) setPage((p) => Math.max(1, p - 1)); }}>上一页</Button>
                      <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => { if (hasNext) setPage((p) => p + 1); }}>下一页</Button>
                    </div>
                  </div>
                  {recommendedLevel != null && (
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center">!</div>
                        <span className="text-sm font-medium text-blue-700">推荐等级</span>
                      </div>
                      <div className="text-sm text-blue-700">推荐等级: L{recommendedLevel}</div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">体裁</label>
                    <Select value={genre} onValueChange={(v) => setGenre(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部体裁" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部体裁</SelectItem>
                        <SelectItem value="dialogue">对话</SelectItem>
                        <SelectItem value="monologue">独白</SelectItem>
                        <SelectItem value="news">新闻</SelectItem>
                        <SelectItem value="lecture">讲座</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">练习状态</label>
                    <Select value={practiced} onValueChange={(v) => setPracticed(v as 'all' | 'practiced' | 'unpracticed')}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="unpracticed">未开始</SelectItem>
                        <SelectItem value="practiced">已完成</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">大主题</label>
                    <Select value={theme || 'all'} onValueChange={(v) => { setTheme(v === 'all' ? '' : v); setSubtopic(''); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="（全部）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">（全部）</SelectItem>
                        {themes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">小主题</label>
                    <Select value={subtopic || 'all'} onValueChange={(v) => setSubtopic(v === 'all' ? '' : v)} disabled={!theme}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="（全部）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">（全部）</SelectItem>
                        {subtopics.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">搜索</label>
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题、主题..." />
                  </div>
                  <div className="pt-1">
                    <Button variant="secondary" className="w-full" onClick={() => { setLang(''); setLevel(''); setPracticed('all'); setTheme(''); setSubtopic(''); setQ(''); setGenre('all'); }}>重置筛选</Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border bg-card text-card-foreground max-h-[60vh] overflow-y-auto shadow-sm">
                {loading ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="p-3">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">暂无可练习的文章</div>
                ) : (
                  <div className="divide-y">
                    {filtered.map((it) => (
                      <button key={it.id} onClick={() => setSelectedId(it.id)} className={`w-full text-left p-3 transition-colors ${selectedId === it.id ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium line-clamp-2">{it.title}</div>
                          {it.isPracticed ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3 h-3" /> 已完成</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{it.lang.toUpperCase()} · L{it.level}</div>
                        <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                          <span>已发布 {it.stats?.sentenceCount ?? 0} 句</span>
                          {it.stats?.lastPracticed ? (
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(it.stats.lastPracticed).toLocaleDateString()}</span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <div>
                  {total > 0 ? (
                    <span>
                      显示 {pageStart}-{Math.min(total, pageEnd)} / {total}
                    </span>
                  ) : (
                    <span>无结果</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!hasPrev} onClick={() => hasPrev && setPage((p) => Math.max(1, p - 1))}>上一页</Button>
                  <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => hasNext && setPage((p) => p + 1)}>下一页</Button>
                </div>
              </div>
            </aside>
            )}

            {/* 主区域 */}
            <section className={sidebarCollapsed ? 'md:col-span-12' : 'md:col-span-9'}>
              {loading ? (
                <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-sm space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                  <div className="flex gap-3">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              ) : selectedItem ? (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card text-card-foreground p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold mb-1">{selectedItem.title}</div>
                        <div className="text-sm text-gray-600">{selectedItem.lang.toUpperCase()} · L{selectedItem.level}</div>
                      </div>
                      {selectedItem.isPracticed ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-4 h-4" /> 已完成</span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-sm text-gray-700 flex flex-wrap gap-3">
                      <span>已发布句数：{selectedItem.stats?.sentenceCount ?? 0}</span>
                      <span>
                        正确率/总句数：
                        {selectedItem.stats?.accuracy != null && selectedItem.stats?.totalSentences != null
                          ? `${Math.round((selectedItem.stats.accuracy || 0) * 100)}% / ${selectedItem.stats.totalSentences}`
                          : '—'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-4 h-4" /> 最近练习：{selectedItem.stats?.lastPracticed ? new Date(selectedItem.stats.lastPracticed).toLocaleString() : '—'}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button onClick={() => gotoItem(selectedItem.id)}>
                        开始练习
                      </Button>
                    </div>
          </div>

                  {/* 也可在此放置更多说明或预览 */}
                </div>
              ) : (
                <div className="rounded-xl border bg-card text-card-foreground p-6 text-center text-sm text-muted-foreground shadow-sm">请选择左侧题目开始</div>
              )}
            </section>
          </div>

          {/* 移动端抽屉侧栏 */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-40">
              <div className="absolute inset-0 bg-black/30" onClick={() => setMobileSidebarOpen(false)} />
              <div className={`absolute left-0 top-0 h-full w-80 bg-white shadow transition-transform ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-medium flex items-center gap-2"><Filter className="w-4 h-4" /> 筛选</div>
                  <button onClick={() => setMobileSidebarOpen(false)} className="p-1 rounded hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto h-full">
                  <div>
                    <label className="block text-sm font-medium mb-1">语言</label>
                    <Select value={lang || 'all'} onValueChange={(v) => setLang(v === 'all' ? '' : (v as Lang))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">中文（普通话）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">难度</label>
                    <Select value={(level === '' ? 'all' : String(level))} onValueChange={(v) => setLevel(v === 'all' ? '' : parseInt(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="1">L1 - 初学</SelectItem>
                        <SelectItem value="2">L2 - 初中级</SelectItem>
                        <SelectItem value="3">L3 - 中级</SelectItem>
                        <SelectItem value="4">L4 - 中高级</SelectItem>
                        <SelectItem value="5">L5 - 高级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {recommendedLevel != null && (
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center">!</div>
                        <span className="text-sm font-medium text-blue-700">推荐等级</span>
                      </div>
                      <div className="text-sm text-blue-700">推荐等级: L{recommendedLevel}</div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">体裁</label>
                    <Select value={genre} onValueChange={(v) => setGenre(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="全部体裁" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部体裁</SelectItem>
                        <SelectItem value="dialogue">对话</SelectItem>
                        <SelectItem value="monologue">独白</SelectItem>
                        <SelectItem value="news">新闻</SelectItem>
                        <SelectItem value="lecture">讲座</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">练习状态</label>
                    <Select value={practiced} onValueChange={(v) => setPracticed(v as 'all' | 'practiced' | 'unpracticed')}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="unpracticed">未开始</SelectItem>
                        <SelectItem value="practiced">已完成</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">大主题</label>
                    <Select value={theme || 'all'} onValueChange={(v) => { setTheme(v === 'all' ? '' : v); setSubtopic(''); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="（全部）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">（全部）</SelectItem>
                        {themes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">小主题</label>
                    <Select value={subtopic || 'all'} onValueChange={(v) => setSubtopic(v === 'all' ? '' : v)} disabled={!theme}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="（全部）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">（全部）</SelectItem>
                        {subtopics.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">搜索</label>
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题、主题..." />
                  </div>
                  <div className="pt-1">
                    <Button variant="secondary" className="w-full" onClick={() => { setLang(''); setLevel(''); setPracticed('all'); setTheme(''); setSubtopic(''); setQ(''); setGenre('all'); }}>重置筛选</Button>
                  </div>

                  <div className="mt-4 rounded-lg border">
                    {filtered.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">暂无可练习的文章</div>
                    ) : (
                      <div className="divide-y">
                        {filtered.map((it) => (
                          <button key={it.id} onClick={() => { setSelectedId(it.id); setMobileSidebarOpen(false); }} className={`w-full text-left p-3 hover:bg-gray-50 ${selectedId === it.id ? 'bg-gray-50' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium line-clamp-2">{it.title}</div>
                              {it.isPracticed ? (
                                <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3 h-3" /> 已完成</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{it.lang.toUpperCase()} · L{it.level}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
