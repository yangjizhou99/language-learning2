/**
 * 优化的Supabase客户端配置
 * 包含连接池、重试机制和性能监控
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 连接池配置
const connectionConfig = {
  auth: { 
    persistSession: true, 
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'language-learning-app',
      'X-Client-Version': '1.0.0',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
};

// 重试配置
const retryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoff: 2,
};

/**
 * 带重试机制的Supabase客户端包装器
 */
class RetryableSupabaseClient {
  private client: SupabaseClient;
  private maxRetries: number;
  private retryDelay: number;
  private retryBackoff: number;

  constructor(
    client: SupabaseClient,
    options: typeof retryConfig = retryConfig
  ) {
    this.client = client;
    this.maxRetries = options.maxRetries;
    this.retryDelay = options.retryDelay;
    this.retryBackoff = options.retryBackoff;
  }

  /**
   * 执行带重试的查询
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const startTime = performance.now();
        const result = await operation();
        const duration = performance.now() - startTime;

        // 记录性能指标
        if (duration > 1000) {
          console.warn(`慢查询警告: ${operationName} 耗时 ${duration.toFixed(2)}ms`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === this.maxRetries) {
          console.error(`操作失败: ${operationName}`, error);
          throw error;
        }

        // 计算重试延迟
        const delay = this.retryDelay * Math.pow(this.retryBackoff, attempt);
        console.warn(`操作重试: ${operationName} (尝试 ${attempt + 1}/${this.maxRetries + 1}), ${delay}ms后重试`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * 获取原始客户端
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * 代理所有客户端方法
   */
  get from() {
    return this.client.from.bind(this.client);
  }

  get auth() {
    return this.client.auth;
  }

  get storage() {
    return this.client.storage;
  }

  get realtime() {
    return this.client.realtime;
  }

  get rpc() {
    return this.client.rpc.bind(this.client);
  }
}

/**
 * 创建优化的客户端实例
 */
function createOptimizedClient(
  url: string,
  key: string,
  options: any = {}
): RetryableSupabaseClient {
  const client = createClient(url, key, {
    ...connectionConfig,
    ...options,
  });

  return new RetryableSupabaseClient(client);
}

/**
 * 客户端实例
 */
export const supabase = createOptimizedClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * 服务端客户端（用于API路由）
 */
export function getServiceSupabase(): RetryableSupabaseClient {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      ...connectionConfig,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  return new RetryableSupabaseClient(client);
}

/**
 * 服务端客户端（用于SSR）
 */
export async function getServerSupabase(): Promise<RetryableSupabaseClient> {
  const cookieStore = await cookies();
  
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { 
          return cookieStore.get(name)?.value; 
        },
        set() {},
        remove() {},
      },
    }
  );

  return new RetryableSupabaseClient(client);
}

/**
 * 带认证头的客户端（用于API调用）
 */
export function getAuthenticatedClient(authHeader: string): RetryableSupabaseClient {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...connectionConfig,
      auth: { 
        persistSession: false, 
        autoRefreshToken: false 
      },
      global: { 
        headers: { 
          Authorization: authHeader,
          ...connectionConfig.global.headers
        } 
      }
    }
  );

  return new RetryableSupabaseClient(client);
}

/**
 * 性能监控装饰器
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = performance.now();
    
    try {
      const result = await fn(...args);
      const duration = performance.now() - startTime;
      
      // 记录成功操作的性能
      if (duration > 500) {
        console.log(`性能监控: ${operationName} 耗时 ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`性能监控: ${operationName} 失败，耗时 ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  };
}

/**
 * 批量操作工具
 */
export class BatchOperations {
  private client: RetryableSupabaseClient;
  private batchSize: number;
  private delay: number;

  constructor(
    client: RetryableSupabaseClient,
    batchSize: number = 100,
    delay: number = 100
  ) {
    this.client = client;
    this.batchSize = batchSize;
    this.delay = delay;
  }

  /**
   * 批量插入
   */
  async batchInsert<T>(
    table: string,
    records: Partial<T>[],
    options: { 
      batchSize?: number;
      delay?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || this.batchSize;
    const delay = options.delay || this.delay;
    const results: T[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const result = await this.client.withRetry(async () => {
        const { data, error } = await this.client
          .getClient()
          .from(table)
          .insert(batch)
          .select();

        if (error) {
          throw new Error(`批量插入失败: ${error.message}`);
        }

        return data || [];
      }, `batchInsert-${table}`);

      results.push(...result);
      
      // 进度回调
      options.onProgress?.(Math.min(i + batchSize, records.length), records.length);
      
      // 批次间延迟
      if (i + batchSize < records.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * 批量更新
   */
  async batchUpdate<T>(
    table: string,
    updates: Array<{ id: string; data: Partial<T> }>,
    options: { 
      batchSize?: number;
      delay?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || this.batchSize;
    const delay = options.delay || this.delay;
    const results: T[] = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const promises = batch.map(({ id, data }) =>
        this.client.withRetry(async () => {
          const { data: result, error } = await this.client
            .getClient()
            .from(table)
            .update(data)
            .eq('id', id)
            .select()
            .single();

          if (error) {
            throw new Error(`更新失败: ${error.message}`);
          }

          return result;
        }, `batchUpdate-${table}-${id}`)
      );

      const responses = await Promise.allSettled(promises);
      
      responses.forEach((response) => {
        if (response.status === 'fulfilled') {
          results.push(response.value);
        } else {
          console.error('批量更新失败:', response.reason);
        }
      });
      
      // 进度回调
      options.onProgress?.(Math.min(i + batchSize, updates.length), updates.length);
      
      // 批次间延迟
      if (i + batchSize < updates.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }
}

/**
 * 导出工具函数
 */
export { createOptimizedClient, RetryableSupabaseClient };
