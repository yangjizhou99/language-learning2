'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Item {
  id: string;
  lang: string;
  level: number;
  title: string;
  created_at?: string;
}

export default function ClozeShadowingReviewIndexPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [onlyUnpublished, setOnlyUnpublished] = useState<boolean>(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterLang, setFilterLang] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // 先取出存在 cloze 生成记录的文章 ID（支持仅看未发布）
        let clozeQuery = supabase
          .from('cloze_shadowing_items')
          .select('source_item_id,created_at')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (onlyUnpublished) clozeQuery = clozeQuery.eq('is_published', false);
        const { data: clozeRows } = await clozeQuery;
        const seen = new Set<string>();
        const ids: string[] = [];
        (clozeRows || []).forEach((r: any) => {
          const id = String(r.source_item_id);
          if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
        });

        if (ids.length === 0) {
          setItems([]);
          return;
        }

        // 再按这些 ID 加载文章基本信息，并保持与 ids 相同的排序
        const { data: articles } = await supabase
          .from('shadowing_items')
          .select('id,lang,level,title,created_at')
          .in('id', ids);
        const map = new Map<string, any>();
        (articles || []).forEach((a: any) => map.set(String(a.id), a));
        const ordered = ids.map((id) => map.get(id)).filter(Boolean);
        setItems(ordered as any[]);
        setSelected({});
      } catch (e: any) {
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [onlyUnpublished, refreshTick]);

  const displayed = useMemo(() => {
    return items.filter((it) => {
      if (filterLang && String(it.lang) !== filterLang) return false;
      if (filterLevel && Number(it.level) !== filterLevel) return false;
      if (search && !String(it.title || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filterLang, filterLevel, search]);

  const allChecked = displayed.length > 0 && displayed.every((it) => selected[it.id]);
  const toggleAll = (checked: boolean) => {
    if (!displayed.length) return;
    const next: Record<string, boolean> = { ...selected };
    displayed.forEach((it) => { next[it.id] = checked; });
    setSelected(next);
  };

  const batchPublish = async (publish: boolean) => {
    try {
      const ids = displayed.filter((it) => selected[it.id]).map((it) => it.id);
      if (ids.length === 0) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return alert('请先登录');
      for (const id of ids) {
        const res = await fetch('/api/admin/cloze-shadowing/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ source_item_id: id, publish }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          console.warn('发布失败', id, j?.error);
        }
      }
      setRefreshTick((n) => n + 1);
      alert(publish ? '批量发布完成' : '批量撤销完成');
    } catch (e: any) {
      alert('操作失败：' + (e?.message || String(e)));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-semibold text-gray-900">Lang Trainer</Link>
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-700 hover:text-gray-900">控制台</Link>
              <span className="text-blue-600 font-medium">Cloze-Shadowing 审阅</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">返回控制台</Link>
            <Link href="/" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">返回首页</Link>
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Cloze-Shadowing 审阅</h1>
        {error && <div className="px-4 py-3 rounded border border-red-300 bg-red-50 text-red-700">{error}</div>}
        {loading ? (
          <div className="p-4">加载中...</div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="mb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={onlyUnpublished} onChange={(e) => setOnlyUnpublished(e.target.checked)} />
                  仅看未发布
                </label>
                <label className="flex items-center gap-2">
                  <span>语言</span>
                  <select value={filterLang} onChange={(e) => setFilterLang(e.target.value)} className="border rounded px-2 py-1">
                    <option value="">全部</option>
                    <option value="en">EN</option>
                    <option value="ja">JA</option>
                    <option value="zh">ZH</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span>等级</span>
                  <select value={filterLevel} onChange={(e) => setFilterLevel(parseInt(e.target.value) || 0)} className="border rounded px-2 py-1">
                    <option value={0 as any}>全部</option>
                    <option value={1 as any}>L1</option>
                    <option value={2 as any}>L2</option>
                    <option value={3 as any}>L3</option>
                    <option value={4 as any}>L4</option>
                    <option value={5 as any}>L5</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索标题" className="w-full border rounded px-2 py-1" />
              </div>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} />
                  全选当前列表
                </label>
                <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={() => batchPublish(true)} disabled={displayed.filter((it) => selected[it.id]).length === 0}>批量发布</button>
                <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={() => batchPublish(false)} disabled={displayed.filter((it) => selected[it.id]).length === 0}>批量撤销</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map((it) => (
                <div key={it.id} className="p-4 border rounded">
                  <div className="flex items-start justify-between gap-3">
                    <label className="mt-1">
                      <input
                        type="checkbox"
                        checked={!!selected[it.id]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [it.id]: e.target.checked }))}
                      />
                    </label>
                    <Link href={`/admin/cloze-shadowing/review/${it.id}`} className="flex-1 hover:underline">
                      <div className="text-lg font-medium mb-1">{it.title}</div>
                      <div className="text-sm text-gray-600">{it.lang?.toUpperCase()} / L{it.level}</div>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {displayed.length === 0 && <div className="text-gray-500">暂无数据</div>}
          </div>
        )}
      </div>
    </div>
  );
}



