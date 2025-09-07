'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import TTSButton from '@/components/TTSButton';
import { supabase } from '@/lib/supabase';

interface VocabEntry {
  id: string;
  term: string;
  lang: string;
  native_lang: string;
  source: string;
  context?: string;
  tags: string[];
  status: string;
  explanation?: any;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function VocabPage() {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 过滤条件
  const [filters, setFilters] = useState({
    lang: 'all',
    status: 'all',
    explanation: 'all', // 新增：解释状态筛选
    search: '',
  });

  // AI生成相关状态
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    current: 0,
    total: 0,
    status: '',
    startTime: null as Date | null,
    estimatedTime: 0
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(0.6); // 语音播放速度
  const [availableModels, setAvailableModels] = useState<any>({});
  const [generationSettings, setGenerationSettings] = useState({
    native_lang: 'zh',
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature: 0.7,
  });

  // 获取可用模型列表
  const fetchAvailableModels = async () => {
    try {
      // 首先获取静态模型列表
      const staticResponse = await fetch('/api/ai/models');
      let staticModels = {};
      if (staticResponse.ok) {
        const staticData = await staticResponse.json();
        staticModels = staticData.providers;
      }

      // 尝试获取OpenRouter的实时模型列表
      try {
        const liveResponse = await fetch('/api/ai/openrouter-models');
        if (liveResponse.ok) {
          const liveData = await liveResponse.json();
          if (liveData.success && liveData.models) {
            // 将OpenRouter的实时模型列表整理成我们需要的格式
            const openrouterModels = [];
            
            // 添加Auto选项
            openrouterModels.push({
              id: 'openrouter/auto',
              name: 'Auto (智能选择)',
              description: '根据任务自动选择最佳模型'
            });

            // 按提供商分类并添加模型
            const providers = ['anthropic', 'openai', 'google', 'meta-llama', 'deepseek', 'qwen', 'mistralai', 'cohere'];
            
            providers.forEach((provider: string) => {
              if (liveData.models[provider]) {
                liveData.models[provider].forEach((model: any) => {
                  openrouterModels.push({
                    id: model.id,
                    name: model.name,
                    description: model.description
                  });
                });
              }
            });

            // 添加其他提供商的模型
            Object.entries(liveData.models).forEach(([provider, models]: [string, any]) => {
              if (!providers.includes(provider) && Array.isArray(models)) {
                models.forEach((model: any) => {
                  openrouterModels.push({
                    id: model.id,
                    name: `${model.name} (${provider})`,
                    description: model.description
                  });
                });
              }
            });

            // 更新OpenRouter模型列表
            staticModels.openrouter = {
              name: `OpenRouter (${liveData.total} 个模型)`,
              models: openrouterModels
            };
            
            console.log(`已获取 ${liveData.total} 个OpenRouter实时模型`);
          }
        }
      } catch (liveError) {
        console.warn('获取OpenRouter实时模型失败，使用静态列表:', liveError);
      }

      setAvailableModels(staticModels);
    } catch (error) {
      console.error('获取模型列表失败:', error);
    }
  };

  // 获取生词列表
  const fetchEntries = async (page = 1) => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.lang && filters.lang !== 'all' && { lang: filters.lang }),
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.explanation && filters.explanation !== 'all' && { explanation: filters.explanation }),
        ...(filters.search && { search: filters.search }),
      });

      // 获取当前会话的 access token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/vocab/list?${params}`, {
        headers
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取生词列表失败');
      }

      const data = await response.json();
      setEntries(data.entries);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取生词列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchEntries();
    fetchAvailableModels();
  }, [filters]);

  // 组件卸载时停止语音播放
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 更新生词状态
  const updateEntryStatus = async (id: string, status: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/vocab/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setEntries(prev => prev.map(entry => 
          entry.id === id ? { ...entry, status } : entry
        ));
      } else {
        const errorData = await response.json();
        alert(`更新失败：${errorData.error}`);
      }
    } catch (error) {
      console.error('更新生词状态失败:', error);
      alert('更新失败，请重试');
    }
  };

  // 删除单个生词
  const deleteEntry = async (id: string) => {
    if (!confirm('确定要删除这个生词吗？')) return;

    try {
      // 获取当前会话的 access token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/vocab/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        setEntries(prev => prev.filter(entry => entry.id !== id));
        setSelectedEntries(prev => prev.filter(entryId => entryId !== id));
      } else {
        const errorData = await response.json();
        alert(`删除失败：${errorData.error}`);
      }
    } catch (error) {
      console.error('删除生词失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 批量删除生词
  const deleteSelectedEntries = async () => {
    if (selectedEntries.length === 0) {
      alert('请先选择要删除的生词');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedEntries.length} 个生词吗？此操作不可恢复！`)) {
      return;
    }

    setIsDeleting(true);
    const total = selectedEntries.length;
    let completed = 0;

    try {
      // 获取当前会话的 access token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // 逐个删除以显示进度 (如果数量较少) 或批量删除 (如果数量较多)
      if (total <= 5) {
        // 逐个删除，显示详细进度
        const failedIds: string[] = [];
        
        for (const id of selectedEntries) {
          try {
            const response = await fetch(`/api/vocab/${id}`, {
              method: 'DELETE',
              headers,
            });
            
            if (response.ok) {
              completed++;
              setEntries(prev => prev.filter(entry => entry.id !== id));
            } else {
              failedIds.push(id);
            }
          } catch (error) {
            failedIds.push(id);
          }
        }

        if (failedIds.length === 0) {
          setSelectedEntries([]);
          alert(`成功删除 ${completed} 个生词！`);
        } else {
          setSelectedEntries(failedIds);
          alert(`删除完成！成功删除 ${completed} 个，失败 ${failedIds.length} 个`);
        }
      } else {
        // 批量删除
        const deletePromises = selectedEntries.map(id => 
          fetch(`/api/vocab/${id}`, {
            method: 'DELETE',
            headers,
          })
        );

        const results = await Promise.all(deletePromises);
        
        // 检查是否有失败的删除操作
        const failedCount = results.filter(response => !response.ok).length;
        
        if (failedCount === 0) {
          // 全部删除成功
          setEntries(prev => prev.filter(entry => !selectedEntries.includes(entry.id)));
          setSelectedEntries([]);
          alert(`成功删除 ${selectedEntries.length} 个生词！`);
        } else {
          // 部分删除失败
          alert(`删除完成，但有 ${failedCount} 个生词删除失败，请重试`);
          // 重新获取列表以更新状态
          fetchEntries(pagination.page);
        }
      }
    } catch (error) {
      console.error('批量删除生词失败:', error);
      alert('批量删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  // 生成AI解释
  const generateExplanations = async () => {
    if (selectedEntries.length === 0) {
      alert('请先选择要生成解释的生词');
      return;
    }

    const total = selectedEntries.length;
    const startTime = new Date();
    
    setIsGenerating(true);
    setGenerationProgress({
      current: 0,
      total,
      status: '准备开始生成...',
      startTime,
      estimatedTime: 0
    });

    try {
      // 获取当前会话的 access token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // 步骤1: 开始生成
      setGenerationProgress(prev => ({
        ...prev,
        current: 0,
        status: '正在发送请求到AI服务...'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500)); // 让用户看到开始状态

      const response = await fetch('/api/vocab/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entry_ids: selectedEntries,
          ...generationSettings,
        }),
      });

      // 步骤2: 请求已发送 - 设置为total/6或至少1
      const step2Progress = Math.max(1, Math.ceil(total / 6));
      setGenerationProgress(prev => ({
        ...prev,
        current: step2Progress,
        status: `正在使用 ${generationSettings.provider === 'deepseek' ? 'DeepSeek' : generationSettings.provider} 生成解释...`
      }));

      if (response.ok) {
        // 步骤3: AI开始处理 - 直接设置为total/3
        const step3Progress = Math.ceil(total / 3);
        setGenerationProgress(prev => ({
          ...prev,
          current: step3Progress,
          status: `AI正在分析和处理 ${total} 个生词...`
        }));
        
        await new Promise(resolve => setTimeout(resolve, 800)); // 让用户看到进度变化

        // 步骤4: 处理中 - 设置为total的2/3
        const step4Progress = Math.ceil(total * 2 / 3);
        setGenerationProgress(prev => ({
          ...prev,
          current: step4Progress,
          status: `正在生成解释... ${Math.floor((step4Progress / total) * 100)}%`
        }));
        
        await new Promise(resolve => setTimeout(resolve, 800));

        // 步骤5: 接近完成 - 设置为total-1
        const step5Progress = Math.max(total - 1, step4Progress + 1);
        setGenerationProgress(prev => ({
          ...prev,
          current: step5Progress,
          status: `即将完成，正在整理结果...`
        }));
        
        await new Promise(resolve => setTimeout(resolve, 500));

        const result = await response.json();

        // 最终步骤: 完成
        setGenerationProgress(prev => ({
          ...prev,
          current: total,
          status: `成功生成 ${result.count} 个生词的解释！`,
          estimatedTime: 0
        }));

        setTimeout(() => {
          setSelectedEntries([]);
          // 重新获取列表以显示新生成的解释
          fetchEntries(pagination.page);
          alert(`成功生成 ${result.count} 个生词的解释！`);
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error('生成解释失败详情:', errorData);
        setGenerationProgress(prev => ({
          ...prev,
          status: `生成失败：${errorData.error}`,
        }));
        alert(`生成失败：${errorData.error}${errorData.details ? '\n详情：' + errorData.details : ''}`);
      }
    } catch (error) {
      console.error('生成解释失败:', error);
      setGenerationProgress(prev => ({
        ...prev,
        status: `生成失败：${error instanceof Error ? error.message : '未知错误'}`,
      }));
      alert(`生成失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationProgress({
          current: 0,
          total: 0,
          status: '',
          startTime: null,
          estimatedTime: 0
        });
      }, 2000);
    }
  };

  // 切换选择状态
  const toggleSelection = (id: string) => {
    setSelectedEntries(prev => 
      prev.includes(id) 
        ? prev.filter(entryId => entryId !== id)
        : [...prev, id]
    );
  };

  // TTS语音播放功能
  const speakText = (text: string, lang: string, entryId: string) => {
    // 检查浏览器是否支持Web Speech API
    if (!('speechSynthesis' in window)) {
      alert('您的浏览器不支持语音功能');
      return;
    }

    // 如果正在播放，先停止
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    // 创建语音合成实例
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 根据语言设置语音
    const langCode = {
      'en': 'en-US',
      'ja': 'ja-JP',
      'zh': 'zh-CN'
    }[lang] || 'en-US';
    
    utterance.lang = langCode;
    utterance.rate = speechRate; // 使用可调节的语速
    utterance.pitch = 1; // 音调
    utterance.volume = 1; // 音量

    // 设置事件监听器
    utterance.onstart = () => {
      setSpeakingId(entryId);
    };

    utterance.onend = () => {
      setSpeakingId(null);
    };

    utterance.onerror = () => {
      setSpeakingId(null);
      alert('语音播放失败，请重试');
    };

    // 开始播放
    window.speechSynthesis.speak(utterance);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedEntries.length === entries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(entries.map(entry => entry.id));
    }
  };

  return (
    <main className="p-6">
      <Container>
        <Breadcrumbs items={[
          { href: "/", label: "首页" }, 
          { label: "生词本" }
        ]} />
        
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">生词本</h1>
            <div className="text-sm text-gray-600">
              共 {pagination.total} 个生词
            </div>
          </div>

          {/* 过滤器 */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <Label htmlFor="lang-filter">语言</Label>
              <Select value={filters.lang} onValueChange={(value) => setFilters(prev => ({ ...prev, lang: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="全部语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  <SelectItem value="en">英语</SelectItem>
                  <SelectItem value="ja">日语</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">状态</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="new">新词</SelectItem>
                  <SelectItem value="starred">已标星</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="explanation-filter">解释状态</Label>
              <Select value={filters.explanation} onValueChange={(value) => setFilters(prev => ({ ...prev, explanation: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="全部解释" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部解释</SelectItem>
                  <SelectItem value="has">已生成解释</SelectItem>
                  <SelectItem value="missing">未生成解释</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">搜索</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="搜索生词或上下文..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({
                    lang: 'all',
                    status: 'all',
                    explanation: 'all',
                    search: '',
                  })}
                >
                  重置
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="speech-rate">🔊 语音速度</Label>
              <div className="space-y-2">
                <input
                  id="speech-rate"
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-center text-gray-600">
                  {speechRate}x
                </div>
              </div>
            </div>

          </div>

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          {/* AI生成设置 */}
          {selectedEntries.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-medium mb-3">AI 解释生成设置</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="native-lang">母语</Label>
                  <Select 
                    value={generationSettings.native_lang} 
                    onValueChange={(value) => setGenerationSettings(prev => ({ ...prev, native_lang: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="provider">AI 提供商</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={generationSettings.provider} 
                      onValueChange={(value) => {
                        const provider = availableModels[value];
                        const defaultModel = provider?.models?.[0]?.id || '';
                        setGenerationSettings(prev => ({ 
                          ...prev, 
                          provider: value,
                          model: defaultModel
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(availableModels).map(([key, provider]: [string, any]) => (
                          <SelectItem key={key} value={key}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAvailableModels}
                      title="刷新模型列表"
                    >
                      🔄
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="model">模型</Label>
                  <Select 
                    value={generationSettings.model} 
                    onValueChange={(value) => setGenerationSettings(prev => ({ ...prev, model: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels[generationSettings.provider]?.models?.map((model: any) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div>
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-gray-500">{model.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button 
                    onClick={generateExplanations}
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? '生成中...' : `生成解释 (${selectedEntries.length})`}
                  </Button>
                </div>
              </div>
              
              {/* 生成进度显示 */}
              {isGenerating && generationProgress.total > 0 && (
                <div className="mt-4 p-4 bg-white rounded border border-blue-200">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">生成进度</span>
                      <span className="text-gray-600">
                        {generationProgress.current} / {generationProgress.total}
                      </span>
                    </div>
                    
                    <Progress 
                      value={(generationProgress.current / generationProgress.total) * 100} 
                      className="w-full"
                    />
                    
                    <div className="text-sm text-gray-600">
                      {generationProgress.status}
                    </div>
                    
                    {generationProgress.estimatedTime > 0 && (
                      <div className="text-xs text-gray-500">
                        预计剩余时间: {Math.round(generationProgress.estimatedTime)}秒
                      </div>
                    )}
                    
                    {generationProgress.startTime && (
                      <div className="text-xs text-gray-500">
                        已用时间: {Math.round((new Date().getTime() - generationProgress.startTime.getTime()) / 1000)}秒
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          {/* 生词列表 */}
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无生词，去 <a href="/practice/shadowing" className="text-blue-600 hover:underline">Shadowing 练习</a> 中添加一些生词吧！
            </div>
          ) : (
            <div className="space-y-4">
              {/* 批量操作 */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedEntries.length === entries.length ? '取消全选' : '全选'}
                </Button>
                <span className="text-sm text-gray-600">
                  已选择 {selectedEntries.length} 个生词
                </span>
                
                {selectedEntries.length > 0 && (
                  <div className="flex gap-2 ml-auto">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedEntries}
                      disabled={isDeleting}
                    >
                      {isDeleting ? '删除中...' : `删除选中 (${selectedEntries.length})`}
                    </Button>
                  </div>
                )}
              </div>

              {/* 生词卡片 */}
              {entries.map((entry) => (
                <div key={entry.id} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedEntries.includes(entry.id)}
                      onChange={() => toggleSelection(entry.id)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-blue-600">{entry.term}</h3>
                        <TTSButton
                          text={entry.term}
                          lang={entry.lang}
                          entryId={entry.id}
                          isPlaying={speakingId === entry.id}
                          onPlay={speakText}
                          disabled={speakingId !== null && speakingId !== entry.id}
                        />
                        <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                          {entry.lang === 'en' ? '英语' : entry.lang === 'ja' ? '日语' : '中文'}
                        </span>
                        <span className="px-2 py-1 text-xs bg-blue-100 rounded">
                          {entry.source}
                        </span>
                      </div>

                      {entry.context && (
                        <div className="text-sm text-gray-600 mb-2 bg-gray-50 p-2 rounded">
                          {entry.context}
                        </div>
                      )}

                      {entry.explanation && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                          <div className="text-gray-600">{entry.explanation.gloss_native}</div>
                          {Array.isArray(entry.explanation.senses) && entry.explanation.senses.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              例：{entry.explanation.senses[0].example_target} — {entry.explanation.senses[0].example_native}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <button 
                          className="px-2 py-1 rounded border" 
                          onClick={() => updateEntryStatus(entry.id, entry.status === 'starred' ? 'new' : 'starred')}
                        >
                          {entry.status === 'starred' ? '取消标星' : '标星'}
                        </button>
                        <button 
                          className="px-2 py-1 rounded border text-red-600 hover:bg-red-50" 
                          onClick={() => deleteEntry(entry.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchEntries(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-gray-600">
                    第 {pagination.page} 页，共 {pagination.totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchEntries(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
