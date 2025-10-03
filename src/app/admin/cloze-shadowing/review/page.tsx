'use client';

import { useEffect, useState } from 'react';
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
      } catch (e: any) {
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [onlyUnpublished]);

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
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">只看存在未发布题目的文章（进入详情后可发布）</div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyUnpublished} onChange={(e) => setOnlyUnpublished(e.target.checked)} />
                仅看未发布
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it) => (
                <Link key={it.id} href={`/admin/cloze-shadowing/review/${it.id}`} className="p-4 border rounded hover:bg-gray-50">
                  <div className="text-lg font-medium mb-1">{it.title}</div>
                  <div className="text-sm text-gray-600">{it.lang?.toUpperCase()} / L{it.level}</div>
                </Link>
              ))}
            </div>
            {items.length === 0 && <div className="text-gray-500">暂无已发布 Shadowing 文章</div>}
          </div>
        )}
      </div>
    </div>
  );
}



