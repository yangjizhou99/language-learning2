'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Row {
  sentence_index: number;
  sentence_text: string;
  blank_start: number;
  blank_length: number;
  correct_options: string[];
  distractor_options: string[];
  is_published?: boolean;
}

export default function ClozeShadowingReviewArticlePage() {
  const params = useParams();
  const articleId = String(params?.articleId || '');

  const [rows, setRows] = useState<Row[]>([]);
  const [article, setArticle] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: a } = await supabase
          .from('shadowing_items')
          .select('id,lang,level,title')
          .eq('id', articleId)
          .single();
        setArticle(a || null);

        const { data: s } = await supabase
          .from('cloze_shadowing_items')
          .select('sentence_index,sentence_text,blank_start,blank_length,correct_options,distractor_options,is_published')
          .eq('source_item_id', articleId)
          .order('sentence_index', { ascending: true });
        setRows((s || []) as Row[]);
      } catch (e: any) {
        setError(e?.message || '加载失败');
      }
    };
    if (articleId) load();
  }, [articleId]);

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{article?.title || '未命名'}（{article?.lang?.toUpperCase()} / L{article?.level}）</h1>
          <Link href={`/practice/cloze-shadowing/${articleId}`} className="text-blue-600 hover:underline">跳转到学员练习</Link>
        </div>

        {error && (
          <div className="px-4 py-3 rounded border border-red-300 bg-red-50 text-red-700">{error}</div>
        )}

        <div className="bg-white p-6 rounded-lg shadow space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">共 {rows.length} 题，已发布 {rows.filter((r) => r.is_published).length} 题</div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return alert('请先登录');
                  const res = await fetch('/api/admin/cloze-shadowing/publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ source_item_id: articleId, publish: true }),
                  });
                  if (res.ok) {
                    setRows((prev) => prev.map((r) => ({ ...r, is_published: true })));
                  } else {
                    const j = await res.json().catch(() => ({}));
                    alert(j?.error || '发布失败');
                  }
                }}
              >发布全部</button>
              <button
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return alert('请先登录');
                  const res = await fetch('/api/admin/cloze-shadowing/publish', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ source_item_id: articleId, publish: false }),
                  });
                  if (res.ok) {
                    setRows((prev) => prev.map((r) => ({ ...r, is_published: false })));
                  } else {
                    const j = await res.json().catch(() => ({}));
                    alert(j?.error || '撤销失败');
                  }
                }}
              >撤销全部</button>
            </div>
          </div>
          {rows.map((r) => {
            const isBlanked = (r.blank_length || 0) > 0 && (r.correct_options || []).length > 0;
            const before = r.sentence_text.slice(0, r.blank_start);
            const blank = r.sentence_text.slice(r.blank_start, r.blank_start + r.blank_length);
            const after = r.sentence_text.slice(r.blank_start + r.blank_length);
            return (
              <div key={r.sentence_index} className="p-3 border rounded">
                <div className="text-sm text-gray-500 mb-1">第 {r.sentence_index + 1} 句</div>
                {isBlanked ? (
                  <>
                    <div className="mb-2 leading-8">
                      <span>{before}</span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">{blank}</span>
                      <span>{after}</span>
                    </div>
                    <div className="text-sm">
                      <div className="mb-1">正确项：{(r.correct_options || []).join(' / ')}</div>
                      <div className="text-gray-500">干扰项：{(r.distractor_options || []).join(' / ')}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-2 leading-8">{r.sentence_text}</div>
                    <div className="text-xs text-orange-600">未挖空（占位）</div>
                  </>
                )}
                <div className={`mt-2 text-xs ${r.is_published ? 'text-green-600' : 'text-gray-500'}`}>{r.is_published ? '已发布' : '未发布'}</div>
              </div>
            );
          })}
          {rows.length === 0 && <div className="text-gray-500">暂无生成数据</div>}
        </div>
      </div>
    </div>
  );
}



