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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Trash2, Search, Filter } from 'lucide-react';

export default function PracticeItemsAdmin() {
  const router = useRouter();

  // 状态管理
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);

  // 筛选状态
  const [q, setQ] = useState(''); // 搜索关键词
  const [lang, setLang] = useState<string>('all'); // 语言筛选
  const [level, setLevel] = useState<string>('all'); // 等级筛选
  const [status, setStatus] = useState<string>('approved'); // 状态筛选
  const [selectAll, setSelectAll] = useState(false); // 全选状态

  // 获取认证头信息
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 获取当前筛选结果
  const getFilteredItems = () => {
    return items
      .filter((it) =>
        q
          ? String(it.title || '')
              .toLowerCase()
              .includes(q.toLowerCase())
          : true,
      )
      .filter((it) => (lang === 'all' ? true : it.lang === lang))
      .filter((it) => (level === 'all' ? true : it.level === parseInt(level)))
      .filter((it) => (status === 'all' ? true : it.status === status));
  };

  // 加载练习题库列表
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang !== 'all') params.set('lang', lang);
      if (level !== 'all') params.set('level', level);
      if (status !== 'all') params.set('status', status);
      if (q) params.set('q', q);

      const r = await fetch(`/api/shadowing/catalog?${params}`, {
        headers: await getAuthHeaders(),
      });

      if (r.status === 401) {
        toast.error('认证失败，请重新登录');
        setTimeout(() => {
          router.push('/auth');
        }, 2000);
        return;
      }

      if (!r.ok) {
        const errorData = await r.json();
        throw new Error(errorData.error || `HTTP ${r.status}`);
      }

      const data = await r.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('加载失败:', error);
      toast.error('加载失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 删除单个素材
  const remove = async (id: string) => {
    try {
      setDeleting(true);
      const r = await fetch(`/api/admin/shadowing/drafts/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
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
    } finally {
      setDeleting(false);
    }
  };

  // 批量删除
  const deleteSelected = async () => {
    const selectedIds = Object.keys(selected).filter((id) => selected[id]);
    if (selectedIds.length === 0) return;

    try {
      setDeleting(true);

      // 逐个删除选中的项目
      for (const id of selectedIds) {
        const r = await fetch(`/api/admin/shadowing/drafts/${id}`, {
          method: 'DELETE',
          headers: await getAuthHeaders(),
        });

        if (!r.ok) {
          const errorData = await r.json();
          throw new Error(`删除失败: ${errorData.error || '未知错误'}`);
        }
      }

      toast.success(`已删除 ${selectedIds.length} 项`);
      setSelected({});
      load();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error('批量删除失败，请检查网络连接');
    } finally {
      setDeleting(false);
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    const filteredItems = getFilteredItems();
    if (selectAll) {
      // 取消全选
      const newSelected = { ...selected };
      filteredItems.forEach((item) => {
        delete newSelected[item.id];
      });
      setSelected(newSelected);
      setSelectAll(false);
    } else {
      // 全选
      const newSelected = { ...selected };
      filteredItems.forEach((item) => {
        newSelected[item.id] = true;
      });
      setSelected(newSelected);
      setSelectAll(true);
    }
  };

  // 页面加载时获取数据
  useEffect(() => {
    load();
  }, [lang, level, status, q]);

  // 更新全选状态
  useEffect(() => {
    const filteredItems = getFilteredItems();
    const selectedCount = filteredItems.filter((item) => selected[item.id]).length;
    setSelectAll(selectedCount === filteredItems.length && filteredItems.length > 0);
  }, [selected, items, q, lang, level, status]);

  const filteredItems = getFilteredItems();
  const selectedCount = filteredItems.filter((item) => selected[item.id]).length;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">练习题库管理</h1>
        <p className="text-gray-600">管理练习页面显示的内容（来自 shadowing_drafts 表）</p>
      </div>

      {/* 搜索与筛选区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            搜索与筛选
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">搜索标题</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="搜索标题..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>语言</Label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有语言</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="en">英文</SelectItem>
                  <SelectItem value="ja">日文</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>等级</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有等级</SelectItem>
                  <SelectItem value="1">L1</SelectItem>
                  <SelectItem value="2">L2</SelectItem>
                  <SelectItem value="3">L3</SelectItem>
                  <SelectItem value="4">L4</SelectItem>
                  <SelectItem value="5">L5</SelectItem>
                  <SelectItem value="6">L6</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>状态</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="approved">已审核</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作区域 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectAll}
                onCheckedChange={toggleSelectAll}
                disabled={filteredItems.length === 0}
              />
              <span className="text-sm text-gray-600">已选择 {selectedCount} 项</span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelected({});
                  setSelectAll(false);
                }}
                disabled={selectedCount === 0}
              >
                清空选择
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" disabled={selectedCount === 0 || deleting}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    批量删除
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>确认批量删除</DialogTitle>
                    <DialogDescription>
                      将删除选中的 {selectedCount} 项内容，操作不可撤销。
                      <br />
                      这些内容将从练习题库中永久移除。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="ghost">取消</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="destructive" onClick={deleteSelected} disabled={deleting}>
                        {deleting ? '删除中...' : '确认删除'}
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 内容列表 */}
      <Card>
        <CardHeader>
          <CardTitle>内容列表</CardTitle>
          <CardDescription>共 {filteredItems.length} 项内容</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">没有找到符合条件的内容</div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selected[item.id] || false}
                      onCheckedChange={(checked) => {
                        setSelected((prev) => ({
                          ...prev,
                          [item.id]: checked as boolean,
                        }));
                      }}
                    />
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{item.lang}</Badge>
                        <Badge variant="outline">L{item.level}</Badge>
                        <Badge variant={item.status === 'approved' ? 'default' : 'secondary'}>
                          {item.status === 'approved' ? '已审核' : '草稿'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认删除</DialogTitle>
                          <DialogDescription>
                            将删除此内容，操作不可撤销。
                            <br />
                            内容将从练习题库中永久移除。
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 flex justify-end gap-2">
                          <DialogClose asChild>
                            <Button variant="ghost">取消</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button
                              variant="destructive"
                              onClick={() => remove(item.id)}
                              disabled={deleting}
                            >
                              {deleting ? '删除中...' : '确认删除'}
                            </Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
