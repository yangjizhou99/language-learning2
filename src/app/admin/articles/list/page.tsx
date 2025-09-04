"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ArticlesAdminList(){
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any|null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<string>("all");
  const [genre, setGenre] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");

  const authHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h = new Headers();
    if (session?.access_token) h.set('Authorization', `Bearer ${session.access_token}`);
    return h;
  };

  const load = async ()=>{
    setLoading(true);
    const r = await fetch('/api/admin/articles/items', { headers: await authHeader() });
    const j = await r.json();
    if (Array.isArray(j)) setItems(j);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const save = async ()=>{
    if (!editing) return;
    const r = await fetch('/api/admin/articles/items', { method:'PUT', headers:{ 'Content-Type':'application/json', ...(await authHeader()) }, body: JSON.stringify({ id:editing.id, title:editing.title, genre:editing.genre, difficulty:editing.difficulty }) });
    if (r.ok) { setEditing(null); toast.success('已保存'); load(); } else toast.error('保存失败');
  };
  const remove = async (id:string)=>{
    const r = await fetch(`/api/admin/articles/items?id=${encodeURIComponent(id)}`, { method:'DELETE', headers: await authHeader() });
    if (r.ok) { toast.success('已删除'); load(); } else toast.error('删除失败');
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">广读文章管理</h1>
      <div>
        <Button asChild><a href="/admin/articles">新增文章 → 生成/录入页</a></Button>
      </div>
      {/* 搜索与筛选 */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="搜索标题" value={q} onChange={e=>setQ(e.target.value)} className="w-64" />
        <div className="flex items-center gap-2">
          <Label>语言</Label>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="w-36"><SelectValue placeholder="所有语言" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有语言</SelectItem>
              <SelectItem value="en">英语</SelectItem>
              <SelectItem value="ja">日语</SelectItem>
              <SelectItem value="zh">中文</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>体裁</Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="w-44"><SelectValue placeholder="全部体裁" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部体裁</SelectItem>
              <SelectItem value="news">新闻</SelectItem>
              <SelectItem value="science">科普</SelectItem>
              <SelectItem value="essay">随笔</SelectItem>
              <SelectItem value="dialogue">对话</SelectItem>
              <SelectItem value="literature">文学</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>难度</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-36"><SelectValue placeholder="所有难度" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有难度</SelectItem>
              {['1','2','3','4','5'].map(l=> <SelectItem key={l} value={l}>L{l}</SelectItem>)}
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
              <DialogDescription>将删除选中的文章，操作不可撤销。</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">取消</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={async()=>{
                  const ids = Object.keys(selected).filter(k=>selected[k]);
                  if (ids.length===0) { toast.message('未选择任何项'); return; }
                  const r = await fetch('/api/admin/articles/items', { method:'DELETE', headers:{ 'Content-Type':'application/json', ...(await authHeader()) }, body: JSON.stringify({ ids }) });
                  if (r.ok) { setSelected({}); toast.success('已删除'); load(); } else toast.error('批量删除失败');
                }}>确认删除</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div>加载中…</div> : (
        <div className="grid gap-3">
          {items
            .filter(it => (q? (String(it.title||'').toLowerCase().includes(q.toLowerCase())) : true))
            .filter(it => (lang==='all'? true : it.lang===lang))
            .filter(it => (genre==='all'? true : it.genre===genre))
            .filter(it => (level==='all'? true : String(it.difficulty)===level))
            .map(it => (
            <div key={it.id} className="border rounded p-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 mr-2 min-w-0">
                  <input type="checkbox" checked={!!selected[it.id]} onChange={e=>setSelected(s=>({ ...s, [it.id]: e.target.checked }))} />
                  <div className="font-medium truncate">{it.title}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={()=>setEditing(it)}>编辑</Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="destructive">删除</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>确认删除</DialogTitle>
                        <DialogDescription>将删除此文章，操作不可撤销。</DialogDescription>
                      </DialogHeader>
                      <div className="mt-4 flex justify-end gap-2">
                        <DialogClose asChild>
                          <Button variant="ghost">取消</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button variant="destructive" onClick={()=>remove(it.id)}>确认删除</Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{it.lang} · {it.genre} · L{it.difficulty}</div>
            </div>
          ))}
          {items.length===0 && <div className="text-sm text-gray-500">暂无文章</div>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-card text-card-foreground w-full max-w-3xl p-4 rounded border space-y-3">
            <div className="text-lg font-semibold">编辑文章</div>
            <Input className="w-full" value={editing.title||''} onChange={e=>setEditing({...editing, title:e.target.value})} />
            <div className="flex gap-2">
              <Select value={editing.genre} onValueChange={(v)=>setEditing({...editing, genre:v})}>
                <SelectTrigger className="w-44"><SelectValue placeholder="体裁" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="news">新闻</SelectItem>
                  <SelectItem value="science">科普</SelectItem>
                  <SelectItem value="essay">随笔</SelectItem>
                  <SelectItem value="dialogue">对话</SelectItem>
                  <SelectItem value="literature">文学</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min={1} max={5} className="w-20" value={editing.difficulty} onChange={e=>setEditing({...editing, difficulty:Number(e.target.value)||3})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setEditing(null)}>取消</Button>
              <Button onClick={save}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


