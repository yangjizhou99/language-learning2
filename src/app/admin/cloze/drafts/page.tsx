'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/Empty';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type Draft = {
  id: string;
  lang: 'en' | 'ja' | 'zh';
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [lang, setLang] = useState<'all' | 'en' | 'ja' | 'zh'>('all');
  const [level, setLevel] = useState<number | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'draft' | 'needs_fix' | 'approved'>('all');
  const [provider, setProvider] = useState<'all' | 'deepseek' | 'openrouter' | 'openai'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('未登录');
        }
        const res = await fetch('/api/admin/cloze/drafts', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
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
    return drafts
      .filter((d) => {
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
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [drafts, lang, level, status, provider, query]);

  return (
    <div className="min-h-screen">
      {/* 管理员导航栏 */}
      <nav className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-semibold">
              Lang Trainer
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="hover:underline">
                控制台
              </Link>
              <Link href="/admin/cloze/ai" className="hover:underline">
                Cloze 管理
              </Link>
              <Link href="/admin/cloze/drafts" className="text-primary font-medium">
                Cloze 草稿箱
              </Link>
              <Link href="/admin/setup" className="hover:underline">
                权限设置
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">返回控制台</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Cloze 草稿箱</h1>

        {/* 筛选区 */}
        <div className="rounded-lg border bg-card text-card-foreground p-4 mb-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <Label className="mb-1 block">语言</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="zh">简体中文</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">难度</Label>
            <Select
              value={String(level)}
              onValueChange={(v) => setLevel(v === 'all' ? 'all' : parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {[1, 2, 3, 4, 5].map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    L{l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">状态</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="needs_fix">needs_fix</SelectItem>
                <SelectItem value="approved">approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">提供商</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block">搜索</Label>
            <Input
              placeholder="标题/主题/内容"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 批量操作 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">共 {filtered.length} 条</div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>批量发布筛选结果</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认批量发布</DialogTitle>
                <DialogDescription>将根据当前筛选条件批量发布，操作不可撤销。</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">取消</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    onClick={async () => {
                      try {
                        const {
                          data: { session },
                        } = await supabase.auth.getSession();
                        if (!session) {
                          toast.error('请先登录');
                          return;
                        }
                        const res = await fetch('/api/admin/cloze/publish-many', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({
                            filter: {
                              lang: lang === 'all' ? undefined : lang,
                              level: level === 'all' ? undefined : level,
                              status: status === 'all' ? undefined : status,
                              provider: provider === 'all' ? undefined : provider,
                            },
                          }),
                        });
                        const t = await res.text();
                        if (!res.ok) throw new Error(t);
                        toast.success('发布完成');
                        location.reload();
                      } catch (e: any) {
                        toast.error('批量发布失败: ' + (e?.message || String(e)));
                      }
                    }}
                  >
                    确认发布
                  </Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* 列表 */}
        <div className="rounded-lg border bg-card text-card-foreground overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
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
                <tr>
                  <td className="p-4" colSpan={7}>
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="p-4 text-red-600" colSpan={7}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td className="p-4" colSpan={7}>
                    <Empty title="暂无草稿" />
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{d.title}</div>
                      <div className="text-muted-foreground line-clamp-1">{d.passage}</div>
                    </td>
                    <td className="p-3">
                      {d.lang.toUpperCase()} / L{d.level}
                    </td>
                    <td className="p-3">{d.topic || '-'}</td>
                    <td className="p-3">{Array.isArray(d.blanks) ? d.blanks.length : 0}</td>
                    <td className="p-3">
                      {d.ai_provider || '-'}
                      {d.ai_model ? ` / ${d.ai_model}` : ''}
                    </td>
                    <td className="p-3">{d.status}</td>
                    <td className="p-3 space-x-2">
                      <Button asChild variant="link" size="sm">
                        <Link href={`/admin/cloze/editor/${d.id}`}>编辑</Link>
                      </Button>
                      {d.status !== 'approved' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="link" size="sm">
                              发布
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>确认发布</DialogTitle>
                              <DialogDescription>将发布此草稿，操作不可撤销。</DialogDescription>
                            </DialogHeader>
                            <div className="mt-4 flex justify-end gap-2">
                              <DialogClose asChild>
                                <Button variant="ghost">取消</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  onClick={async () => {
                                    const {
                                      data: { session },
                                    } = await supabase.auth.getSession();
                                    if (!session) {
                                      toast.error('请先登录');
                                      return;
                                    }
                                    const res = await fetch('/api/admin/cloze/publish', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${session.access_token}`,
                                      },
                                      body: JSON.stringify({ draftId: d.id }),
                                    });
                                    if (res.ok) {
                                      toast.success('发布成功');
                                      location.reload();
                                    } else {
                                      const t = await res.text();
                                      toast.error('发布失败: ' + t);
                                    }
                                  }}
                                >
                                  确认发布
                                </Button>
                              </DialogClose>
                            </div>
                          </DialogContent>
                        </Dialog>
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
