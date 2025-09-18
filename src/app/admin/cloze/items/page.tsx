'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function ClozeItemsAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [lang, setLang] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');
  const [creating, setCreating] = useState(false);
  const [newItem, setNewItem] = useState<any>({
    lang: 'en',
    level: 3,
    topic: '',
    title: '',
    passage: '',
    blanksText:
      '[{"id":1,"answer":"...","acceptable":[],"distractors":[],"explanation":"","type":"vocabulary"}]',
  });

  const load = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const r = await fetch('/api/admin/cloze/items', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const j = await r.json();
      if (Array.isArray(j)) setItems(j);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const r = await fetch(`/api/admin/cloze/items?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (r.ok) {
      toast.success('已删除');
      load();
    } else {
      toast.error('删除失败');
    }
  };

  const save = async () => {
    if (!editing) return;
    const { id, title, passage, blanks, topic } = editing;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const r = await fetch('/api/admin/cloze/items', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ id, title, passage, blanks, topic }),
    });
    if (r.ok) {
      setEditing(null);
      load();
    } else {
      alert('保存失败');
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Cloze 题库管理</h1>
      <div>
        <Button asChild>
          <a href="/admin/cloze/ai">新增题目 → 生成页</a>
        </Button>
      </div>
      {/* 搜索与筛选 */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="搜索标题/主题"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
        <div className="flex items-center gap-2">
          <Label>语言</Label>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="所有语言" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有语言</SelectItem>
              <SelectItem value="en">英语</SelectItem>
              <SelectItem value="ja">日语</SelectItem>
              <SelectItem value="zh">中文</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>难度</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="所有难度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有难度</SelectItem>
              {['1', '2', '3', '4', '5'].map((l) => (
                <SelectItem key={l} value={l}>
                  L{l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">批量删除</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认批量删除</DialogTitle>
              <DialogDescription>将删除选中的题目，操作不可撤销。</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">取消</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const ids = Object.keys(selected).filter((k) => selected[k]);
                    if (ids.length === 0) {
                      toast.message('未选择任何项');
                      return;
                    }
                    const {
                      data: { session },
                    } = await supabase.auth.getSession();
                    const h = new Headers({ 'Content-Type': 'application/json' });
                    if (session?.access_token)
                      h.set('Authorization', `Bearer ${session.access_token}`);
                    const r = await fetch('/api/admin/cloze/items', {
                      method: 'DELETE',
                      headers: h,
                      body: JSON.stringify({ ids }),
                    });
                    if (r.ok) {
                      setSelected({});
                      toast.success('已删除');
                      load();
                    } else {
                      toast.error('批量删除失败');
                    }
                  }}
                >
                  确认删除
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {items
            .filter((it) =>
              q
                ? it.title?.toLowerCase().includes(q.toLowerCase()) ||
                  it.topic?.toLowerCase().includes(q.toLowerCase())
                : true,
            )
            .filter((it) => (lang === 'all' ? true : it.lang === lang))
            .filter((it) => (level === 'all' ? true : String(it.level) === level))
            .map((it) => (
              <div key={it.id} className="border rounded p-3 bg-card text-card-foreground">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 mr-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [it.id]: e.target.checked }))}
                    />
                    <div className="font-medium truncate">{it.title}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(it)}>
                      编辑
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          删除
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认删除</DialogTitle>
                          <DialogDescription>将删除此题目，操作不可撤销。</DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 flex justify-end gap-2">
                          <DialogClose asChild>
                            <Button variant="ghost">取消</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button variant="destructive" onClick={() => remove(it.id)}>
                              确认删除
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {it.lang} · L{it.level} · {it.topic}
                </div>
              </div>
            ))}
          {items.length === 0 && <div className="text-sm text-muted-foreground">暂无题目</div>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-card text-card-foreground w-full max-w-3xl p-4 rounded border space-y-3">
            <div className="text-lg font-semibold">编辑题目</div>
            <Input
              value={editing.title || ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <textarea
              className="w-full border rounded px-2 py-1 h-40"
              value={editing.passage || ''}
              onChange={(e) => setEditing({ ...editing, passage: e.target.value })}
            />
            <div className="text-xs text-muted-foreground">
              暂支持整体编辑；如需分 blank 编辑，可在 Cloze 生成页处理。
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button onClick={save}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* 新增改为跳转到生成页，不再内嵌表单 */}
    </main>
  );
}
