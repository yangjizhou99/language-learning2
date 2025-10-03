'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';

type Lang = 'en' | 'ja' | 'zh';

interface ShadowingItem {
  id: string;
  lang: Lang;
  level: number;
  title: string;
}

export default function ClozeShadowingEntryPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ShadowingItem[]>([]);
  const [lang, setLang] = useState<Lang | ''>('');
  const [level, setLevel] = useState<number | ''>('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError('请先登录');
          setLoading(false);
          return;
        }

        // 最近生成的 cloze_shadowing_items（只拿 id 列表，客户端去重）
        const { data: rows, error: e1 } = await supabase
          .from('cloze_shadowing_items')
          .select('source_item_id, created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        if (e1) throw e1;

        const ids: string[] = [];
        for (const r of rows || []) {
          if (r?.source_item_id && !ids.includes(r.source_item_id)) ids.push(r.source_item_id);
          if (ids.length >= 60) break;
        }
        if (ids.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        const { data: articles, error: e2 } = await supabase
          .from('shadowing_items')
          .select('id, lang, level, title, status')
          .in('id', ids)
          .eq('status', 'approved');
        if (e2) throw e2;

        const mapped = (articles || []).map((a: any) => ({
          id: a.id,
          lang: a.lang as Lang,
          level: a.level as number,
          title: a.title as string,
        }));
        // 按 ids 原顺序排序
        mapped.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        setItems(mapped);
      } catch (e: any) {
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => (lang ? it.lang === lang : true) && (level ? it.level === level : true));
  }, [items, lang, level]);

  return (
    <main className="p-6">
      <Container>
        <Breadcrumbs items={[{ href: '/', label: '首页' }, { label: 'Cloze-Shadowing 挖空练习' }]} />
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Cloze-Shadowing 挖空练习</h1>
            <p className="text-muted-foreground">选择一篇 Shadowing 文章开始逐句挖空练习</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded border border-red-300 bg-red-50 text-red-700">{error}</div>
          )}

          <div className="rounded-lg border bg-card text-card-foreground p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">语言</label>
                <select value={lang} onChange={(e) => setLang((e.target.value || '') as any)} className="w-40 p-2 border rounded">
                  <option value="">全部</option>
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">难度</label>
                <select value={level as any} onChange={(e) => setLevel(e.target.value ? parseInt(e.target.value) : ('' as any))} className="w-40 p-2 border rounded">
                  <option value="">全部</option>
                  <option value={1}>L1</option>
                  <option value={2}>L2</option>
                  <option value={3}>L3</option>
                  <option value={4}>L4</option>
                  <option value={5}>L5</option>
                </select>
              </div>
              <div className="ml-auto">
                <Button onClick={() => { setLang('' as any); setLevel('' as any); }}>重置筛选</Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-4">加载中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((it) => (
                <div key={it.id} className="p-4 border rounded-lg bg-white">
                  <div className="font-medium mb-1 line-clamp-2">{it.title}</div>
                  <div className="text-sm text-gray-600 mb-3">{it.lang.toUpperCase()} / L{it.level}</div>
                  <Link href={`/practice/cloze-shadowing/${it.id}`} className="inline-block">
                    <Button>开始练习</Button>
                  </Link>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-gray-500">暂无可练习的文章，请先联系管理员生成题库</div>
              )}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}



