'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import TTSButton from '@/components/TTSButton';
import Pagination from '@/components/Pagination';
import { supabase } from '@/lib/supabase';
import { useLanguage, useTranslation } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeInWhenVisible } from '@/components/FadeInWhenVisible';
import { useCounterAnimation } from '@/hooks/useCounterAnimation';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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
  // SRS fields
  srs_due?: string | null;
  srs_interval?: number | null;
  srs_ease?: number | null;
  srs_reps?: number | null;
  srs_lapses?: number | null;
  srs_last?: string | null;
  srs_state?: string | null;
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
  const prefersReducedMotion = useReducedMotion();
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
  
  // 动画相关状态
  const [statsLoaded, setStatsLoaded] = useState(false);

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
    estimatedTime: 0,
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

  // ====== SRS Review states ======
  const [dueCount, setDueCount] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [reviewList, setReviewList] = useState<VocabEntry[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [reviewAmount, setReviewAmount] = useState<string>('all');
  const [buttonDelays, setButtonDelays] = useState<Record<string, number>>({});
  const [clickedButton, setClickedButton] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<Array<{id: string, rating: string}>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 缓存相关状态
  const [cache, setCache] = useState<{
    data: any;
    timestamp: number;
    filters: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  // 获取用户个人资料
  const fetchUserProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        setGenerationSettings((prev) => ({
          ...prev,
          native_lang: profile.native_lang,
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
              description: '根据任务自动选择最佳模型',
            });

            // 按提供商分类并添加模型
            const providers = [
              'anthropic',
              'openai',
              'google',
              'meta-llama',
              'deepseek',
              'qwen',
              'mistralai',
              'cohere',
            ];

            providers.forEach((provider: string) => {
              if (liveData.models[provider]) {
                liveData.models[provider].forEach((model: any) => {
                  openrouterModels.push({
                    id: model.id,
                    name: model.name,
                    description: model.description,
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
                    description: model.description,
                  });
                });
              }
            });

            // 更新OpenRouter模型列表
            staticModels.openrouter = {
              name: `OpenRouter (${liveData.total} 个模型)`,
              models: openrouterModels,
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

  // 检查缓存是否有效
  const isCacheValid = (cacheData: any, currentFilters: any, currentLimit: number) => {
    if (!cacheData) return false;
    const now = Date.now();
    const cacheAge = now - cacheData.timestamp;
    const filtersMatch = JSON.stringify(cacheData.filters) === JSON.stringify(currentFilters);
    const limitMatch = cacheData.data.pagination.limit === currentLimit;
    return cacheAge < 30000 && filtersMatch && limitMatch; // 30秒缓存，且分页大小匹配
  };

  // 获取生词列表（优化版）
  const fetchEntries = async (page = 1, limit = itemsPerPage, useCache = true) => {
    // 暂时禁用缓存，因为API返回的是分页数据，不能用于前端分页
    // TODO: 如果需要缓存，应该修改API返回所有数据，然后在前端分页
    console.log('获取生词数据:', { page, limit, useCache, filters });

    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.lang && filters.lang !== 'all' && { lang: filters.lang }),
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.explanation &&
          filters.explanation !== 'all' && { explanation: filters.explanation }),
        ...(filters.search && { search: filters.search }),
      });

      // 获取当前会话的 access token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = {};

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // 使用新的合并API
      const response = await fetch(`/api/vocab/dashboard?${params}`, {
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t.vocabulary.messages.fetch_vocab_failed);
      }

      const data = await response.json();
      
      console.log('API返回数据:', { 
        entries: data.entries.length, 
        pagination: data.pagination,
        stats: data.stats,
        firstEntry: data.entries[0]?.term || 'none',
        lastEntry: data.entries[data.entries.length - 1]?.term || 'none'
      });
      
      // 更新缓存
      setCache({
        data: {
          entries: data.entries,
          pagination: data.pagination,
          stats: data.stats
        },
        timestamp: Date.now(),
        filters: { ...filters }
      });

      console.log('设置生词数据:', { 
        entriesCount: data.entries.length,
        page: data.pagination.page,
        totalPages: data.pagination.totalPages 
      });

      setEntries(data.entries);
      setPagination(data.pagination);
      setDueCount(data.stats.dueCount);
      setStatsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.vocabulary.messages.fetch_vocab_failed);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取今日到期数量（现在由合并API处理）
  const fetchDueCount = async () => {
    // 如果缓存中有数据，直接使用
    if (cache && cache.data.stats) {
      setDueCount(cache.data.stats.dueCount);
      return;
    }
    
    // 否则触发一次完整的数据获取
    await fetchEntries(1, itemsPerPage, false);
  };

  // 开始复习
  const startReview = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      // 确定本次复习数量：全部则严格按到期数(dueCount)，手动选择则按选择值
      const selectedLimit = reviewAmount === 'all'
        ? Math.max(dueCount, 1)
        : parseInt(reviewAmount || '20', 10);
      const res = await fetch(`/api/vocab/review/due?limit=${encodeURIComponent(String(selectedLimit))}&page=1`, { headers });
      if (!res.ok) {
        alert(t.vocabulary.messages.review_failed);
        return;
      }
      const data = await res.json();
      const list: VocabEntry[] = data.entries || [];
      if (list.length === 0) {
        alert(t.vocabulary.messages.review_no_due);
        setDueCount(0);
        return;
      }
      setReviewList(list);
      setReviewIndex(0);
      setShowBack(false);
      setReviewing(true);
      
      // 自动播放第一个单词的发音
      setTimeout(() => {
        if (list[0]) {
          speakText(list[0].term, list[0].lang, list[0].id);
        }
      }, 300); // 稍微延迟确保界面渲染完成
    } catch (e) {
      console.error(e);
      alert(t.vocabulary.messages.review_failed);
    }
  };

  // 计算按钮延迟时间
  const calculateButtonDelays = (cur: VocabEntry) => {
    const currentInterval = cur.srs_interval || 0;
    const currentEase = typeof cur.srs_ease === 'number' ? cur.srs_ease : 2.5;
    const currentReps = cur.srs_reps || 0;

    const calculateDelay = (rating: string) => {
      const qMap: Record<string, number> = { again: 1, hard: 3, good: 4, easy: 5 };
      const q = qMap[rating];

      if (q < 3) {
        return 1; // Tomorrow
      } else {
        let interval = currentInterval;
        if (currentReps === 0) {
          interval = 1;
        } else if (currentReps === 1) {
          interval = 6;
        } else {
          interval = Math.max(1, Math.round(interval * currentEase));
        }
        return interval;
      }
    };

    return {
      again: calculateDelay('again'),
      hard: calculateDelay('hard'),
      good: calculateDelay('good'),
      easy: calculateDelay('easy'),
    };
  };

  // 播放按钮点击音效
  const playButtonSound = (rating: string) => {
    try {
      // 创建音频上下文
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 根据评分选择不同的音效
      const frequencies = {
        again: [200, 150, 100], // 低沉的音效
        hard: [300, 250, 200], // 中等音效
        good: [400, 500, 600], // 上升音效
        easy: [600, 700, 800]  // 高音效
      };
      
      const freq = frequencies[rating as keyof typeof frequencies] || [400, 500, 600];
      
      // 创建音效
      freq.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1 + index * 0.1);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + 0.1 + index * 0.1);
      });
    } catch (error) {
      console.log('音效播放失败:', error);
    }
  };

  // 批量提交复习结果
  const submitPendingReviews = async () => {
    if (pendingReviews.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      // 使用批量API提交所有待处理的复习结果
      const response = await fetch(`/api/vocab/review/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reviews: pendingReviews }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`成功提交 ${result.processed} 个复习结果`);
        // 清空待处理列表
        setPendingReviews([]);
      } else {
        const error = await response.json();
        console.error('批量提交失败:', error);
        // 如果批量提交失败，尝试单个提交
        await submitIndividualReviews();
      }
    } catch (error) {
      console.error('批量提交复习结果失败:', error);
      // 如果批量提交失败，尝试单个提交
      await submitIndividualReviews();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 单个提交作为备用方案
  const submitIndividualReviews = async () => {
    if (pendingReviews.length === 0) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    const promises = pendingReviews.map(review => 
      fetch(`/api/vocab/review/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: review.id, rating: review.rating }),
      })
    );

    const results = await Promise.allSettled(promises);
    
    const failedCount = results.filter(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && !result.value.ok)
    ).length;

    if (failedCount > 0) {
      console.warn(`${failedCount} 个复习结果提交失败`);
    } else {
      setPendingReviews([]);
    }
  };

  // 提交复习打分
  const answerReview = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    const cur = reviewList[reviewIndex];
    if (!cur) return;

    // 立即停止当前播放的声音
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);

    // 设置按钮点击反馈
    setClickedButton(rating);
    setIsTransitioning(true);
    
    // 播放音效
    playButtonSound(rating);

    // 添加到待处理列表，而不是立即提交
    setPendingReviews(prev => [...prev, { id: cur.id, rating }]);

    // 延迟一下让用户看到反馈效果
    setTimeout(() => {
      const next = reviewIndex + 1;
      if (next < reviewList.length) {
        setReviewIndex(next);
        setShowBack(false);
        
        // 自动播放下一个单词的发音
        setTimeout(() => {
          const nextWord = reviewList[next];
          if (nextWord) {
            speakText(nextWord.term, nextWord.lang, nextWord.id);
          }
        }, 300);
      } else {
        // 复习完成，提交所有待处理的结果
        submitPendingReviews();
        setReviewing(false);
        setReviewList([]);
        setReviewIndex(0);
        setShowBack(false);
        fetchDueCount();
        fetchEntries(pagination.page);
      }
      setClickedButton(null);
      setIsTransitioning(false);
    }, 500);
  };

  // 处理每页显示条数变化
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    console.log('每页显示条数变化:', { 
      newItemsPerPage, 
      currentItemsPerPage: itemsPerPage,
      currentPage: pagination.page 
    });
    setItemsPerPage(newItemsPerPage);
    setPagination((prev) => ({ ...prev, page: 1 })); // 重置到第一页
    fetchEntries(1, newItemsPerPage, false); // 强制不使用缓存
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    console.log('页码变化:', { 
      page, 
      itemsPerPage, 
      totalPages: pagination.totalPages,
      currentPage: pagination.page 
    });
    
    // 直接调用API获取对应页面的数据
    fetchEntries(page, itemsPerPage, false);
  };

  // 初始加载
  useEffect(() => {
    fetchUserProfile();
    fetchAvailableModels();
    // 合并数据获取，减少API调用
    fetchEntries();
  }, [filters]);

  // 预加载下一页数据
  // 预加载功能暂时禁用，因为缓存逻辑有问题
  // TODO: 如果需要预加载，应该修改API和缓存逻辑
  // useEffect(() => {
  //   if (pagination.page < pagination.totalPages && cache && cache.data.pagination.limit === itemsPerPage) {
  //     const nextPage = pagination.page + 1;
  //     const startIndex = (nextPage - 1) * itemsPerPage;
  //     const endIndex = startIndex + itemsPerPage;
      
  //     // 如果缓存中没有下一页数据，预加载
  //     if (!cache.data.entries.slice(startIndex, endIndex).length) {
  //       fetchEntries(nextPage, itemsPerPage, false);
  //     }
  //   }
  // }, [pagination.page, itemsPerPage, cache]);

  // 定时提交待处理的复习结果
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingReviews.length > 0 && !isSubmitting) {
        submitPendingReviews();
      }
    }, 5000); // 每5秒检查一次

    return () => clearInterval(interval);
  }, [pendingReviews.length, isSubmitting]);

  // 页面卸载时保存待处理的复习结果
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingReviews.length > 0) {
        // 同步提交，确保数据不丢失
        navigator.sendBeacon('/api/vocab/review/batch', JSON.stringify({
          reviews: pendingReviews
        }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingReviews]);

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status } : entry)));
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        setEntries((prev) => prev.filter((entry) => entry.id !== id));
        setSelectedEntries((prev) => prev.filter((entryId) => entryId !== id));
      } else {
        const errorData = await response.json();
        alert(`${t.vocabulary.messages.delete_failed.replace('{error}', errorData.error)}`);
      }
    } catch (error) {
      console.error('删除生词失败:', error);
      alert(t.vocabulary.messages.delete_failed.replace('{error}', t.vocabulary.messages.delete_failed_unknown));
    }
  };

  // 批量删除生词
  const deleteSelectedEntries = async () => {
    if (selectedEntries.length === 0) {
      alert(t.vocabulary.messages.confirm_delete);
      return;
    }

    if (
      !confirm(
        t.vocabulary.messages.confirm_batch_delete.replace(
          '{count}',
          selectedEntries.length.toString(),
        ),
      )
    ) {
      return;
    }

    setIsDeleting(true);
    const total = selectedEntries.length;
    let completed = 0;

    try {
      // 获取当前会话的 access token
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
              setEntries((prev) => prev.filter((entry) => entry.id !== id));
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
          alert(
            `${t.vocabulary.messages.delete_success.replace('{count}', completed.toString())}${t.vocabulary.messages.batch_delete_retry.replace('{count}', failedIds.length.toString())}`,
          );
        }
      } else {
        // 批量删除
        const deletePromises = selectedEntries.map((id) =>
          fetch(`/api/vocab/${id}`, {
            method: 'DELETE',
            headers,
          }),
        );

        const results = await Promise.all(deletePromises);

        // 检查是否有失败的删除操作
        const failedCount = results.filter((response) => !response.ok).length;

        if (failedCount === 0) {
          // 全部删除成功
          setEntries((prev) => prev.filter((entry) => !selectedEntries.includes(entry.id)));
          setSelectedEntries([]);
          alert(
            t.vocabulary.messages.delete_success.replace(
              '{count}',
              selectedEntries.length.toString(),
            ),
          );
        } else {
          // 部分删除失败
          alert(
            `${t.vocabulary.messages.delete_success.replace('{count}', (selectedEntries.length - failedCount).toString())}${t.vocabulary.messages.batch_delete_partial_failed.replace('{count}', failedCount.toString())}`,
          );
          // 重新获取列表以更新状态
          fetchEntries(pagination.page);
        }
      }
    } catch (error) {
      console.error('批量删除生词失败:', error);
      alert(t.vocabulary.messages.delete_failed.replace('{error}', t.vocabulary.messages.delete_failed_unknown));
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
      status: t.vocabulary.messages.generation_preparing,
      startTime,
      estimatedTime: 0,
    });

    try {
      // 获取当前会话的 access token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // 预检：AI权限 + API限额
      try {
        const precheckRes = await fetch('/api/ai/precheck', {
          method: 'POST',
          headers,
          body: JSON.stringify({ provider: generationSettings.provider, model: generationSettings.model }),
        });
        if (!precheckRes.ok) {
          const j = await precheckRes.json().catch(() => ({} as any));
          const msg = j?.reason || (precheckRes.status === 429 ? 'API 使用已达上限' : '无权限使用所选模型');
          alert(msg);
          setIsGenerating(false);
          setGenerationProgress({
            current: 0,
            total: 0,
            status: '',
            startTime: null,
            estimatedTime: 0,
          });
          return;
        }
      } catch (e) {
        console.error('预检失败', e);
        alert('暂时无法进行AI生成，请稍后再试');
        setIsGenerating(false);
        setGenerationProgress({
          current: 0,
          total: 0,
          status: '',
          startTime: null,
          estimatedTime: 0,
        });
        return;
      }

      // 步骤1: 开始生成
      setGenerationProgress((prev) => ({
        ...prev,
        current: 0,
        status: t.vocabulary.messages.generation_sending_request,
      }));

      await new Promise((resolve) => setTimeout(resolve, 500)); // 让用户看到开始状态

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
      setGenerationProgress((prev) => ({
        ...prev,
        current: step2Progress,
        status: t.vocabulary.messages.generation_processing.replace('{count}', total.toString()),
      }));

      if (response.ok) {
        // 步骤3: AI开始处理 - 直接设置为total/3
        const step3Progress = Math.ceil(total / 3);
        setGenerationProgress((prev) => ({
          ...prev,
          current: step3Progress,
          status: t.vocabulary.messages.generation_processing.replace('{count}', total.toString()),
        }));

        await new Promise((resolve) => setTimeout(resolve, 800)); // 让用户看到进度变化

        // 步骤4: 处理中 - 设置为total的2/3
        const step4Progress = Math.ceil((total * 2) / 3);
        setGenerationProgress((prev) => ({
          ...prev,
          current: step4Progress,
          status: t.vocabulary.messages.generation_generating.replace('{progress}', Math.floor((step4Progress / total) * 100).toString()),
        }));

        await new Promise((resolve) => setTimeout(resolve, 800));

        // 步骤5: 接近完成 - 设置为total-1
        const step5Progress = Math.max(total - 1, step4Progress + 1);
        setGenerationProgress((prev) => ({
          ...prev,
          current: step5Progress,
          status: t.vocabulary.messages.generation_finalizing,
        }));

        await new Promise((resolve) => setTimeout(resolve, 500));

        const result = await response.json();

        // 最终步骤: 完成
        setGenerationProgress((prev) => ({
          ...prev,
          current: total,
          status: t.vocabulary.messages.generation_completed.replace('{count}', result.count.toString()),
          estimatedTime: 0,
        }));

        setTimeout(() => {
          setSelectedEntries([]);
          // 重新获取列表以显示新生成的解释
          fetchEntries(pagination.page);
          alert(
            t.vocabulary.messages.generation_success.replace('{count}', result.count.toString()),
          );
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error('生成解释失败详情:', errorData);
        setGenerationProgress((prev) => ({
          ...prev,
          status: t.vocabulary.messages.generation_failed_status.replace('{error}', errorData.error),
        }));
        alert(
          t.vocabulary.messages.generation_failed.replace(
            '{error}',
            errorData.error + (errorData.details ? '\n' + t.vocabulary.messages.generation_details + errorData.details : ''),
          ),
        );
      }
    } catch (error) {
      console.error('生成解释失败:', error);
      setGenerationProgress((prev) => ({
        ...prev,
        status: t.vocabulary.messages.generation_failed_status.replace('{error}', error instanceof Error ? error.message : t.vocabulary.messages.delete_failed_unknown),
      }));
      alert(
        t.vocabulary.messages.generation_failed.replace(
          '{error}',
          error instanceof Error ? error.message : t.vocabulary.messages.delete_failed_unknown,
        ),
      );
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationProgress({
          current: 0,
          total: 0,
          status: '',
          startTime: null,
          estimatedTime: 0,
        });
      }, 2000);
    }
  };

  // 切换选择状态
  const toggleSelection = (id: string) => {
    setSelectedEntries((prev) =>
      prev.includes(id) ? prev.filter((entryId) => entryId !== id) : [...prev, id],
    );
  };

  // TTS语音播放功能
  const speakText = (text: string, lang: string, entryId: string) => {
    // 检查浏览器是否支持Web Speech API
    if (!('speechSynthesis' in window)) {
      console.log('语音合成不支持');
      return;
    }

    // 如果正在播放相同的内容，先停止
    if (speakingId === entryId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    // 停止当前播放
    window.speechSynthesis.cancel();
    setSpeakingId(null);

    // 等待一小段时间确保停止完成
    setTimeout(() => {
      try {
        // 创建语音合成实例
        const utterance = new SpeechSynthesisUtterance(text);

        // 根据语言设置语音代码
        const langCode =
          {
            en: 'en-US',
            ja: 'ja-JP',
            zh: 'zh-CN',
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
            const japaneseVoices = voices.filter(
              (voice) =>
                voice.lang.startsWith('ja') ||
                voice.name.toLowerCase().includes('japanese') ||
                voice.name.toLowerCase().includes('japan'),
            );

            if (japaneseVoices.length > 0) {
              // 优先选择本地日语语音引擎，避免使用错误的引擎
              utterance.voice = japaneseVoices[0];
              return;
            }
          }

          // 如果没有找到特定语言的语音，尝试匹配语言代码
          const matchingVoices = voices.filter(
            (voice) => voice.lang === langCode || voice.lang.startsWith(langCode.split('-')[0]),
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

        utterance.onerror = (event) => {
          console.log('语音播放错误:', event.error);
          setSpeakingId(null);
          // 不显示错误提示，静默处理
        };

        // 开始播放
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.log('语音播放失败:', error);
        setSpeakingId(null);
      }
    }, 100); // 100ms延迟确保停止完成
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedEntries.length === entries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(entries.map((entry) => entry.id));
    }
  };

  // 一键选择未解释的生词
  const selectUnexplainedEntries = () => {
    const unexplainedEntries = entries.filter(
      (entry) => !entry.explanation || !entry.explanation.gloss_native,
    );
    const unexplainedIds = unexplainedEntries.map((entry) => entry.id);

    setSelectedEntries(unexplainedIds);

    // 显示选择结果
    if (unexplainedIds.length === 0) {
      alert(t.vocabulary.messages.no_unexplained);
    } else {
      // 按语言分组显示统计信息
      const langStats = unexplainedEntries.reduce(
        (acc, entry) => {
          acc[entry.lang] = (acc[entry.lang] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const langText = Object.entries(langStats)
        .map(
          ([lang, count]) =>
            `${t.vocabulary.language_labels[lang as keyof typeof t.vocabulary.language_labels]}: ${count}个`,
        )
        .join(', ');

      alert(
        t.vocabulary.messages.select_unexplained_result
          .replace('{count}', unexplainedIds.length.toString())
          .replace('{langText}', langText),
      );
    }
  };

  // 数字计数动画
  const animatedTotal = useCounterAnimation(pagination.total, 1500, statsLoaded && !prefersReducedMotion);
  const animatedDueCount = useCounterAnimation(dueCount, 1200, statsLoaded && !prefersReducedMotion);

  return (<>
    <main className="p-3 sm:p-6 bg-gray-50 min-h-screen">
      <Container>
        <Breadcrumbs items={[{ href: '/', label: t.nav.home }, { label: t.vocabulary.title }]} />

        <div className="max-w-7xl mx-auto space-y-6">
          {/* 页面标题区域 */}
          <motion.div
            className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 sm:p-6 text-white"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <motion.div
                className="flex items-center gap-3 sm:gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <motion.div
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <span className="text-xl sm:text-2xl">📚</span>
                </motion.div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold truncate">{t.vocabulary.title}</h1>
                  <p className="text-blue-100 mt-1 text-sm sm:text-base">{t.vocabulary.messages.page_description}</p>
                </div>
              </motion.div>
              <motion.div
                className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-end xl:items-center gap-3 sm:gap-4 lg:gap-2 xl:gap-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="text-center sm:text-right">
                  <div className="text-xl sm:text-2xl font-bold">{animatedTotal}</div>
                  <div className="text-blue-100 text-xs sm:text-sm">
                    {t.vocabulary.total_vocab.replace('{count}', animatedTotal.toString())}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <motion.span
                    className="px-2 py-1 rounded-full text-xs bg-white/20 text-center sm:text-left"
                    animate={animatedDueCount > 0 ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {t.vocabulary.messages.review_progress
                      .replace('{current}', animatedDueCount.toString())
                      .replace('{total}', animatedTotal.toString())}
                  </motion.span>
                  <div className="flex gap-2">
                    <Select value={reviewAmount} onValueChange={(v) => setReviewAmount(v)}>
                      <SelectTrigger className="h-8 w-24 sm:w-28 bg-white text-blue-700 text-xs sm:text-sm">
                        <SelectValue placeholder={t.vocabulary.messages.review_count_placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t.vocabulary.messages.review_count_all}</SelectItem>
                        <SelectItem value="10">{t.vocabulary.messages.review_count_10}</SelectItem>
                        <SelectItem value="20">{t.vocabulary.messages.review_count_20}</SelectItem>
                        <SelectItem value="30">{t.vocabulary.messages.review_count_30}</SelectItem>
                        <SelectItem value="50">{t.vocabulary.messages.review_count_50}</SelectItem>
                        <SelectItem value="100">{t.vocabulary.messages.review_count_100}</SelectItem>
                      </SelectContent>
                    </Select>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={startReview}
                        className="h-8 px-3 bg-white text-blue-700 hover:bg-blue-50 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {t.vocabulary.messages.start_review}
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* 过滤器卡片 */}
          <FadeInWhenVisible delay={0.1}>
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-gray-800">{t.vocabulary.messages.filter_conditions}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 语言筛选 */}
              <div className="space-y-2">
                <Label htmlFor="lang-filter" className="text-sm font-medium text-gray-700">
                  {t.vocabulary.filters.language}
                </Label>
                <Select
                  value={filters.lang}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, lang: value }))}
                >
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
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
                >
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
                <Select
                  value={filters.explanation}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, explanation: value }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={t.vocabulary.filters.all_explanations} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.vocabulary.filters.all_explanations}</SelectItem>
                    <SelectItem value="has">{t.vocabulary.filters.has_explanation}</SelectItem>
                    <SelectItem value="missing">
                      {t.vocabulary.filters.missing_explanation}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 搜索框 */}
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="search" className="text-sm font-medium text-gray-700">
                  {t.vocabulary.filters.search}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    placeholder={t.vocabulary.filters.search_placeholder}
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="h-10 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFilters({
                        lang: 'all',
                        status: 'all',
                        explanation: 'all',
                        search: '',
                      })
                    }
                    className="h-10 px-3 whitespace-nowrap"
                  >
                    {t.vocabulary.filters.reset}
                  </Button>
                </div>
              </div>
            </div>

            {/* 语音速度控制 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Label
                  htmlFor="speech-rate"
                  className="text-sm font-medium text-gray-700 flex items-center gap-2 flex-shrink-0"
                >
                  <span>🔊</span>
                  {t.vocabulary.filters.speech_rate}
                </Label>
                <div className="flex items-center gap-3 flex-1">
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
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((speechRate - 0.3) / 1.2) * 100}%, #e5e7eb ${((speechRate - 0.3) / 1.2) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-600 min-w-[3rem] text-center">
                    {speechRate}x
                  </div>
                </div>
              </div>
            </div>
            </motion.div>
          </FadeInWhenVisible>

          {/* 错误信息 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-50 border border-red-200 rounded text-red-700"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI生成设置 */}
          <AnimatePresence>
            {selectedEntries.length > 0 && (
              <motion.div
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: '1.5rem' }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <motion.div
                  className="flex items-center gap-3 mb-4"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <motion.div
                    className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <span className="text-white text-lg">🤖</span>
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {t.vocabulary.ai_generation.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t.vocabulary.messages.ai_generation_for_selected.replace('{count}', selectedEntries.length.toString())}
                    </p>
                  </div>
                </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="native-lang" className="text-sm font-medium text-gray-700">
                    {t.vocabulary.ai_generation.native_language}
                  </Label>
                  <Select
                    value={generationSettings.native_lang}
                    onValueChange={(value) =>
                      setGenerationSettings((prev) => ({ ...prev, native_lang: value }))
                    }
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
                        setGenerationSettings((prev) => ({
                          ...prev,
                          provider: value,
                          model: defaultModel,
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
                    onValueChange={(value) =>
                      setGenerationSettings((prev) => ({ ...prev, model: value }))
                    }
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
                  <motion.div
                    className="w-full"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
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
                          ✨ {t.vocabulary.ai_generation.generate_explanations} (
                          {selectedEntries.length})
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>

              {/* 生成进度显示 */}
              {isGenerating && generationProgress.total > 0 && (
                <div className="mt-6 bg-white rounded-lg border border-blue-200 p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="font-medium text-gray-800">
                          {t.vocabulary.ai_generation.progress}
                        </span>
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
                          ⏱️ {t.vocabulary.ai_generation.estimated_time}:{' '}
                          {Math.round(generationProgress.estimatedTime)}秒
                        </span>
                      )}

                      {generationProgress.startTime && (
                        <span>
                          ⏰ {t.vocabulary.ai_generation.elapsed_time}:{' '}
                          {Math.round(
                            (new Date().getTime() - generationProgress.startTime.getTime()) / 1000,
                          )}
                          秒
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 生词列表 */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                {t.vocabulary.messages.loading}
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t.vocabulary.messages.no_vocab}，去{' '}
              <a href="/practice/shadowing" className="text-blue-600 hover:underline">
                {t.nav.shadowing}
              </a>{' '}
              中添加一些生词吧！
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="h-9 px-3 sm:px-4 text-xs sm:text-sm"
                      >
                        {selectedEntries.length === entries.length
                          ? t.vocabulary.batch_operations.deselect_all
                          : t.vocabulary.batch_operations.select_all}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectUnexplainedEntries}
                        className="h-9 px-3 sm:px-4 bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 text-xs sm:text-sm"
                      >
                        🎯 {t.vocabulary.batch_operations.select_unexplained}
                      </Button>
                    </div>
                    <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-800">
                        {t.vocabulary.batch_operations.selected_count.replace(
                          '{count}',
                          selectedEntries.length.toString(),
                        )}
                      </span>
                      {(() => {
                        const unexplainedCount = entries.filter(
                          (entry) => !entry.explanation || !entry.explanation.gloss_native,
                        ).length;
                        return unexplainedCount > 0 ? (
                          <span className="ml-2 text-yellow-600">
                            (
                            {t.vocabulary.batch_operations.selected_unexplained.replace(
                              '{count}',
                              unexplainedCount.toString(),
                            )}
                            )
                          </span>
                        ) : (
                          ''
                        );
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
                        className="h-9 px-3 sm:px-4 text-xs sm:text-sm"
                      >
                        {isDeleting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            {t.vocabulary.batch_operations.deleting}
                          </>
                        ) : (
                          <>
                            🗑️ {t.vocabulary.batch_operations.delete_selected} (
                            {selectedEntries.length})
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* 生词卡片网格 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {entries.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.5) }}
                    whileHover={{ y: -4, boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                    className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* 卡片头部 */}
                    <div className="p-3 sm:p-4 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(entry.id)}
                            onChange={() => toggleSelection(entry.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0 mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <h3 className="text-lg sm:text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                                {entry.term}
                              </h3>
                              {entry.explanation?.pronunciation && (
                                <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs sm:text-sm font-medium flex-shrink-0">
                                  {entry.explanation.pronunciation}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  entry.lang === 'en'
                                    ? 'bg-blue-100 text-blue-700'
                                    : entry.lang === 'ja'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {
                                  t.vocabulary.language_labels[
                                    entry.lang as keyof typeof t.vocabulary.language_labels
                                  ]
                                }
                              </span>
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                {entry.source}
                              </span>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  entry.status === 'starred'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : entry.status === 'archived'
                                      ? 'bg-gray-100 text-gray-600'
                                      : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {
                                  t.vocabulary.status_labels[
                                    entry.status as keyof typeof t.vocabulary.status_labels
                                  ]
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
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
                    </div>

                    {/* 卡片内容 */}
                    <div className="p-3 sm:p-4">
                      {/* 上下文 */}
                      {entry.context && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-200">
                          <p className="text-sm text-gray-700 italic break-words">"{entry.context}"</p>
                        </div>
                      )}

                      {/* 解释内容 */}
                      {entry.explanation ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                            <p className="text-gray-800 font-medium break-words">
                              {entry.explanation.gloss_native}
                            </p>
                          </div>

                          {/* 词性和例句 */}
                          <div className="space-y-2">
                            {entry.explanation.pos && (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                  {t.vocabulary.vocab_card.part_of_speech}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium w-fit">
                                  {entry.explanation.pos}
                                </span>
                              </div>
                            )}

                            {Array.isArray(entry.explanation.senses) &&
                              entry.explanation.senses.length > 0 && (
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                  <div className="text-xs font-medium text-amber-700 mb-2">
                                    {t.vocabulary.vocab_card.example}
                                  </div>
                                  <div className="text-sm text-gray-700 space-y-1">
                                    <div className="font-medium break-words">
                                      {entry.explanation.senses[0].example_target}
                                    </div>
                                    <div className="text-gray-600 break-words">
                                      {entry.explanation.senses[0].example_native}
                                    </div>
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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                                entry.status === 'starred'
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                              onClick={() =>
                                updateEntryStatus(
                                  entry.id,
                                  entry.status === 'starred' ? 'new' : 'starred',
                                )
                              }
                            >
                              {entry.status === 'starred'
                                ? '⭐ ' + t.vocabulary.vocab_card.unstar
                                : '☆ ' + t.vocabulary.vocab_card.star}
                            </button>
                          </div>
                          <button
                            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors w-fit sm:w-auto"
                            onClick={() => deleteEntry(entry.id)}
                          >
                            🗑️ {t.vocabulary.vocab_card.delete}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
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

    <AnimatePresence>
      {reviewing && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
          {(() => {
            const total = reviewList.length;
            const cur = reviewList[reviewIndex];
            const progress = ((reviewIndex + 1) / total) * 100;
            
            if (!cur) {
              return (
                <div className="p-8 sm:p-16 text-center bg-gradient-to-br from-green-50 to-blue-50">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                    <span className="text-3xl sm:text-5xl">🎉</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">{t.vocabulary.messages.review_completed}</div>
                  <div className="text-gray-600 mb-8 sm:mb-10 text-base sm:text-lg">恭喜完成本次复习！</div>
                  <Button 
                    onClick={() => setReviewing(false)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-2xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  >
                    {t.vocabulary.messages.review_close}
                  </Button>
                </div>
              );
            }
            return (
              <div className="bg-white">
                {/* 顶部进度条和关闭按钮 */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-8 py-4 sm:py-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-lg sm:text-xl">📚</span>
                      </div>
                      <div className="text-white min-w-0 flex-1">
                        <div className="text-sm sm:text-base font-medium opacity-90">词汇复习</div>
                        <div className="text-lg sm:text-xl font-bold truncate">
                          {t.vocabulary.messages.review_progress.replace('{current}', (reviewIndex + 1).toString()).replace('{total}', total.toString())}
                        </div>
                      </div>
                    </div>
                    <button 
                      className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-colors duration-200 text-base sm:text-lg font-medium flex-shrink-0" 
                      onClick={() => setReviewing(false)}
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="w-full bg-white/20 rounded-full h-2 sm:h-3">
                    <div 
                      className="bg-white rounded-full h-2 sm:h-3 transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* 主要内容区域 */}
                <div className="p-4 sm:p-6 lg:p-10">
                  {/* 单词显示区域 */}
                  <div className="text-center mb-6 sm:mb-8 lg:mb-10">
                    <div className="relative">
                      <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-800 mb-4 sm:mb-6 tracking-wide break-words">
                        {cur.term}
                      </div>
                      <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white text-xs sm:text-sm font-bold">{reviewIndex + 1}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                      <span
                        className={`px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-full ${
                          cur.lang === 'en'
                            ? 'bg-blue-100 text-blue-700'
                            : cur.lang === 'ja'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {t.vocabulary.language_labels[cur.lang as 'en' | 'ja' | 'zh']}
                      </span>
                      
                      {cur.explanation?.pronunciation && (
                        <span className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm sm:text-base font-mono">
                          {cur.explanation.pronunciation}
                        </span>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => speakText(cur.term, cur.lang, cur.id)}
                        className="bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:text-gray-900 shadow-sm px-3 sm:px-4 py-2 text-sm sm:text-base font-medium"
                      >
                        <span className="mr-1 sm:mr-2">🔊</span>
                        {t.vocabulary.vocab_card.pronunciation}
                      </Button>
                    </div>
                  </div>

                  {/* 解释显示区域 */}
                  <div className="mb-6 sm:mb-8 lg:mb-10">
                    <AnimatePresence mode="wait">
                      {!showBack ? (
                        <motion.div
                          key="show-button"
                          className="text-center"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                        >
                          <motion.div
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <Button 
                              className="w-full py-4 sm:py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-lg sm:text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105" 
                              onClick={() => setShowBack(true)}
                            >
                              <span className="mr-2 sm:mr-3 text-xl sm:text-2xl">💡</span>
                              {t.vocabulary.messages.review_show_explanation}
                            </Button>
                          </motion.div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="answer"
                          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl sm:rounded-3xl border border-blue-100 p-4 sm:p-6 lg:p-8 shadow-sm"
                          initial={{ opacity: 0, rotateX: -10 }}
                          animate={{ opacity: 1, rotateX: 0 }}
                          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                        >
                        {cur.explanation?.gloss_native ? (
                          <div className="space-y-4 sm:space-y-6">
                            <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 leading-relaxed break-words">
                              {cur.explanation.gloss_native}
                            </div>
                            
                            {cur.explanation.pos && (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                                  {t.vocabulary.vocab_card.part_of_speech}
                                </span>
                                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm sm:text-base font-semibold w-fit">
                                  {cur.explanation.pos}
                                </span>
                              </div>
                            )}
                            
                            {Array.isArray(cur.explanation.senses) && cur.explanation.senses.length > 0 && (
                              <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-amber-200 shadow-sm">
                                <div className="text-sm sm:text-base font-semibold text-amber-700 mb-3 flex items-center gap-2">
                                  <span className="text-base sm:text-lg">📝</span>
                                  {t.vocabulary.messages.example_sentence_label}
                                </div>
                                <div className="text-gray-800 space-y-2">
                                  <div className="font-semibold text-lg sm:text-xl break-words">
                                    {cur.explanation.senses[0].example_target}
                                  </div>
                                  <div className="text-gray-600 text-base sm:text-lg break-words">
                                    {cur.explanation.senses[0].example_native}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8 sm:py-12">
                            <div className="text-gray-500 text-lg sm:text-xl">
                              {t.vocabulary.messages.review_no_explanation}
                            </div>
                          </div>
                        )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 评分按钮区域 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {(() => {
                      const delays = calculateButtonDelays(cur);
                      return (
                        <>
                          <Button 
                            className={`bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 min-h-[60px] sm:min-h-[80px] ${
                              clickedButton === 'again' 
                                ? 'transform scale-95 shadow-2xl ring-4 ring-red-300 ring-opacity-50' 
                                : 'transform hover:scale-105'
                            } ${isTransitioning ? 'pointer-events-none' : ''}`}
                            onClick={() => answerReview('again')}
                            disabled={isTransitioning}
                          >
                            <div className="text-center w-full">
                              <div className="text-sm sm:text-base font-bold mb-1 flex items-center justify-center gap-1">
                                <span className={`text-base sm:text-lg transition-transform duration-200 ${clickedButton === 'again' ? 'scale-125' : ''}`}>✕</span>
                                <span className="truncate">{t.vocabulary.messages.review_again}</span>
                              </div>
                              <div className="text-xs opacity-90">
                                {delays.again === 1 ? t.vocabulary.messages.review_tomorrow : t.vocabulary.messages.review_days_later.replace('{days}', delays.again.toString())}
                              </div>
                              {clickedButton === 'again' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                            </div>
                          </Button>
                          
                          <Button 
                            className={`bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 min-h-[60px] sm:min-h-[80px] ${
                              clickedButton === 'hard' 
                                ? 'transform scale-95 shadow-2xl ring-4 ring-orange-300 ring-opacity-50' 
                                : 'transform hover:scale-105'
                            } ${isTransitioning ? 'pointer-events-none' : ''}`}
                            onClick={() => answerReview('hard')}
                            disabled={isTransitioning}
                          >
                            <div className="text-center w-full">
                              <div className="text-sm sm:text-base font-bold mb-1 flex items-center justify-center gap-1">
                                <span className={`text-base sm:text-lg transition-transform duration-200 ${clickedButton === 'hard' ? 'scale-125' : ''}`}>😰</span>
                                <span className="truncate">{t.vocabulary.messages.review_hard}</span>
                              </div>
                              <div className="text-xs opacity-90">
                                {delays.hard === 1 ? t.vocabulary.messages.review_tomorrow : t.vocabulary.messages.review_days_later.replace('{days}', delays.hard.toString())}
                              </div>
                              {clickedButton === 'hard' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                            </div>
                          </Button>
                          
                          <Button 
                            className={`bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 min-h-[60px] sm:min-h-[80px] ${
                              clickedButton === 'good' 
                                ? 'transform scale-95 shadow-2xl ring-4 ring-blue-300 ring-opacity-50' 
                                : 'transform hover:scale-105'
                            } ${isTransitioning ? 'pointer-events-none' : ''}`}
                            onClick={() => answerReview('good')}
                            disabled={isTransitioning}
                          >
                            <div className="text-center w-full">
                              <div className="text-sm sm:text-base font-bold mb-1 flex items-center justify-center gap-1">
                                <span className={`text-base sm:text-lg transition-transform duration-200 ${clickedButton === 'good' ? 'scale-125' : ''}`}>😊</span>
                                <span className="truncate">{t.vocabulary.messages.review_good}</span>
                              </div>
                              <div className="text-xs opacity-90">
                                {delays.good === 1 ? t.vocabulary.messages.review_tomorrow : t.vocabulary.messages.review_days_later.replace('{days}', delays.good.toString())}
                              </div>
                              {clickedButton === 'good' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                            </div>
                          </Button>
                          
                          <Button 
                            className={`bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 min-h-[60px] sm:min-h-[80px] ${
                              clickedButton === 'easy' 
                                ? 'transform scale-95 shadow-2xl ring-4 ring-green-300 ring-opacity-50' 
                                : 'transform hover:scale-105'
                            } ${isTransitioning ? 'pointer-events-none' : ''}`}
                            onClick={() => answerReview('easy')}
                            disabled={isTransitioning}
                          >
                            <div className="text-center w-full">
                              <div className="text-sm sm:text-base font-bold mb-1 flex items-center justify-center gap-1">
                                <span className={`text-base sm:text-lg transition-transform duration-200 ${clickedButton === 'easy' ? 'scale-125' : ''}`}>😎</span>
                                <span className="truncate">{t.vocabulary.messages.review_easy}</span>
                              </div>
                              <div className="text-xs opacity-90">
                                {delays.easy === 1 ? t.vocabulary.messages.review_tomorrow : t.vocabulary.messages.review_days_later.replace('{days}', delays.easy.toString())}
                              </div>
                              {clickedButton === 'easy' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                            </div>
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>);
}
