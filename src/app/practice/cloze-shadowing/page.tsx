'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { loadFilters as loadClozeFilters, saveFilters as saveClozeFilters } from '@/lib/clozeShadowingFilterStorage';
import { Input } from '@/components/ui/input';
import { Menu, X, Filter, Shuffle, ArrowRight, CheckCircle, Clock, BookOpen, Target, FileEdit, Circle, Star, Sparkles } from 'lucide-react';
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
      } catch (e) {
        // 忽略中止错误
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        let msg = '加载失败';
        try {
          if (e && typeof e === 'object' && 'message' in e && e.message) {
            msg = String(e.message);
          }
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Shadowing 题库</h1>
              <p className="text-muted-foreground text-sm">筛选并选择题目进行 Cloze 挖空练习</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 排序选择器 */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card">
                <span className="text-sm text-muted-foreground hidden md:inline">排序</span>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="w-32 h-8 border-0 shadow-none">
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
              
              {/* 筛选按钮（移动端） */}
              <Button variant="outline" size="sm" className="md:hidden" onClick={() => setMobileSidebarOpen(true)}>
                <Filter className="w-4 h-4 mr-2" /> 筛选
              </Button>
              
              {/* 侧栏控制（桌面端） */}
              <Button variant="outline" size="sm" className="hidden md:flex" onClick={() => setSidebarCollapsed((v) => !v)}>
                <Menu className="w-4 h-4 mr-2" />
                {sidebarCollapsed ? '展开' : '收起'}
              </Button>
              
              {/* 快捷操作按钮组 */}
              <div className="flex items-center gap-2 p-1 rounded-lg border bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => lastPracticedItem && gotoItem(lastPracticedItem.id)} 
                  disabled={!lastPracticedItem}
                  className="hover:bg-white/80 transition-all hover:shadow-sm"
                  title="继续上次练习"
                >
                  <Clock className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">继续</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={getRandomUnpracticed} 
                  disabled={unpracticedPool.length === 0}
                  className="hover:bg-white/80 transition-all hover:shadow-sm"
                  title="随机选择未完成题目"
                >
                  <Shuffle className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">随机</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={getNextUnpracticed} 
                  disabled={unpracticedPool.length === 0}
                  className="hover:bg-white/80 transition-all hover:shadow-sm"
                  title="下一个未完成题目"
                >
                  <ArrowRight className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">下一题</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* 总题数 */}
            <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 transition-all hover:shadow-md hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-1">总题数</p>
                  <p className="text-2xl font-bold text-blue-900">{totalCount}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
            
            {/* 已完成 */}
            <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-green-50 to-green-100/50 p-4 transition-all hover:shadow-md hover:scale-105">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs text-green-600 font-medium mb-1">已完成</p>
                  <p className="text-2xl font-bold text-green-900">{completedCount}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
              {/* 进度条 */}
              <div className="w-full bg-green-200/50 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-green-600 mt-1">
                {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
              </p>
            </div>
            
            {/* 草稿中 */}
            <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 transition-all hover:shadow-md hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium mb-1">草稿中</p>
                  <p className="text-2xl font-bold text-amber-900">{draftCount}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <FileEdit className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>
            
            {/* 未开始 */}
            <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 transition-all hover:shadow-md hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-1">未开始</p>
                  <p className="text-2xl font-bold text-gray-900">{unstartedCount}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center">
                  <Circle className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {activeChips.map((c) => {
                // 根据不同类型使用不同的颜色
                let chipColor = 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
                if (c.key === 'lang') chipColor = 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200';
                if (c.key === 'level') chipColor = 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200';
                if (c.key === 'practiced') chipColor = 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
                if (c.key === 'genre') chipColor = 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200';
                if (c.key === 'theme') chipColor = 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200';
                if (c.key === 'subtopic') chipColor = 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200';
                if (c.key === 'q') chipColor = 'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200';
                
                return (
                  <button
                    key={c.key}
                    onClick={c.onRemove}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${chipColor} hover:shadow-sm group`}
                  >
                    <span>{c.label}</span>
                    <X className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
                  </button>
                );
              })}
              <button 
                onClick={resetAllFilters} 
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 underline decoration-dotted hover:decoration-solid transition-all"
              >
                <X className="w-3.5 h-3.5" />
                清空全部
              </button>
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
                    <div className="relative p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-lg border-2 border-amber-200 shadow-md overflow-hidden animate-pulse">
                      {/* 装饰性闪光效果 */}
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-200/30 to-amber-200/30 rounded-full blur-2xl" />
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                            <Star className="w-4 h-4 text-white fill-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-bold text-amber-900">为你推荐</span>
                          </div>
                        </div>
                        <div className="text-lg font-bold text-amber-900 flex items-baseline gap-2">
                          <span>等级</span>
                          <span className="text-2xl text-orange-600">L{recommendedLevel}</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">根据你的学习进度推荐</p>
                      </div>
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
                      <div key={i} className="p-3 animate-pulse">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">暂无可练习的文章</p>
                    <Button variant="outline" size="sm" onClick={resetAllFilters}>重置筛选条件</Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filtered.map((it) => {
                      // 根据难度级别设置徽章颜色
                      const getLevelBadgeColor = (level: number) => {
                        if (level === 1) return 'bg-green-100 text-green-700 border-green-200';
                        if (level === 2) return 'bg-blue-100 text-blue-700 border-blue-200';
                        if (level === 3) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
                        if (level === 4) return 'bg-purple-100 text-purple-700 border-purple-200';
                        if (level === 5) return 'bg-red-100 text-red-700 border-red-200';
                        return 'bg-gray-100 text-gray-700 border-gray-200';
                      };
                      
                      // 语言标识色
                      const getLangColor = (lang: string) => {
                        if (lang === 'en') return 'text-blue-600';
                        if (lang === 'ja') return 'text-pink-600';
                        if (lang === 'zh') return 'text-red-600';
                        return 'text-gray-600';
                      };
                      
                      return (
                        <button 
                          key={it.id} 
                          onClick={() => setSelectedId(it.id)} 
                          className={`w-full text-left p-3 transition-all relative group ${
                            selectedId === it.id 
                              ? 'bg-gradient-to-r from-violet-50 to-indigo-50 border-l-4 border-l-violet-500' 
                              : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="font-medium line-clamp-2 flex-1">{it.title}</div>
                            {it.isPracticed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 text-xs font-medium shrink-0">
                                <CheckCircle className="w-3 h-3" /> 已完成
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold ${getLangColor(it.lang)}`}>
                              {it.lang.toUpperCase()}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${getLevelBadgeColor(it.level)}`}>
                              L{it.level}
                            </span>
                            <span className="text-xs text-gray-500">
                              {it.stats?.sentenceCount ?? 0} 句
                            </span>
                            {it.stats?.lastPracticed ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" /> 
                                {new Date(it.stats.lastPracticed).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* 分页控件 */}
              <div className="mt-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-lg border">
                <div className="flex flex-col gap-3">
                  {/* 显示信息和页码 */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-medium text-gray-700">
                      {total > 0 ? (
                        <span>
                          显示 <span className="text-violet-600 font-bold">{pageStart}-{Math.min(total, pageEnd)}</span> / 共 <span className="text-violet-600 font-bold">{total}</span> 题
                        </span>
                      ) : (
                        <span className="text-gray-500">无结果</span>
                      )}
                    </div>
                    <div className="font-medium text-gray-700">
                      第 <span className="text-violet-600 font-bold">{page}</span> / {Math.max(1, Math.ceil(total / pageSize))} 页
                    </div>
                  </div>
                  
                  {/* 分页按钮和每页数量 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={!hasPrev} 
                        onClick={() => hasPrev && setPage((p) => Math.max(1, p - 1))}
                        className="h-8 px-3 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 transition-colors disabled:opacity-50"
                      >
                        上一页
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={!hasNext} 
                        onClick={() => hasNext && setPage((p) => p + 1)}
                        className="h-8 px-3 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 transition-colors disabled:opacity-50"
                      >
                        下一页
                      </Button>
                    </div>
                    
                    {/* 每页数量选择 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">每页</span>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                        <SelectTrigger className="h-8 w-16 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-gray-600">条</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
            )}

            {/* 主区域 */}
            <section className={sidebarCollapsed ? 'md:col-span-12' : 'md:col-span-9'}>
              {loading ? (
                <div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm space-y-4 animate-pulse">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-1/4" />
                  <div className="flex gap-3 mt-6">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              ) : selectedItem ? (
                <div className="space-y-4">
                  {(() => {
                    // 根据难度级别设置渐变背景色
                    const getGradientByLevel = (level: number) => {
                      if (level === 1) return 'from-green-500/10 via-emerald-500/5 to-transparent';
                      if (level === 2) return 'from-blue-500/10 via-cyan-500/5 to-transparent';
                      if (level === 3) return 'from-indigo-500/10 via-blue-500/5 to-transparent';
                      if (level === 4) return 'from-purple-500/10 via-violet-500/5 to-transparent';
                      if (level === 5) return 'from-red-500/10 via-rose-500/5 to-transparent';
                      return 'from-gray-500/10 via-gray-500/5 to-transparent';
                    };
                    
                    const getLevelBadgeColor = (level: number) => {
                      if (level === 1) return 'bg-green-100 text-green-700 border-green-200';
                      if (level === 2) return 'bg-blue-100 text-blue-700 border-blue-200';
                      if (level === 3) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
                      if (level === 4) return 'bg-purple-100 text-purple-700 border-purple-200';
                      if (level === 5) return 'bg-red-100 text-red-700 border-red-200';
                      return 'bg-gray-100 text-gray-700 border-gray-200';
                    };
                    
                    const getLangColor = (lang: string) => {
                      if (lang === 'en') return 'text-blue-600 bg-blue-50';
                      if (lang === 'ja') return 'text-pink-600 bg-pink-50';
                      if (lang === 'zh') return 'text-red-600 bg-red-50';
                      return 'text-gray-600 bg-gray-50';
                    };
                    
                    const accuracy = selectedItem.stats?.accuracy ?? 0;
                    const accuracyPercent = Math.round(accuracy * 100);
                    
                    return (
                      <div className={`rounded-xl border bg-gradient-to-br ${getGradientByLevel(selectedItem.level)} p-6 shadow-lg relative overflow-hidden`}>
                        {/* 装饰性背景图案 */}
                        <div className="absolute top-0 right-0 w-64 h-64 opacity-5">
                          <div className="w-full h-full bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full blur-3xl" />
                        </div>
                        
                        <div className="relative z-10">
                          {/* 头部信息 */}
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex-1">
                              <h2 className="text-2xl font-bold mb-3">{selectedItem.title}</h2>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getLangColor(selectedItem.lang)}`}>
                                  {selectedItem.lang.toUpperCase()}
                                </span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-md border text-sm font-medium ${getLevelBadgeColor(selectedItem.level)}`}>
                                  L{selectedItem.level}
                                </span>
                              </div>
                            </div>
                            {selectedItem.isPracticed ? (
                              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 font-medium shadow-sm">
                                <CheckCircle className="w-5 h-5" /> 已完成
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-medium">
                                <Circle className="w-5 h-5" /> 未开始
                              </div>
                            )}
                          </div>
                          
                          {/* 统计信息网格 */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {/* 已发布句数 */}
                            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <BookOpen className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-0.5">已发布句数</p>
                                  <p className="text-xl font-bold text-gray-900">{selectedItem.stats?.sentenceCount ?? 0}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* 正确率 */}
                            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border shadow-sm">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                  <Target className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-0.5">正确率</p>
                                  <p className="text-xl font-bold text-gray-900">
                                    {selectedItem.stats?.accuracy != null ? `${accuracyPercent}%` : '—'}
                                  </p>
                                </div>
                              </div>
                              {selectedItem.stats?.accuracy != null && (
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${accuracyPercent}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            
                            {/* 练习历史 */}
                            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                  <Clock className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-0.5">最近练习</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {selectedItem.stats?.lastPracticed 
                                      ? new Date(selectedItem.stats.lastPracticed).toLocaleDateString() 
                                      : '从未练习'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* 操作按钮 */}
                          <div className="flex flex-wrap gap-3">
                            <Button 
                              onClick={() => gotoItem(selectedItem.id)}
                              size="lg"
                              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
                            >
                              <ArrowRight className="w-5 h-5 mr-2" />
                              开始练习
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 也可在此放置更多说明或预览 */}
                </div>
              ) : (
                <div className="rounded-xl border bg-gradient-to-br from-gray-50 to-gray-100/50 p-12 text-center shadow-sm">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                    <Target className="w-10 h-10 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">选择题目开始练习</h3>
                  <p className="text-sm text-muted-foreground mb-4">从左侧列表中选择一个题目，或使用上方的快捷按钮</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={getRandomUnpracticed} 
                      disabled={unpracticedPool.length === 0}
                    >
                      <Shuffle className="w-4 h-4 mr-2" />
                      随机选题
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => lastPracticedItem && gotoItem(lastPracticedItem.id)} 
                      disabled={!lastPracticedItem}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      继续上次
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* 移动端抽屉侧栏 */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-40 animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
              <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl transition-transform duration-300 ease-out animate-in slide-in-from-left">
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
                    <div className="relative p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-lg border-2 border-amber-200 shadow-md overflow-hidden animate-pulse">
                      {/* 装饰性闪光效果 */}
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-200/30 to-amber-200/30 rounded-full blur-2xl" />
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                            <Star className="w-4 h-4 text-white fill-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-bold text-amber-900">为你推荐</span>
                          </div>
                        </div>
                        <div className="text-lg font-bold text-amber-900 flex items-baseline gap-2">
                          <span>等级</span>
                          <span className="text-2xl text-orange-600">L{recommendedLevel}</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">根据你的学习进度推荐</p>
                      </div>
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

                  <div className="mt-4 rounded-lg border bg-card overflow-hidden">
                    {filtered.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">暂无可练习的文章</p>
                        <Button variant="outline" size="sm" onClick={resetAllFilters}>重置筛选条件</Button>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filtered.map((it) => {
                          // 根据难度级别设置徽章颜色
                          const getLevelBadgeColor = (level: number) => {
                            if (level === 1) return 'bg-green-100 text-green-700 border-green-200';
                            if (level === 2) return 'bg-blue-100 text-blue-700 border-blue-200';
                            if (level === 3) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
                            if (level === 4) return 'bg-purple-100 text-purple-700 border-purple-200';
                            if (level === 5) return 'bg-red-100 text-red-700 border-red-200';
                            return 'bg-gray-100 text-gray-700 border-gray-200';
                          };
                          
                          // 语言标识色
                          const getLangColor = (lang: string) => {
                            if (lang === 'en') return 'text-blue-600';
                            if (lang === 'ja') return 'text-pink-600';
                            if (lang === 'zh') return 'text-red-600';
                            return 'text-gray-600';
                          };
                          
                          return (
                            <button 
                              key={it.id} 
                              onClick={() => { setSelectedId(it.id); setMobileSidebarOpen(false); }} 
                              className={`w-full text-left p-3 transition-all relative ${
                                selectedId === it.id 
                                  ? 'bg-gradient-to-r from-violet-50 to-indigo-50 border-l-4 border-l-violet-500' 
                                  : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="font-medium line-clamp-2 flex-1">{it.title}</div>
                                {it.isPracticed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 text-xs font-medium shrink-0">
                                    <CheckCircle className="w-3 h-3" /> 已完成
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${getLangColor(it.lang)}`}>
                                  {it.lang.toUpperCase()}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${getLevelBadgeColor(it.level)}`}>
                                  L{it.level}
                                </span>
                              </div>
                            </button>
                          );
                        })}
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
