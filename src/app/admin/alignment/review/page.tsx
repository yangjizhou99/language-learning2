'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = {
  id: string;
  lang: 'en' | 'ja' | 'zh';
  topic: string;
  status: string;
  created_at: string;
};

export default function AlignmentReviewList() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState<'all' | 'en' | 'ja' | 'zh'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 添加认证头
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const params = new URLSearchParams({ status: 'draft' });
      if (lang !== 'all') params.set('lang', lang);
      if (q.trim()) params.set('q', q.trim());

      const r = await fetch(`/api/admin/alignment/drafts?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await r.json();
      setItems(j.items || []);
      setLoading(false);
    })();
  }, [q, lang]);

  const list = useMemo(() => items, [items]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">对齐草稿审核</h1>
      <div className="flex gap-2">
        <input
          className="border rounded px-2 py-1"
          placeholder="搜索主题"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded px-2 py-1"
          value={lang}
          onChange={(e) => setLang(e.target.value as any)}
        >
          <option value="all">全部语言</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="zh">简体中文</option>
        </select>
      </div>
      {loading ? (
        <div>加载中…</div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {list.map((it) => (
            <div key={it.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">
                  {it.lang} · {new Date(it.created_at).toLocaleString()}
                </div>
                <div className="font-medium">{it.topic}</div>
              </div>
              <Link
                className="px-3 py-1 rounded bg-blue-600 text-white"
                href={`/admin/alignment/review/${it.id}`}
              >
                查看
              </Link>
            </div>
          ))}
          {list.length === 0 && <div className="p-6 text-center text-gray-500">暂无草稿</div>}
        </div>
      )}
    </div>
  );
}
