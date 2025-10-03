'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Lang = 'en' | 'ja' | 'zh';

interface Theme {
  id: string;
  lang: Lang;
  level: number;
  title: string;
  status?: string | null;
}

interface Subtopic {
  id: string;
  theme_id: string;
  lang: Lang;
  level: number;
  title: string;
  status?: string | null;
}

export default function ClozeShadowingGeneratePage() {
  const [lang, setLang] = useState<Lang>('ja');
  const [level, setLevel] = useState<number>(3);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [themeId, setThemeId] = useState<string>('');
  const [subtopicId, setSubtopicId] = useState<string>('');
  const [limit, setLimit] = useState<number>(20);
  const [correctMin, setCorrectMin] = useState<number>(1);
  const [correctMax, setCorrectMax] = useState<number>(5);
  const [distrMin, setDistrMin] = useState<number>(4);
  const [distrMax, setDistrMax] = useState<number>(8);
  const [provider, setProvider] = useState<'deepseek' | 'openrouter' | 'openai'>('deepseek');
  const [model, setModel] = useState<string>('deepseek-chat');
  const [running, setRunning] = useState(false);
  const [details, setDetails] = useState<Array<{ source_item_id: string; sentences: number; created: number }>>([]);
  const [articleRows, setArticleRows] = useState<Array<{ id: string; lang: Lang; level: number; title: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // 加载可选的已发布 Shadowing 文章（带音频）
  useEffect(() => {
    const load = async () => {
      try {
        let q = supabase
          .from('shadowing_items')
          .select('id,lang,level,title,audio_url,status')
          .eq('status', 'approved')
          .not('audio_url', 'is', null)
          .limit(200);
        if (lang) q = q.eq('lang', lang);
        if (level) q = q.eq('level', level);
        if (themeId) q = q.eq('theme_id', themeId);
        if (subtopicId) q = q.eq('subtopic_id', subtopicId);
        const { data } = await q;
        const rows = (data || []).map((r: any) => ({ id: r.id as string, lang: r.lang as Lang, level: r.level as number, title: r.title as string }));
        setArticleRows(rows);
      } catch {
        setArticleRows([]);
      }
    };
    load();
  }, [lang, level, themeId, subtopicId]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('shadowing_themes')
          .select('id,lang,level,title,status')
          .eq('lang', lang)
          .eq('level', level)
          .eq('status', 'active');
        setThemes(data || []);
      } catch {
        setThemes([]);
      }
    };
    load();
  }, [lang, level]);

  useEffect(() => {
    const load = async () => {
      if (!themeId) {
        setSubtopics([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('shadowing_subtopics')
          .select('id,theme_id,lang,level,title,status')
          .eq('theme_id', themeId)
          .eq('status', 'active');
        setSubtopics(data || []);
      } catch {
        setSubtopics([]);
      }
    };
    load();
  }, [themeId]);

  const startGenerate = async () => {
    setRunning(true);
    setDetails([]);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('请先登录');
        setRunning(false);
        return;
      }

      const body: any = {
        lang,
        level,
        limit,
        provider,
        model,
        correct_range: [correctMin, correctMax],
        distractor_range: [distrMin, distrMax],
      };
      const chosen = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k);
      if (chosen.length > 0) {
        body.item_ids = chosen;
      } else {
        if (themeId) body.theme_id = themeId;
        if (subtopicId) body.subtopic_id = subtopicId;
      }

      const res = await fetch('/api/admin/cloze-shadowing/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        toast.error('生成失败：' + (data?.error || 'unknown'));
      } else {
        toast.success(`生成完成：新增 ${data.created} 句`);
        setDetails(data.details || []);
      }
    } catch (e: any) {
      toast.error('生成失败：' + (e?.message || String(e)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              Lang Trainer
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-700 hover:text-gray-900">
                控制台
              </Link>
              <span className="text-blue-600 font-medium">Cloze-Shadowing 生成</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
              返回控制台
            </Link>
            <Link href="/" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
              返回首页
            </Link>
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">基于 Shadowing 的 Cloze 句题生成</h1>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">语言</label>
              <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="w-full p-2 border rounded">
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="zh">简体中文</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">难度等级</label>
              <select value={level} onChange={(e) => setLevel(parseInt(e.target.value))} className="w-full p-2 border rounded">
                <option value={1}>L1</option>
                <option value={2}>L2</option>
                <option value={3}>L3</option>
                <option value={4}>L4</option>
                <option value={5}>L5</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">大主题</label>
              <select value={themeId} onChange={(e) => { setThemeId(e.target.value); setSubtopicId(''); }} className="w-full p-2 border rounded">
                <option value="">（全部/不限定）</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">小主题</label>
              <select value={subtopicId} onChange={(e) => setSubtopicId(e.target.value)} className="w-full p-2 border rounded" disabled={!themeId}>
                <option value="">（全部/不限定）</option>
                {subtopics.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">生成数量上限</label>
              <input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(parseInt(e.target.value))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">正确项最少</label>
              <input type="number" min={1} max={5} value={correctMin} onChange={(e) => setCorrectMin(parseInt(e.target.value))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">正确项最多</label>
              <input type="number" min={1} max={5} value={correctMax} onChange={(e) => setCorrectMax(parseInt(e.target.value))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">干扰项最少</label>
              <input type="number" min={4} max={8} value={distrMin} onChange={(e) => setDistrMin(parseInt(e.target.value))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">干扰项最多</label>
              <input type="number" min={4} max={8} value={distrMax} onChange={(e) => setDistrMax(parseInt(e.target.value))} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">AI 提供商</label>
              <select value={provider} onChange={(e) => {
                const p = e.target.value as 'deepseek' | 'openrouter' | 'openai';
                setProvider(p);
                const defaults: Record<string, string> = {
                  deepseek: 'deepseek-chat',
                  openrouter: 'anthropic/claude-3.5-sonnet',
                  openai: 'gpt-4o',
                };
                setModel(defaults[p] || 'deepseek-chat');
              }} className="w-full p-2 border rounded">
                <option value="deepseek">DeepSeek</option>
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">模型</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full p-2 border rounded" />
            </div>
          </div>

          {/* 文章勾选 */}
          <div>
            <div className="text-sm font-medium mb-2">可选文章（勾选后将按选中生成；未勾选时使用上方筛选）</div>
            <div className="max-h-64 overflow-auto border rounded">
              {articleRows.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">暂无符合条件的文章</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 w-10">
                        <input
                          type="checkbox"
                          checked={articleRows.length > 0 && articleRows.every((r) => selectedIds[r.id])}
                          onChange={(e) => {
                            const all = e.target.checked;
                            const next: Record<string, boolean> = {};
                            if (all) articleRows.forEach((r) => (next[r.id] = true));
                            setSelectedIds(next);
                          }}
                        />
                      </th>
                      <th className="p-2 text-left">标题</th>
                      <th className="p-2 text-left">语言</th>
                      <th className="p-2 text-left">难度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articleRows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={!!selectedIds[r.id]}
                            onChange={(e) => setSelectedIds((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                          />
                        </td>
                        <td className="p-2">{r.title}</td>
                        <td className="p-2">{r.lang.toUpperCase()}</td>
                        <td className="p-2">L{r.level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <Button onClick={startGenerate} disabled={running}>
            {running ? '生成中...' : '开始生成'}
          </Button>
        </div>

        {details.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-lg font-semibold mb-3">生成详情</div>
            <div className="space-y-2">
              {details.map((d) => (
                <div key={d.source_item_id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="text-sm text-gray-500">Article: {d.source_item_id}</div>
                    <div>句子数：{d.sentences}，新增：{d.created}</div>
                  </div>
                  <Link href={`/admin/cloze-shadowing/review/${d.source_item_id}`} className="text-blue-600 hover:underline">
                    查看句子
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


