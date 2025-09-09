"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

type Item = { id:string; lang:"en"|"ja"|"zh"; level:number; genre:string; title:string; status:string; created_at:string; notes?: any };

export default function ShadowingReviewList(){
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"all"|"en"|"ja"|"zh">("all");
  const [genre, setGenre] = useState("all");
  const [level, setLevel] = useState<"all"|"1"|"2"|"3"|"4"|"5">("all");
  const [status, setStatus] = useState<"all"|"draft"|"approved">("draft");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ttsLoading, setTtsLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [ttsTotal, setTtsTotal] = useState(0);
  const [ttsDone, setTtsDone] = useState(0);
  const [ttsCurrent, setTtsCurrent] = useState("");
  const [currentOperation, setCurrentOperation] = useState<"tts" | "publish" | "delete">("tts");
  
  // 性能优化参数
  const [concurrency, setConcurrency] = useState(3);
  const [batchSize, setBatchSize] = useState(1);
  const [retries, setRetries] = useState(2);
  const [throttle, setThrottle] = useState(200);
  
  // 统计信息
  const stats = useMemo(() => {
    const total = items.length;
    const withAudio = items.filter(item => item?.notes?.audio_url).length;
    const selectedCount = selected.size;
    const selectedWithAudio = items.filter(item => selected.has(item.id) && item?.notes?.audio_url).length;
    
    return {
      total,
      withAudio,
      withoutAudio: total - withAudio,
      selectedCount,
      selectedWithAudio,
      selectedWithoutAudio: selectedCount - selectedWithAudio,
      audioPercentage: total > 0 ? Math.round((withAudio / total) * 100) : 0
    };
  }, [items, selected]);

  useEffect(()=>{ (async()=>{
    const params = new URLSearchParams({ status: status === "all" ? "draft" : status });
    if (lang !== 'all') params.set('lang', lang);
    if (genre !== 'all') params.set('genre', genre);
    if (level !== 'all') params.set('level', level);
    if (q.trim()) params.set('q', q.trim());
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts?${params}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
    const j = await r.json();
    setItems(j.items||[]);
  })(); }, [q, lang, genre, level, status]);

  function isAllSelected(): boolean {
    if (items.length === 0) return false;
    return items.every(it => selected.has(it.id));
  }
  function toggleSelectAll(){
    setSelected(prev => {
      if (items.length === 0) return new Set();
      const all = new Set<string>();
      if (!isAllSelected()) items.forEach(it => all.add(it.id));
      return isAllSelected() ? new Set() : all;
    });
  }
  function toggleSelect(id: string){
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function synthOne(id: string){
    const it = items.find(x => x.id === id);
    if (!it) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const detail = await fetch(`/api/admin/shadowing/drafts/${id}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
      if (!detail.ok) throw new Error(`获取草稿失败(${detail.status})`);
      const dj = await detail.json();
      const draft = dj.draft;
      const r = await fetch('/api/admin/shadowing/synthesize', { method:'POST', headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) }, body: JSON.stringify({ text: draft.text, lang: draft.lang, voice: draft?.notes?.voice || null, speakingRate: draft?.notes?.speakingRate || 1.0 }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "TTS 失败");
      // 写入 notes.audio_url 并保存
      const next = { ...draft, notes: { ...(draft.notes||{}), audio_url: j.audio_url } };
      const save = await fetch(`/api/admin/shadowing/drafts/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) }, body: JSON.stringify({ notes: next.notes }) });
      if (!save.ok) throw new Error(`保存音频地址失败(${save.status})`);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async function synthSelected(){
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setTtsLoading(true);
    setCurrentOperation("tts");
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;
    
    try {
      // 并发处理
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id) => {
          const it = items.find(x => x.id === id);
          setTtsCurrent(it?.title || "");
          const ok = await synthOne(id);
          setTtsDone(v => v + 1);
          return { id, success: ok };
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => !r.success).length;
      };
      
      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchFail = await processBatch(batch);
        fail += batchFail;
        
        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          await new Promise(resolve => setTimeout(resolve, throttle));
        }
      }
      
      toast.success(`TTS 合成完成：${ids.length - fail}/${ids.length}`);
      // 触发刷新
      setQ(q => q);
    } catch (e) {
      toast.error("批量合成失败，请重试");
    } finally {
      setTtsCurrent("");
      setTtsLoading(false);
    }
  }

  async function deleteOne(id: string){
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`/api/admin/shadowing/drafts/${id}`, { method:'DELETE', headers: token? { Authorization: `Bearer ${token}` } : undefined });
  }

  async function deleteSelected(){
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPublishing(true); // 复用发布状态显示进度
    setCurrentOperation("delete");
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;
    
    try {
      // 并发处理删除
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id) => {
          const it = items.find(x => x.id === id);
          setTtsCurrent(it?.title || "");
          try {
            await deleteOne(id);
            setTtsDone(v => v + 1);
            return { id, success: true };
          } catch (error) {
            console.error(`删除失败 ${id}:`, error);
            setTtsDone(v => v + 1);
            return { id, success: false };
          }
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => !r.success).length;
      };
      
      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchFail = await processBatch(batch);
        fail += batchFail;
        
        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          await new Promise(resolve => setTimeout(resolve, throttle));
        }
      }
      
      toast.success(`批量删除完成：${ids.length - fail}/${ids.length}`);
      setSelected(new Set());
      // 刷新
      setQ(q => q);
    } catch (e) {
      toast.error("批量删除失败，请重试");
    } finally {
      setTtsCurrent("");
      setPublishing(false);
    }
  }

  async function publishOne(id: string){
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`/api/admin/shadowing/drafts/${id}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: "publish" }) });
  }

  async function publishSelected(){
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPublishing(true);
    setCurrentOperation("publish");
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;
    
    try {
      // 并发处理发布
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id) => {
          const it = items.find(x => x.id === id);
          setTtsCurrent(it?.title || "");
          try {
            await publishOne(id);
            setTtsDone(v => v + 1);
            return { id, success: true };
          } catch (error) {
            console.error(`发布失败 ${id}:`, error);
            setTtsDone(v => v + 1);
            return { id, success: false };
          }
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => !r.success).length;
      };
      
      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchFail = await processBatch(batch);
        fail += batchFail;
        
        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          await new Promise(resolve => setTimeout(resolve, throttle));
        }
      }
      
      toast.success(`批量发布完成：${ids.length - fail}/${ids.length}`);
      setSelected(new Set());
      // 刷新
      setQ(q => q);
    } catch (e) {
      toast.error("批量发布失败，请重试");
    } finally {
      setTtsCurrent("");
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Shadowing 草稿审核</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>总计: {stats.total}</span>
          <span>•</span>
          <span>有音频: {stats.withAudio}</span>
          <span>•</span>
          <span>完成度: {stats.audioPercentage}%</span>
        </div>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">搜索标题</label>
              <Input 
                placeholder="搜索标题" 
                value={q} 
                onChange={e=> setQ(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium">语言</label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">简体中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">体裁</label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部体裁</SelectItem>
                  <SelectItem value="monologue">monologue</SelectItem>
                  <SelectItem value="dialogue">dialogue</SelectItem>
                  <SelectItem value="news">news</SelectItem>
                  <SelectItem value="lecture">lecture</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">等级</label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部等级</SelectItem>
                  <SelectItem value="1">L1</SelectItem>
                  <SelectItem value="2">L2</SelectItem>
                  <SelectItem value="3">L3</SelectItem>
                  <SelectItem value="4">L4</SelectItem>
                  <SelectItem value="5">L5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">状态</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="approved">已审核</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 性能优化参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ 性能优化参数</CardTitle>
          <CardDescription>调整批量操作的性能和稳定性</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">并发数 (1-8)</label>
              <Input 
                type="number" 
                min={1} 
                max={8} 
                value={concurrency} 
                onChange={e => setConcurrency(Number(e.target.value) || 3)}
              />
              <p className="text-xs text-gray-500">同时处理的任务数</p>
            </div>
            <div>
              <label className="text-sm font-medium">重试次数 (0-5)</label>
              <Input 
                type="number" 
                min={0} 
                max={5} 
                value={retries} 
                onChange={e => setRetries(Number(e.target.value) || 2)}
              />
              <p className="text-xs text-gray-500">失败重试次数</p>
            </div>
            <div>
              <label className="text-sm font-medium">节流延迟 (ms)</label>
              <Input 
                type="number" 
                min={0} 
                max={2000} 
                value={throttle} 
                onChange={e => setThrottle(Number(e.target.value) || 200)}
              />
              <p className="text-xs text-gray-500">任务间延迟</p>
            </div>
            <div>
              <label className="text-sm font-medium">快速配置</label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setConcurrency(2); setRetries(1); setThrottle(500); }}>
                  保守
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setConcurrency(4); setRetries(2); setThrottle(200); }}>
                  平衡
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setConcurrency(6); setRetries(3); setThrottle(100); }}>
                  高速
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">批量操作</CardTitle>
          <CardDescription>已选择 {selected.size} 项，其中 {stats.selectedWithAudio} 项已有音频</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                checked={isAllSelected()} 
                onCheckedChange={toggleSelectAll}
              />
              <label className="text-sm font-medium">全选</label>
            </div>
            <div className="flex items-center space-x-1">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  const withoutAudio = items.filter(item => !item?.notes?.audio_url);
                  setSelected(new Set(withoutAudio.map(item => item.id)));
                }}
                disabled={ttsLoading || publishing}
              >
                选择无音频
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  const withAudio = items.filter(item => item?.notes?.audio_url);
                  setSelected(new Set(withAudio.map(item => item.id)));
                }}
                disabled={ttsLoading || publishing}
              >
                选择有音频
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button 
              onClick={synthSelected} 
              disabled={ttsLoading || selected.size===0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {ttsLoading ? "合成中..." : "批量合成 TTS"}
            </Button>
            <Button 
              onClick={publishSelected} 
              disabled={publishing || selected.size===0}
              variant="outline"
            >
              {publishing ? "发布中..." : "批量发布选中"}
            </Button>
            <Button 
              onClick={deleteSelected} 
              disabled={selected.size===0}
              variant="destructive"
            >
              删除选中
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* 进度显示 */}
      {(ttsLoading || publishing) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {currentOperation === "tts" && "TTS 合成进度"}
                  {currentOperation === "publish" && "批量发布进度"}
                  {currentOperation === "delete" && "批量删除进度"}
                </span>
                <span>{ttsDone}/{ttsTotal} ({Math.round((ttsDone/ttsTotal)*100)}%)</span>
              </div>
              <Progress value={(ttsDone/ttsTotal)*100} className="w-full" />
              {ttsCurrent && (
                <div className="text-sm text-gray-600">
                  当前处理: {ttsCurrent}
                </div>
              )}
              <div className="text-xs text-gray-500">
                并发数: {concurrency} | 节流延迟: {throttle}ms
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 草稿列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">草稿列表</CardTitle>
          <CardDescription>共 {items.length} 项草稿</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无符合条件的草稿</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(it => (
                <div key={it.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox 
                      checked={selected.has(it.id)} 
                      onCheckedChange={() => toggleSelect(it.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{it.lang}</Badge>
                        <Badge variant="secondary">L{it.level}</Badge>
                        <Badge variant="outline">{it.genre}</Badge>
                        {it?.notes?.audio_url && (
                          <Badge variant="default" className="bg-green-600">有音频</Badge>
                        )}
                      </div>
                      <div className="font-medium text-lg mb-2">{it.title}</div>
                      <div className="text-sm text-gray-500">
                        创建时间: {new Date(it.created_at).toLocaleString()}
                      </div>
                      {it?.notes?.audio_url && (
                        <div className="mt-3">
                          <audio controls src={it.notes.audio_url} className="h-8 w-full max-w-md" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm">
                      <Link href={`/admin/shadowing/review/${it.id}`}>查看详情</Link>
                    </Button>
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


