'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Draft = {
  id: string;
  lang: 'en'|'ja'|'zh';
  level: number;
  topic: string;
  title: string;
  passage: string;
  blanks: any[];
  status: string;
  ai_provider?: string | null;
  ai_model?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

export default function ClozeDraftsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [lang, setLang] = useState<'all'|'en'|'ja'|'zh'>('all');
  const [level, setLevel] = useState<number | 'all'>('all');
  const [status, setStatus] = useState<'all'|'draft'|'needs_fix'|'approved'>('all');
  const [provider, setProvider] = useState<'all'|'deepseek'|'openrouter'|'openai'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('未登录');
        }
        const res = await fetch('/api/admin/cloze/drafts', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `Failed to load drafts: ${res.status}`);
        }
        const data: Draft[] = await res.json();
        setDrafts(data);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    return drafts.filter(d => {
      if (lang !== 'all' && d.lang !== lang) return false;
      if (level !== 'all' && d.level !== level) return false;
      if (status !== 'all' && d.status !== status) return false;
      if (provider !== 'all') {
        const p = (d.ai_provider || '').toLowerCase();
        if (p !== provider) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const hay = `${d.title}\n${d.topic}\n${d.passage}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [drafts, lang, level, status, provider, query]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 管理员导航栏 */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-semibold text-gray-900">Lang Trainer</Link>
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-700 hover:text-gray-900">控制台</Link>
              <Link href="/admin/cloze/ai" className="text-gray-700 hover:text-gray-900">Cloze 管理</Link>
              <Link href="/admin/cloze/drafts" className="text-blue-600 font-medium">Cloze 草稿箱</Link>
              <Link href="/admin/setup" className="text-gray-700 hover:text-gray-900">权限设置</Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">返回控制台</Link>
            <Link href="/" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">返回首页</Link>
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Cloze 草稿箱</h1>

        {/* 筛选区 */}
        <div className="bg-white p-4 rounded-lg shadow mb-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm mb-1">语言</label>
            <select className="w-full p-2 border rounded" value={lang} onChange={e=>setLang(e.target.value as any)}>
              <option value="all">全部</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="zh">简体中文</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">难度</label>
            <select className="w-full p-2 border rounded" value={level} onChange={e=>setLevel(e.target.value==='all'?'all':parseInt(e.target.value))}>
              <option value="all">全部</option>
              {[1,2,3,4,5].map(l=> <option key={l} value={l}>L{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">状态</label>
            <select className="w-full p-2 border rounded" value={status} onChange={e=>setStatus(e.target.value as any)}>
              <option value="all">全部</option>
              <option value="draft">draft</option>
              <option value="needs_fix">needs_fix</option>
              <option value="approved">approved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">提供商</label>
            <select className="w-full p-2 border rounded" value={provider} onChange={e=>setProvider(e.target.value as any)}>
              <option value="all">全部</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">搜索</label>
            <input className="w-full p-2 border rounded" placeholder="标题/主题/内容" value={query} onChange={e=>setQuery(e.target.value)} />
          </div>
        </div>

        {/* 批量操作 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">共 {filtered.length} 条</div>
          <button
            className="px-3 py-2 text-sm rounded bg-purple-600 text-white hover:bg-purple-700"
            onClick={async ()=>{
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { alert('请先登录'); return; }
                const res = await fetch('/api/admin/cloze/publish-many', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                  },
                  body: JSON.stringify({
                    filter: {
                      lang: lang==='all'?undefined:lang,
                      level: level==='all'?undefined:level,
                      status: status==='all'?undefined:status,
                      provider: provider==='all'?undefined:provider
                    }
                  })
                });
                const t = await res.text();
                if (!res.ok) throw new Error(t);
                alert('发布完成: ' + t);
                location.reload();
              } catch (e: any) {
                alert('批量发布失败: ' + (e?.message || String(e)));
              }
            }}
          >批量发布筛选结果</button>
        </div>

        {/* 列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-3">标题</th>
                <th className="text-left p-3">语言/难度</th>
                <th className="text-left p-3">主题</th>
                <th className="text-left p-3">空白数</th>
                <th className="text-left p-3">提供商/模型</th>
                <th className="text-left p-3">状态</th>
                <th className="text-left p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="p-4" colSpan={7}>加载中...</td></tr>
              )}
              {error && !loading && (
                <tr><td className="p-4 text-red-600" colSpan={7}>{error}</td></tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr><td className="p-4" colSpan={7}>暂无草稿</td></tr>
              )}
              {!loading && !error && filtered.map(d => (
                <tr key={d.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{d.title}</div>
                    <div className="text-gray-500 line-clamp-1">{d.passage}</div>
                  </td>
                  <td className="p-3">{d.lang.toUpperCase()} / L{d.level}</td>
                  <td className="p-3">{d.topic || '-'}</td>
                  <td className="p-3">{Array.isArray(d.blanks) ? d.blanks.length : 0}</td>
                  <td className="p-3">{d.ai_provider || '-'}{d.ai_model ? ` / ${d.ai_model}` : ''}</td>
                  <td className="p-3">{d.status}</td>
                  <td className="p-3 space-x-2">
                    <Link href={`/admin/cloze/ai?draft=${d.id}`} className="text-blue-600 hover:underline">编辑</Link>
                    {d.status !== 'approved' && (
                      <button
                        className="text-purple-600 hover:underline"
                        onClick={async () => {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) {
                            alert('请先登录');
                            return;
                          }
                          const res = await fetch('/api/admin/cloze/publish', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({ draftId: d.id })
                          });
                          if (res.ok) {
                            // 重新加载
                            location.reload();
                          } else {
                            const t = await res.text();
                            alert('发布失败: ' + t);
                          }
                        }}
                      >发布</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


