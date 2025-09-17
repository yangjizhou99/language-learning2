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
import Pagination from '@/components/Pagination';
import { supabase } from '@/lib/supabase';
import { useLanguage, useTranslation } from '@/contexts/LanguageContext';

interface VocabEntry {
  id: string;
  term: string;
  lang: string;
  native_lang: string;
  source: string;
  context?: string;
  tags: string[];
  status: string;
  explanation?: {
    gloss_native: string;
    pronunciation?: string;
    pos?: string;
    senses?: Array<{
      example_target: string;
      example_native: string;
    }>;
  };
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
  const { setLanguageFromUserProfile } = useLanguage();
  const t = useTranslation();
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [itemsPerPage, setItemsPerPage] = useState(10);
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
    native_lang: 'zh', // 默认值，将在加载用户资料后更新
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature: 0.7,
  });
  const [userProfile, setUserProfile] = useState<any>(null);

  // 获取用户个人资料
  const fetchUserProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('native_lang')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.warn('获取用户资料失败:', error);
        return;
      }

      if (profile?.native_lang) {
        setUserProfile(profile);
        // 更新生成设置中的母语
        setGenerationSettings(prev => ({
          ...prev,
          native_lang: profile.native_lang
        }));
        // 根据用户母语设置界面语言
        setLanguageFromUserProfile(profile.native_lang);
      }
    } catch (error) {
      console.error('获取用户资料失败:', error);
    }
  };

  // 获取可用模型列表
  const fetchAvailableModels = async () => {
    try {
      // 首先获取静态模型列表
      const staticResponse = await fetch('/api/ai/models');
      let staticModels: any = {};
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
  const fetchEntries = async (page = 1, limit = itemsPerPage) => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
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

  // 处理每页显示条数变化
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setPagination(prev => ({ ...prev, page: 1 })); // 重置到第一页
    fetchEntries(1, newItemsPerPage);
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    fetchEntries(page, itemsPerPage);
  };

  // 初始加载
  useEffect(() => {
    fetchUserProfile();
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
        alert(`${t.vocabulary.messages.update_failed}：${errorData.error}`);
      }
    } catch (error) {
      console.error('更新生词状态失败:', error);
      alert(t.vocabulary.messages.update_failed);
    }
  };

  // 删除单个生词
  const deleteEntry = async (id: string) => {
    if (!confirm(t.vocabulary.messages.confirm_delete)) return;

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
        alert(`${t.vocabulary.messages.delete_failed.replace('{error}', errorData.error)}`);
      }
    } catch (error) {
      console.error('删除生词失败:', error);
      alert(t.vocabulary.messages.delete_failed.replace('{error}', '未知错误'));
    }
  };

  // 批量删除生词
  const deleteSelectedEntries = async () => {
    if (selectedEntries.length === 0) {
      alert(t.vocabulary.messages.confirm_delete);
      return;
    }

    if (!confirm(t.vocabulary.messages.confirm_batch_delete.replace('{count}', selectedEntries.length.toString()))) {
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
          alert(t.vocabulary.messages.delete_success.replace('{count}', completed.toString()));
        } else {
          setSelectedEntries(failedIds);
          alert(`${t.vocabulary.messages.delete_success.replace('{count}', completed.toString())}，失败 ${failedIds.length} 个`);
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
          alert(t.vocabulary.messages.delete_success.replace('{count}', selectedEntries.length.toString()));
        } else {
          // 部分删除失败
          alert(`${t.vocabulary.messages.delete_success.replace('{count}', (selectedEntries.length - failedCount).toString())}，但有 ${failedCount} 个生词删除失败，请重试`);
          // 重新获取列表以更新状态
          fetchEntries(pagination.page);
        }
      }
    } catch (error) {
      console.error('批量删除生词失败:', error);
      alert(t.vocabulary.messages.delete_failed.replace('{error}', '未知错误'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 生成AI解释
  const generateExplanations = async () => {
    if (selectedEntries.length === 0) {
      alert(t.vocabulary.messages.confirm_delete);
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
          alert(t.vocabulary.messages.generation_success.replace('{count}', result.count.toString()));
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error('生成解释失败详情:', errorData);
        setGenerationProgress(prev => ({
          ...prev,
          status: `生成失败：${errorData.error}`,
        }));
        alert(t.vocabulary.messages.generation_failed.replace('{error}', errorData.error + (errorData.details ? '\n详情：' + errorData.details : '')));
      }
    } catch (error) {
      console.error('生成解释失败:', error);
      setGenerationProgress(prev => ({
        ...prev,
        status: `生成失败：${error instanceof Error ? error.message : '未知错误'}`,
      }));
      alert(t.vocabulary.messages.generation_failed.replace('{error}', error instanceof Error ? error.message : '未知错误'));
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
    // 如果正在播放，先停止
    if (speakingId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    // 检查浏览器是否支持Web Speech API
    if (!('speechSynthesis' in window)) {
      alert(t.vocabulary.messages.speech_not_supported);
      return;
    }

    // 停止当前播放
    window.speechSynthesis.cancel();

    // 创建语音合成实例
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 根据语言设置语音代码
    const langCode = {
      'en': 'en-US',
      'ja': 'ja-JP',
      'zh': 'zh-CN'
    }[lang] || 'en-US';
    
    utterance.lang = langCode;
    utterance.rate = speechRate; // 使用可调节的语速
    utterance.pitch = 1;
    utterance.volume = 1;

    // 选择最合适的语音引擎
    const selectBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      
      if (lang === 'ja') {
        // 对于日语，按优先级选择语音引擎
        const japaneseVoices = voices.filter(voice => 
          voice.lang.startsWith('ja') || 
          voice.name.toLowerCase().includes('japanese') ||
          voice.name.toLowerCase().includes('japan')
        );
        
        if (japaneseVoices.length > 0) {
          // 优先选择本地日语语音引擎，避免使用错误的引擎
          utterance.voice = japaneseVoices[0];
          return;
        }
      }
      
      // 如果没有找到特定语言的语音，尝试匹配语言代码
      const matchingVoices = voices.filter(voice => 
        voice.lang === langCode || voice.lang.startsWith(langCode.split('-')[0])
      );
      
      if (matchingVoices.length > 0) {
        utterance.voice = matchingVoices[0];
      }
    };

    // 尝试选择最佳语音引擎
    selectBestVoice();

    // 如果语音列表还没有加载完成，等待加载
    if (window.speechSynthesis.getVoices().length === 0) {
      const handleVoicesChanged = () => {
        selectBestVoice();
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    }

    // 设置事件监听器
    utterance.onstart = () => {
      setSpeakingId(entryId);
    };

    utterance.onend = () => {
      setSpeakingId(null);
    };

    utterance.onerror = () => {
      setSpeakingId(null);
      alert(t.vocabulary.messages.speech_failed);
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

  // 一键选择未解释的生词
  const selectUnexplainedEntries = () => {
    const unexplainedEntries = entries.filter(entry => !entry.explanation || !entry.explanation.gloss_native);
    const unexplainedIds = unexplainedEntries.map(entry => entry.id);
    
    setSelectedEntries(unexplainedIds);
    
    // 显示选择结果
    if (unexplainedIds.length === 0) {
      alert(t.vocabulary.messages.no_unexplained);
    } else {
      // 按语言分组显示统计信息
      const langStats = unexplainedEntries.reduce((acc, entry) => {
        acc[entry.lang] = (acc[entry.lang] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const langText = Object.entries(langStats)
        .map(([lang, count]) => `${t.vocabulary.language_labels[lang as keyof typeof t.vocabulary.language_labels]}: ${count}个`)
        .join(', ');
      
      alert(t.vocabulary.messages.select_unexplained_result.replace('{count}', unexplainedIds.length.toString()).replace('{langText}', langText));
    }
  };

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <Container>
        <Breadcrumbs items={[
          { href: "/", label: t.nav.home }, 
          { label: t.vocabulary.title }
        ]} />
        
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 页面标题区域 */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{t.vocabulary.title}</h1>
                  <p className="text-blue-100 mt-1">管理您的生词收藏，提升语言学习效率</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {pagination.total}
                </div>
                <div className="text-blue-100 text-sm">
                  {t.vocabulary.total_vocab.replace('{count}', pagination.total.toString())}
                </div>
              </div>
            </div>
          </div>

          {/* 过滤器卡片 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-800">筛选条件</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 语言筛选 */}
              <div className="space-y-2">
                <Label htmlFor="lang-filter" className="text-sm font-medium text-gray-700">
                  {t.vocabulary.filters.language}
                </Label>
                <Select value={filters.lang} onValueChange={(value) => setFilters(prev => ({ ...prev, lang: value }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={t.vocabulary.filters.all_languages} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.vocabulary.filters.all_languages}</SelectItem>
                    <SelectItem value="en">{t.vocabulary.filters.english}</SelectItem>
                    <SelectItem value="ja">{t.vocabulary.filters.japanese}</SelectItem>
                    <SelectItem value="zh">{t.vocabulary.filters.chinese}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 状态筛选 */}
              <div className="space-y-2">
                <Label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
                  {t.vocabulary.filters.status}
                </Label>
                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={t.vocabulary.filters.all_status} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.vocabulary.filters.all_status}</SelectItem>
                    <SelectItem value="new">{t.vocabulary.filters.new_word}</SelectItem>
                    <SelectItem value="starred">{t.vocabulary.filters.starred}</SelectItem>
                    <SelectItem value="archived">{t.vocabulary.filters.archived}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 解释状态筛选 */}
              <div className="space-y-2">
                <Label htmlFor="explanation-filter" className="text-sm font-medium text-gray-700">
                  {t.vocabulary.filters.explanation_status}
                </Label>
                <Select value={filters.explanation} onValueChange={(value) => setFilters(prev => ({ ...prev, explanation: value }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={t.vocabulary.filters.all_explanations} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.vocabulary.filters.all_explanations}</SelectItem>
                    <SelectItem value="has">{t.vocabulary.filters.has_explanation}</SelectItem>
                    <SelectItem value="missing">{t.vocabulary.filters.missing_explanation}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 搜索框 */}
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm font-medium text-gray-700">
                  {t.vocabulary.filters.search}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder={t.vocabulary.filters.search_placeholder}
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="h-10"
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
                    className="h-10 px-3"
                  >
                    {t.vocabulary.filters.reset}
                  </Button>
                </div>
              </div>
            </div>

            {/* 语音速度控制 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <Label htmlFor="speech-rate" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <span>🔊</span>
                  {t.vocabulary.filters.speech_rate}
                </Label>
                <div className="flex-1 max-w-xs">
                  <input
                    id="speech-rate"
                    type="range"
                    min="0.3"
                    max="1.5"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(speechRate - 0.3) / 1.2 * 100}%, #e5e7eb ${(speechRate - 0.3) / 1.2 * 100}%, #e5e7eb 100%)`
                    }}
                  />
                </div>
                <div className="text-sm font-medium text-gray-600 min-w-[3rem] text-center">
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
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg">🤖</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{t.vocabulary.ai_generation.title}</h3>
                  <p className="text-sm text-gray-600">为选中的 {selectedEntries.length} 个生词生成AI解释</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="native-lang" className="text-sm font-medium text-gray-700">
                    {t.vocabulary.ai_generation.native_language}
                  </Label>
                  <Select 
                    value={generationSettings.native_lang} 
                    onValueChange={(value) => setGenerationSettings(prev => ({ ...prev, native_lang: value }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">{t.vocabulary.language_labels.zh}</SelectItem>
                      <SelectItem value="en">{t.vocabulary.language_labels.en}</SelectItem>
                      <SelectItem value="ja">{t.vocabulary.language_labels.ja}</SelectItem>
                    </SelectContent>
                  </Select>
                  {userProfile?.native_lang && (
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <span>💡</span>
                      {t.vocabulary.ai_generation.auto_selected}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider" className="text-sm font-medium text-gray-700">
                    {t.vocabulary.ai_generation.ai_provider}
                  </Label>
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
                      <SelectTrigger className="h-10">
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
                      title={t.vocabulary.ai_generation.refresh_models}
                      className="h-10 px-3"
                    >
                      {t.vocabulary.ai_generation.refresh_models}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm font-medium text-gray-700">
                    {t.vocabulary.ai_generation.model}
                  </Label>
                  <Select 
                    value={generationSettings.model} 
                    onValueChange={(value) => setGenerationSettings(prev => ({ ...prev, model: value }))}
                  >
                    <SelectTrigger className="h-10">
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
                    className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        {t.vocabulary.ai_generation.generating}
                      </>
                    ) : (
                      <>
                        ✨ {t.vocabulary.ai_generation.generate_explanations} ({selectedEntries.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* 生成进度显示 */}
              {isGenerating && generationProgress.total > 0 && (
                <div className="mt-6 bg-white rounded-lg border border-blue-200 p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="font-medium text-gray-800">{t.vocabulary.ai_generation.progress}</span>
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {generationProgress.current} / {generationProgress.total}
                      </span>
                    </div>
                    
                    <Progress 
                      value={(generationProgress.current / generationProgress.total) * 100} 
                      className="w-full h-2"
                    />
                    
                    <div className="text-sm text-gray-700 font-medium">
                      {generationProgress.status}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      {generationProgress.estimatedTime > 0 && (
                        <span>
                          ⏱️ {t.vocabulary.ai_generation.estimated_time}: {Math.round(generationProgress.estimatedTime)}秒
                        </span>
                      )}
                      
                      {generationProgress.startTime && (
                        <span>
                          ⏰ {t.vocabulary.ai_generation.elapsed_time}: {Math.round((new Date().getTime() - generationProgress.startTime.getTime()) / 1000)}秒
                        </span>
                      )}
                    </div>
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
            <div className="text-center py-8">{t.vocabulary.messages.loading}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t.vocabulary.messages.no_vocab}，去 <a href="/practice/shadowing" className="text-blue-600 hover:underline">{t.nav.shadowing}</a> 中添加一些生词吧！
            </div>
          ) : (
            <div className="space-y-4">
              {/* 顶部分页 */}
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                showItemsPerPage={true}
                showPageInput={true}
                maxVisiblePages={5}
                className="mb-4"
              />
              {/* 批量操作工具栏 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="h-9 px-4"
                    >
                      {selectedEntries.length === entries.length ? t.vocabulary.batch_operations.deselect_all : t.vocabulary.batch_operations.select_all}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectUnexplainedEntries}
                      className="h-9 px-4 bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                    >
                      🎯 {t.vocabulary.batch_operations.select_unexplained}
                    </Button>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-800">
                        {t.vocabulary.batch_operations.selected_count.replace('{count}', selectedEntries.length.toString())}
                      </span>
                      {(() => {
                        const unexplainedCount = entries.filter(entry => !entry.explanation || !entry.explanation.gloss_native).length;
                        return unexplainedCount > 0 ? (
                          <span className="ml-2 text-yellow-600">
                            ({t.vocabulary.batch_operations.selected_unexplained.replace('{count}', unexplainedCount.toString())})
                          </span>
                        ) : '';
                      })()}
                    </div>
                  </div>
                  
                  {selectedEntries.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteSelectedEntries}
                        disabled={isDeleting}
                        className="h-9 px-4"
                      >
                        {isDeleting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            {t.vocabulary.batch_operations.deleting}
                          </>
                        ) : (
                          <>
                            🗑️ {t.vocabulary.batch_operations.delete_selected} ({selectedEntries.length})
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* 生词卡片网格 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {entries.map((entry) => (
                  <div key={entry.id} className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
                    {/* 卡片头部 */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(entry.id)}
                            onChange={() => toggleSelection(entry.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                {entry.term}
                              </h3>
                              {entry.explanation?.pronunciation && (
                                <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-sm font-medium">
                                  {entry.explanation.pronunciation}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                entry.lang === 'en' ? 'bg-blue-100 text-blue-700' :
                                entry.lang === 'ja' ? 'bg-red-100 text-red-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {t.vocabulary.language_labels[entry.lang as keyof typeof t.vocabulary.language_labels]}
                              </span>
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                {entry.source}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                entry.status === 'starred' ? 'bg-yellow-100 text-yellow-700' :
                                entry.status === 'archived' ? 'bg-gray-100 text-gray-600' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {t.vocabulary.status_labels[entry.status as keyof typeof t.vocabulary.status_labels]}
                              </span>
                            </div>
                          </div>
                        </div>
                        <TTSButton
                          text={entry.term}
                          lang={entry.lang}
                          entryId={entry.id}
                          isPlaying={speakingId === entry.id}
                          onPlay={speakText}
                          disabled={speakingId !== null && speakingId !== entry.id}
                        />
                      </div>
                    </div>

                    {/* 卡片内容 */}
                    <div className="p-4">
                      {/* 上下文 */}
                      {entry.context && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                          <p className="text-sm text-gray-700 italic">"{entry.context}"</p>
                        </div>
                      )}

                      {/* 解释内容 */}
                      {entry.explanation ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                            <p className="text-gray-800 font-medium">{entry.explanation.gloss_native}</p>
                          </div>
                          
                          {/* 词性和例句 */}
                          <div className="space-y-2">
                            {entry.explanation.pos && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  {t.vocabulary.vocab_card.part_of_speech}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                                  {entry.explanation.pos}
                                </span>
                              </div>
                            )}
                            
                            {Array.isArray(entry.explanation.senses) && entry.explanation.senses.length > 0 && (
                              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="text-xs font-medium text-amber-700 mb-1">
                                  {t.vocabulary.vocab_card.example}
                                </div>
                                <div className="text-sm text-gray-700">
                                  <span className="font-medium">{entry.explanation.senses[0].example_target}</span>
                                  <span className="text-gray-500 mx-2">—</span>
                                  <span className="text-gray-600">{entry.explanation.senses[0].example_native}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                          <p className="text-sm text-yellow-700 font-medium">
                            {t.vocabulary.vocab_card.no_explanation}
                          </p>
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button 
                              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                                entry.status === 'starred' 
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              onClick={() => updateEntryStatus(entry.id, entry.status === 'starred' ? 'new' : 'starred')}
                            >
                              {entry.status === 'starred' ? '⭐ ' + t.vocabulary.vocab_card.unstar : '☆ ' + t.vocabulary.vocab_card.star}
                            </button>
                          </div>
                          <button 
                            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors" 
                            onClick={() => deleteEntry(entry.id)}
                          >
                            🗑️ {t.vocabulary.vocab_card.delete}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 底部分页 */}
              <div className="border-t pt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  showItemsPerPage={true}
                  showPageInput={true}
                  maxVisiblePages={5}
                  className="mt-4"
                />
              </div>
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
