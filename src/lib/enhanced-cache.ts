/**
 * 增强版缓存管理系统
 * 支持三层缓存 + 304 条件请求
 */

import { createHash } from 'crypto';

interface CacheEntry<T> {
  value: T;
  expires: number;
  created: number;
  etag: string;
}

interface ETagResponse {
  data: unknown;
  etag: string;
  shouldReturn304: boolean;
}

class EnhancedMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 2000;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  get<T>(key: string): { value: T; etag: string } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return { value: entry.value as T, etag: entry.etag };
  }

  set<T>(key: string, value: T, ttlSeconds = 300): string {
    // 生成 ETag
    const etag = this.generateETag(value);

    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expires: now + ttlSeconds * 1000,
      created: now,
      etag,
    });

    return etag;
  }

  private generateETag<T>(value: T): string {
    const content = JSON.stringify(value);
    return `"${createHash('sha1').update(content).digest('hex')}"`;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    const values = Array.from(this.cache.values());
    for (const entry of values) {
      if (now > entry.expires) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      maxSize: this.maxSize,
    };
  }
}

// 全局增强缓存实例
const enhancedCache = new EnhancedMemoryCache();

export class EnhancedCacheManager {
  private static requestCache = new Map<string, Promise<unknown>>();

  /**
   * 检查 ETag 并决定是否返回 304
   */
  static checkETag<T>(key: string, clientETag?: string): ETagResponse {
    const cached = enhancedCache.get<T>(key);

    if (!cached) {
      return { data: null, etag: '', shouldReturn304: false };
    }

    // 如果客户端提供了 ETag 且匹配，返回 304
    if (clientETag && clientETag === cached.etag) {
      return { data: cached.value, etag: cached.etag, shouldReturn304: true };
    }

    return { data: cached.value, etag: cached.etag, shouldReturn304: false };
  }

  /**
   * 获取缓存值（带 ETag 支持）
   */
  static async getWithETag<T>(key: string): Promise<{ value: T; etag: string } | null> {
    try {
      return enhancedCache.get<T>(key);
    } catch (error) {
      console.error('Enhanced cache get error:', error);
      return null;
    }
  }

  /**
   * 设置缓存值（自动生成 ETag）
   */
  static async setWithETag<T>(key: string, value: T, ttlSeconds = 300): Promise<string> {
    try {
      return enhancedCache.set(key, value, ttlSeconds);
    } catch (error) {
      console.error('Enhanced cache set error:', error);
      return '';
    }
  }

  /**
   * 请求去重 + ETag 支持
   */
  static async dedupeWithETag<T>(
    key: string,
    fetcher: () => Promise<T>,
    clientETag?: string | null,
    ttlSeconds = 300,
  ): Promise<ETagResponse> {
    // 首先检查缓存和 ETag
    const etagCheck = this.checkETag<T>(key, clientETag ?? undefined);
    if (etagCheck.data !== null) {
      return etagCheck;
    }

    // 检查是否有正在进行的请求
    if (this.requestCache.has(key)) {
      const data = await this.requestCache.get(key)!;
      const etag = await this.setWithETag(key, data, ttlSeconds);
      return { data, etag, shouldReturn304: false };
    }

    // 创建新请求
    const promise = fetcher().finally(() => {
      this.requestCache.delete(key);
    });

    this.requestCache.set(key, promise);

    try {
      const data = await promise;
      const etag = await this.setWithETag(key, data, ttlSeconds);
      return { data, etag, shouldReturn304: false };
    } catch (error) {
      this.requestCache.delete(key);
      throw error;
    }
  }

  /**
   * 生成缓存键
   */
  static generateKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * 批量删除缓存（支持通配符）
   */
  static async invalidate(pattern: string): Promise<void> {
    try {
      const keys = Array.from(enhancedCache['cache'].keys());
      const matchingKeys = keys.filter((key) => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(key);
        }
        return key.includes(pattern);
      });

      for (const key of matchingKeys) {
        enhancedCache.delete(key);
      }

      console.log(`缓存失效：删除了 ${matchingKeys.length} 个匹配模式 "${pattern}" 的缓存条目`);
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  static getStats() {
    return {
      memory: enhancedCache.getStats(),
      pendingRequests: this.requestCache.size,
    };
  }

  /**
   * 清理所有缓存
   */
  static async clear(): Promise<void> {
    try {
      enhancedCache.clear();
      this.requestCache.clear();
      console.log('所有缓存已清空');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

/**
 * 条件请求装饰器
 * 自动处理 ETag 和 304 响应
 */
export function withConditionalCache(ttlSeconds = 300) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (request: Request, ...args: unknown[]) {
      // 提取缓存键参数
      const url = new URL(request.url);
      const searchParams = Object.fromEntries(url.searchParams.entries());
      const cacheKey = EnhancedCacheManager.generateKey(
        `${(target as { constructor: { name: string } }).constructor.name}:${propertyName}`,
        searchParams,
      );

      // 获取客户端 ETag
      const clientETag = request.headers.get('if-none-match');

      try {
        // 使用增强缓存管理器
        const result = await EnhancedCacheManager.dedupeWithETag(
          cacheKey,
          () => method.apply(this, [request, ...args]) as Promise<unknown>,
          clientETag,
          ttlSeconds,
        );

        // 如果应该返回 304
        if (result.shouldReturn304) {
          return new Response(null, {
            status: 304,
            headers: {
              ETag: result.etag,
              'Cache-Control': `public, max-age=${ttlSeconds}`,
            },
          });
        }

        // 返回正常响应带 ETag
        return new Response(JSON.stringify(result.data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ETag: result.etag,
            'Cache-Control': `public, max-age=${Math.min(ttlSeconds, 60)}, s-maxage=${ttlSeconds}`,
          },
        });
      } catch (error) {
        console.error(`Conditional cache error for ${cacheKey}:`, error);
        // 降级到原始方法
        return method.apply(this, [request, ...args]);
      }
    };
  };
}

// 导出增强缓存实例
export { enhancedCache };
