"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ShadowingItemsAdmin(){
  const router = useRouter();
  
  // 状态管理
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any|null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  
  // 筛选状态
  const [q, setQ] = useState(""); // 搜索关键词
  const [lang, setLang] = useState<string>("all"); // 语言筛选
  const [level, setLevel] = useState<string>("all"); // 等级筛选
  const [selectAll, setSelectAll] = useState(false); // 全选状态

  // 获取认证头信息
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 获取当前筛选结果
  const getFilteredItems = () => {
    return items
      .filter(it => (q? (String(it.title||'').toLowerCase().includes(q.toLowerCase())) : true))
      .filter(it => (lang==='all'? true : it.lang===lang))
      .filter(it => (level==='all'? true : it.level===parseInt(level)));
  };

  // 加载素材列表
  const load = async ()=>{
    setLoading(true);
    try {
      const r = await fetch('/api/admin/shadowing/items', { headers: await getAuthHeaders() });
      
      if (r.status === 401) {
        toast.error('认证失败，请重新登录');
        setTimeout(() => {
          router.push('/auth');
        }, 2000);
        return;
      }
      
      const j = await r.json();
      if (Array.isArray(j)) {
        setItems(j);
      } else {
        console.error('加载数据失败:', j);
        toast.error('加载数据失败');
      }
    } catch (error) {
      console.error('加载失败:', error);
      toast.error('加载失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ 
    load(); 
  },[]);

  // 监听选择状态变化，更新全选状态
  useEffect(() => {
    const filteredItems = getFilteredItems();
    const selectedCount = filteredItems.filter(item => selected[item.id]).length;
    const totalCount = filteredItems.length;
    
    if (totalCount === 0) {
      setSelectAll(false);
    } else {
      setSelectAll(selectedCount === totalCount);
    }
  }, [selected, items, q, lang, level]);

  // 保存编辑的素材
  const save = async ()=>{
    if (!editing) return;
    try {
      const r = await fetch('/api/admin/shadowing/items', { 
        method:'PUT', 
        headers:{ 
          'Content-Type':'application/json', 
          ...(await getAuthHeaders()) 
        }, 
        body: JSON.stringify(editing) 
      });
      
      if (r.status === 401) {
        toast.error('认证失败，请重新登录');
        setTimeout(() => {
          router.push('/auth');
        }, 2000);
        return;
      }
      
      if (r.ok) { 
        setEditing(null); 
        toast.success('已保存'); 
        load(); 
      } else {
        const errorData = await r.json();
        toast.error(`保存失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存失败:', error);
      toast.error('保存失败，请检查网络连接');
    }
  };
  // 删除单个素材
  const remove = async (id:string)=>{
    try {
      const r = await fetch(`/api/admin/shadowing/items?id=${encodeURIComponent(id)}`, { 
        method:'DELETE', 
        headers: await getAuthHeaders() 
      });
      
      if (r.status === 401) {
        toast.error('认证失败，请重新登录');
        setTimeout(() => {
          router.push('/auth');
        }, 2000);
        return;
      }
      
      if (r.ok) { 
        toast.success('已删除'); 
        load(); 
      } else {
        const errorData = await r.json();
        toast.error(`删除失败: ${errorData.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败，请检查网络连接');
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      {/* 页面标题和导航 */}
      <h1 className="text-2xl font-semibold">Shadowing 素材管理</h1>
      <div>
        <a href="/admin/shadowing/ai" className="px-3 py-1 rounded bg-black text-white">新增素材 → 生成页</a>
      </div>
      
      {/* 搜索与筛选区域 */}
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
          <Label>等级</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-36"><SelectValue placeholder="所有等级" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有等级</SelectItem>
              <SelectItem value="1">等级 1</SelectItem>
              <SelectItem value="2">等级 2</SelectItem>
              <SelectItem value="3">等级 3</SelectItem>
              <SelectItem value="4">等级 4</SelectItem>
              <SelectItem value="5">等级 5</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const filteredItems = getFilteredItems();
              
              if (selectAll) {
                // 取消全选
                const newSelected = { ...selected };
                filteredItems.forEach(item => {
                  delete newSelected[item.id];
                });
                setSelected(newSelected);
                setSelectAll(false);
              } else {
                // 全选
                const newSelected = { ...selected };
                filteredItems.forEach(item => {
                  newSelected[item.id] = true;
                });
                setSelected(newSelected);
                setSelectAll(true);
              }
            }}
          >
            {selectAll ? '取消全选' : '全选'}
          </Button>
          <span className="text-sm text-gray-500">
            已选择 {getFilteredItems().filter(item => selected[item.id]).length} 项
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelected({});
              setSelectAll(false);
            }}
            disabled={getFilteredItems().filter(item => selected[item.id]).length === 0}
          >
            清空选择
          </Button>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" disabled={getFilteredItems().filter(item => selected[item.id]).length === 0}>
              批量删除
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认批量删除</DialogTitle>
              <DialogDescription>
                将删除当前筛选结果中选中的 {getFilteredItems().filter(item => selected[item.id]).length} 项素材，操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">取消</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={async()=>{
                  // 只获取当前筛选结果中选中的项目
                  const filteredItems = getFilteredItems();
                  const selectedIds = filteredItems
                    .filter(item => selected[item.id])
                    .map(item => item.id);
                  
                  if (selectedIds.length===0) { 
                    toast.error('未选择任何项'); 
                    return; 
                  }
                  
                  const r = await fetch('/api/admin/shadowing/items', { 
                    method:'DELETE', 
                    headers:{ 
                      'Content-Type':'application/json', 
                      ...(await getAuthHeaders()) 
                    }, 
                    body: JSON.stringify({ ids: selectedIds }) 
                  });
                  
                  if (r.status === 401) {
                    toast.error('认证失败，请重新登录');
                    setTimeout(() => {
                      router.push('/auth');
                    }, 2000);
                    return;
                  }
                  
                  if (r.ok) { 
                    // 只清除被删除项目的选择状态
                    const newSelected = { ...selected };
                    selectedIds.forEach(id => {
                      delete newSelected[id];
                    });
                    setSelected(newSelected);
                    toast.success(`已删除 ${selectedIds.length} 项`); 
                    load(); 
                  } else {
                    const errorData = await r.json();
                    toast.error(`批量删除失败: ${errorData.error || '未知错误'}`);
                  }
                }}>确认删除</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {/* 素材列表区域 */}
      {loading ? <div>加载中…</div> : (
        <div className="grid gap-3">
          {getFilteredItems().map(it => (
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
                        <DialogDescription>将删除此素材，操作不可撤销。</DialogDescription>
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
              <div className="text-xs text-gray-500 mt-1">{it.lang} • 等级 {it.level}</div>
            </div>
          ))}
          {items.length===0 && <div className="text-sm text-gray-500">暂无素材</div>}
        </div>
      )}

      {/* 编辑素材弹窗 */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-card text-card-foreground w-full max-w-3xl p-4 rounded border space-y-3">
            <div className="text-lg font-semibold">编辑素材</div>
            <div className="flex gap-2">
              <Select value={editing.lang} onValueChange={(v)=>setEditing({...editing, lang:v})}>
                <SelectTrigger className="w-36"><SelectValue placeholder="语言" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">英语</SelectItem>
                  <SelectItem value="ja">日语</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(editing.level||1)} onValueChange={(v)=>setEditing({...editing, level:parseInt(v)})}>
                <SelectTrigger className="w-24"><SelectValue placeholder="等级" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">等级 1</SelectItem>
                  <SelectItem value="2">等级 2</SelectItem>
                  <SelectItem value="3">等级 3</SelectItem>
                  <SelectItem value="4">等级 4</SelectItem>
                  <SelectItem value="5">等级 5</SelectItem>
                </SelectContent>
              </Select>
              <Input className="flex-1" value={editing.title||''} onChange={e=>setEditing({...editing, title:e.target.value})} />
            </div>
            <textarea className="w-full border rounded px-2 py-1 h-36 bg-background" value={editing.text||''} onChange={e=>setEditing({...editing, text:e.target.value})} />
            <Input className="w-full" value={editing.audio_url||''} onChange={e=>setEditing({...editing, audio_url:e.target.value})} />
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


