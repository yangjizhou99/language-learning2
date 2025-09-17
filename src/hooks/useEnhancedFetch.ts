/**
 * 增强版数据获取钩子
 * 支持去重、stale-while-revalidate、ETag 条件请求
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface FetchOptions {
  dedupe?: boolean; // 去重
  staleTime?: number; // stale time (ms)
  cacheTime?: number; // cache time (ms)
  revalidateOnFocus?: boolean; // 聚焦时重新验证
  retryCount?: number; // 重试次数
}

interface CacheEntry<T> {
  data: T;
  error: any;
  timestamp: number;
  etag?: string;
  isStale: boolean;
}

interface FetchState<T> {
  data: T | null;
  error: any;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => Promise<void>;
}

class EnhancedFetchCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inflightRequests = new Map<string, Promise<any>>();
  private subscribers = new Map<string, Set<() => void>>();

  // 获取缓存
  get<T>(key: string): CacheEntry<T> | null {
    return this.cache.get(key) || null;
  }

  // 设置缓存
  set<T>(key: string, data: T, error: any = null, etag?: string): void {
    this.cache.set(key, {
      data,
      error,
      timestamp: Date.now(),
      etag,
      isStale: false
    });
    this.notify(key);
  }

  // 标记为过期
  markStale(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.isStale = true;
      this.cache.set(key, entry);
      this.notify(key);
    }
  }

  // 检查是否过期
  isStale(key: string, staleTime: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return entry.isStale || (Date.now() - entry.timestamp > staleTime);
  }

  // 检查缓存是否过期
  isExpired(key: string, cacheTime: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > cacheTime;
  }

  // 获取或创建进行中的请求
  getInflightRequest<T>(key: string): Promise<T> | null {
    return this.inflightRequests.get(key) || null;
  }

  setInflightRequest<T>(key: string, promise: Promise<T>): void {
    this.inflightRequests.set(key, promise);
    promise.finally(() => {
      this.inflightRequests.delete(key);
    });
  }

  // 订阅缓存变化
  subscribe(key: string, callback: () => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  // 通知订阅者
  private notify(key: string): void {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    const maxCacheTime = 24 * 60 * 60 * 1000; // 24小时

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > maxCacheTime) {
        this.cache.delete(key);
      }
    }
  }
}

// 全局缓存实例
const fetchCache = new EnhancedFetchCache();

// 定期清理缓存
setInterval(() => {
  fetchCache.cleanup();
}, 10 * 60 * 1000); // 每10分钟清理一次

// 默认选项
const defaultOptions: FetchOptions = {
  dedupe: true,
  staleTime: 60 * 1000, // 1分钟
  cacheTime: 5 * 60 * 1000, // 5分钟
  revalidateOnFocus: true,
  retryCount: 3
};

export function useEnhancedFetch<T>(
  url: string | null,
  options: FetchOptions = {}
): FetchState<T> {
  const opts = { ...defaultOptions, ...options };
  const [state, setState] = useState<Omit<FetchState<T>, 'mutate'>>({
    data: null,
    error: null,
    isLoading: false,
    isValidating: false
  });

  const retryCountRef = useRef(0);

  // 执行请求
  const fetchData = useCallback(async (
    revalidate = false, 
    force = false
  ): Promise<void> => {
    if (!url) return;

    const cacheKey = url;
    const cached = fetchCache.get<T>(cacheKey);

    // 如果不是强制刷新且有缓存数据
    if (!force && cached && !fetchCache.isExpired(cacheKey, opts.cacheTime!)) {
      setState(prev => ({
        ...prev,
        data: cached.data,
        error: cached.error,
        isLoading: false
      }));

      // 如果数据是新鲜的，直接返回
      if (!revalidate && !fetchCache.isStale(cacheKey, opts.staleTime!)) {
        return;
      }
    }

    // 检查去重
    if (opts.dedupe) {
      const inflightRequest = fetchCache.getInflightRequest<T>(cacheKey);
      if (inflightRequest) {
        try {
          const result = await inflightRequest;
          setState(prev => ({
            ...prev,
            data: result,
            error: null,
            isLoading: false,
            isValidating: false
          }));
        } catch (error) {
          setState(prev => ({
            ...prev,
            error,
            isLoading: false,
            isValidating: false
          }));
        }
        return;
      }
    }

    // 设置加载状态
    setState(prev => ({
      ...prev,
      isLoading: !cached?.data,
      isValidating: true
    }));

    const requestPromise = (async () => {
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };

        // 添加 ETag 支持
        if (cached?.etag && !force) {
          headers['If-None-Match'] = cached.etag;
        }

        const response = await fetch(url, { headers });

        // 处理 304 Not Modified
        if (response.status === 304) {
          if (cached) {
            // 更新时间戳但保持数据
            fetchCache.set(cacheKey, cached.data, cached.error, cached.etag);
            setState(prev => ({
              ...prev,
              data: cached.data,
              error: cached.error,
              isLoading: false,
              isValidating: false
            }));
          }
          return cached?.data;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const etag = response.headers.get('ETag') || undefined;

        // 更新缓存
        fetchCache.set(cacheKey, data, null, etag);
        retryCountRef.current = 0; // 重置重试计数

        setState(prev => ({
          ...prev,
          data,
          error: null,
          isLoading: false,
          isValidating: false
        }));

        return data;
      } catch (error) {
        console.error(`Fetch error for ${url}:`, error);

        // 重试逻辑
        if (retryCountRef.current < opts.retryCount!) {
          retryCountRef.current++;
          const delay = Math.pow(2, retryCountRef.current) * 1000; // 指数退避
          setTimeout(() => fetchData(revalidate, force), delay);
          return;
        }

        // 如果有缓存数据，继续使用（容错）
        if (cached?.data) {
          fetchCache.set(cacheKey, cached.data, error, cached.etag);
          setState(prev => ({
            ...prev,
            data: cached.data,
            error,
            isLoading: false,
            isValidating: false
          }));
        } else {
          // 没有缓存数据，显示错误
          fetchCache.set(cacheKey, null, error);
          setState(prev => ({
            ...prev,
            data: null,
            error,
            isLoading: false,
            isValidating: false
          }));
        }

        throw error;
      }
    })();

    if (opts.dedupe) {
      fetchCache.setInflightRequest(cacheKey, requestPromise);
    }

    await requestPromise;
  }, [url, opts.dedupe, opts.staleTime, opts.cacheTime, opts.retryCount]);

  // 手动重新验证
  const mutate = useCallback(async (): Promise<void> => {
    await fetchData(false, true);
  }, [fetchData]);

  // 监听缓存变化
  useEffect(() => {
    if (!url) return;

    const unsubscribe = fetchCache.subscribe(url, () => {
      const cached = fetchCache.get<T>(url);
      if (cached) {
        setState(prev => ({
          ...prev,
          data: cached.data,
          error: cached.error
        }));
      }
    });

    return unsubscribe;
  }, [url]);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 窗口聚焦时重新验证
  useEffect(() => {
    if (!opts.revalidateOnFocus || !url) return;

    const handleFocus = () => {
      const cacheKey = url;
      if (fetchCache.isStale(cacheKey, opts.staleTime!)) {
        fetchData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [url, opts.revalidateOnFocus, opts.staleTime, fetchData]);

  return {
    ...state,
    mutate
  };
}

// 缓存管理工具
export const cacheManager = {
  // 手动失效缓存
  invalidate: (pattern: string) => {
    // 简单通配符匹配实现
    const keys = Array.from(fetchCache['cache'].keys());
    const matchingKeys = keys.filter(key => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(key);
      }
      return key.includes(pattern);
    });

    matchingKeys.forEach(key => {
      fetchCache['cache'].delete(key);
    });

    console.log(`失效了 ${matchingKeys.length} 个缓存条目`);
  },

  // 预加载数据
  prefetch: async <T>(url: string): Promise<T | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const etag = response.headers.get('ETag') || undefined;
      
      fetchCache.set(url, data, null, etag);
      return data;
    } catch (error) {
      console.error('Prefetch error:', error);
      return null;
    }
  },

  // 获取缓存统计
  getStats: () => {
    const cacheSize = fetchCache['cache'].size;
    const inflightSize = fetchCache['inflightRequests'].size;
    const subscriberSize = fetchCache['subscribers'].size;

    return {
      cacheSize,
      inflightSize,
      subscriberSize
    };
  }
};

export default useEnhancedFetch;
